import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { toast } from '@/components/ui/Toast'
import { generateFinancialIntelligence } from '@/data/financeIntelligence'
import { advanceRecurrenceDate } from '@/hooks/useRecurring'
import { playConfirmSound } from '@/lib/sound'
import { accountSavingsRate, byCategory, currentMonthKey, dateLocale, monthLabel, monthlySeries, netWorthSeries, savingsBalance, totalBalanceInBase, totals, transactionsForTotals, txForMonth } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useFmt } from '@/hooks/useFmt'
import { translateCategoryName, useT } from '@/i18n'
import type { IconName } from '@/types'

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

function SavingsRing({ rate, amount, t, fmtAmount }: { rate: number; amount: number; t: ReturnType<typeof useT>; fmtAmount: string }) {
  const pct = Math.max(0, Math.min(100, rate))
  const dash = 2 * Math.PI * 36
  const fill = dash * pct / 100
  const color = amount > 0 ? '#35d0a2' : '#8a93a6'
  return (
    <div className="man-ring">
      <svg viewBox="0 0 80 80" width={80} height={80}>
        <circle cx={40} cy={40} r={36} fill="none" strokeWidth={8} stroke="rgba(255,255,255,.07)" />
        <circle
          cx={40}
          cy={40}
          r={36}
          fill="none"
          strokeWidth={8}
          stroke={color}
          strokeDasharray={`${fill} ${dash - fill}`}
          strokeDashoffset={dash / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray var(--m-duration-slow, 220ms) var(--m-ease-out, ease)' }}
        />
      </svg>
      <span style={{ color }}>
        <strong>{Math.round(rate)}%</strong>
        <small>{amount > 0 ? t('savings') : fmtAmount}</small>
      </span>
    </div>
  )
}

export function MobileAnalytics({ mkey, onBudgets }: { mkey: string; onBudgets?: () => void }) {
  const { transactions, accounts, categories, goalContributions, currency, updateTx } = useFinance()
  const fmtVal = useFmt()
  const t = useT()
  const settings = useSettings()
  const lang = (settings.language ?? 'es') as 'en' | 'es'
  const compactNumbers = settings.compactNumbers
  const MONTHS_SHORT = getMonthsShort(t)
  const PERIODS = getPeriods(t)
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const year = Number(mkey.slice(0, 4))
  const visTx = useMemo(() => transactionsForTotals(transactions, accounts, currency), [transactions, accounts, currency])
  const monthTx = txForMonth(visTx, mkey)
  const weekWindow = useMemo(() => {
    if (!monthTx.length) return { start: '', end: '', tx: [] as typeof monthTx }
    const sortedDates = [...monthTx].map(tx => tx.date).sort((a, b) => a.localeCompare(b))
    const lastDate = sortedDates[sortedDates.length - 1] ?? `${mkey}-01`
    const end = new Date(`${lastDate}T00:00:00`)
    const start = new Date(end)
    start.setDate(end.getDate() - 6)
    const startKey = start.toISOString().slice(0, 10)
    const endKey = end.toISOString().slice(0, 10)
    return {
      start: startKey,
      end: endKey,
      tx: monthTx.filter(tx => tx.date >= startKey && tx.date <= endKey),
    }
  }, [monthTx, mkey])

  const scopedTx = useMemo(() => {
    if (period === 'year') return visTx.filter(tx => tx.date.startsWith(String(year)))
    if (period === 'week') return weekWindow.tx
    return monthTx
  }, [monthTx, period, visTx, weekWindow.tx, year])

  const summary = totals(scopedTx)
  const savedAmount = savingsBalance(accounts)
  const savingsRate = accountSavingsRate(accounts)
  const currentNetWorth = totalBalanceInBase(accounts, currency)
  const categoryRows = byCategory(scopedTx, 'expense', categories).slice(0, 6)
  const totalExpense = Math.max(1, summary.expense)
  const monthly = monthlySeries(visTx, year)
  const netWorth = netWorthSeries(accounts, transactions, goalContributions, year, dateLocale(lang), currency)

  const barData = useMemo(() => {
    if (period === 'year') {
      return monthly.map(m => ({
        label: MONTHS_SHORT[parseInt(m.key.slice(5, 7)) - 1] ?? m.label,
        income: m.income,
        expense: m.expense,
      }))
    }
    if (period === 'week') {
      if (!weekWindow.start) {
        return Array.from({ length: 7 }, (_, index) => ({ label: String(index + 1), income: 0, expense: 0 }))
      }
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(`${weekWindow.start}T00:00:00`)
        day.setDate(day.getDate() + index)
        const key = day.toISOString().slice(0, 10)
        const dayTx = weekWindow.tx.filter(tx => tx.date === key)
        const daySummary = totals(dayTx)
        return {
          label: String(day.getDate()),
          income: daySummary.income,
          expense: daySummary.expense,
        }
      })
    }
    return monthly.filter(m => m.key <= mkey).slice(-6).map(m => ({
      label: MONTHS_SHORT[parseInt(m.key.slice(5, 7)) - 1] ?? m.label,
      income: m.income,
      expense: m.expense,
    }))
  }, [mkey, monthly, period, weekWindow.start, weekWindow.tx, MONTHS_SHORT])

  const maxBar = Math.max(1, ...barData.flatMap(d => [d.income, d.expense]))

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
  const prevSum = totals(txForMonth(visTx, prevMkey))
  const prevCategoryRows = byCategory(txForMonth(visTx, prevMkey), 'expense', categories)
  const prevCategoryMap = new Map(prevCategoryRows.map(row => [row.category.id, row.amount]))
  const prevPace = prevSum.expense > 0 && dayOfMonth > 0 ? prevSum.expense / daysInMonth * dayOfMonth : 0
  const spendTrend = prevPace > 0 ? Math.round((summary.expense / prevPace - 1) * 100) : null
  const showTrend = period === 'month' && isCurrentMonth && monthTx.length > 0 && dayOfMonth >= 3
  const totalBudget = categories.filter(c => c.type === 'expense').reduce((sum, category) => sum + category.budget, 0)
  const budgetPct = totalBudget > 0 ? Math.min(100, Math.round(summary.expense / totalBudget * 100)) : 0

  const prevYear = year - 1
  const prevYearSum = useMemo(() => totals(visTx.filter(tx => tx.date.startsWith(String(prevYear)))), [visTx, prevYear])
  const compareLabel = period === 'year' ? String(prevYear) : monthLabel(prevMkey, dateLocale(lang))
  const comparePrev = period === 'year' ? prevYearSum : prevSum
  const compareRows: Array<{ label: string; current: number; prev: number; goodWhenUp: boolean; cls: string }> = [
    { label: t('incomes'), current: summary.income, prev: comparePrev.income, goodWhenUp: true, cls: 'income' },
    { label: t('expenses'), current: summary.expense, prev: comparePrev.expense, goodWhenUp: false, cls: 'expense' },
    { label: t('netLabel'), current: summary.net, prev: comparePrev.net, goodWhenUp: true, cls: summary.net >= 0 ? 'income' : 'expense' },
  ]
  const showCompare = period === 'month' || period === 'year'

  const donutValueLabel = fmtVal(summary.expense, currency)
  const donutValueSize = donutValueLabel.length > 11 ? 12 : donutValueLabel.length > 8 ? 14 : 16

  const donut = categoryRows.length
    ? `conic-gradient(${categoryRows.map((row, i) => {
        const start = categoryRows.slice(0, i).reduce((sum, current) => sum + current.amount / totalExpense * 100, 0)
        const end = start + row.amount / totalExpense * 100
        return `${row.category.color} ${start}% ${end}%`
      }).join(', ')}, rgba(255,255,255,.07) 0)`
    : 'conic-gradient(rgba(255,255,255,.07) 0 100%)'

  const heroLabel = period === 'week'
    ? `${weekWindow.start} - ${weekWindow.end}`
    : period === 'year'
      ? String(year)
      : monthLabel(mkey, dateLocale(lang))

  const topCategory = categoryRows[0]
  const topCategoryPrevious = topCategory ? (prevCategoryMap.get(topCategory.category.id) ?? 0) : 0
  const topCategoryDelta = topCategory ? topCategory.amount - topCategoryPrevious : 0
  const overBudgetCategory = categoryRows.find(row => {
    const category = categories.find(item => item.id === row.category.id)
    return !!category && category.budget > 0 && row.amount >= category.budget * 0.8
  })
  const intelligence = useMemo(() => generateFinancialIntelligence({
    txns: visTx,
    categories,
    mkey,
    currentBalance: currentNetWorth,
    anomalySensitivity: settings.anomalySensitivity,
  }), [categories, currentNetWorth, mkey, settings.anomalySensitivity, visTx])
  const recentAnomaly = intelligence.anomalies[0]
  const upcomingSubscription = intelligence.subscriptions.find(item => !item.alreadyRecurring) ?? intelligence.subscriptions[0]
  const netWorthHistory = netWorth.filter(point => point.key <= mkey)
  const netWorthPoint = netWorth.find(point => point.key === mkey) ?? netWorthHistory[netWorthHistory.length - 1] ?? netWorth[0]
  const compareNetDeltaPct = showCompare
    ? comparePrev.net !== 0
      ? Math.round(((summary.net - comparePrev.net) / Math.abs(comparePrev.net)) * 100)
      : (summary.net !== 0 ? 100 : 0)
    : 0

  // Convierte el gasto detectado como suscripción en un recurrente mensual real
  const makeSubscriptionRecurring = () => {
    if (!upcomingSubscription) return
    const candidate = transactions
      .filter(tx => tx.type === 'expense' && !tx.recurring
        && tx.date === upcomingSubscription.lastDate
        && (tx.categoryId ?? '') === (upcomingSubscription.categoryId ?? '')
        && (tx.accountId ?? '') === (upcomingSubscription.accountId ?? ''))
      .sort((a, b) => Math.abs(a.amount - upcomingSubscription.amount) - Math.abs(b.amount - upcomingSubscription.amount))[0]
    if (!candidate) return toast(t('insightRecurringNotFound'), { icon: 'alert' })
    updateTx(candidate.id, {
      recurring: 'monthly',
      recurringStart: candidate.date,
      recurringNext: advanceRecurrenceDate(candidate.date, 'monthly'),
    })
    playConfirmSound()
    toast(t('insightRecurringCreated').replace('{name}', candidate.note), { icon: 'repeat', type: 'ok' })
  }

  const insightRows = [
    topCategory && topCategoryDelta > Math.max(500, topCategoryPrevious * 0.25)
      ? {
          id: 'category-cause',
          icon: topCategory.category.icon,
          tone: 'warn',
          title: t('spentMoreByCategory')
            .replace('{amount}', fmtVal(topCategoryDelta, currency))
            .replace('{category}', translateCategoryName(topCategory.category, lang)),
          subtitle: t('categoryExplainsIncrease'),
          action: onBudgets ? { label: t('insightActionBudget'), onClick: onBudgets } : undefined,
        }
      : null,
    recentAnomaly
      ? {
          id: 'anomaly',
          icon: 'alert' as IconName,
          tone: 'danger',
          title: t('anomalousExpenseTitle').replace('{note}', recentAnomaly.tx.note),
          subtitle: t('anomalousExpenseText')
            .replace('{amount}', fmtVal(recentAnomaly.tx.amount, currency))
            .replace('{baseline}', fmtVal(recentAnomaly.baseline, currency)),
        }
      : null,
    upcomingSubscription
      ? {
          id: 'subscription',
          icon: 'repeat' as IconName,
          tone: upcomingSubscription.alreadyRecurring ? '' : 'warn',
          title: t('subscriptionInsightTitle').replace('{merchant}', upcomingSubscription.merchant),
          subtitle: t('subscriptionInsightText')
            .replace('{amount}', fmtVal(upcomingSubscription.amount, currency))
            .replace('{months}', String(upcomingSubscription.months)),
          action: upcomingSubscription.alreadyRecurring
            ? undefined
            : { label: t('insightActionMakeRecurring'), onClick: makeSubscriptionRecurring },
        }
      : null,
    overBudgetCategory
      ? {
          id: 'budget-risk',
          icon: 'wallet' as IconName,
          tone: 'warn',
          title: t('budgetRiskTitle').replace('{category}', translateCategoryName(overBudgetCategory.category, lang)),
          subtitle: t('budgetRiskText').replace('{amount}', fmtVal(overBudgetCategory.amount, currency)),
          action: onBudgets ? { label: t('insightActionBudget'), onClick: onBudgets } : undefined,
        }
      : null,
    showTrend && spendTrend !== null
      ? {
          id: 'trend',
          icon: spendTrend >= 0 ? 'arrowUp' : 'arrowDn',
          tone: spendTrend > 10 ? 'warn' : spendTrend < -10 ? 'ok' : '',
          title: (spendTrend >= 0 ? t('spendMoreThanLastMonth') : t('spendLessThanLastMonth')).replace('{pct}', String(Math.abs(spendTrend))),
          subtitle: t('samePaceAsElapsedDays'),
        }
      : null,
    showTrend && projectedExpense > 0
      ? {
          id: 'projection',
          icon: 'trend',
          tone: projectedExpense > totalBudget && totalBudget > 0 ? 'warn' : 'ok',
          title: t('projectedAtClose').replace('{amount}', fmtVal(projectedExpense, currency)),
          subtitle: t('ifYouKeepCurrentPace'),
          action: onBudgets && projectedExpense > totalBudget && totalBudget > 0
            ? { label: t('insightActionViewBudgets'), onClick: onBudgets }
            : undefined,
        }
      : null,
    topCategory
      ? {
          id: 'top-category',
          icon: topCategory.category.icon,
          tone: '',
          title: `${translateCategoryName(topCategory.category, lang)} - ${fmtVal(topCategory.amount, currency)}`,
          subtitle: t('topExpenseOfPeriod'),
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string; icon: IconName; tone: string; title: string; subtitle: string
    action?: { label: string; onClick: () => void }
  }>

  return (
    <div className="man-root">
      <div className="mobile-segment man-tabs" role="tablist" aria-label={t('periodLabel')}>
        {PERIODS.map(p => (
          <button key={p.id} className={period === p.id ? 'on' : ''} role="tab" aria-selected={period === p.id} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <section className="man-hero">
        <div className="man-hero-head">
          <div>
            <span className="man-hero-kicker">{heroLabel}</span>
            <h2>{t('monthlyFlowTitle')}</h2>
            <p>{t('monthlyFlowDesc')}</p>
          </div>
          <SavingsRing rate={savingsRate} amount={savedAmount} t={t} fmtAmount={fmtVal(savedAmount, currency)} />
        </div>

        <div className="man-hero-grid">
          <article className="man-hero-card">
            <small>{t('incomes')}</small>
            <strong className="income"><AnimatedMoney value={summary.income} compact={compactNumbers} /></strong>
          </article>
          <article className="man-hero-card">
            <small>{t('expenses')}</small>
            <strong className="expense"><AnimatedMoney value={summary.expense} compact={compactNumbers} /></strong>
          </article>
        </div>

        <article className="man-hero-net">
          <small>{t('netLabel')}</small>
          <strong style={{ color: summary.net >= 0 ? '#35d0a2' : '#ff6b8a' }}>
            <AnimatedMoney value={summary.net} compact={compactNumbers} />
          </strong>
        </article>
      </section>

      <section className="man-metrics">
        <div className="man-panel-head">
          <h3>{t('analyticsMetricsTitle')}</h3>
          <p>{t('analyticsMetricsDesc')}</p>
        </div>

        <div className="man-quick-grid">
          <article className="man-quick-card">
            <span className="man-chip-label">{t('monthlyFlowMetric')}</span>
            <strong className={`man-quick-value ${summary.net >= 0 ? 'income' : 'expense'}`}>
              {fmtVal(summary.net, currency)}
            </strong>
            <span className="man-quick-subtle">{t('incomes')} / {t('expenses')}</span>
          </article>

        {period === 'month' && totalBudget > 0 && onBudgets ? (
          <button className="man-quick-card" onClick={onBudgets}>
            <span className="man-chip-label">{t('monthBudget')}</span>
            <strong className={`man-quick-value ${budgetPct >= 100 ? 'expense' : budgetPct >= 80 ? 'warn' : ''}`}>{budgetPct}%</strong>
            <div className="man-quick-track">
              <span
                style={{
                  width: `${Math.min(100, budgetPct)}%`,
                  background: budgetPct >= 100 ? '#ff6b8a' : budgetPct >= 80 ? '#f59e0b' : '#35d0a2',
                }}
              />
            </div>
          </button>
        ) : (
          <article className="man-quick-card">
            <span className="man-chip-label">{t('savingsRateTitle')}</span>
            <strong className="man-quick-value income">{Math.round(savingsRate)}%</strong>
            <span className="man-quick-subtle">{fmtVal(savedAmount, currency)}</span>
          </article>
        )}

        <article className="man-quick-card">
          <span className="man-chip-label">{t('topCategoryLabel')}</span>
          <strong className="man-quick-value">{topCategory ? translateCategoryName(topCategory.category, lang) : '—'}</strong>
          <span className="man-quick-subtle">{topCategory ? fmtVal(topCategory.amount, currency) : t('noExpensesToAnalyze')}</span>
        </article>

        <article className="man-quick-card">
          <span className="man-chip-label">{t('comparisonLabel')}</span>
          <strong className={`man-quick-value ${compareNetDeltaPct >= 0 ? 'income' : 'expense'}`}>
            {showCompare ? `${compareNetDeltaPct >= 0 ? '+' : ''}${compareNetDeltaPct}%` : '—'}
          </strong>
          <span className="man-quick-subtle">vs. {compareLabel}</span>
        </article>
          <article className="man-quick-card">
            <span className="man-chip-label">{t('netWorthLabel')}</span>
            <strong className={`man-quick-value ${currentNetWorth >= 0 ? 'income' : 'expense'}`}>
              {fmtVal(netWorthPoint?.value ?? currentNetWorth, currency)}
            </strong>
            <span className="man-quick-subtle">{t('patrimonyScope')}</span>
          </article>
        </div>
      </section>

      <section className="man-panel man-panel-distribution">
        <div className="man-panel-head">
          <h3>{t('expenseDistribution')}</h3>
          <p>{t('byCategoryLabel')}</p>
        </div>

        <div className="man-donut-wrap">
          <div className="man-donut" style={{ background: donut }}>
            <span>
              <small>{t('expenses')}</small>
              <strong style={{ fontSize: donutValueSize }}>{donutValueLabel}</strong>
            </span>
          </div>

          <div className="man-legend">
            {categoryRows.slice(0, 5).map(row => {
              const pct = Math.round(row.amount / totalExpense * 100)
              const category = categories.find(item => item.id === row.category.id)
              const budgetUsagePct = category && category.budget > 0 ? Math.min(100, row.amount / category.budget * 100) : null
              return (
                <div key={row.category.id} className="man-legend-row">
                  <i style={{ background: row.category.color }} />
                  <div className="man-legend-main">
                    <strong>{translateCategoryName(row.category, lang)}</strong>
                    {budgetUsagePct !== null && (
                      <span className={`man-budget-chip${budgetUsagePct >= 100 ? ' over' : budgetUsagePct >= 80 ? ' warn' : ''}`}>
                        {t('pctOfBudget').replace('{pct}', String(Math.round(budgetUsagePct)))}
                      </span>
                    )}
                  </div>
                  <div className="man-legend-amount">
                    {fmtVal(row.amount, currency)}
                    <small>{pct}%</small>
                  </div>
                </div>
              )
            })}
            {!categoryRows.length && <p className="man-empty">{t('noExpensesToAnalyze')}</p>}
          </div>
        </div>
      </section>

      {(showCompare || insightRows.length > 0) && (
        <section className="man-panel man-panel-trend">
          <div className="man-panel-head">
            <h3>{t('quickReadTitle')}</h3>
            <p>{t('quickReadDesc')}</p>
          </div>

          {showCompare && (
            <div className="man-compare-list">
              {compareRows.map(row => {
                const delta = row.prev !== 0
                  ? Math.round((row.current / row.prev - 1) * 100)
                  : (row.current !== 0 ? 100 : 0)
                const isUp = delta >= 0
                const isGood = isUp === row.goodWhenUp
                return (
                  <div key={row.label} className="man-compare-row">
                    <div className="man-compare-main">
                      <span>{row.label}</span>
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
          )}

          {insightRows.length > 0 && (
            <div className="man-insights">
              {insightRows.map(insight => (
                <div key={insight.id} className="man-insight-row">
                  <span className={`man-insight-icon ${insight.tone}`}>
                    <Icon name={insight.icon} size={16} />
                  </span>
                  <div className="man-insight-copy">
                    <strong>{insight.title}</strong>
                    <small>{insight.subtitle}</small>
                    {insight.action && (
                      <button className="man-insight-action" onClick={insight.action.onClick}>
                        {insight.action.label} <Icon name="arrowUp" size={11} style={{ transform: 'rotate(90deg)' }} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="man-panel man-panel-bars">
        <div className="man-panel-head">
          <h3>{period === 'week' ? t('weeklyExpenses') : period === 'year' ? t('incomeVsExpense') : t('last6Months')}</h3>
          <p>{period === 'week' ? `${weekWindow.start} - ${weekWindow.end}` : t('comparisonLabel')}</p>
        </div>

        <div className="man-bar-chart">
          {barData.map(d => (
            <div key={d.label} className="man-bar-col">
              <div className="man-bar-tracks">
                {(period !== 'week' || d.income > 0) && (
                  <div
                    className="man-bar-income"
                    style={{ height: `${Math.max(2, d.income / maxBar * 100)}%` }}
                    title={t('incomeColon').replace('{amount}', fmtVal(d.income, currency))}
                  />
                )}
                <div
                  className="man-bar-expense"
                  style={{ height: `${Math.max(2, d.expense / maxBar * 100)}%` }}
                  title={t('expenseColon').replace('{amount}', fmtVal(d.expense, currency))}
                />
              </div>
              <span className="man-bar-label">{d.label}</span>
            </div>
          ))}
        </div>

        {(period !== 'week' || barData.some(d => d.income > 0)) && (
          <div className="man-bar-legend">
            <span><i style={{ background: '#35d0a2' }} />{t('incomes')}</span>
            <span><i style={{ background: '#ff6b8a' }} />{t('expenses')}</span>
          </div>
        )}
      </section>

      {categoryRows.length > 0 && (
        <section className="man-panel man-panel-categories">
          <div className="man-panel-head">
            <h3>{t('topCategoriesTitle')}</h3>
            <p>{t('topExpenseOfPeriod')}</p>
          </div>
          <div className="man-category-list">
            {categoryRows.map((row, index) => {
              const category = categories.find(item => item.id === row.category.id)
              const pct = row.amount / totalExpense * 100
              return (
                <div key={row.category.id} className="man-cat-row">
                  <div className="man-cat-top">
                    <div className="man-cat-meta">
                      <span className="man-cat-rank">{index + 1}</span>
                      <span
                        className="man-cat-icon"
                        style={{
                          color: row.category.color,
                          background: `color-mix(in oklab, ${row.category.color} 16%, transparent)`,
                        }}
                      >
                        <Icon name={row.category.icon} size={18} />
                      </span>
                      <span className="man-cat-name">{translateCategoryName(row.category, lang)}</span>
                    </div>
                    <strong>{fmtVal(row.amount, currency)}</strong>
                  </div>
                  <div className="man-cat-bar">
                    <div style={{ width: `${pct}%`, background: row.category.color }} />
                  </div>
                  {category && category.budget > 0 && (
                    <span className={`man-cat-budget${row.amount > category.budget ? ' over' : ''}`}>
                      {row.amount > category.budget
                        ? t('overBudgetAmount').replace('{amount}', fmtVal(row.amount - category.budget, currency))
                        : t('availableAmount').replace('{amount}', fmtVal(category.budget - row.amount, currency))}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div style={{ height: 'calc(12px + env(safe-area-inset-bottom))' }} />
    </div>
  )
}
