import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { byCategory, fmtCompact, monthLabel, totals, txForMonth } from '@/data/helpers'
import { useFinance } from '@/store/finance'
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
  const monthTx = txForMonth(transactions, mkey)
  const summary = totals(monthTx)
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const expCats = categories.filter(c => c.type === 'expense')
  const totalBudget = expCats.reduce((s, c) => s + c.budget, 0)
  const budgetPct = totalBudget > 0 ? Math.min(100, Math.round(summary.expense / totalBudget * 100)) : 0
  const recent = monthTx.slice(0, 5)
  const topExpense = byCategory(monthTx, 'expense', categories)[0]
  const isPositive = summary.net >= 0

  return (
    <div className="mobile-home">

      {/* ─── Hero ─── */}
      <section className="mhome-hero">
        <div className="mhome-hero-top">
          <span className="mhome-label-tiny">Este mes · {monthLabel(mkey)}</span>
          <button className="mhome-add-fab" onClick={onAdd} aria-label="Agregar movimiento">
            <Icon name="plus" size={18} />
          </button>
        </div>

        <div className="mhome-hero-main">
          <span className="mhome-hero-sub">Balance del mes</span>
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
              <small>Ingresos</small>
            </div>
          </div>
          <div className="mhome-pill-sep" />
          <div className="mhome-pill expense">
            <span className="mhome-pill-icon"><Icon name="arrowUp" size={13} /></span>
            <div>
              <strong><AnimatedMoney value={summary.expense} compact /></strong>
              <small>Gastos</small>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Cuentas ─── */}
      {accounts.length > 0 && (
        <div className="mhome-section mhome-stagger-1">
          <div className="mhome-section-hdr">
            <span>Cuentas</span>
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
            <span>Presupuesto del mes</span>
            <span className={budgetPct >= 100 ? 'danger' : budgetPct >= 80 ? 'warn' : 'ok'}>
              {budgetPct}%
            </span>
          </div>
          <div className="mhome-bar-track">
            <span className="mhome-bar-fill" style={{
              width: `${Math.min(100, budgetPct)}%`,
              background: budgetPct >= 100 ? '#ff6b8a' : budgetPct >= 80 ? '#f59e0b' : '#ffdd3d',
            }} />
          </div>
          <div className="mhome-budget-meta">
            <span><AnimatedMoney value={summary.expense} compact /> gastado</span>
            <span>de {fmtCompact(totalBudget, currency)}</span>
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
            Mayor gasto: <strong>{topExpense.category.name}</strong> (<AnimatedMoney value={topExpense.amount} compact />)
          </p>
        </div>
      )}

      {/* ─── Movimientos recientes ─── */}
      <div className="mhome-section mhome-stagger-4">
        <div className="mhome-section-hdr">
          <span>Movimientos</span>
          <button onClick={onMovements}>Ver todo</button>
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
            <BrandMark size={52} className="mhome-empty-brand" />
            <p>Sin movimientos este mes</p>
            <button onClick={onAdd}>Registrar el primero</button>
          </div>
        )}
      </div>

    </div>
  )
}
