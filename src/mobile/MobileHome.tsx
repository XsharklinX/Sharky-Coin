import { useEffect, useMemo } from 'react'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { Icon } from '@/components/ui/Icon'
import { getMobileAlerts } from '@/data/alerts'
import { currentMonthKey, totals, txForMonth } from '@/data/helpers'
import { sendNativeNotification } from '@/hooks/useTauri'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import { MobileTransactionList } from './MobileTransactionList'
import type { Transaction } from '@/types'

export function MobileHome({
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
  const { transactions, categories, currency } = useFinance()
  const dismissedAlerts = useSettings(state => state.dismissedAlerts)
  const dismissAlert = useSettings(state => state.dismissAlert)
  const notifiedAlerts = useSettings(state => state.notifiedAlerts)
  const markAlertNotified = useSettings(state => state.markAlertNotified)
  const t = useT()
  const monthTx = txForMonth(transactions, mkey)
  const summary = totals(monthTx)
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

      {/* ─── Movimientos del mes ─── */}
      <div className="mhome-movements mhome-stagger-2">
        {monthTx.length ? (
          <MobileTransactionList
            transactions={monthTx}
            onEdit={onEditTx}
            onDelete={onDeleteTx}
          />
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
