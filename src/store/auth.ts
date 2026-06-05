import { create } from 'zustand'
import { recordAuditEvent } from '@/data/audit'
import { getAuthRedirectUrl } from '@/lib/authRedirect'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { isTauri } from '@/hooks/useTauri'

const LOCAL_USER_KEY = 'sharky-user-v1'
const LOCAL_SESSION_KEY = 'sharky-session-v1'
const ITERATIONS = 120_000

interface StoredLocalUser {
  name: string
  email: string
  salt: string
  passwordHash: string
}

export interface AuthUser {
  id?: string
  name: string
  email: string
  mode: 'cloud' | 'local'
}

interface AuthState {
  user: AuthUser | null
  initialized: boolean
  recoveryMode: boolean
  hasLocalAccount: boolean
  cloudAvailable: boolean
  initialize: () => Promise<void>
  registerCloud: (fields: { name: string; email: string; password: string }) => Promise<'authenticated' | 'confirm-email'>
  loginCloud: (fields: { email: string; password: string }) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  registerLocal: (fields: { name: string; email: string; password: string }) => Promise<void>
  loginLocal: (fields: { email: string; password: string }) => Promise<void>
  logout: (scope?: 'local' | 'global') => Promise<void>
}

const encoder = new TextEncoder()
let authListenerAttached = false
let deepLinkListenerAttached = false
let desktopDeepLinkConsumed = false

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: Uint8Array.from(salt).buffer,
    iterations: ITERATIONS,
  }, key, 256)
  return bytesToBase64(new Uint8Array(bits))
}

function readLocalUser(): StoredLocalUser | null {
  try {
    const value = localStorage.getItem(LOCAL_USER_KEY)
    return value ? JSON.parse(value) as StoredLocalUser : null
  } catch {
    return null
  }
}

function readLocalSession(): AuthUser | null {
  const stored = readLocalUser()
  return stored && sessionStorage.getItem(LOCAL_SESSION_KEY) === stored.email
    ? { name: stored.name, email: stored.email, mode: 'local' }
    : null
}

function mapCloudUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AuthUser {
  const email = user.email ?? ''
  const displayName = user.user_metadata?.display_name
  return {
    id: user.id,
    name: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : email.split('@')[0],
    email,
    mode: 'cloud',
  }
}

function requireSupabase() {
  if (!supabase) throw new Error('La conexión cloud no está configurada en este dispositivo.')
  return supabase
}

async function handleAuthCallbackUrls(urls: string[] | null | undefined): Promise<boolean> {
  if (!supabase || !urls?.length) return false
  const callback = urls.find(url => url.startsWith('sharky://auth/callback'))
  if (!callback) return false
  const code = new URL(callback).searchParams.get('code')
  if (!code) return false
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) throw new Error(error.message)
  return true
}

async function consumeInitialAuthDeepLink(): Promise<void> {
  if (!supabase || !isTauri() || desktopDeepLinkConsumed) return
  desktopDeepLinkConsumed = true
  const { getCurrent } = await import('@tauri-apps/plugin-deep-link')
  await handleAuthCallbackUrls(await getCurrent())
}

async function attachRuntimeDeepLinkListener(setUser: (user: AuthUser) => void): Promise<void> {
  if (!supabase || !isTauri() || deepLinkListenerAttached) return
  deepLinkListenerAttached = true
  const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
  await onOpenUrl(async urls => {
    try {
      const handled = await handleAuthCallbackUrls(urls)
      if (!handled) return
      const { data, error } = await supabase!.auth.getSession()
      if (error) throw new Error(error.message)
      if (data.session?.user) setUser(mapCloudUser(data.session.user))
    } catch (error) {
      console.error('No se pudo completar el enlace de autenticación.', error)
    }
  })
}

export const useAuth = create<AuthState>((set, get) => ({
  user: readLocalSession(),
  initialized: false,
  recoveryMode: false,
  hasLocalAccount: !!readLocalUser(),
  cloudAvailable: isSupabaseConfigured,

  initialize: async () => {
    if (get().initialized) return
    if (!supabase) {
      set({ initialized: true })
      return
    }

    if (!authListenerAttached) {
      authListenerAttached = true
      supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) set({
          user: mapCloudUser(session.user),
          initialized: true,
          recoveryMode: event === 'PASSWORD_RECOVERY' || get().recoveryMode,
        })
        else if (get().user?.mode === 'cloud') set({ user: readLocalSession(), initialized: true })
      })
    }

    try {
      await attachRuntimeDeepLinkListener(user => set({ user, initialized: true, recoveryMode: false }))
      await consumeInitialAuthDeepLink()
    } catch (error) {
      console.error('No se pudo completar el enlace de autenticación.', error)
    }

    const { data, error } = await supabase.auth.getSession()
    if (error) console.error('No se pudo restaurar la sesión cloud.', error)
    const cloudUser = data.session?.user ? mapCloudUser(data.session.user) : null
    set({ user: cloudUser ?? readLocalSession(), initialized: true })
  },

  registerCloud: async ({ name, email, password }) => {
    const client = requireSupabase()
    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: getAuthRedirectUrl(),
      },
    })
    if (error) throw new Error(error.message)
    recordAuditEvent('account', 'Cuenta cloud creada', normalizedEmail)
    if (!data.session) return 'confirm-email'
    if (data.user) set({ user: mapCloudUser(data.user) })
    return 'authenticated'
  },

  loginCloud: async ({ email, password }) => {
    const client = requireSupabase()
    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await client.auth.signInWithPassword({ email: normalizedEmail, password })
    if (error) throw new Error('Correo o contraseña incorrectos, o correo aún no confirmado.')
    set({ user: mapCloudUser(data.user) })
    recordAuditEvent('account', 'Inicio de sesión cloud', normalizedEmail)
  },

  requestPasswordReset: async (email) => {
    const client = requireSupabase()
    const normalizedEmail = email.trim().toLowerCase()
    const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getAuthRedirectUrl(),
    })
    if (error) throw new Error(error.message)
    recordAuditEvent('account', 'Recuperación de contraseña solicitada', normalizedEmail)
  },

  updatePassword: async (password) => {
    const client = requireSupabase()
    const { error } = await client.auth.updateUser({ password })
    if (error) throw new Error(error.message)
    recordAuditEvent('account', 'Contraseña cloud actualizada')
    set({ recoveryMode: false })
  },

  registerLocal: async ({ name, email, password }) => {
    if (readLocalUser()) throw new Error('Ya existe un usuario local en este dispositivo.')
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const normalizedEmail = email.trim().toLowerCase()
    const stored: StoredLocalUser = {
      name: name.trim(),
      email: normalizedEmail,
      salt: bytesToBase64(salt),
      passwordHash: await hashPassword(password, salt),
    }
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(stored))
    sessionStorage.setItem(LOCAL_SESSION_KEY, stored.email)
    recordAuditEvent('account', 'Cuenta local creada', stored.email)
    set({ user: { name: stored.name, email: stored.email, mode: 'local' }, hasLocalAccount: true })
  },

  loginLocal: async ({ email, password }) => {
    const stored = readLocalUser()
    const normalizedEmail = email.trim().toLowerCase()
    if (!stored || stored.email !== normalizedEmail) throw new Error('Correo o contraseña incorrectos.')
    const passwordHash = await hashPassword(password, base64ToBytes(stored.salt))
    if (passwordHash !== stored.passwordHash) throw new Error('Correo o contraseña incorrectos.')
    sessionStorage.setItem(LOCAL_SESSION_KEY, stored.email)
    recordAuditEvent('account', 'Inicio de sesión local', stored.email)
    set({ user: { name: stored.name, email: stored.email, mode: 'local' } })
  },

  logout: async (scope = 'local') => {
    const mode = get().user?.mode
    sessionStorage.removeItem(LOCAL_SESSION_KEY)
    if (mode === 'cloud' && supabase) {
      const { error } = await supabase.auth.signOut({ scope })
      if (error) throw new Error(error.message)
    }
    recordAuditEvent('account', scope === 'global' ? 'Cierre remoto de sesiones' : 'Cierre de sesión')
    set({ user: null })
  },
}))
