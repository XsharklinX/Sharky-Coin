import { useEffect } from 'react'
import { localToday } from '@/data/helpers'
import { isTauri } from '@/hooks/useTauri'
import { listenBankNotifications, takePendingBankNotifications } from '@/lib/bankNotifications'
import { classifyBankNotification } from '@/lib/bankNotificationParser'
import { useBankSuggestions } from '@/store/bankSuggestions'

/**
 * Mientras `bankSuggestions.enabled` esté activo y la app corra en
 * Tauri/Android, convierte los avisos de movimientos bancarios en sugerencias.
 *
 * Clave: el servicio nativo persiste los avisos en una cola aunque la app esté
 * cerrada (antes se perdían si el JS no estaba escuchando en ese instante — la
 * razón por la que "no detectaba nada"). Aquí DRENAMOS esa cola al montar, al
 * volver al foreground, y cuando el servicio nos despierta con la app abierta.
 * El clasificador filtra promos/OTP/telecom; el resto nunca se guarda.
 */
export function useBankNotifications() {
  const enabled = useBankSuggestions((state) => state.enabled)
  const add = useBankSuggestions((state) => state.add)

  useEffect(() => {
    if (!enabled || !isTauri()) return

    let unlisten: (() => void) | undefined
    let cancelled = false
    let draining = false

    // Drena la cola persistida y clasifica cada aviso. Se protege contra
    // llamadas solapadas (foreground + evento a la vez) con `draining`.
    const drain = async () => {
      if (draining || cancelled) return
      draining = true
      try {
        const pending = await takePendingBankNotifications()
        for (const { package: pkg, title, text, postTime } of pending) {
          const result = classifyBankNotification(pkg, title, text)
          if (result.ok) add({ ...result.tx, date: localToday(new Date(postTime)), postTime, pkg })
        }
      } finally {
        draining = false
      }
    }

    void drain() // lo capturado mientras la app estaba cerrada

    // El evento en vivo (app abierta) solo gatilla un drenaje — la cola es la
    // única fuente de datos, así no se duplica.
    listenBankNotifications(() => { void drain() }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })

    const onVisible = () => { if (document.visibilityState === 'visible') void drain() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      unlisten?.()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, add])
}
