import { useEffect, useRef } from 'react'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { cancelWeeklyBackup, scheduleWeeklyBackup, syncBackupSnapshot } from '@/lib/scheduledBackup'

/**
 * Contraparte Android de `useWeeklyAutoBackup`: mantiene al día el snapshot que
 * el worker nativo (WorkManager) copia a la carpeta elegida, y programa /
 * cancela ese worker según la preferencia del usuario. Corre aunque la app
 * esté cerrada, por eso aquí solo sincronizamos el archivo y (re)programamos;
 * la copia real la hace el worker. No-op fuera de Android+Tauri.
 */
export function useScheduledBackup(): void {
  const transactions = useFinance(s => s.transactions)
  const accounts = useFinance(s => s.accounts)
  const categories = useFinance(s => s.categories)
  const goals = useFinance(s => s.goals)
  const currency = useFinance(s => s.currency)
  const enabled = useSettings(s => s.weeklyAutoBackupEnabled)
  const day = useSettings(s => s.weeklyAutoBackupDay)
  const hour = useSettings(s => s.weeklyAutoBackupHour)
  const isFirstSync = useRef(true)

  // (Re)programa o cancela el worker cuando cambia la preferencia.
  useEffect(() => {
    if (enabled) {
      void scheduleWeeklyBackup(day, hour)
    } else {
      void cancelWeeklyBackup()
    }
  }, [enabled, day, hour])

  // Mantiene el archivo del snapshot al día: si está viejo, el backup semanal
  // saldría viejo. Se debounce para no reescribir en cada tecla.
  useEffect(() => {
    if (!enabled) return
    const delay = isFirstSync.current ? 0 : 1500
    isFirstSync.current = false
    const id = setTimeout(() => { void syncBackupSnapshot() }, delay)
    return () => clearTimeout(id)
  }, [transactions, accounts, categories, goals, currency, enabled])
}
