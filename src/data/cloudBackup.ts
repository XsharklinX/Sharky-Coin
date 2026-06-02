import { create } from 'zustand'
import { createBackup, parseBackup } from '@/data/backup'
import { recordAuditEvent } from '@/data/audit'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useFinance } from '@/store/finance'

interface EncryptedEnvelope {
  version: 1
  algorithm: 'AES-GCM'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

export interface CloudBackupVersion {
  path: string
  createdAt: string
}

interface CloudBackupState {
  unlocked: boolean
  busy: boolean
  versions: CloudBackupVersion[]
  error?: string
  unlock: (passphrase: string) => void
  lock: () => void
  refresh: () => Promise<void>
  createNow: () => Promise<void>
  restore: (path: string) => Promise<void>
}

const BUCKET = 'encrypted-backups'
const ITERATIONS = 250_000
const RETENTION = 10
const AUTO_BACKUP_INTERVAL_MS = 10 * 60 * 1000
const encoder = new TextEncoder()
const decoder = new TextDecoder()
let sessionPassphrase = ''

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: Uint8Array.from(salt).buffer,
    iterations: ITERATIONS,
  }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptCloudBackupPayload(value: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value))
  const envelope: EncryptedEnvelope = {
    version: 1,
    algorithm: 'AES-GCM',
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
  return JSON.stringify(envelope)
}

export async function decryptCloudBackupPayload(value: string, passphrase: string): Promise<string> {
  let envelope: EncryptedEnvelope
  try {
    envelope = JSON.parse(value) as EncryptedEnvelope
  } catch {
    throw new Error('El backup cifrado está corrupto.')
  }
  if (envelope.version !== 1 || envelope.algorithm !== 'AES-GCM' || envelope.iterations !== ITERATIONS) {
    throw new Error('El formato del backup cifrado no es compatible.')
  }
  try {
    const key = await deriveKey(passphrase, base64ToBytes(envelope.salt))
    const iv = Uint8Array.from(base64ToBytes(envelope.iv))
    const ciphertext = Uint8Array.from(base64ToBytes(envelope.ciphertext))
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return decoder.decode(clear)
  } catch {
    throw new Error('La frase secreta no es correcta o el backup está dañado.')
  }
}

function requireCloudUser(): string {
  const user = useAuth.getState().user
  if (!supabase || user?.mode !== 'cloud' || !user.id) throw new Error('Inicia sesión con una cuenta cloud.')
  return user.id
}

function requirePassphrase(): string {
  if (!sessionPassphrase) throw new Error('Desbloquea los backups con tu frase secreta.')
  return sessionPassphrase
}

async function listVersions(userId = requireCloudUser()): Promise<CloudBackupVersion[]> {
  if (!supabase) return []
  const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 100, sortBy: { column: 'name', order: 'desc' } })
  if (error) throw new Error(error.message)
  return data
    .filter(file => file.name.endsWith('.sharky.enc'))
    .map(file => ({ path: `${userId}/${file.name}`, createdAt: file.created_at ?? file.updated_at ?? new Date().toISOString() }))
}

async function createVersion(automatic = false): Promise<void> {
  const userId = requireCloudUser()
  const encrypted = await encryptCloudBackupPayload(JSON.stringify(createBackup(useFinance.getState())), requirePassphrase())
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}.sharky.enc`
  if (!supabase) return
  const { error } = await supabase.storage.from(BUCKET).upload(`${userId}/${name}`, new Blob([encrypted], { type: 'application/octet-stream' }))
  if (error) throw new Error(error.message)

  const versions = await listVersions(userId)
  const stale = versions.slice(RETENTION)
  if (stale.length) await supabase.storage.from(BUCKET).remove(stale.map(version => version.path))
  localStorage.setItem(`sharky-cloud-backup-last-v1:${userId}`, new Date().toISOString())
  recordAuditEvent('backup', automatic ? 'Backup cloud automático cifrado' : 'Backup cloud cifrado creado')
}

export async function maybeCreateAutoCloudBackup(): Promise<void> {
  const user = useAuth.getState().user
  if (!sessionPassphrase || user?.mode !== 'cloud' || !user.id) return
  const last = localStorage.getItem(`sharky-cloud-backup-last-v1:${user.id}`)
  if (last && Date.now() - Date.parse(last) < AUTO_BACKUP_INTERVAL_MS) return
  await createVersion(true)
  await useCloudBackup.getState().refresh()
}

export const useCloudBackup = create<CloudBackupState>((set) => ({
  unlocked: false,
  busy: false,
  versions: [],

  unlock: (passphrase) => {
    if (passphrase.trim().length < 10) throw new Error('Usa una frase secreta de al menos 10 caracteres.')
    sessionPassphrase = passphrase
    set({ unlocked: true, error: undefined })
  },

  lock: () => {
    sessionPassphrase = ''
    set({ unlocked: false })
  },

  refresh: async () => {
    set({ busy: true, error: undefined })
    try {
      set({ versions: await listVersions(), busy: false })
    } catch (cause) {
      set({ busy: false, error: cause instanceof Error ? cause.message : 'No se pudieron listar los backups.' })
      throw cause
    }
  },

  createNow: async () => {
    set({ busy: true, error: undefined })
    try {
      await createVersion()
      set({ versions: await listVersions(), busy: false })
    } catch (cause) {
      set({ busy: false, error: cause instanceof Error ? cause.message : 'No se pudo crear el backup.' })
      throw cause
    }
  },

  restore: async (path) => {
    set({ busy: true, error: undefined })
    try {
      if (!supabase) throw new Error('La conexión cloud no está configurada.')
      const { data, error } = await supabase.storage.from(BUCKET).download(path)
      if (error) throw new Error(error.message)
      useFinance.getState().restoreBackup(parseBackup(await decryptCloudBackupPayload(await data.text(), requirePassphrase())))
      recordAuditEvent('recovery', 'Backup cloud cifrado restaurado')
      set({ busy: false })
    } catch (cause) {
      set({ busy: false, error: cause instanceof Error ? cause.message : 'No se pudo restaurar el backup.' })
      throw cause
    }
  },
}))
