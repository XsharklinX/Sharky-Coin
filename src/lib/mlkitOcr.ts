import { isTauri } from '@/hooks/useTauri'

/**
 * Reconoce texto en una imagen usando Google ML Kit (on-device, vía el
 * plugin nativo de Tauri). Devuelve `null` si no estamos en Android+Tauri,
 * si Google Play Services no está disponible, o si el plugin falla por
 * cualquier otra razón — en cuyo caso el llamador debe usar Tesseract.js.
 */
export async function recognizeWithMlKit(imageBase64: string): Promise<string | null> {
  const isAndroid = /android/i.test(navigator.userAgent)
  if (!isTauri() || !isAndroid) return null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const result = await invoke<{ text: string }>('plugin:mlkit-ocr|recognize_text', { imageBase64 })
    return result.text
  } catch {
    return null
  }
}
