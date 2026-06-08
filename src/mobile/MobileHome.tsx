import { useEffect, useMemo, useState } from 'react'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { Icon } from '@/components/ui/Icon'
import { getMobileAlerts } from '@/data/alerts'
import { currentMonthKey, fmt, fmtCompact, monthLabel, totals, txForMonth } from '@/data/helpers'
import { notificationActionTypeId, sendNativeNotification } from '@/hooks/useTauri'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import { MobileTransactionList } from './MobileTransactionList'
import type { Transaction } from '@/types'

function prevMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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
  const { transactions, accounts, categories, currency } = useFinance()
  const settings = useSettings()
  const { dismissedAlerts, dismissAlert, notifiedAlerts, markAlertNotified, compactNumbers } = settings
  const t = useT()

  // Meses cargados: empieza con el mes actual; el usuario puede cargar meses anteriores
  const [extraMonths, setExtraMonths] = useState<string[]>([])
  const [showBalanceBreakdown, setShowBalanceBreakdown] = useState(false)

  // Resetear meses extra cuando cambia el mes seleccionado
  useEffect(() => { setExtraMonths([]) }, [mkey])

  const monthTx = txForMonth(transactions, mkey)
  const summary = totals(monthTx)
  const isCurrent = mkey === currentMonthKey()

  // Balance total de todas las cuentas (no el net mensual)
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const balancePositive = totalBalance >= 0

  const alerts = useMemo(() => getMobileAlerts(transactions, categories, currency), [transactions, categories, currency])
  const visibleAlerts = isCurrent ? alerts.filter(a => !dismissedAlerts.includes(a.id)) : []

  useEffect(() => {
    if (!isCurrent) return
    const fresh = alerts.filter(a => !notifiedAlerts.includes(a.id))
    fresh.forEach(alert => {
      sendNativeNotification(alert.title, alert.text, { actionTypeId: notificationActionTypeId, extra: { alertId: alert.id } })
      markAlertNotified(alert.id)
    })
  }, [isCurrent, alerts, notifiedAlerts, markAlertNotified])

  const fmtVal = (n: number) => compactNumbers ? fmtCompact(n, currency) : fmt(n, currency)

  // Mes anterior disponible para cargar
  const oldestLoaded = extraMonths.length ? extraMonths[extraMonths.length - 1] : mkey
  const prevKey = prevMonthKey(oldestLoaded)
  const prevHasTx = transactions.some(tx => tx.date.startsWith(prevKey))

  const loadPrevMonth = () => setExtraMonths(ms => [...ms, prevKey])

  return (
    <div className="mobile-home">

      {/* ─── Resumen del mes (sticky) ─── */}
      <section className="mhome-summary">
        <div className="mhome-summary-col">
          <small>{t('expenses')}</small>
          <strong className="expense">
            <AnimatedMoney value={summary.expense} compact={compactNumbers} />
          </strong>
        </div>
        <div className="mhome-summary-col">
          <small>{t('incomes')}</small>
          <strong className="income">
            <AnimatedMoney value={summary.income} compact={compactNumbers} />
          </strong>
        </div>
        <button className="mhome-summary-col mhome-balance-btn" onClick={() => setShowBalanceBreakdown(v => !v)}>
          <small>{t('balance')} <Icon name="arrowDn" size={9} style={{ display: 'inline', verticalAlign: 'middle', opacity: .6, transform: showBalanceBreakdown ? 'rotate(180deg)' : 'none' }} /></small>
          <strong className={balancePositive ? 'income' : 'expense'}>
            {balancePositive ? '+' : '–'}
            <AnimatedMoney value={Math.abs(totalBalance)} compact={compactNumbers} />
          </strong>
        </button>
      </section>

      {/* ─── Desglose de balance por cuenta ─── */}
      {showBalanceBreakdown && accounts.length > 0 && (
        <div className="mhome-balance-breakdown mhome-stagger-1">
          {accounts.map(a => (
            <div key={a.id} className="mhome-balance-row">
              <span style={{ color: a.color }}>●</span>
              <span className="mhome-balance-acct-name">{a.name}</span>
              <strong className={a.balance < 0 ? 'expense' : ''}>{fmtVal(a.balance)}</strong>
            </div>
          ))}
        </div>
      )}

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

      {/* ─── Movimientos del mes actual ─── */}
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

        {/* ─── Meses anteriores cargados inline ─── */}
        {extraMonths.map(mk => {
          const mkTx = txForMonth(transactions, mk)
          return (
            <div key={mk} className="mhome-prev-month">
              <div className="mhome-prev-month-header">
                <Icon name="calendar" size={13} />
                <span>{monthLabel(mk)}</span>
              </div>
              {mkTx.length ? (
                <MobileTransactionList transactions={mkTx} onEdit={onEditTx} onDelete={onDeleteTx} />
              ) : (
                <p className="mhome-prev-empty">Sin movimientos ese mes</p>
              )}
            </div>
          )
        })}

        {/* ─── Botón cargar mes anterior ─── */}
        {prevHasTx && (
          <button className="mhome-load-prev" onClick={loadPrevMonth}>
            <Icon name="calendar" size={14} />
            <span>Cargar {monthLabel(prevKey)}</span>
          </button>
        )}
      </div>

    </div>
  )
}
