import { create } from 'zustand'

const USER_KEY = 'sharky-user-v1'
const SESSION_KEY = 'sharky-session-v1'
const ITERATIONS = 120_000

interface StoredUser {
  name: string
  email: string
  salt: string
  passwordHash: string
}

export interface AuthUser {
  name: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  hasAccount: boolean
  register: (fields: { name: string; email: string; password: string }) => Promise<void>
  login: (fields: { email: string; password: string }) => Promise<void>
  logout: () => void
}

const encoder = new TextEncoder()

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const saltBuffer = Uint8Array.from(salt).buffer
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations: ITERATIONS }, key, 256)
  return bytesToBase64(new Uint8Array(bits))
}

function readUser(): StoredUser | null {
  try {
    const value = localStorage.getItem(USER_KEY)
    return value ? JSON.parse(value) as StoredUser : null
  } catch {
    return null
  }
}

function readSession(): AuthUser | null {
  const stored = readUser()
  return stored && sessionStorage.getItem(SESSION_KEY) === stored.email
    ? { name: stored.name, email: stored.email }
    : null
}

export const useAuth = create<AuthState>((set) => ({
  user: readSession(),
  hasAccount: !!readUser(),

  register: async ({ name, email, password }) => {
    if (readUser()) throw new Error('Ya existe un usuario registrado en este dispositivo.')
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const normalizedEmail = email.trim().toLowerCase()
    const stored: StoredUser = {
      name: name.trim(),
      email: normalizedEmail,
      salt: bytesToBase64(salt),
      passwordHash: await hashPassword(password, salt),
    }
    localStorage.setItem(USER_KEY, JSON.stringify(stored))
    sessionStorage.setItem(SESSION_KEY, stored.email)
    set({ user: { name: stored.name, email: stored.email }, hasAccount: true })
  },

  login: async ({ email, password }) => {
    const stored = readUser()
    const normalizedEmail = email.trim().toLowerCase()
    if (!stored || stored.email !== normalizedEmail) throw new Error('Correo o contraseña incorrectos.')
    const passwordHash = await hashPassword(password, base64ToBytes(stored.salt))
    if (passwordHash !== stored.passwordHash) throw new Error('Correo o contraseña incorrectos.')
    sessionStorage.setItem(SESSION_KEY, stored.email)
    set({ user: { name: stored.name, email: stored.email } })
  },

  logout: () => {
    sessionStorage.removeItem(SESSION_KEY)
    set({ user: null })
  },
}))
