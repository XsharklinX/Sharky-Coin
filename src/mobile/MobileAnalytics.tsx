import { useMemo, useState } from 'react'
import { byCategory, fmtCompact, monthlySeries, totals, txForMonth, weeklySeries } from '@/data/helpers'
import { useFinance } from '@/store/finance'

type AnalyticsPeriod = 'week' | 'month' | 'year'

const PERIODS: Array<{ id: AnalyticsPeriod; label: string }> = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'year', label: 'Año' },
]

export function MobileAnalytics({ mkey }: { mkey: string }) {
  const { transactions, categories, currency } = useFinance()
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const year = Number(mkey.slice(0, 4))
  const monthTx = txForMonth(transactions, mkey)
  const scopedTx = useMemo(() => {
    if (period === 'year') return transactions.filter(tx => tx.date.startsWith(String(year)))
    return monthTx
  }, [monthTx, period, transactions, year])
  const summary = totals(scopedTx)
  const categoryRows = byCategory(scopedTx, 'expense', categories).slice(0, 6)
  const totalExpense = Math.max(1, summary.expense)
  const weekly = weeklySeries(monthTx)
  const monthly = monthlySeries(transactions, year)
  const comparison = period === 'year'
    ? monthly.map(item => ({ label: item.label, value: item.expense }))
    : period === 'week'
      ? weekly
      : monthly.filter(item => item.key <= mkey).slice(-6).map(item => ({ label: item.label, value: item.expense }))

  const donut = categoryRows.length
    ? `conic-gradient(${categoryRows.map((row, index) => {
      const start = categoryRows.slice(0, index).reduce((sum, item) => sum + item.amount / totalExpense * 100, 0)
      const end = start + row.amount / totalExpense * 100
      return `${row.category.color} ${start}% ${end}%`
    }).join(', ')}, rgba(255,255,255,.08) 0)`
    : 'conic-gradient(rgba(255,255,255,.08) 0 100%)'

  const maxComparison = Math.max(1, ...comparison.map(item => item.value))

  return (
    <div className="mobile-analytics">
      <div className="mobile-segment mobile-analytics-tabs" role="tablist" aria-label="Periodo de análisis">
        {PERIODS.map(item => (
          <button
            key={item.id}
            className={period === item.id ? 'on' : ''}
            aria-selected={period === item.id}
            role="tab"
            onClick={() => setPeriod(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <section className="mobile-chart-card">
        <div className="mobile-donut-wrap">
          <div className="mobile-donut" style={{ background: donut }}>
            <span>
              <small>Gastos</small>
              <strong>{fmtCompact(summary.expense, currency)}</strong>
            </span>
          </div>
          <div className="mobile-donut-legend">
            {categoryRows.slice(0, 5).map(row => (
              <div key={row.category.id}>
                <i style={{ background: row.category.color }} />
                <span>{row.category.name}</span>
                <strong>{Math.round(row.amount / totalExpense * 100)}%</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mobile-section-card">
        <header>
          <div>
            <h2>Categorías</h2>
            <p>Distribución de gastos</p>
          </div>
        </header>
        <div className="mobile-category-bars">
          {categoryRows.map(row => (
            <article key={row.category.id}>
              <div>
                <span style={{ color: row.category.color }}>{row.category.name}</span>
                <strong>{fmtCompact(row.amount, currency)}</strong>
              </div>
              <div className="mobile-progress-track">
                <span style={{ width: `${Math.min(100, row.amount / totalExpense * 100)}%`, background: row.category.color }} />
              </div>
            </article>
          ))}
          {!categoryRows.length && <p className="mobile-muted">Sin gastos para analizar.</p>}
        </div>
      </section>

      <section className="mobile-section-card">
        <header>
          <div>
            <h2>Comparativa</h2>
            <p>{period === 'week' ? 'Gastos por semana del mes' : period === 'year' ? 'Gastos por mes del año' : 'Últimos meses'}</p>
          </div>
        </header>
        <div className="mobile-comparison-bars">
          {comparison.map(item => (
            <article key={item.label}>
              <span>{item.label}</span>
              <div><i style={{ width: `${Math.max(4, item.value / maxComparison * 100)}%` }} /></div>
              <strong>{fmtCompact(item.value, currency)}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
