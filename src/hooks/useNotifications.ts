import { useEffect } from 'react'
import { currentMonthKey, fmtCompact, txForMonth } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'

const NOTIFIED_KEY = 'sharky-notified-v2'

export function useNotifications(): void {
  const { transactions, categories, currency } = useFinance()
  const thresholds = useSettings(state => state.budgetAlertThresholds)

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission === 'denied') return
    const curKey = currentMonthKey()
    const monthTx = txForMonth(transactions, curKey)
    const notified: Record<string, string[]> = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '{}')
    const done = new Set(notified[curKey] ?? [])
    const alerts = categories.flatMap(cat => {
      if (cat.type !== 'expense' || !cat.budget) return []
      const spent = monthTx.filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0)
      return thresholds.filter(threshold => spent >= cat.budget * threshold / 100 && !done.has(`${cat.id}:${threshold}`))
        .map(threshold => ({ cat, spent, threshold }))
    })
    if (!alerts.length) return

    const send = () => {
      alerts.forEach(({ cat, spent, threshold }) => {
        const pct = Math.round(spent / cat.budget * 100)
        new Notification(`$harky - ${cat.name}`, {
          body: `Alerta del ${threshold}%: llevas ${fmtCompact(spent, currency)} (${pct}%) de ${fmtCompact(cat.budget, currency)}.`,
          icon: '/icons/icon-192.png',
          tag: `budget-${cat.id}-${threshold}-${curKey}`,
        })
      })
      notified[curKey] = [...(notified[curKey] ?? []), ...alerts.map(({ cat, threshold }) => `${cat.id}:${threshold}`)]
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified))
    }
    if (Notification.permission === 'granted') send()
    else void Notification.requestPermission().then(permission => { if (permission === 'granted') send() })
  }, [categories, currency, thresholds, transactions])
}
