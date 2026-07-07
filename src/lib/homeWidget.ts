import { isTauri } from '@/hooks/useTauri'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { firstRecurrenceDate } from '@/hooks/useRecurring'
import { currentMonthKey, dateLocale, fmtCompact, localToday, totals, transactionsForTotals, txForMonth, visibleAccounts } from '@/data/helpers'
import { CURRENCIES } from '@/data/seed'

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
  const { language, widgetAccountIds } = useSettings.getState()

  const mkey = currentMonthKey()
  const visTx = transactionsForTotals(transactions, accounts)
  const monthTx = txForMonth(visTx, mkey)
  const locale = dateLocale(language)

  const totalBalance = visibleAccounts(accounts).reduce((sum, a) => sum + a.balance, 0)

  const widgetAccounts = (() => {
    if (widgetAccountIds && widgetAccountIds.length > 0) {
      return widgetAccountIds
        .map(id => accounts.find(a => a.id === id))
        .filter((a): a is typeof accounts[number] => !!a)
        .slice(0, 3)
    }
    return [...visibleAccounts(accounts)].sort((a, b) => b.balance - a.balance).slice(0, 3)
  })()
  const topAccounts = widgetAccounts.map(a => ({ name: a.short || a.name, balanceLabel: fmtCompact(a.balance, currency) }))

  const { income, expense } = totals(monthTx)
  const maxFlow = Math.max(income, expense, 1)
  const month = {
    incomeLabel:  fmtCompact(income, currency),
    expenseLabel: fmtCompact(expense, currency),
    incomePct:    Math.round(income / maxFlow * 100),
    expensePct:   Math.round(expense / maxFlow * 100),
  }

  const budgetRows = categories
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
    .sort((a, b) => b.pct - a.pct)

  const topBudget = budgetRows[0] ?? null
  const topBudgets = budgetRows.slice(0, 4)

  const todayStr = localToday()
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
    currencySymbol: CURRENCIES[currency].symbol,
    accounts: topAccounts,
    month,
    topBudget,
    topBudgets,
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

/**
 * Pide al sistema añadir un widget a la pantalla de inicio: 'balance' (saldo,
 * por defecto) o 'budgets' (presupuestos). Devuelve 'requested' si se mostró
 * el diálogo nativo, 'unsupported' si el dispositivo no lo permite, o
 * 'unavailable' fuera de Android+Tauri.
 */
export async function requestPinHomeWidget(widget: 'balance' | 'budgets' = 'balance'): Promise<'requested' | 'unsupported' | 'unavailable'> {
  if (!isAndroidTauri()) return 'unavailable'
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const result = await invoke<{ supported: boolean; requested: boolean }>('plugin:home-widget|request_pin', { widget })
    return result.supported && result.requested ? 'requested' : 'unsupported'
  } catch {
    return 'unavailable'
  }
}
