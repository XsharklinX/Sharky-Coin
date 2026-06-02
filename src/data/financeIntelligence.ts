import { byCategory, monthKey, monthlySeries, totals, txForMonth } from '@/data/helpers'
import type { Category, Transaction } from '@/types'

export interface SubscriptionInsight {
  merchant: string
  amount: number
  categoryId?: string
  months: number
  confidence: number
  lastDate: string
}

export interface CashflowProjection {
  horizonDays: 30 | 60 | 90
  projectedNet: number
  projectedBalance: number
}

export interface SpendingAnomaly {
  tx: Transaction
  baseline: number
  multiplier: number
  reason: string
}

export interface TrendInsight {
  label: string
  amount: number
  delta: number
  kind: 'merchant' | 'category' | 'tag'
}

export interface FinancialIntelligence {
  subscriptions: SubscriptionInsight[]
  projections: CashflowProjection[]
  anomalies: SpendingAnomaly[]
  trends: TrendInsight[]
  recommendedMonthlySavings: number
  monthlyActions: string[]
}

function normalizeMerchant(note: string): string {
  return note
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(?:pago|compra|consumo|pos|visa|mastercard|rd|dop|ref|aut)\b/gi, ' ')
    .replace(/[0-9#*_.:/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .slice(0, 4)
    .join(' ') || 'movimiento'
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function standardDeviation(values: number[]): number {
  const avg = average(values)
  return Math.sqrt(average(values.map(value => (value - avg) ** 2)))
}

function lastMonthsFrom(mkey: string, count: number): string[] {
  const [year, month] = mkey.split('-').map(Number)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - 1 - index, 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }).reverse()
}

export function detectSubscriptions(txns: Transaction[], mkey: string): SubscriptionInsight[] {
  const months = lastMonthsFrom(mkey, 12)
  const groups = new Map<string, Transaction[]>()
  txns
    .filter(tx => tx.type === 'expense' && months.includes(monthKey(tx.date)))
    .forEach(tx => {
      const key = `${normalizeMerchant(tx.note)}|${tx.categoryId ?? ''}|${tx.accountId ?? ''}`
      groups.set(key, [...(groups.get(key) ?? []), tx])
    })

  return Array.from(groups.entries()).flatMap(([key, rows]) => {
    const distinctMonths = new Set(rows.map(tx => monthKey(tx.date)))
    const amounts = rows.map(tx => tx.amount)
    const avg = average(amounts)
    const variance = avg ? standardDeviation(amounts) / avg : 1
    const recurringFlag = rows.some(tx => tx.recurring)
    if (distinctMonths.size < 3 && !recurringFlag) return []
    if (variance > 0.18 && !recurringFlag) return []
    const [merchant, categoryId] = key.split('|')
    return [{
      merchant,
      amount: avg,
      categoryId: categoryId || undefined,
      months: distinctMonths.size,
      confidence: Math.min(98, Math.round((distinctMonths.size / 6) * 70 + (recurringFlag ? 25 : 0) + (1 - variance) * 20)),
      lastDate: rows.map(tx => tx.date).sort()[rows.length - 1] ?? '',
    }]
  }).sort((a, b) => b.confidence - a.confidence || b.amount - a.amount).slice(0, 6)
}

export function projectCashflow(txns: Transaction[], mkey: string, currentBalance: number): CashflowProjection[] {
  const historyMonths = lastMonthsFrom(mkey, 3)
  const history = historyMonths.map(key => totals(txForMonth(txns, key)))
  const avgMonthlyIncome = average(history.map(item => item.income))
  const avgMonthlyExpense = average(history.map(item => item.expense))
  const avgMonthlyNet = avgMonthlyIncome - avgMonthlyExpense
  return ([30, 60, 90] as const).map(horizonDays => {
    const factor = horizonDays / 30
    const projectedNet = avgMonthlyNet * factor
    return { horizonDays, projectedNet, projectedBalance: currentBalance + projectedNet }
  })
}

export function detectSpendingAnomalies(txns: Transaction[], mkey: string): SpendingAnomaly[] {
  const historyMonths = lastMonthsFrom(mkey, 6)
  const monthTx = txForMonth(txns, mkey).filter(tx => tx.type === 'expense')
  const history = txns.filter(tx => tx.type === 'expense' && historyMonths.includes(monthKey(tx.date)) && monthKey(tx.date) !== mkey)

  return monthTx.flatMap(tx => {
    const peerGroup = history.filter(item => item.categoryId === tx.categoryId || normalizeMerchant(item.note) === normalizeMerchant(tx.note))
    if (peerGroup.length < 3) return []
    const baseline = average(peerGroup.map(item => item.amount))
    const deviation = standardDeviation(peerGroup.map(item => item.amount))
    const threshold = Math.max(baseline * 1.75, baseline + deviation * 2)
    if (tx.amount < threshold || tx.amount < 500) return []
    return [{ tx, baseline, multiplier: baseline ? tx.amount / baseline : 0, reason: `${normalizeMerchant(tx.note)} supera su patron habitual` }]
  }).sort((a, b) => b.multiplier - a.multiplier).slice(0, 5)
}

export function computeTrends(txns: Transaction[], categories: Category[], mkey: string): TrendInsight[] {
  const current = txForMonth(txns, mkey).filter(tx => tx.type === 'expense')
  const previousKeys = lastMonthsFrom(mkey, 4).slice(0, 3)
  const previous = txns.filter(tx => tx.type === 'expense' && previousKeys.includes(monthKey(tx.date)))
  const build = (rows: Transaction[], selector: (tx: Transaction) => string | undefined) => {
    const map = new Map<string, number>()
    rows.forEach(tx => {
      const key = selector(tx)
      if (!key) return
      map.set(key, (map.get(key) ?? 0) + tx.amount)
    })
    return map
  }
  const currentMerchants = build(current, tx => normalizeMerchant(tx.note))
  const previousMerchants = build(previous, tx => normalizeMerchant(tx.note))
  const currentTags = build(current, tx => tx.tags?.[0])
  const previousTags = build(previous, tx => tx.tags?.[0])
  const categoryData = byCategory(current, 'expense', categories)

  const merchantTrends = Array.from(currentMerchants.entries()).map(([label, amount]) => ({
    label,
    amount,
    delta: amount - ((previousMerchants.get(label) ?? 0) / 3),
    kind: 'merchant' as const,
  }))
  const tagTrends = Array.from(currentTags.entries()).map(([label, amount]) => ({
    label: `#${label}`,
    amount,
    delta: amount - ((previousTags.get(label) ?? 0) / 3),
    kind: 'tag' as const,
  }))
  const categoryTrends = categoryData.map(item => ({
    label: item.category.name,
    amount: item.amount,
    delta: item.amount,
    kind: 'category' as const,
  }))

  return [...merchantTrends, ...tagTrends, ...categoryTrends]
    .filter(item => item.amount > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 8)
}

export function generateFinancialIntelligence(params: {
  txns: Transaction[]
  categories: Category[]
  mkey: string
  currentBalance: number
}): FinancialIntelligence {
  const { txns, categories, mkey, currentBalance } = params
  const months = monthlySeries(txns, Number(mkey.slice(0, 4))).filter(month => month.key <= mkey)
  const activeMonths = months.filter(month => month.income > 0 || month.expense > 0).slice(-3)
  const avgIncome = average(activeMonths.map(month => month.income))
  const avgExpense = average(activeMonths.map(month => month.expense))
  const avgNet = avgIncome - avgExpense
  const subscriptions = detectSubscriptions(txns, mkey)
  const projections = projectCashflow(txns, mkey, currentBalance)
  const anomalies = detectSpendingAnomalies(txns, mkey)
  const trends = computeTrends(txns, categories, mkey)
  const recommendedMonthlySavings = Math.max(0, Math.round(Math.min(avgNet * 0.5, avgIncome * 0.2)))

  const actions = [
    subscriptions.length ? `Revisa ${subscriptions.length} posible${subscriptions.length > 1 ? 's' : ''} suscripcion${subscriptions.length > 1 ? 'es' : ''} antes del proximo cierre.` : '',
    anomalies.length ? `Audita ${anomalies[0].tx.note}: esta por encima de su promedio habitual.` : '',
    avgNet < 0 ? 'Reduce gastos variables: el promedio reciente esta cerrando en negativo.' : '',
    recommendedMonthlySavings > 0 ? `Programa un ahorro mensual sugerido de ${Math.round(recommendedMonthlySavings)} DOP.` : '',
    projections[0]?.projectedBalance < 0 ? 'Tu proyeccion a 30 dias queda negativa; evita nuevos gastos no esenciales.' : '',
  ].filter(Boolean)

  if (!actions.length) actions.push('Mantén el ritmo actual y revisa categorias top una vez por semana.')

  return { subscriptions, projections, anomalies, trends, recommendedMonthlySavings, monthlyActions: actions.slice(0, 4) }
}
