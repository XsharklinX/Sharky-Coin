import { CURRENCIES } from './seed'
import type {
  Transaction, Category, Account,
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
  const set = new Set(txns.map(t => monthKey(t.date)))
  set.add(currentMonthKey())
  return Array.from(set).sort()
}

export function monthlySeries(txns: Transaction[], year: number): MonthSeries[] {
  return Array.from({ length: 12 }, (_, m) => {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`
    const t   = totals(txForMonth(txns, key))
    return { key, label: shortMonth(key), ...t }
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

// ── Lookup helpers ────────────────────────────────────────
export const getCategory = (id: string | undefined, cats: Category[]) =>
  cats.find(c => c.id === id)

export const getAccount = (id: string | undefined, accs: Account[]) =>
  accs.find(a => a.id === id)
