import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface GoogleUser {
  id:       string   // Google sub — unique per user per app
  name:     string
  email:    string
  picture?: string
}

interface GoogleAuthState {
  user:    GoogleUser | null
  signIn:  (credential: string) => void
  signOut: () => void
}

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

export const useGoogleAuth = create<GoogleAuthState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (credential: string) => {
        const p = decodeJwt(credential)
        if (!p.sub) return
        set({
          user: {
            id:      p.sub as string,
            name:    (p.name as string) || (p.email as string) || 'Usuario',
            email:   (p.email as string) || '',
            picture: p.picture as string | undefined,
          },
        })
      },
      signOut: () => set({ user: null }),
    }),
    { name: 'sharky-google-user', storage: createJSONStorage(() => localStorage) },
  ),
)

export type GisPromptNotification = {
  isNotDisplayed:   () => boolean
  isSkippedMoment:  () => boolean
  isDismissedMoment:() => boolean
  getNotDisplayedReason: () => string
  getSkippedReason: () => string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (r: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (el: HTMLElement, opts: object) => void
          prompt: (callback?: (n: GisPromptNotification) => void) => void
        }
      }
    }
  }
}

// ── GIS loader con manejo de error y timeout ──────────────────────────────────

let gisState: 'idle' | 'loading' | 'ready' | 'error' = 'idle'
const readyCbs: Array<() => void> = []
const errorCbs: Array<() => void> = []

export function loadGIS(onReady: () => void, onError?: () => void) {
  if (gisState === 'ready')  { onReady(); return }
  if (gisState === 'error')  { onError?.(); return }

  readyCbs.push(onReady)
  if (onError) errorCbs.push(onError)

  if (gisState === 'loading') return
  gisState = 'loading'

  const s = document.createElement('script')
  s.src   = 'https://accounts.google.com/gsi/client'
  s.async = true

  const fail = () => {
    gisState = 'error'
    errorCbs.forEach(cb => cb())
    errorCbs.length = 0
    readyCbs.length = 0
  }

  s.onload = () => {
    if (!window.google?.accounts?.id) { fail(); return }
    gisState = 'ready'
    readyCbs.forEach(cb => cb())
    readyCbs.length = 0
    errorCbs.length = 0
  }
  s.onerror = fail

  // Timeout de 12 s — si Google no responde, marcamos error
  setTimeout(() => { if (gisState === 'loading') fail() }, 12_000)

  document.head.appendChild(s)
}
