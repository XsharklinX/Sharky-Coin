import { firstRecurrenceDate } from '@/hooks/useRecurring'
import { currentMonthKey, fmtCompact, txForMonth } from './helpers'
import type { Category, CurrencyCode, IconName, Transaction } from '@/types'

export interface MobileAlert {
  id:    string
  level: 'warn' | 'danger'
  icon:  IconName
  title: string
  text:  string
}

const DUE_SOON_DAYS = 3

export function getMobileAlerts(
  transactions: Transaction[],
  categories: Category[],
  currency: CurrencyCode,
  todayStr = new Date().toISOString().slice(0, 10),
  locale = 'es-DO',
): MobileAlert[] {
  const mkey = currentMonthKey()
  const monthTx = txForMonth(transactions, mkey)
  const alerts: MobileAlert[] = []

  categories.filter(c => c.type === 'expense' && c.budget > 0).forEach(cat => {
    const spent = monthTx
      .filter(tx => tx.type === 'expense' && tx.categoryId === cat.id)
      .reduce((sum, tx) => sum + tx.amount, 0)
    const pct = Math.round(spent / cat.budget * 100)
    if (pct >= 100) {
      alerts.push({
        id:    `budget:${cat.id}:${mkey}:100`,
        level: 'danger',
        icon:  'alert',
        title: `Superaste el presupuesto de ${cat.name}`,
        text:  `Llevas ${fmtCompact(spent, currency)} de ${fmtCompact(cat.budget, currency)} (${pct}%)`,
      })
    } else if (pct >= 80) {
      alerts.push({
        id:    `budget:${cat.id}:${mkey}:80`,
        level: 'warn',
        icon:  'alert',
        title: `Vas en ${pct}% del presupuesto de ${cat.name}`,
        text:  `Llevas ${fmtCompact(spent, currency)} de ${fmtCompact(cat.budget, currency)}`,
      })
    }
  })

  const limit = new Date(`${todayStr}T00:00:00`)
  limit.setDate(limit.getDate() + DUE_SOON_DAYS)
  const limitStr = limit.toISOString().slice(0, 10)

  transactions.filter(tx => tx.recurring).forEach(template => {
    const next = firstRecurrenceDate(template)
    if (next < todayStr || next > limitStr) return
    if (template.recurringEnd && next > template.recurringEnd) return
    const when = next === todayStr
      ? 'hoy'
      : new Date(`${next}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    alerts.push({
      id:    `recurring:${template.id}:${next}`,
      level: 'warn',
      icon:  'calendar',
      title: `Pago recurrente próximo: ${template.note || 'Sin nota'}`,
      text:  `Vence ${when} · ${fmtCompact(template.amount, currency)}`,
    })
  })

  return alerts
}
