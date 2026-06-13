import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { byCategory, currentMonthKey, dateLocale, monthLabel, monthlySeries, totals, txForMonth, weeklySeries } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useFmt } from '@/hooks/useFmt'
import { translateCategoryName, useT } from '@/i18n'

type AnalyticsPeriod = 'week' | 'month' | 'year'

function getMonthsShort(t: ReturnType<typeof useT>) {
  return [
    t('janShort'), t('febShort'), t('marShort'), t('aprShort'),
    t('mayShort'), t('junShort'), t('julShort'), t('augShort'),
    t('sepShort'), t('octShort'), t('novShort'), t('decShort'),
  ]
}

function getPeriods(t: ReturnType<typeof useT>): Array<{ id: AnalyticsPeriod; label: string }> {
  return [
    { id: 'week', label: t('periodWeek') },
    { id: 'month', label: t('periodMonth') },
    { id: 'year', label: t('periodYear') },
  ]
}

function SavingsRing({ rate, t }: { rate: number; t: ReturnType<typeof useT> }) {
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
        <small>{positive ? t('savingsWord') : t('deficitWord')}</small>
      </span>
    </div>
  )
}

export function MobileAnalytics({ mkey, onBudgets }: { mkey: string; onBudgets?: () => void }) {
  const { transactions, categories, currency } = useFinance()
  const fmtVal = useFmt()
  const t = useT()
  const lang = (useSettings(s => s.language) ?? 'es') as 'en' | 'es'
  const compactNumbers = useSettings(s => s.compactNumbers)
  const MONTHS_SHORT = getMonthsShort(t)
  const PERIODS = getPeriods(t)
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

  // Comparativa mes vs. mes anterior / año vs. año anterior
  const prevYear = year - 1
  const prevYearSum = useMemo(
    () => totals(transactions.filter(tx => tx.date.startsWith(String(prevYear)))),
    [transactions, prevYear],
  )
  const compareLabel = period === 'year' ? String(prevYear) : monthLabel(prevMkey, dateLocale(lang))
  const comparePrev = period === 'year' ? prevYearSum : prevSum
  const compareRows: Array<{ label: string; current: number; prev: number; goodWhenUp: boolean; cls: string }> = [
    { label: t('incomes'), current: summary.income, prev: comparePrev.income, goodWhenUp: true, cls: 'income' },
    { label: t('expenses'), current: summary.expense, prev: comparePrev.expense, goodWhenUp: false, cls: 'expense' },
    { label: t('netLabel'), current: summary.net, prev: comparePrev.net, goodWhenUp: true, cls: summary.net >= 0 ? 'income' : 'expense' },
  ]
  const showCompare = period === 'month' || period === 'year'

  // Donut — tamaño de fuente del centro según el largo del monto, para que no se desborde
  const donutValueLabel = fmtVal(summary.expense, currency)
  const donutValueSize = donutValueLabel.length > 11 ? 12 : donutValueLabel.length > 8 ? 14 : 16

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
      <div className="mobile-segment man-tabs" role="tablist" aria-label={t('periodLabel')}>
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
          <small>{t('incomes')}</small>
          <strong className="income"><AnimatedMoney value={summary.income} compact={compactNumbers} /></strong>
        </div>
        <div className="man-summary-card">
          <small>{t('expenses')}</small>
          <strong className="expense"><AnimatedMoney value={summary.expense} compact={compactNumbers} /></strong>
        </div>
        <div className="man-summary-card">
          <small>{t('netLabel')}</small>
          <strong style={{ color: summary.net >= 0 ? '#35d0a2' : '#ff6b8a' }}>
            <AnimatedMoney value={summary.net} compact={compactNumbers} />
          </strong>
        </div>
      </div>

      {/* Savings rate + donut */}
      <section className="man-card man-donut-section">
        <div className="man-card-header">
          <h2>{t('expenseDistribution')}</h2>
          <p>{t('byCategoryLabel')}</p>
        </div>
        <div className="man-donut-wrap">
          <div className="man-donut" style={{ background: donut }}>
            <span>
              <small>{t('expenses')}</small>
              <strong style={{ fontSize: donutValueSize }}>{donutValueLabel}</strong>
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
                  <span className="man-legend-name">{translateCategoryName(row.category, lang)}</span>
                  <div className="man-legend-right">
                    <div className="man-legend-values">
                      <strong>{fmtVal(row.amount, currency)}</strong>
                      <span className="man-legend-pct">{pct}%</span>
                    </div>
                    {budgetPct !== null && (
                      <span className={`man-budget-chip${budgetPct >= 100 ? ' over' : budgetPct >= 80 ? ' warn' : ''}`}>
                        {t('pctOfBudget').replace('{pct}', String(Math.round(budgetPct)))}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {!categoryRows.length && <p className="man-empty">{t('noExpensesToAnalyze')}</p>}
          </div>
        </div>
      </section>

      {/* Presupuesto del mes (acceso rápido) */}
      {onBudgets && period === 'month' && totalBudget > 0 && (
        <button className="man-card man-budget-card" onClick={onBudgets}>
          <div className="man-card-header">
            <h2>{t('monthBudget')}</h2>
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
            <span><AnimatedMoney value={summary.expense} compact={compactNumbers} /> {t('spent')}</span>
            <span>{t('of')} {fmtVal(totalBudget, currency)}</span>
          </div>
        </button>
      )}

      {/* Tendencia y proyección */}
      {showTrend && (spendTrend !== null || projectedExpense > 0) && (
        <section className="man-card man-trend-section">
          <div className="man-card-header">
            <h2>{t('monthTrendTitle')}</h2>
            <p>{t('comparedToUsualPace')}</p>
          </div>
          <div className="man-trend-rows">
            {spendTrend !== null && (
              <div className="man-trend-row">
                <span className={`man-trend-icon ${spendTrend > 10 ? 'warn' : spendTrend < -10 ? 'ok' : ''}`}>
                  <Icon name={spendTrend >= 0 ? 'arrowUp' : 'arrowDn'} size={15} />
                </span>
                <div>
                  <strong>{(spendTrend >= 0 ? t('spendMoreThanLastMonth') : t('spendLessThanLastMonth')).replace('{pct}', String(Math.abs(spendTrend)))}</strong>
                  <small>{t('samePaceAsElapsedDays')}</small>
                </div>
              </div>
            )}
            {projectedExpense > 0 && (
              <div className="man-trend-row">
                <span className={`man-trend-icon ${projectedExpense > totalBudget && totalBudget > 0 ? 'warn' : ''}`}>
                  <Icon name="trend" size={15} />
                </span>
                <div>
                  <strong>{t('projectedAtClose').replace('{amount}', fmtVal(projectedExpense, currency))}</strong>
                  <small>{t('ifYouKeepCurrentPace')}</small>
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
            <h2>{t('savingsRateTitle')}</h2>
            <p>{period === 'year' ? String(year) : mkey}</p>
          </div>
          <div className="man-savings-body">
            <SavingsRing rate={savingsRate} t={t} />
            <div className="man-savings-detail">
              <div>
                <small>{t('totalIncomeLabel')}</small>
                <strong>{fmtVal(summary.income, currency)}</strong>
              </div>
              <div>
                <small>{t('totalExpenseLabel')}</small>
                <strong>{fmtVal(summary.expense, currency)}</strong>
              </div>
              <div>
                <small>{summary.net >= 0 ? t('netSavingsLabel') : t('deficitLabel')}</small>
                <strong style={{ color: summary.net >= 0 ? '#35d0a2' : '#ff6b8a' }}>
                  {fmtVal(Math.abs(summary.net), currency)}
                </strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Comparativa con el período anterior */}
      {showCompare && (
        <section className="man-card man-compare-section">
          <div className="man-card-header">
            <h2>{t('comparisonLabel')}</h2>
            <p>vs. {compareLabel}</p>
          </div>
          <div className="man-compare-rows">
            {compareRows.map(row => {
              const delta = row.prev !== 0
                ? Math.round((row.current / row.prev - 1) * 100)
                : (row.current !== 0 ? 100 : 0)
              const isUp = delta >= 0
              const isGood = isUp === row.goodWhenUp
              return (
                <div key={row.label} className="man-compare-row">
                  <div className="man-compare-main">
                    <span className="man-compare-label">{row.label}</span>
                    <strong className={row.cls}>{fmtVal(row.current, currency)}</strong>
                  </div>
                  <div className="man-compare-side">
                    <span className={`man-compare-delta ${delta === 0 ? '' : isGood ? 'ok' : 'warn'}`}>
                      <Icon name={isUp ? 'arrowUp' : 'arrowDn'} size={11} />
                      {Math.abs(delta)}%
                    </span>
                    <small>{fmtVal(row.prev, currency)}</small>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Bar chart — income vs expense */}
      <section className="man-card">
        <div className="man-card-header">
          <h2>{period === 'week' ? t('weeklyExpenses') : period === 'year' ? t('incomeVsExpense') : t('last6Months')}</h2>
          <p>{period === 'week' ? t('ofCurrentMonth') : t('comparisonLabel')}</p>
        </div>
        <div className="man-bar-chart">
          {barData.map(d => (
            <div key={d.label} className="man-bar-col">
              <div className="man-bar-tracks">
                {period !== 'week' && (
                  <div className="man-bar-income"
                    style={{ height: `${Math.max(2, d.income / maxBar * 100)}%` }}
                    title={t('incomeColon').replace('{amount}', fmtVal(d.income, currency))}
                  />
                )}
                <div className="man-bar-expense"
                  style={{ height: `${Math.max(2, d.expense / maxBar * 100)}%` }}
                  title={t('expenseColon').replace('{amount}', fmtVal(d.expense, currency))}
                />
              </div>
              <span className="man-bar-label">{d.label}</span>
            </div>
          ))}
        </div>
        {period !== 'week' && (
          <div className="man-bar-legend">
            <span><i style={{ background: '#35d0a2' }} />{t('incomes')}</span>
            <span><i style={{ background: '#ff6b8a' }} />{t('expenses')}</span>
          </div>
        )}
      </section>

      {/* Top categorías con monto */}
      {categoryRows.length > 0 && (
        <section className="man-card">
          <div className="man-card-header">
            <h2>{t('topCategoriesTitle')}</h2>
            <p>{t('topExpenseOfPeriod')}</p>
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
                      <span className="man-cat-name">{translateCategoryName(row.category, lang)}</span>
                      <strong>{fmtVal(row.amount, currency)}</strong>
                    </div>
                    <div className="man-cat-bar">
                      <div style={{ width: `${pct}%`, background: row.category.color }} />
                    </div>
                    {cat && cat.budget > 0 && (
                      <span className={`man-cat-budget${row.amount > cat.budget ? ' over' : ''}`}>
                        {row.amount > cat.budget
                          ? t('overBudgetAmount').replace('{amount}', fmtVal(row.amount - cat.budget, currency))
                          : t('availableAmount').replace('{amount}', fmtVal(cat.budget - row.amount, currency))}
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
