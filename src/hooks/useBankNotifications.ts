import { useEffect } from 'react'
import { localToday } from '@/data/helpers'
import { isTauri } from '@/hooks/useTauri'
import { listenBankNotifications } from '@/lib/bankNotifications'
import { isBankNotification, parseBankNotification } from '@/lib/bankNotificationParser'
import { useBankSuggestions } from '@/store/bankSuggestions'

/**
 * Mientras `bankSuggestions.enabled` esté activo y la app corra en
 * Tauri/Android, escucha las notificaciones del sistema y, si una parece un
 * aviso de movimiento bancario (monto + palabra clave de transacción),
 * la convierte en una sugerencia de movimiento para que el usuario la
 * confirme. El resto de las notificaciones (WhatsApp, redes, etc.) se
 * descartan de inmediato y nunca se guardan.
 */
export function useBankNotifications() {
  const enabled = useBankSuggestions((state) => state.enabled)
  const add = useBankSuggestions((state) => state.add)

  useEffect(() => {
    if (!enabled || !isTauri()) return

    let unlisten: (() => void) | undefined
    let cancelled = false

    listenBankNotifications(({ package: pkg, title, text, postTime }) => {
      if (!isBankNotification(pkg, title, text)) return
      const parsed = parseBankNotification(title, text)
      if (!parsed) return
      add({ ...parsed, date: localToday(new Date(postTime)), postTime })
    }).then((fn) => {
      if (cancelled) {
        fn()
      } else {
        unlisten = fn
      }
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [enabled, add])
}
