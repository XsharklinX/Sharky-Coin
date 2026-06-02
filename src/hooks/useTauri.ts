/**
 * Integración con la app nativa de Tauri.
 * Cuando corre en el browser normal, todas las funciones caen al
 * equivalente web (download/upload por archivo).
 */

/** True cuando la app corre dentro de Tauri (no en el browser). */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

// ── Import dinámico para no romper el bundle web ──────────
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

async function tauriSaveDialog(opts: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  return save(opts)
}

async function tauriOpenDialog(opts: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const result = await open(opts)
  return Array.isArray(result) ? result[0] ?? null : result
}

// ── API pública ────────────────────────────────────────────

/**
 * Guarda un backup JSON.
 * - En Tauri: abre diálogo de guardado nativo → escribe al FS
 * - En browser: descarga el archivo
 */
export async function saveBackup(json: string): Promise<void> {
  const filename = `sharky-backup-${new Date().toISOString().slice(0, 10)}.json`

  if (isTauri()) {
    const path = await tauriSaveDialog({
      defaultPath: filename,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return
    await tauriInvoke('write_backup', { path, json })
    return
  }

  // Fallback web
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Carga un backup JSON.
 * - En Tauri: abre diálogo de archivo nativo → lee el contenido
 * - En browser: usa input[type=file]
 */
export function openBackup(): Promise<string | null> {
  if (isTauri()) {
    return tauriOpenDialog({ filters: [{ name: 'JSON', extensions: ['json'] }] })
      .then(path => path ? tauriInvoke<string>('read_backup', { path }) : null)
  }

  return new Promise(resolve => {
    const input    = document.createElement('input')
    input.type     = 'file'
    input.accept   = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      resolve(await file.text())
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}