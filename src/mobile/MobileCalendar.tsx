import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { dateLocale, fmtCompact, txForMonth } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import { MobileTransactionList } from './MobileTransactionList'
import type { Transaction } from '@/types'

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// En las celdas del calendario (≈1/7 del ancho) no cabe "RD$ 26,000.00": se
// cortaba a "RD$ 26…". Mostramos el número agrupado sin símbolo ni decimales
// —el color (verde/rojo) ya indica ingreso/gasto y la moneda va en la cabecera—
// para que el monto se vea completo y de un vistazo.
function fmtDayAmount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function weekdayLabels(locale: string): string[] {
  // Monday-first week
  return Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }))
}

function monthLabels(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) => capitalize(new Date(2024, i, 1).toLocaleDateString(locale, { month: 'long' })))
}

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}
function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}
function mkey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function MobileCalendar({
  mkey: initialMkey,
  onEditTx,
  onDeleteTx,
}: {
  mkey: string
  onEditTx: (tx: Transaction) => void
  onDeleteTx?: (id: string) => void
}) {
  const { transactions, categories, currency } = useFinance()
  const t = useT()
  const lang = (useSettings(s => s.language) ?? 'es') as 'en' | 'es'
  const locale = dateLocale(lang)
  const DAYS = weekdayLabels(locale)
  const MONTHS = monthLabels(locale)
  const [year,  setYear]  = useState(Number(initialMkey.slice(0, 4)))
  const [month, setMonth] = useState(Number(initialMkey.slice(5, 7)))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const mk = mkey(year, month)
  const monthTx = txForMonth(transactions, mk)

  // Calculate daily budget = sum of monthly category budgets / days in month
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalMonthBudget = categories
    .filter(c => c.type === 'expense')
    .reduce((s, c) => s + c.budget, 0)
  const dailyBudget = totalMonthBudget > 0 ? totalMonthBudget / daysInMonth : 0

  // Group transactions by day
  const byDay = monthTx.reduce<Record<number, Transaction[]>>((acc, tx) => {
    const d = Number(tx.date.slice(8, 10))
    ;(acc[d] ??= []).push(tx)
    return acc
  }, {})

  // First weekday of month (Monday-first)
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7

  // Build calendar grid cells
  const cells: Array<number | null> = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()
  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear()

  const dayTxs = selectedDay !== null ? (byDay[selectedDay] ?? []) : []

  const goBack = () => {
    const p = prevMonth(year, month)
    setYear(p.year); setMonth(p.month); setSelectedDay(null)
  }
  const goNext = () => {
    const n = nextMonth(year, month)
    setYear(n.year); setMonth(n.month); setSelectedDay(null)
  }

  return (
    <div className="mcal-root">
      {/* Header nav */}
      <div className="mcal-header">
        <button className="mcal-nav" aria-label={t('prevMonth')} onClick={goBack}>
          <Icon name="arrowUp" size={16} style={{ transform: 'rotate(-90deg)' }} />
        </button>
        <span className="mcal-month-label">{MONTHS[month - 1]} {year}</span>
        <button className="mcal-nav" aria-label={t('nextMonth')} onClick={goNext}>
          <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
        </button>
      </div>

      {/* Day headers */}
      <div className="mcal-grid">
        {DAYS.map(d => <span key={d} className="mcal-dow">{d}</span>)}

        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} className="mcal-empty" />
          const txs = byDay[day] ?? []
          const expense = txs.reduce((s, tx) => s + (tx.type === 'expense' ? tx.amount : 0), 0)
          const income  = txs.reduce((s, tx) => s + (tx.type === 'income'  ? tx.amount : 0), 0)
          const hasData = txs.length > 0
          const overBudget = dailyBudget > 0 ? expense > dailyBudget : expense > income && expense > 0
          const selected = selectedDay === day

          return (
            <button
              key={day}
              className={[
                'mcal-day',
                hasData ? (overBudget ? 'over' : 'ok') : '',
                isToday(day) ? 'today' : '',
                selected ? 'selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDay(prev => prev === day ? null : day)}
            >
              <span className="mcal-day-num">{day}</span>
              {income  > 0 && <span className="mcal-amt inc">+{fmtDayAmount(income)}</span>}
              {expense > 0 && <span className="mcal-amt exp">−{fmtDayAmount(expense)}</span>}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mcal-footer">
        {dailyBudget > 0 && (
          <span className="mcal-budget-label">
            {t('avgDailyBudgetLabel')}:&nbsp;
            <strong>{fmtCompact(dailyBudget, currency)}</strong>
          </span>
        )}
        <div className="mcal-legend">
          <span><i className="mcal-dot over" />{t('overBudgetLegend')}</span>
          <span><i className="mcal-dot ok" />{t('withinBudgetLegend')}</span>
        </div>
      </div>

      {/* Day detail */}
      {selectedDay !== null && dayTxs.length > 0 && (
        <div className="mcal-detail">
          <MobileTransactionList
            transactions={dayTxs}
            onEdit={onEditTx}
            onDelete={onDeleteTx}
            compact
          />
        </div>
      )}
      {selectedDay !== null && dayTxs.length === 0 && (
        <p className="mcal-empty-day">{t('noMovementsOnDay').replace('{day}', String(selectedDay))}</p>
      )}
    </div>
  )
}
