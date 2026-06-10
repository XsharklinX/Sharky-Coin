import { isTauri } from '@/hooks/useTauri'
import { decryptSecure, encryptSecure, isAndroidTauri, type SecureBlob } from '@/lib/secureBlob'

interface AuthStorage {
  getItem: (key: string) => Promise<string | null> | string | null
  setItem: (key: string, value: string) => Promise<void> | void
  removeItem: (key: string) => Promise<void> | void
}

async function tauriInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

const memoryStorage = new Map<string, string>()
const hasBrowserStorage = typeof localStorage !== 'undefined'
  && typeof localStorage.getItem === 'function'
  && typeof localStorage.setItem === 'function'
  && typeof localStorage.removeItem === 'function'

const browserStorage: AuthStorage = {
  getItem: key => hasBrowserStorage ? localStorage.getItem(key) : memoryStorage.get(key) ?? null,
  setItem: (key, value) => {
    if (hasBrowserStorage) localStorage.setItem(key, value)
    else memoryStorage.set(key, value)
  },
  removeItem: key => {
    if (hasBrowserStorage) localStorage.removeItem(key)
    else memoryStorage.delete(key)
  },
}

const tauriCredentialStorage: AuthStorage = {
  getItem: key => tauriInvoke<string | null>('secure_storage_get', { key }),
  setItem: (key, value) => tauriInvoke<void>('secure_storage_set', { key, value }),
  removeItem: key => tauriInvoke<void>('secure_storage_remove', { key }),
}

// El crate `keyring` solo trae backend nativo para Windows (ver Cargo.toml,
// feature "windows-native"). En Android no hay backend de `keyring`, así que
// secure_storage_get/set se reemplazan por almacenamiento cifrado con
// Android Keystore (ver src/lib/secureBlob.ts).
const SECURE_PREFIX = 'sb-secure-'

const androidKeystoreStorage: AuthStorage = {
  getItem: async (key) => {
    const raw = hasBrowserStorage ? localStorage.getItem(SECURE_PREFIX + key) : null
    if (!raw) return null
    try {
      return await decryptSecure(JSON.parse(raw) as SecureBlob)
    } catch {
      return null
    }
  },
  setItem: async (key, value) => {
    const blob = await encryptSecure(value)
    if (blob && hasBrowserStorage) localStorage.setItem(SECURE_PREFIX + key, JSON.stringify(blob))
  },
  removeItem: (key) => {
    if (hasBrowserStorage) localStorage.removeItem(SECURE_PREFIX + key)
  },
}

export const usesNativeCredentialStorage = isTauri()

if (usesNativeCredentialStorage && hasBrowserStorage) {
  Object.keys(localStorage)
    .filter(key => /^sb-.*-auth-token(?:-code-verifier)?$/.test(key))
    .forEach(key => localStorage.removeItem(key))
}

export const secureAuthStorage: AuthStorage = isAndroidTauri()
  ? androidKeystoreStorage
  : usesNativeCredentialStorage
    ? tauriCredentialStorage
    : browserStorage
