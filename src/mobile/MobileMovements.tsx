import { useState } from 'react'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { Icon } from '@/components/ui/Icon'
import { totalBalanceInBase, totals, transactionsForTotals, txForMonth, visibleAccounts } from '@/data/helpers'
import { useT } from '@/i18n'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { Transaction } from '@/types'
import { MobileTransactionList } from './MobileTransactionList'

const PIN_NUDGE_ID = 'pin-setup-nudge'
const PIN_NUDGE_MIN_TXNS = 3

export function MobileMovements({
  mkey,
  onAdd,
  onEditTx,
  onDeleteTx,
  onOpenSecurity,
}: {
  mkey: string
  onAdd: () => void
  onEditTx: (tx: Transaction) => void
  onDeleteTx?: (id: string) => void
  onOpenSecurity?: () => void
}) {
  const { transactions, accounts, currency } = useFinance()
  const { compactNumbers, appPin, appPattern, dismissedAlerts, dismissAlert } = useSettings()
  const t = useT()
  const [showBalanceBreakdown, setShowBalanceBreakdown] = useState(false)
  const showPinNudge = !!onOpenSecurity && !appPin && !appPattern
    && transactions.length >= PIN_NUDGE_MIN_TXNS && !dismissedAlerts.includes(PIN_NUDGE_ID)
  const visibleTx = transactionsForTotals(transactions, accounts, currency)
  const monthTx = txForMonth(visibleTx, mkey)
  const summary = totals(monthTx)
  const activeAccounts = visibleAccounts(accounts)
  const totalBalance = totalBalanceInBase(accounts, currency)
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

      {showPinNudge && (
        <div className="mhome-alert warn mhome-alert-standalone">
          <span className="mhome-alert-ico"><Icon name="key" size={16} /></span>
          <p><strong>{t('pinNudgeTitle')}</strong>{t('pinNudgeText')}</p>
          <button className="mhome-alert-action" onClick={onOpenSecurity}>{t('pinNudgeAction')}</button>
          <button aria-label={t('dismissAlertLabel')} onClick={() => dismissAlert(PIN_NUDGE_ID)}>
            <Icon name="close" size={14} />
          </button>
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

