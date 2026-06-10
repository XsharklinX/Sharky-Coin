import { useEffect } from 'react'
import { isTauri } from '@/hooks/useTauri'
import { listenBankNotifications } from '@/lib/bankNotifications'
import { useNotificationInbox } from '@/store/notificationInbox'

/**
 * Activa la captura de notificaciones bancarias mientras
 * `notificationInbox.enabled` esté activo y la app corra en Tauri/Android.
 */
export function useBankNotifications() {
  const enabled = useNotificationInbox((state) => state.enabled)
  const add = useNotificationInbox((state) => state.add)

  useEffect(() => {
    if (!enabled || !isTauri()) return

    let unlisten: (() => void) | undefined
    let cancelled = false

    listenBankNotifications((event) => {
      add(event)
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
