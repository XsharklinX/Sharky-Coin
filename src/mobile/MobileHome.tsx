import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { Icon } from '@/components/ui/Icon'
import { byCategory, currentMonthKey, fmtCompact, totals, txForMonth } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useT } from '@/i18n'
import { MobileTransactionList } from './MobileTransactionList'
import type { IconName, Transaction } from '@/types'

const ACCT_ICONS: Record<string, IconName> = {
  cash: 'wallet', debit: 'cards', savings: 'piggy', credit: 'cards',
}

export function MobileHome({
  mkey,
  onAdd,
  onMovements,
  onBudgets,
  onEditTx,
  onDeleteTx,
}: {
  mkey: string
  onAdd: () => void
  onMovements: () => void
  onBudgets: () => void
  onEditTx: (tx: Transaction) => void
  onDeleteTx?: (id: string) => void
}) {
  const { transactions, categories, accounts, currency } = useFinance()
  const t = useT()
  const monthTx = txForMonth(transactions, mkey)
  const summary = totals(monthTx)
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const expCats = categories.filter(c => c.type === 'expense')
  const totalBudget = expCats.reduce((s, c) => s + c.budget, 0)
  const budgetPct = totalBudget > 0 ? Math.min(100, Math.round(summary.expense / totalBudget * 100)) : 0
  const recent = monthTx.slice(0, 5)
  const topExpense = byCategory(monthTx, 'expense', categories)[0]
  const isPositive = summary.net >= 0

  // Smart insights (current month only)
  const isCurrent = mkey === currentMonthKey()
  const today = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const projectedExpense = dayOfMonth > 0 ? summary.expense / dayOfMonth * daysInMonth : 0
  const savingsRate = summary.income > 0 ? Math.round((summary.income - summary.expense) / summary.income * 100) : null
  const prevMkey = (() => {
    const [y, m] = mkey.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const prevTx = txForMonth(transactions, prevMkey)
  const prevSum = totals(prevTx)
  const prevPace = prevSum.expense > 0 && dayOfMonth > 0 ? prevSum.expense / daysInMonth * dayOfMonth : 0
  const spendTrend = prevPace > 0 ? Math.round((summary.expense / prevPace - 1) * 100) : null
  const showInsights = isCurrent && monthTx.length > 0 && dayOfMonth >= 3

  return (
    <div className="mobile-home">

      {/* ─── Hero ─── */}
      <section className="mhome-hero">
        <div className="mhome-hero-main">
          <span className="mhome-hero-sub">{t('monthBalance')}</span>
          <h2 className={`mhome-hero-amount ${isPositive ? '' : 'neg'}`}>
            {isPositive ? '+' : '–'}
            <AnimatedMoney value={Math.abs(summary.net)} compact />
          </h2>
        </div>

        <div className="mhome-hero-pills">
          <div className="mhome-pill income">
            <span className="mhome-pill-icon"><Icon name="arrowDn" size={13} /></span>
            <div>
              <strong><AnimatedMoney value={summary.income} compact /></strong>
              <small>{t('incomes')}</small>
            </div>
          </div>
          <div className="mhome-pill-sep" />
          <div className="mhome-pill expense">
            <span className="mhome-pill-icon"><Icon name="arrowUp" size={13} /></span>
            <div>
              <strong><AnimatedMoney value={summary.expense} compact /></strong>
              <small>{t('expenses')}</small>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Cuentas ─── */}
      {accounts.length > 0 && (
        <div className="mhome-section mhome-stagger-1">
          <div className="mhome-section-hdr">
            <span>{t('accounts')}</span>
            <strong><AnimatedMoney value={totalBalance} compact /></strong>
          </div>
          <div className="mhome-accounts-row">
            {accounts.map(account => (
              <div key={account.id} className="mhome-account-card">
                <span className="mhome-account-icon" style={{
                  color: account.color,
                  background: `color-mix(in oklab, ${account.color} 15%, transparent)`,
                }}>
                  <Icon name={ACCT_ICONS[account.type] ?? 'wallet'} size={18} />
                </span>
                <small>{account.name}</small>
                <b className={account.balance < 0 ? 'neg' : ''}>
                  <AnimatedMoney value={account.balance} compact />
                </b>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Presupuesto ─── */}
      {totalBudget > 0 && (
        <button className="mhome-budget mhome-stagger-2" onClick={onBudgets}>
          <div className="mhome-budget-row">
            <span>{t('monthBudget')}</span>
            <span className={budgetPct >= 100 ? 'danger' : budgetPct >= 80 ? 'warn' : 'ok'}>
              {budgetPct}%
            </span>
          </div>
          <div className="mhome-bar-track">
            <span className="mhome-bar-fill" style={{
              width: `${Math.min(100, budgetPct)}%`,
              background: budgetPct >= 100 ? '#ff6b8a' : budgetPct >= 80 ? '#f59e0b' : 'var(--accent, #ffdd3d)',
            }} />
          </div>
          <div className="mhome-budget-meta">
            <span><AnimatedMoney value={summary.expense} compact /> {t('spent')}</span>
            <span>{t('of')} {fmtCompact(totalBudget, currency)}</span>
          </div>
        </button>
      )}

      {/* ─── Insight rápido ─── */}
      {topExpense && summary.expense > 0 && (
        <div className="mhome-insight mhome-stagger-3">
          <span style={{ color: topExpense.category.color, background: `color-mix(in oklab, ${topExpense.category.color} 14%, transparent)` }}>
            <Icon name={topExpense.category.icon} size={16} />
          </span>
          <p>
            {t('topExpense')}: <strong>{topExpense.category.name}</strong> (<AnimatedMoney value={topExpense.amount} compact />)
          </p>
        </div>
      )}

      {/* ─── Smart Insights ─── */}
      {showInsights && (
        <div className="mhome-smart-insights mhome-stagger-4">
          {spendTrend !== null && (
            <div className={`mhome-insight-chip ${spendTrend > 10 ? 'warn' : spendTrend < -10 ? 'ok' : ''}`}>
              <Icon name={spendTrend >= 0 ? 'arrowUp' : 'arrowDn'} size={13} />
              <span>
                Gastos {Math.abs(spendTrend)}% {spendTrend >= 0 ? 'más' : 'menos'} que el mes pasado
              </span>
            </div>
          )}
          {projectedExpense > 0 && (
            <div className={`mhome-insight-chip ${projectedExpense > totalBudget && totalBudget > 0 ? 'warn' : ''}`}>
              <Icon name="trend" size={13} />
              <span>Proyección: {fmtCompact(projectedExpense, currency)} al cierre</span>
            </div>
          )}
          {savingsRate !== null && (
            <div className={`mhome-insight-chip ${savingsRate >= 20 ? 'ok' : savingsRate < 0 ? 'warn' : ''}`}>
              <Icon name="piggy" size={13} />
              <span>
                {savingsRate >= 0 ? `Ahorrando ${savingsRate}% del ingreso` : `Déficit: ${Math.abs(savingsRate)}% sobre ingresos`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Movimientos recientes ─── */}
      <div className="mhome-section mhome-stagger-4">
        <div className="mhome-section-hdr">
          <span>{t('movements')}</span>
          <button onClick={onMovements}>{t('viewAll')}</button>
        </div>
        {recent.length ? (
          <div className="mhome-tx-card">
            <MobileTransactionList
              transactions={recent}
              onEdit={onEditTx}
              onDelete={onDeleteTx}
              compact
            />
          </div>
        ) : (
          <div className="mhome-empty">
            <span className="mhome-empty-ico"><Icon name="list" size={22} /></span>
            <p>{t('noMovementsMonth')}</p>
            <button onClick={onAdd}>{t('registerFirst')}</button>
          </div>
        )}
      </div>

    </div>
  )
}
