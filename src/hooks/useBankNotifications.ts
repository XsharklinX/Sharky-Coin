import { useEffect } from 'react'
import { toast } from '@/components/ui/Toast'
import { guessCategoryId } from '@/data/bankCsv'
import { movementDedupKey, resolveDetectedAccount } from '@/data/bankIngest'
import { fmt, localToday } from '@/data/helpers'
import { newId } from '@/data/seed'
import { isTauri } from '@/hooks/useTauri'
import { tt } from '@/i18n'
import { listenBankNotifications, takePendingBankNotifications } from '@/lib/bankNotifications'
import { classifyBankNotification } from '@/lib/bankNotificationParser'
import { useBankSuggestions } from '@/store/bankSuggestions'
import { useBankNotificationsDebug } from '@/store/bankNotificationsDebug'
import { useFinance } from '@/store/finance'

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
        const debug = useBankNotificationsDebug.getState()
        // Observabilidad: se anota CADA revisión y cuántos avisos entregó el
        // sistema. Si la app revisa (drainCount sube) pero pending es siempre 0,
        // el problema es la capa nativa/permiso, no el clasificador.
        debug.recordDrain(pending.length)
        const record = debug.record
        for (const { package: pkg, title, text, postTime } of pending) {
          const result = classifyBankNotification(pkg, title, text)
          if (!result.ok) {
            record({ pkg, title, text, postTime, verdict: result.reason })
            continue
          }

          const tx = result.tx
          const bank = useBankSuggestions.getState()
          const key = movementDedupKey(tx.type, tx.amount, tx.cardLast4, pkg)

          // Dedup: si ya procesamos este mismo movimiento (mismos monto/tarjeta
          // en la ventana), es una de las 2-3 copias del aviso → se ignora.
          if (bank.isRecentlyProcessed(key, postTime)) {
            record({ pkg, title, text, postTime, verdict: 'duplicate' })
            continue
          }
          bank.markProcessed(key, postTime)

          const date = localToday(new Date(postTime))
          const finance = useFinance.getState()
          const account = resolveDetectedAccount(finance.accounts, bank.packageAccountMap, tx.cardLast4, pkg)

          // Auto-crear: si sabemos la cuenta (por los 4 dígitos o el mapeo) y el
          // usuario lo tiene activado, se registra el movimiento SOLO. Si no, o
          // si falla (p.ej. saldo insuficiente en política bloquear), cae a
          // sugerencia manual para que el usuario elija cuenta / lo revise.
          if (bank.autoCreate && account) {
            const categoryId = guessCategoryId(tx.note, finance.categories, tx.type, false)
            const id = newId('tx_')
            try {
              finance.addTx({ id, type: tx.type, amount: tx.amount, date, note: tx.note, accountId: account.id, categoryId, detectedFrom: 'notification' })
              record({ pkg, title, text, postTime, verdict: 'auto-added' })
              // Red de seguridad: aviso con DESHACER. Si la app está en primer
              // plano el usuario lo ve al instante y puede revertir de un toque;
              // si estaba cerrada, el movimiento queda marcado como "automático"
              // en la lista para revisarlo con confianza.
              const sign = tx.type === 'expense' ? '−' : '+'
              toast(tt('autoAddedToast', { name: tx.note, amount: `${sign}${fmt(tx.amount, tx.currency)}` }), {
                icon: 'check', type: 'ok',
                action: { label: tt('undo'), onClick: () => useFinance.getState().deleteTx(id) },
              })
              continue
            } catch {
              // cae a sugerencia manual abajo
            }
          }
          bank.add({ ...tx, date, postTime, pkg })
          record({ pkg, title, text, postTime, verdict: 'added' })
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
  }, [enabled])
}
