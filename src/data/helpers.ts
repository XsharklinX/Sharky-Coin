import { CURRENCIES } from './seed'
import type {
  Transaction, Category, Account, GoalContribution,
  Totals, CategoryTotal, MonthSeries, WeekBucket,
  CurrencyCode, FmtOptions,
} from '@/types'

// ── Formato de moneda ─────────────────────────────────────
export function fmt(n: number, currency: CurrencyCode, opts: FmtOptions = {}): string {
  const c    = CURRENCIES[currency]
  const v    = n * c.rate
  const sign = v < 0 ? '-' : ''
  const abs  = Math.abs(v)
  const dec  = opts.decimals ?? c.decimals
  const s    = abs.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  return `${sign}${c.symbol} ${s}`
}

export function fmtCompact(n: number, currency: CurrencyCode): string {
  const c    = CURRENCIES[currency]
  const v    = n * c.rate
  const abs  = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${c.symbol} ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${c.symbol} ${(abs / 1_000).toFixed(1)}k`
  return `${sign}${c.symbol} ${Math.round(abs)}`
}

// ── Fechas ────────────────────────────────────────────────
export function dateLocale(lang: string): string {
  return lang === 'en' ? 'en-US' : 'es-DO'
}

export function monthKey(dateStr: string): string { return dateStr.slice(0, 7) }

export function currentMonthKey(now = new Date()): string {
  const y = now.getFullYear(), m = now.getMonth()
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

export function monthLabel(key: string, locale = 'es-DO'): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

export function shortMonth(key: string, locale = 'es-DO'): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short' })
}

// ── Cálculos ──────────────────────────────────────────────
export function txForMonth(txns: Transaction[], key: string): Transaction[] {
  return txns.filter(t => monthKey(t.date) === key)
}

export function totals(txns: Transaction[]): Totals {
  let income = 0, expense = 0
  txns.forEach(t => {
    if (t.type === 'income')  income  += t.amount
    if (t.type === 'expense') expense += t.amount
  })
  return { income, expense, net: income - expense }
}

export function byCategory(
  txns: Transaction[],
  type: 'income' | 'expense',
  categories: Category[],
): CategoryTotal[] {
  const map: Record<string, number> = {}
  txns.forEach(t => {
    if (t.type !== type || !t.categoryId) return
    map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount
  })
  return Object.entries(map)
    .map(([id, amount]) => ({ category: categories.find(c => c.id === id)!, amount }))
    .filter(x => x.category)
    .sort((a, b) => b.amount - a.amount)
}

export function monthKeys(txns: Transaction[]): string[] {
  if (txns.length === 0) {
    return [currentMonthKey()]
  }

  const allKeys = txns.map(t => monthKey(t.date))
  allKeys.push(currentMonthKey())
  allKeys.sort()

  const minKey = allKeys[0]
  const maxKey = allKeys[allKeys.length - 1]

  const keys: string[] = []
  let [currY, currM] = minKey.split('-').map(Number)
  const [maxY, maxM] = maxKey.split('-').map(Number)

  while (currY < maxY || (currY === maxY && currM <= maxM)) {
    keys.push(`${currY}-${String(currM).padStart(2, '0')}`)
    currM++
    if (currM > 12) {
      currM = 1
      currY++
    }
  }
  return keys
}

export function monthlySeries(txns: Transaction[], year: number, locale = 'es-DO'): MonthSeries[] {
  return Array.from({ length: 12 }, (_, m) => {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`
    const t   = totals(txForMonth(txns, key))
    return { key, label: shortMonth(key, locale), ...t }
  })
}

export function weeklySeries(txns: Transaction[]): WeekBucket[] {
  const buckets = [0, 0, 0, 0, 0]
  txns.forEach(t => {
    if (t.type !== 'expense') return
    const day = Number(t.date.slice(8, 10))
    buckets[Math.min(4, Math.floor((day - 1) / 7))] += t.amount
  })
  return buckets.map((value, i) => ({ label: `Sem ${i + 1}`, value }))
}

export interface AccountMonthBucket { key: string; label: string; inflow: number; outflow: number }

export function accountActivity(txns: Transaction[], accountId: string): Transaction[] {
  return txns.filter(t =>
    t.accountId === accountId || t.fromAccount === accountId || t.toAccount === accountId)
}

/**
 * Efecto neto de todos los movimientos sobre una cuenta (ingresos +, gastos −,
 * transferencias según dirección, aportes a metas −). El saldo real de la
 * cuenta es `openingBalance + accountMovementsTotal(...)`.
 */
export function accountMovementsTotal(
  accountId: string,
  txns: Transaction[],
  contributions: GoalContribution[] = [],
): number {
  let total = 0
  for (const t of txns) {
    if (t.type === 'income' && t.accountId === accountId) total += t.amount
    else if (t.type === 'expense' && t.accountId === accountId) total -= t.amount
    else if (t.type === 'transfer') {
      if (t.toAccount === accountId) total += t.amount
      if (t.fromAccount === accountId) total -= t.amount
    }
  }
  for (const c of contributions) {
    if (c.fromAccountId === accountId) total -= c.amount
  }
  return total
}

export function monthlyAccountSeries(
  txns: Transaction[], accountId: string, mkey: string, locale = 'es-DO',
): AccountMonthBucket[] {
  const activity = accountActivity(txns, accountId)
  const [y, m] = mkey.split('-').map(Number)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(y, m - 1 - (5 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    let inflow = 0, outflow = 0
    txForMonth(activity, key).forEach(t => {
      if (t.type === 'income' && t.accountId === accountId) inflow += t.amount
      else if (t.type === 'expense' && t.accountId === accountId) outflow += t.amount
      else if (t.type === 'transfer') {
        if (t.toAccount === accountId) inflow += t.amount
        if (t.fromAccount === accountId) outflow += t.amount
      }
    })
    return { key, label: shortMonth(key, locale), inflow, outflow }
  })
}

// ── Lookup helpers ────────────────────────────────────────
export const getCategory = (id: string | undefined, cats: Category[]) =>
  cats.find(c => c.id === id)

export const getAccount = (id: string | undefined, accs: Account[]) =>
  accs.find(a => a.id === id)
