import { useEffect, useMemo, useState } from 'react'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { Icon } from '@/components/ui/Icon'
import { getMobileAlerts } from '@/data/alerts'
import { accountSavingsRate, byCategory, currentMonthKey, dateLocale, fmt, fmtCompact, monthLabel, savingsBalance, totals, transactionsForTotals, txForMonth, visibleAccounts } from '@/data/helpers'
import { notificationActionTypeId, sendNativeNotification } from '@/hooks/useTauri'
import { translateCategoryName, useT } from '@/i18n'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { MobileTransactionList } from './MobileTransactionList'
import type { Transaction } from '@/types'

function prevMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MobileHome({
  mkey,
  visibleMonth,
  onVisibleMonthChange,
  onAdd,
  onOpenAnalysis,
  onOpenBudgets,
  onEditTx,
  onDeleteTx,
}: {
  mkey: string
  visibleMonth: string
  onVisibleMonthChange: (mk: string) => void
  onAdd: () => void
  onOpenAnalysis?: () => void
  onOpenBudgets?: () => void
  onEditTx: (tx: Transaction) => void
  onDeleteTx?: (id: string) => void
}) {
  const { transactions, accounts, categories, currency } = useFinance()
  const settings = useSettings()
  const { dismissedAlerts, dismissAlert, notifiedAlerts, markAlertNotified, compactNumbers } = settings
  const t = useT()
  const lang = useSettings(s => s.language)

  const [extraMonths, setExtraMonths] = useState<string[]>([])
  const [showBalanceBreakdown, setShowBalanceBreakdown] = useState(false)

  useEffect(() => { setExtraMonths([]) }, [mkey])

  const totalsTx = transactionsForTotals(transactions, accounts)
  const visibleMonthTx = txForMonth(totalsTx, visibleMonth)
  const summary = totals(visibleMonthTx)
  const isCurrent = mkey === currentMonthKey()

  const totalBalance = visibleAccounts(accounts).reduce((sum, account) => sum + account.balance, 0)
  const balancePositive = totalBalance >= 0
  const expenseCategories = categories.filter(category => category.type === 'expense')
  const monthlyBudget = expenseCategories.reduce((sum, category) => sum + Math.max(0, category.budget), 0)
  const budgetRemaining = monthlyBudget - summary.expense
  const budgetProgress = monthlyBudget > 0 ? Math.min(100, Math.max(0, (summary.expense / monthlyBudget) * 100)) : 0
  const savedAmount = savingsBalance(accounts)
  const savingsRate = Math.round(accountSavingsRate(accounts))
  const topExpense = byCategory(visibleMonthTx, 'expense', categories)[0] ?? null
  const comparisonMonth = prevMonthKey(visibleMonth)
  const previousSummary = totals(txForMonth(totalsTx, comparisonMonth))
  const expenseDelta = summary.expense - previousSummary.expense
  const expenseDeltaPct = previousSummary.expense > 0
    ? Math.round((Math.abs(expenseDelta) / previousSummary.expense) * 100)
    : 0

  const alerts = useMemo(
    () => getMobileAlerts(transactions, categories, currency, undefined, dateLocale(lang)),
    [transactions, categories, currency, lang],
  )
  const visibleAlerts = isCurrent ? alerts.filter(alert => !dismissedAlerts.includes(alert.id)) : []

  useEffect(() => {
    if (!isCurrent) return
    const fresh = alerts.filter(alert => !notifiedAlerts.includes(alert.id))
    fresh.forEach(alert => {
      sendNativeNotification(alert.title, alert.text, { actionTypeId: notificationActionTypeId, extra: { alertId: alert.id } })
      markAlertNotified(alert.id)
    })
  }, [isCurrent, alerts, notifiedAlerts, markAlertNotified])

  const fmtVal = (n: number) => compactNumbers ? fmtCompact(n, currency) : fmt(n, currency)

  const oldestLoaded = extraMonths.length ? extraMonths[extraMonths.length - 1] : mkey
  const prevKey = prevMonthKey(oldestLoaded)
  const prevHasTx = totalsTx.some(tx => tx.date.startsWith(prevKey))

  useEffect(() => {
    const scrollContainer = document.querySelector('.mobile-content')
    if (!scrollContainer) return

    let pending: ReturnType<typeof setTimeout> | null = null

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.find(entry => entry.isIntersecting)
        if (!visible) return
        const mk = visible.target.getAttribute('data-month')
        if (!mk) return
        if (pending) clearTimeout(pending)
        pending = setTimeout(() => onVisibleMonthChange(mk), 120)
      },
      {
        root: scrollContainer,
        rootMargin: '-60px 0px -85% 0px',
        threshold: 0,
      },
    )

    const elements = scrollContainer.querySelectorAll('[data-month]')
    elements.forEach(element => observer.observe(element))

    return () => {
      observer.disconnect()
      if (pending) clearTimeout(pending)
    }
  }, [mkey, extraMonths, onVisibleMonthChange])

  const loadPrevMonth = () => setExtraMonths(months => [...months, prevKey])

  return (
    <div className="mobile-home">
      <section className="mhome-hero">
        <div className="mhome-hero-copy">
          <span className="mhome-kicker">{monthLabel(visibleMonth, dateLocale(lang))}</span>
          <h2>{t('totalBalance')}</h2>
          <button className="mhome-hero-balance" onClick={() => setShowBalanceBreakdown(value => !value)}>
            <strong className={balancePositive ? 'income' : 'expense'}>
              {!balancePositive && '-'}
              <AnimatedMoney value={Math.abs(totalBalance)} compact={compactNumbers} />
            </strong>
            <Icon
              name="arrowDn"
              size={14}
              style={{ opacity: .65, transform: showBalanceBreakdown ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          <p>
            {summary.net >= 0 ? t('monthPositiveClose') : t('monthNegativeClose')}
            {' • '}
            {t('incomes')} {fmtVal(summary.income)}
            {' • '}
            {t('expenses')} {fmtVal(summary.expense)}
          </p>
        </div>

        <div className="mhome-hero-actions">
          <button className="mhome-primary-btn" onClick={onAdd}>
            <Icon name="plus" size={16} />
            <span>{t('addMovement')}</span>
          </button>
          <button className="mhome-secondary-btn" onClick={onOpenAnalysis}>
            <Icon name="chart" size={16} />
            <span>{t('openAnalysis')}</span>
          </button>
        </div>
      </section>

      <section className="mhome-pulse-grid">
        <article className="mhome-pulse-card">
          <small>{t('monthBalance')}</small>
          <strong className={summary.net >= 0 ? 'income' : 'expense'}>{fmtVal(summary.net)}</strong>
          <p>
            {previousSummary.expense <= 0
              ? t('firstMonthComparison')
              : expenseDelta === 0
                ? t('sameAsLastMonth')
                : expenseDelta > 0
                  ? t('moreThanLastMonth').replace('{pct}', String(expenseDeltaPct))
                  : t('lessThanLastMonth').replace('{pct}', String(expenseDeltaPct))}
          </p>
        </article>

        <article className="mhome-pulse-card">
          <small>{t('monthBudget')}</small>
          <strong className={budgetRemaining >= 0 ? 'income' : 'expense'}>{fmtVal(budgetRemaining)}</strong>
          <div className="mhome-mini-progress">
            <span style={{ width: `${budgetProgress}%` }} />
          </div>
          <p>
            {monthlyBudget > 0
              ? `${t('spent')} ${fmtVal(summary.expense)} ${t('of')} ${fmtVal(monthlyBudget)}`
              : t('noBudget')}
          </p>
        </article>

        <article className="mhome-pulse-card">
          <small>{t('topCategoryLabel')}</small>
          <strong>{topExpense ? translateCategoryName(topExpense.category, lang) : '—'}</strong>
          <p>
            {topExpense
              ? `${fmtVal(topExpense.amount)} • ${summary.expense > 0 ? Math.round((topExpense.amount / summary.expense) * 100) : 0}%`
              : t('noExpensesToAnalyze')}
          </p>
        </article>

        <article className="mhome-pulse-card">
          <small>{t('savingsRate')}</small>
          <strong className="income">{`${savingsRate}%`}</strong>
          <p>{savedAmount > 0 ? fmtVal(savedAmount) : t('noSavingsAccountHint')}</p>
        </article>
      </section>

      {showBalanceBreakdown && visibleAccounts(accounts).length > 0 && (
        <div className="mhome-balance-breakdown">
          {visibleAccounts(accounts).map(account => (
            <div key={account.id} className="mhome-balance-row">
              <span style={{ color: account.color }}>●</span>
              <span className="mhome-balance-acct-name">{account.name}</span>
              <strong className={account.balance < 0 ? 'expense' : ''}>{fmtVal(account.balance)}</strong>
            </div>
          ))}
        </div>
      )}

      {visibleAlerts.length > 0 && (
        <div className="mhome-alerts">
          {visibleAlerts.map(alert => (
            <div key={alert.id} className={`mhome-alert ${alert.level}`}>
              <span className="mhome-alert-ico"><Icon name={alert.icon} size={16} /></span>
              <p><strong>{alert.title}</strong>{alert.text}</p>
              <button aria-label={t('dismissAlertLabel')} onClick={() => dismissAlert(alert.id)}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <section className="mhome-section-head">
        <div>
          <h3>{t('recentMovements')}</h3>
          <p>{monthLabel(visibleMonth, dateLocale(lang))}</p>
        </div>
        {onOpenBudgets && (
          <button className="mhome-inline-link" onClick={onOpenBudgets}>
            {t('budgets')}
          </button>
        )}
      </section>

      <div className="mhome-movements" data-month={visibleMonth}>
        {visibleMonthTx.length ? (
          <MobileTransactionList
            transactions={visibleMonthTx}
            onEdit={onEditTx}
            onDelete={onDeleteTx}
            showSearch={false}
          />
        ) : (
          <div className="mhome-empty">
            <span className="mhome-empty-ico"><Icon name="list" size={22} /></span>
            <p>{t('noMovementsMonth')}</p>
            <button onClick={onAdd}>{t('registerFirst')}</button>
          </div>
        )}

        {extraMonths.map(month => {
          const extraMonthTx = txForMonth(totalsTx, month)
          return (
            <div key={month} data-month={month} className="mhome-prev-month">
              <div className="mhome-prev-month-header">
                <Icon name="calendar" size={13} />
                <span>{monthLabel(month, dateLocale(lang))}</span>
              </div>
              {extraMonthTx.length ? (
                <MobileTransactionList transactions={extraMonthTx} onEdit={onEditTx} onDelete={onDeleteTx} showSearch={false} />
              ) : (
                <p className="mhome-prev-empty">{t('noMovementsThatMonth')}</p>
              )}
            </div>
          )
        })}

        {prevHasTx && (
          <button className="mhome-load-prev" onClick={loadPrevMonth}>
            <Icon name="calendar" size={14} />
            <span>{t('loadMonth').replace('{month}', monthLabel(prevKey, dateLocale(lang)))}</span>
          </button>
        )}
      </div>
    </div>
  )
}


