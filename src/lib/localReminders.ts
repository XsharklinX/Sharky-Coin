import { isTauri } from '@/hooks/useTauri'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { firstRecurrenceDate } from '@/hooks/useRecurring'
import { currentMonthKey, dateLocale, fmtCompact, txForMonth } from '@/data/helpers'

function isAndroidTauri(): boolean {
  return isTauri() && /android/i.test(navigator.userAgent)
}

/**
 * Snapshot JSON con todo lo que el worker nativo (WorkManager) necesita para
 * decidir qué notificaciones mostrar sin tener acceso a localStorage/Zustand.
 * Los montos y fechas vienen pre-formateados para no portar fmtCompact()
 * ni el formato de fechas localizado a Kotlin.
 */
function buildReminderSnapshot(): string {
  const { transactions, categories, currency } = useFinance.getState()
  const { language, dismissedAlerts } = useSettings.getState()

  const mkey = currentMonthKey()
  const monthTx = txForMonth(transactions, mkey)
  const locale = dateLocale(language)

  const categoriesSnapshot = categories
    .filter(c => c.type === 'expense' && c.budget > 0)
    .map(cat => {
      const spent = monthTx
        .filter(tx => tx.type === 'expense' && tx.categoryId === cat.id)
        .reduce((sum, tx) => sum + tx.amount, 0)
      const pct = Math.round(spent / cat.budget * 100)
      return {
        id: cat.id,
        name: cat.name,
        monthKey: mkey,
        pct,
        spentLabel: fmtCompact(spent, currency),
        budgetLabel: fmtCompact(cat.budget, currency),
      }
    })

  const recurringSnapshot = transactions
    .filter(tx => tx.recurring)
    .map(tx => {
      const next = firstRecurrenceDate(tx)
      return {
        id: tx.id,
        note: tx.note,
        nextDate: next,
        dateLabel: new Date(`${next}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
        amountLabel: fmtCompact(tx.amount, currency),
        recurringEnd: tx.recurringEnd ?? null,
      }
    })

  return JSON.stringify({
    dismissedAlerts,
    categories: categoriesSnapshot,
    recurring: recurringSnapshot,
  })
}

/** Envía el snapshot actual al worker nativo. No-op fuera de Android+Tauri. */
export async function syncReminderSnapshot(): Promise<void> {
  if (!isAndroidTauri()) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('plugin:local-reminders|sync_snapshot', { snapshot: buildReminderSnapshot() })
  } catch {
    // plugin no disponible — sin recordatorios nativos
  }
}

/** Programa el worker periódico (WorkManager) que revisa el snapshot. */
export async function scheduleLocalReminders(): Promise<void> {
  if (!isAndroidTauri()) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('plugin:local-reminders|schedule_reminders')
  } catch {
    // no-op
  }
}

/** Cancela el worker periódico. */
export async function cancelLocalReminders(): Promise<void> {
  if (!isAndroidTauri()) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('plugin:local-reminders|cancel_reminders')
  } catch {
    // no-op
  }
}
