import { useEffect } from 'react'
import { useFinance } from '@/store/finance'
import { currentMonthKey, txForMonth } from '@/data/helpers'
import { fmtCompact } from '@/data/helpers'

const NOTIFIED_KEY = 'sharky-notified-v1'
const THRESHOLD = 0.8   // 80% del presupuesto

/**
 * Solicita permiso de notificaciones y avisa cuando una categoría
 * supera el 80% del presupuesto. Notifica una vez por categoría por mes.
 */
export function useNotifications() {
  const { transactions, categories, currency } = useFinance()

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission === 'denied') return

    const curKey   = currentMonthKey()
    const monthTx  = txForMonth(transactions, curKey)
    const notified: Record<string, string[]> =
      JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '{}')
    const done = new Set(notified[curKey] ?? [])

    // categorías que superaron el umbral y aún no han sido notificadas
    const toNotify = categories.filter(cat => {
      if (cat.type !== 'expense' || !cat.budget || done.has(cat.id)) return false
      const spent = monthTx
        .filter(t => t.categoryId === cat.id && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0)
      return spent >= cat.budget * THRESHOLD
    })

    if (toNotify.length === 0) return

    const send = () => {
      toNotify.forEach(cat => {
        const spent = monthTx
          .filter(t => t.categoryId === cat.id && t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0)
        const pct = Math.round((spent / cat.budget) * 100)
        new Notification(`$harky — ${cat.name}`, {
          body: `Llevas ${fmtCompact(spent, currency)} (${pct}%) de tu presupuesto de ${fmtCompact(cat.budget, currency)}.`,
          icon: '/icons/icon-192.png',
          tag:  `budget-${cat.id}-${curKey}`,
        })
      })
      const ids = toNotify.map(c => c.id)
      notified[curKey] = [...(notified[curKey] ?? []), ...ids]
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified))
    }

    if (Notification.permission === 'granted') {
      send()
    } else {
      Notification.requestPermission().then(p => { if (p === 'granted') send() })
    }
  }, [transactions, categories, currency])
}
