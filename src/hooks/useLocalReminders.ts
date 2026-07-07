import { useEffect, useRef } from 'react'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { cancelLocalReminders, requestReminderPermission, scheduleLocalReminders, syncReminderSnapshot } from '@/lib/localReminders'

/**
 * Mantiene sincronizado el snapshot que usa el worker nativo (WorkManager)
 * para mostrar recordatorios de pagos recurrentes y alertas de presupuesto
 * aunque la app esté cerrada. No-op fuera de Android+Tauri.
 */
export function useLocalReminders(): void {
  const transactions = useFinance(s => s.transactions)
  const categories = useFinance(s => s.categories)
  const currency = useFinance(s => s.currency)
  const language = useSettings(s => s.language)
  const dismissedAlerts = useSettings(s => s.dismissedAlerts)
  const remindersEnabled = useSettings(s => s.remindersEnabled)
  const isFirstSync = useRef(true)

  useEffect(() => {
    if (remindersEnabled) {
      void requestReminderPermission()
      void scheduleLocalReminders()
    } else {
      void cancelLocalReminders()
    }
  }, [remindersEnabled])

  useEffect(() => {
    if (!remindersEnabled) return
    const delay = isFirstSync.current ? 0 : 1500
    isFirstSync.current = false
    const id = setTimeout(() => { void syncReminderSnapshot() }, delay)
    return () => clearTimeout(id)
  }, [transactions, categories, currency, language, dismissedAlerts, remindersEnabled])
}
