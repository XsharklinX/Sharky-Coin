import { isTauri } from '@/hooks/useTauri'

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
// feature "windows-native"). En Android no hay Keystore configurado:
// secure_storage_get/set fallan en tiempo de ejecución, lo que rompe el
// round-trip del code_verifier PKCE (Google login queda colgado en silencio).
const isAndroid = isTauri() && /android/i.test(navigator.userAgent)

export const usesNativeCredentialStorage = isTauri() && !isAndroid

if (usesNativeCredentialStorage && hasBrowserStorage) {
  Object.keys(localStorage)
    .filter(key => /^sb-.*-auth-token(?:-code-verifier)?$/.test(key))
    .forEach(key => localStorage.removeItem(key))
}

export const secureAuthStorage: AuthStorage = usesNativeCredentialStorage
  ? tauriCredentialStorage
  : browserStorage
