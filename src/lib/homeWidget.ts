import { isTauri } from '@/hooks/useTauri'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { firstRecurrenceDate } from '@/hooks/useRecurring'
import { currentMonthKey, dateLocale, fmtCompact, txForMonth } from '@/data/helpers'

function isAndroidTauri(): boolean {
  return isTauri() && /android/i.test(navigator.userAgent)
}

/**
 * Snapshot JSON con lo que el widget de pantalla de inicio necesita mostrar
 * sin abrir la app: saldo total, la categoría más cercana a su límite de
 * presupuesto del mes y el próximo pago recurrente.
 */
function buildWidgetSnapshot(): string {
  const { accounts, transactions, categories, currency } = useFinance.getState()
  const { language } = useSettings.getState()

  const mkey = currentMonthKey()
  const monthTx = txForMonth(transactions, mkey)
  const locale = dateLocale(language)

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  const topBudget = categories
    .filter(c => c.type === 'expense' && c.budget > 0)
    .map(cat => {
      const spent = monthTx
        .filter(tx => tx.type === 'expense' && tx.categoryId === cat.id)
        .reduce((sum, tx) => sum + tx.amount, 0)
      return {
        name: cat.name,
        pct: Math.round(spent / cat.budget * 100),
        spentLabel: fmtCompact(spent, currency),
        budgetLabel: fmtCompact(cat.budget, currency),
      }
    })
    .sort((a, b) => b.pct - a.pct)[0] ?? null

  const todayStr = new Date().toISOString().slice(0, 10)
  const nextPayment = transactions
    .filter(tx => tx.recurring)
    .map(tx => ({ tx, next: firstRecurrenceDate(tx) }))
    .filter(({ next }) => next >= todayStr)
    .sort((a, b) => a.next.localeCompare(b.next))
    .map(({ tx, next }) => ({
      note: tx.note,
      dateLabel: new Date(`${next}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      amountLabel: fmtCompact(tx.amount, currency),
    }))[0] ?? null

  return JSON.stringify({
    totalBalanceLabel: fmtCompact(totalBalance, currency),
    topBudget,
    nextPayment,
  })
}

/** Envía el snapshot actual al widget nativo. No-op fuera de Android+Tauri. */
export async function syncHomeWidgetSnapshot(): Promise<void> {
  if (!isAndroidTauri()) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('plugin:home-widget|sync_snapshot', { snapshot: buildWidgetSnapshot() })
  } catch {
    // plugin no disponible — sin widget nativo
  }
}
