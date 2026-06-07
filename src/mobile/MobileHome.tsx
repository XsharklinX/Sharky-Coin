import { useEffect, useMemo } from 'react'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { Icon } from '@/components/ui/Icon'
import { getMobileAlerts } from '@/data/alerts'
import { currentMonthKey, fmtCompact, totals, txForMonth } from '@/data/helpers'
import { sendNativeNotification } from '@/hooks/useTauri'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
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
  const dismissedAlerts = useSettings(state => state.dismissedAlerts)
  const dismissAlert = useSettings(state => state.dismissAlert)
  const notifiedAlerts = useSettings(state => state.notifiedAlerts)
  const markAlertNotified = useSettings(state => state.markAlertNotified)
  const t = useT()
  const monthTx = txForMonth(transactions, mkey)
  const summary = totals(monthTx)
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const expCats = categories.filter(c => c.type === 'expense')
  const totalBudget = expCats.reduce((s, c) => s + c.budget, 0)
  const budgetPct = totalBudget > 0 ? Math.min(100, Math.round(summary.expense / totalBudget * 100)) : 0
  const recent = monthTx.slice(0, 5)
  const isPositive = summary.net >= 0
  const isCurrent = mkey === currentMonthKey()

  const alerts = useMemo(() => getMobileAlerts(transactions, categories, currency), [transactions, categories, currency])
  const visibleAlerts = isCurrent ? alerts.filter(a => !dismissedAlerts.includes(a.id)) : []

  // Notificación nativa del SO para avisos nuevos (una sola vez por id)
  useEffect(() => {
    if (!isCurrent) return
    const fresh = alerts.filter(a => !notifiedAlerts.includes(a.id))
    fresh.forEach(alert => {
      sendNativeNotification(alert.title, alert.text)
      markAlertNotified(alert.id)
    })
  }, [isCurrent, alerts, notifiedAlerts, markAlertNotified])

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

      {/* ─── Avisos ─── */}
      {visibleAlerts.length > 0 && (
        <div className="mhome-alerts mhome-stagger-1">
          {visibleAlerts.map(alert => (
            <div key={alert.id} className={`mhome-alert ${alert.level}`}>
              <span className="mhome-alert-ico"><Icon name={alert.icon} size={16} /></span>
              <p><strong>{alert.title}</strong>{alert.text}</p>
              <button aria-label="Descartar aviso" onClick={() => dismissAlert(alert.id)}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

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
