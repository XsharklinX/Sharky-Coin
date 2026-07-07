import { useState } from 'react'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { Icon } from '@/components/ui/Icon'
import { totals, transactionsForTotals, txForMonth, visibleAccounts } from '@/data/helpers'
import { useT } from '@/i18n'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { Transaction } from '@/types'
import { MobileTransactionList } from './MobileTransactionList'

export function MobileMovements({
  mkey,
  onAdd,
  onEditTx,
  onDeleteTx,
}: {
  mkey: string
  onAdd: () => void
  onEditTx: (tx: Transaction) => void
  onDeleteTx?: (id: string) => void
}) {
  const { transactions, accounts, currency } = useFinance()
  const { compactNumbers } = useSettings()
  const t = useT()
  const [showBalanceBreakdown, setShowBalanceBreakdown] = useState(false)
  const visibleTx = transactionsForTotals(transactions, accounts)
  const monthTx = txForMonth(visibleTx, mkey)
  const summary = totals(monthTx)
  const activeAccounts = visibleAccounts(accounts)
  const totalBalance = activeAccounts.reduce((sum, account) => sum + account.balance, 0)
  const balancePositive = totalBalance >= 0

  return (
    <div className="mobile-movements-screen">
      <section className="mobile-summary-strip mobile-summary-strip-movements">
        <article className="mini-stat">
          <small>{t('incomes')}</small>
          <strong className="income">
            <AnimatedMoney value={summary.income} compact={compactNumbers} />
          </strong>
        </article>
        <article className="mini-stat">
          <small>{t('expenses')}</small>
          <strong className="expense">
            <AnimatedMoney value={summary.expense} compact={compactNumbers} />
          </strong>
        </article>
        <button
          className="mini-stat mini-stat-button"
          aria-expanded={showBalanceBreakdown}
          aria-label={t('accounts')}
          onClick={() => setShowBalanceBreakdown(value => !value)}
        >
          <small>{t('totalBalance')}</small>
          <strong className={balancePositive ? 'income' : 'expense'}>
            {!balancePositive && '-'}
            <AnimatedMoney value={Math.abs(totalBalance)} compact={compactNumbers} />
          </strong>
        </button>
      </section>

      {showBalanceBreakdown && activeAccounts.length > 0 && (
        <div className="mhome-balance-breakdown mobile-balance-breakdown-inline">
          {activeAccounts.map(account => (
            <div key={account.id} className="mhome-balance-row">
              <span className="mobile-balance-dot" style={{ background: account.color }} />
              <span className="mhome-balance-acct-name">{account.name}</span>
              <strong className={account.balance < 0 ? 'expense' : ''}>
                {new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency,
                  maximumFractionDigits: compactNumbers ? 0 : 2,
                  minimumFractionDigits: compactNumbers ? 0 : 2,
                }).format(account.balance)}
              </strong>
            </div>
          ))}
        </div>
      )}

      {monthTx.length ? (
        <MobileTransactionList
          transactions={monthTx}
          onEdit={onEditTx}
          onDelete={onDeleteTx}
          className="mobile-list-card-flat"
        />
      ) : (
        <div className="mobile-movements-empty">
          <span className="mobile-movements-empty-icon">
            <Icon name="list" size={22} />
          </span>
          <strong>{t('noMovementsTitle')}</strong>
          <p>{t('noMovementsMonth')}</p>
          <button onClick={onAdd}>{t('addMovement')}</button>
        </div>
      )}
    </div>
  )
}

