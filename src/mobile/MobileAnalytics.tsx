import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { byCategory, currentMonthKey, monthlySeries, totals, txForMonth, weeklySeries } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useFmt } from '@/hooks/useFmt'

type AnalyticsPeriod = 'week' | 'month' | 'year'

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const PERIODS: Array<{ id: AnalyticsPeriod; label: string }> = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'year', label: 'Año' },
]

function SavingsRing({ rate }: { rate: number }) {
  const clamped = Math.max(-100, Math.min(100, rate))
  const positive = clamped >= 0
  const pct = Math.abs(clamped)
  const dash = 2 * Math.PI * 36
  const fill = dash * pct / 100
  const color = pct >= 20 ? '#35d0a2' : pct >= 5 ? '#ffdd3d' : '#ff6b8a'
  return (
    <div className="man-ring">
      <svg viewBox="0 0 80 80" width={80} height={80}>
        <circle cx={40} cy={40} r={36} fill="none" strokeWidth={8}
          stroke="rgba(255,255,255,.07)" />
        <circle cx={40} cy={40} r={36} fill="none" strokeWidth={8}
          stroke={positive ? color : '#ff6b8a'}
          strokeDasharray={`${fill} ${dash - fill}`}
          strokeDashoffset={dash / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .5s ease' }}
        />
      </svg>
      <span style={{ color: positive ? color : '#ff6b8a' }}>
        <strong>{positive ? '' : '-'}{Math.abs(Math.round(rate))}%</strong>
        <small>{positive ? 'ahorro' : 'déficit'}</small>
      </span>
    </div>
  )
}

export function MobileAnalytics({ mkey, onBudgets }: { mkey: string; onBudgets?: () => void }) {
  const { transactions, categories, currency } = useFinance()
  const fmtVal = useFmt()
  const compactNumbers = useSettings(s => s.compactNumbers)
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const year = Number(mkey.slice(0, 4))
  const monthTx = txForMonth(transactions, mkey)

  const scopedTx = useMemo(() => {
    if (period === 'year') return transactions.filter(tx => tx.date.startsWith(String(year)))
    if (period === 'week') return monthTx
    return monthTx
  }, [monthTx, period, transactions, year])

  const summary = totals(scopedTx)
  const savingsRate = summary.income > 0 ? ((summary.income - summary.expense) / summary.income) * 100 : 0

  const categoryRows = byCategory(scopedTx, 'expense', categories).slice(0, 6)
  const totalExpense = Math.max(1, summary.expense)

  const weekly = weeklySeries(monthTx)
  const monthly = monthlySeries(transactions, year)

  const barData = useMemo(() => {
    if (period === 'year') {
      return monthly.map(m => ({
        label: MONTHS_SHORT[parseInt(m.key.slice(5, 7)) - 1] ?? m.label,
        income: m.income,
        expense: m.expense,
        net: m.income - m.expense,
      }))
    }
    if (period === 'week') {
      return weekly.map(w => ({ label: w.label, income: 0, expense: w.value, net: -w.value }))
    }
    // month: last 6 months
    return monthly.filter(m => m.key <= mkey).slice(-6).map(m => ({
      label: MONTHS_SHORT[parseInt(m.key.slice(5, 7)) - 1] ?? m.label,
      income: m.income,
      expense: m.expense,
      net: m.income - m.expense,
    }))
  }, [mkey, monthly, period, weekly])

  const maxBar = Math.max(1, ...barData.flatMap(d => [d.income, d.expense]))

  // Tendencia y proyección del mes en curso
  const isCurrentMonth = mkey === currentMonthKey()
  const today = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const projectedExpense = isCurrentMonth && dayOfMonth > 0 ? summary.expense / dayOfMonth * daysInMonth : 0
  const prevMkey = (() => {
    const [y, m] = mkey.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const prevSum = totals(txForMonth(transactions, prevMkey))
  const prevPace = prevSum.expense > 0 && dayOfMonth > 0 ? prevSum.expense / daysInMonth * dayOfMonth : 0
  const spendTrend = prevPace > 0 ? Math.round((summary.expense / prevPace - 1) * 100) : null
  const showTrend = period === 'month' && isCurrentMonth && monthTx.length > 0 && dayOfMonth >= 3
  const totalBudget = categories.filter(c => c.type === 'expense').reduce((s, c) => s + c.budget, 0)
  const budgetPct = totalBudget > 0 ? Math.min(100, Math.round(summary.expense / totalBudget * 100)) : 0

  // Donut
  const donut = categoryRows.length
    ? `conic-gradient(${categoryRows.map((row, i) => {
        const start = categoryRows.slice(0, i).reduce((s, r) => s + r.amount / totalExpense * 100, 0)
        const end = start + row.amount / totalExpense * 100
        return `${row.category.color} ${start}% ${end}%`
      }).join(', ')}, rgba(255,255,255,.07) 0)`
    : 'conic-gradient(rgba(255,255,255,.07) 0 100%)'

  return (
    <div className="man-root">

      {/* Period tabs */}
      <div className="mobile-segment man-tabs" role="tablist" aria-label="Periodo">
        {PERIODS.map(p => (
          <button key={p.id} className={period === p.id ? 'on' : ''} role="tab"
            aria-selected={period === p.id} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary strip */}
      <div className="man-summary">
        <div className="man-summary-card">
          <small>Ingresos</small>
          <strong className="income"><AnimatedMoney value={summary.income} compact={compactNumbers} /></strong>
        </div>
        <div className="man-summary-card">
          <small>Gastos</small>
          <strong className="expense"><AnimatedMoney value={summary.expense} compact={compactNumbers} /></strong>
        </div>
        <div className="man-summary-card">
          <small>Neto</small>
          <strong style={{ color: summary.net >= 0 ? '#35d0a2' : '#ff6b8a' }}>
            <AnimatedMoney value={summary.net} compact={compactNumbers} />
          </strong>
        </div>
      </div>

      {/* Savings rate + donut */}
      <section className="man-card man-donut-section">
        <div className="man-card-header">
          <h2>Distribución de gastos</h2>
          <p>Por categoría</p>
        </div>
        <div className="man-donut-wrap">
          <div className="man-donut" style={{ background: donut }}>
            <span>
              <small>Gastos</small>
              <strong>{fmtVal(summary.expense, currency)}</strong>
            </span>
          </div>
          <div className="man-donut-legend">
            {categoryRows.slice(0, 5).map(row => {
              const pct = Math.round(row.amount / totalExpense * 100)
              const cat = categories.find(c => c.id === row.category.id)
              const budgetPct = cat && cat.budget > 0 ? Math.min(100, row.amount / cat.budget * 100) : null
              return (
                <div key={row.category.id} className="man-legend-row">
                  <i style={{ background: row.category.color }} />
                  <span className="man-legend-name">{row.category.name}</span>
                  <div className="man-legend-right">
                    <strong>{pct}%</strong>
                    {budgetPct !== null && (
                      <span className={`man-budget-chip${budgetPct >= 100 ? ' over' : budgetPct >= 80 ? ' warn' : ''}`}>
                        {Math.round(budgetPct)}% pres.
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {!categoryRows.length && <p className="man-empty">Sin gastos para analizar.</p>}
          </div>
        </div>
      </section>

      {/* Presupuesto del mes (acceso rápido) */}
      {onBudgets && period === 'month' && totalBudget > 0 && (
        <button className="man-card man-budget-card" onClick={onBudgets}>
          <div className="man-card-header">
            <h2>Presupuesto del mes</h2>
            <span className={`man-budget-pct ${budgetPct >= 100 ? 'danger' : budgetPct >= 80 ? 'warn' : 'ok'}`}>
              {budgetPct}%
            </span>
          </div>
          <div className="man-budget-track">
            <span className="man-budget-fill" style={{
              width: `${Math.min(100, budgetPct)}%`,
              background: budgetPct >= 100 ? '#ff6b8a' : budgetPct >= 80 ? '#f59e0b' : 'var(--accent, #ffdd3d)',
            }} />
          </div>
          <div className="man-budget-meta">
            <span><AnimatedMoney value={summary.expense} compact={compactNumbers} /> gastado</span>
            <span>de {fmtVal(totalBudget, currency)}</span>
          </div>
        </button>
      )}

      {/* Tendencia y proyección */}
      {showTrend && (spendTrend !== null || projectedExpense > 0) && (
        <section className="man-card man-trend-section">
          <div className="man-card-header">
            <h2>Tendencia del mes</h2>
            <p>Comparado con tu ritmo habitual</p>
          </div>
          <div className="man-trend-rows">
            {spendTrend !== null && (
              <div className="man-trend-row">
                <span className={`man-trend-icon ${spendTrend > 10 ? 'warn' : spendTrend < -10 ? 'ok' : ''}`}>
                  <Icon name={spendTrend >= 0 ? 'arrowUp' : 'arrowDn'} size={15} />
                </span>
                <div>
                  <strong>Gastos {Math.abs(spendTrend)}% {spendTrend >= 0 ? 'más' : 'menos'} que el mes pasado</strong>
                  <small>Al mismo ritmo de días transcurridos</small>
                </div>
              </div>
            )}
            {projectedExpense > 0 && (
              <div className="man-trend-row">
                <span className={`man-trend-icon ${projectedExpense > totalBudget && totalBudget > 0 ? 'warn' : ''}`}>
                  <Icon name="trend" size={15} />
                </span>
                <div>
                  <strong>Proyección al cierre: {fmtVal(projectedExpense, currency)}</strong>
                  <small>Si mantienes el ritmo actual de gasto</small>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tasa de ahorro */}
      {period !== 'week' && summary.income > 0 && (
        <section className="man-card man-savings-section">
          <div className="man-card-header">
            <h2>Tasa de ahorro</h2>
            <p>{period === 'year' ? String(year) : mkey}</p>
          </div>
          <div className="man-savings-body">
            <SavingsRing rate={savingsRate} />
            <div className="man-savings-detail">
              <div>
                <small>Ingresos totales</small>
                <strong>{fmtVal(summary.income, currency)}</strong>
              </div>
              <div>
                <small>Gastos totales</small>
                <strong>{fmtVal(summary.expense, currency)}</strong>
              </div>
              <div>
                <small>{summary.net >= 0 ? 'Ahorro neto' : 'Déficit'}</small>
                <strong style={{ color: summary.net >= 0 ? '#35d0a2' : '#ff6b8a' }}>
                  {fmtVal(Math.abs(summary.net), currency)}
                </strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Bar chart — income vs expense */}
      <section className="man-card">
        <div className="man-card-header">
          <h2>{period === 'week' ? 'Gastos semanales' : period === 'year' ? 'Ingresos vs Gastos' : 'Últimos 6 meses'}</h2>
          <p>{period === 'week' ? 'Del mes actual' : 'Comparativa'}</p>
        </div>
        <div className="man-bar-chart">
          {barData.map(d => (
            <div key={d.label} className="man-bar-col">
              <div className="man-bar-tracks">
                {period !== 'week' && (
                  <div className="man-bar-income"
                    style={{ height: `${Math.max(2, d.income / maxBar * 100)}%` }}
                    title={`Ingreso: ${fmtVal(d.income, currency)}`}
                  />
                )}
                <div className="man-bar-expense"
                  style={{ height: `${Math.max(2, d.expense / maxBar * 100)}%` }}
                  title={`Gasto: ${fmtVal(d.expense, currency)}`}
                />
              </div>
              <span className="man-bar-label">{d.label}</span>
            </div>
          ))}
        </div>
        {period !== 'week' && (
          <div className="man-bar-legend">
            <span><i style={{ background: '#35d0a2' }} />Ingresos</span>
            <span><i style={{ background: '#ff6b8a' }} />Gastos</span>
          </div>
        )}
      </section>

      {/* Top categorías con monto */}
      {categoryRows.length > 0 && (
        <section className="man-card">
          <div className="man-card-header">
            <h2>Top categorías</h2>
            <p>Mayor gasto del período</p>
          </div>
          <div className="man-category-list">
            {categoryRows.map((row, i) => {
              const cat = categories.find(c => c.id === row.category.id)
              const pct = row.amount / totalExpense * 100
              return (
                <div key={row.category.id} className="man-cat-row">
                  <span className="man-cat-rank">{i + 1}</span>
                  <span className="man-cat-icon" style={{
                    color: row.category.color,
                    background: `color-mix(in oklab, ${row.category.color} 16%, transparent)`,
                  }}>
                    <Icon name={row.category.icon} size={18} />
                  </span>
                  <div className="man-cat-body">
                    <div className="man-cat-top">
                      <span className="man-cat-name">{row.category.name}</span>
                      <strong>{fmtVal(row.amount, currency)}</strong>
                    </div>
                    <div className="man-cat-bar">
                      <div style={{ width: `${pct}%`, background: row.category.color }} />
                    </div>
                    {cat && cat.budget > 0 && (
                      <span className={`man-cat-budget${row.amount > cat.budget ? ' over' : ''}`}>
                        {row.amount > cat.budget
                          ? `${fmtVal(row.amount - cat.budget, currency)} sobre presupuesto`
                          : `${fmtVal(cat.budget - row.amount, currency)} disponible`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div style={{ height: 'calc(16px + env(safe-area-inset-bottom))' }} />
    </div>
  )
}
