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
 * Guarda un backup en la carpeta de documentos de la app (solo Tauri Android).
 * Devuelve la ruta donde se guardó el archivo.
 */
export async function saveBackupAuto(json: string): Promise<string> {
  return tauriInvoke<string>('save_backup_auto', { json })
}

/**
 * Guarda un backup JSON.
 * - En Tauri Android: auto-guarda a {app_document_dir}/backups/
 * - En Tauri desktop: abre diálogo de guardado nativo → escribe al FS
 * - En Android PWA: usa navigator.share() con el archivo
 * - En browser desktop: descarga el archivo
 */
export async function saveBackup(json: string): Promise<void> {
  const filename = `sharky-backup-${new Date().toISOString().slice(0, 10)}.json`

  if (isTauri()) {
    // On Android the save dialog is unreliable — auto-save to app documents folder
    const isAndroid = /android/i.test(navigator.userAgent)
    if (isAndroid) {
      await tauriInvoke('save_backup_auto', { json })
      return
    }
    const path = await tauriSaveDialog({
      defaultPath: filename,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return
    await tauriInvoke('write_backup', { path, json })
    return
  }

  // Web Share API — preferred on Android PWA (shares to Files, Drive, WhatsApp, etc.)
  const file = new File([json], filename, { type: 'application/json' })
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: '$harky backup' })
    return
  }

  // Fallback: programmatic download (desktop browsers)
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