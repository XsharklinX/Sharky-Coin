import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmt } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useFmt } from '@/hooks/useFmt'
import { useDebt, simulatePayoff, type Debt, type PayoffMethod } from '@/store/debt'
import { useT } from '@/i18n'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { useDialogA11y } from './useDialogA11y'
import { MobileAmountSheet } from './MobileAmountSheet'

const COLORS = ['#ff6b8a', '#5bc0ff', '#35d0a2', '#a78bfa', '#f59e0b', '#ffdd3d']
const EMPTY: Omit<Debt, 'id'> = { name: '', balance: 0, rate: 0, minPayment: 0, color: COLORS[0] }

function monthsLabel(m: number, t: ReturnType<typeof useT>) {
  if (m <= 0) return '—'
  if (m >= 600) return t('over50Years')
  const y = Math.floor(m / 12), mo = m % 12
  if (y === 0) return `${mo} ${mo !== 1 ? t('monthsPlural') : t('monthsSingular')}`
  if (mo === 0) return `${y} ${y !== 1 ? t('yearsPlural') : t('yearsSingular')}`
  return t('yearsMonthsShort').replace('{y}', String(y)).replace('{mo}', String(mo))
}

export function MobileDebt() {
  const { currency } = useFinance()
  const fmtVal = useFmt()
  const t = useT()
  const { debts, extraPayment, addDebt, updateDebt, deleteDebt, setExtraPayment } = useDebt()
  const [method, setMethod] = useState<PayoffMethod>('avalanche')
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)
  const [extraSheet, setExtraSheet] = useState(false)

  useMobileBackDismiss(!!editing || extraSheet, () => { setEditing(null); setExtraSheet(false) })

  const snowball  = useMemo(() => simulatePayoff(debts, extraPayment, 'snowball'),  [debts, extraPayment])
  const avalanche = useMemo(() => simulatePayoff(debts, extraPayment, 'avalanche'), [debts, extraPayment])
  const active = method === 'snowball' ? snowball : avalanche
  const other  = method === 'snowball' ? avalanche : snowball
  const otherName = method === 'snowball' ? 'Avalanche' : 'Snowball'

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
  const totalMin  = debts.reduce((s, d) => s + d.minPayment, 0)
  const interestSavings = other.totalInterest - active.totalInterest
  const monthSavings    = other.months - active.months

  if (debts.length === 0) return (
    <div className="mdebt-root">
      <div className="mdebt-empty">
        <Icon name="dollar" size={44} style={{ opacity: .18 }} />
        <p>{t('noDebtsRegistered')}</p>
        <small>{t('addDebtsHint')}</small>
        <button className="mdebt-add-btn" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> {t('addDebt')}
        </button>
      </div>
      {editing && (
        <DebtSheet debt={undefined} onClose={() => setEditing(null)}
          onSave={d => { addDebt(d); setEditing(null) }} />
      )}
    </div>
  )

  return (
    <div className="mdebt-root">

      {/* Hero */}
      <div className="mdebt-hero">
        <div className="mdebt-hero-label">{t('totalDebtLabel')}</div>
        <div className="mdebt-hero-amount">{fmtVal(totalDebt, currency)}</div>
        <div className="mdebt-hero-sub">{t('monthlyMinimumColon').replace('{amount}', fmt(totalMin, currency))}</div>
      </div>

      {/* Method toggle */}
      <div className="mdebt-toggle">
        <button className={method === 'snowball' ? 'on' : ''} onClick={() => setMethod('snowball')}>
          ❄️ Snowball
        </button>
        <button className={method === 'avalanche' ? 'on' : ''} onClick={() => setMethod('avalanche')}>
          🌋 Avalanche
        </button>
      </div>

      <p className="mdebt-hint">
        {method === 'snowball' ? t('snowballHint') : t('avalancheHint')}
      </p>

      {/* Result card */}
      <div className="mdebt-result-card">
        <div className="mdebt-result-row">
          <div className="mdebt-result-item">
            <div className="mdebt-result-val">{monthsLabel(active.months, t)}</div>
            <div className="mdebt-result-lbl">{t('toPayOffLabel')}</div>
          </div>
          <div className="mdebt-result-sep" />
          <div className="mdebt-result-item">
            <div className="mdebt-result-val">{fmtVal(active.totalInterest, currency)}</div>
            <div className="mdebt-result-lbl">{t('totalInterestLabel')}</div>
          </div>
        </div>
        {interestSavings > 0 && (
          <div className="mdebt-badge ok">
            {t('youSaveVsMethod').replace('{amount}', fmtVal(interestSavings, currency)).replace('{method}', otherName)}
            {monthSavings > 0 && t('fewerMonthsSuffix').replace('{n}', String(monthSavings))}
          </div>
        )}
        {interestSavings < 0 && (
          <div className="mdebt-badge warn">
            {t('methodWouldSaveMore').replace('{method}', otherName).replace('{amount}', fmtVal(-interestSavings, currency))}
          </div>
        )}
      </div>

      {/* Extra payment */}
      <div className="mdebt-extra-card">
        <span className="mdebt-extra-label">{t('extraMonthlyPayment')}</span>
        <button className="mdebt-extra-row mdebt-extra-tap" onClick={() => setExtraSheet(true)}>
          <span className={extraPayment > 0 ? 'mdebt-amt-set' : 'mdebt-amt-ph'}>
            {extraPayment > 0 ? fmt(extraPayment, currency) : `+ ${t('add')}`}
          </span>
          <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)' }} />
        </button>
        {extraPayment > 0 && active.months < other.months + (method === 'snowball' ? 0 : 0) && (
          <small className="mdebt-extra-note">
            {other.months - active.months > 0 ? t('reducesByMonths').replace('{months}', String(other.months - active.months)) : t('reducesPaymentTime')}
          </small>
        )}
      </div>

      {/* Payoff order */}
      {active.order.length > 0 && (
        <>
          <div className="mdebt-section-title">{t('payoffOrderLabel')}</div>
          <div className="mdebt-order-list">
            {active.order.map((id, i) => {
              const debt = debts.find(d => d.id === id)
              if (!debt) return null
              return (
                <div key={id} className="mdebt-order-row">
                  <span className="mdebt-order-num">{i + 1}</span>
                  <span className="mdebt-order-dot" style={{ background: debt.color }} />
                  <span className="mdebt-order-name">{debt.name}</span>
                  <span className="mdebt-order-rate">{debt.rate}% APR</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Debt list */}
      <div className="mdebt-section-title">
        {t('debtsLabel')}
        <button className="mdebt-add-inline" onClick={() => setEditing('new')}>
          <Icon name="plus" size={14} /> {t('add')}
        </button>
      </div>
      <div className="mdebt-list">
        {debts.map(debt => (
          <button key={debt.id} className="mdebt-row" onClick={() => setEditing(debt)}>
            <span className="mdebt-row-dot" style={{ background: debt.color }} />
            <div className="mdebt-row-info">
              <b>{debt.name}</b>
              <small>{t('aprMinPerMonth').replace('{rate}', String(debt.rate)).replace('{amount}', fmt(debt.minPayment, currency))}</small>
            </div>
            <strong>{fmtVal(debt.balance, currency)}</strong>
            <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {editing !== null && (
        <DebtSheet
          debt={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={d => {
            if (editing === 'new') addDebt(d)
            else updateDebt(editing.id, d)
            toast(editing === 'new' ? t('debtAdded') : t('debtUpdated'), { icon: 'check', type: 'ok' })
            setEditing(null)
          }}
          onDelete={editing !== 'new' ? () => {
            deleteDebt(editing.id)
            toast(t('debtDeleted'), { icon: 'trash' })
            setEditing(null)
          } : undefined}
        />
      )}

      {extraSheet && (
        <MobileAmountSheet
          title={t('extraMonthlyPayment')}
          value={extraPayment}
          currency={currency}
          onDone={v => { setExtraPayment(Math.max(0, v)); setExtraSheet(false) }}
          onClose={() => setExtraSheet(false)}
        />
      )}
    </div>
  )
}

function DebtSheet({ debt, onClose, onSave, onDelete }: {
  debt?: Debt
  onClose: () => void
  onSave: (d: Omit<Debt, 'id'>) => void
  onDelete?: () => void
}) {
  const { currency } = useFinance()
  const t = useT()
  const [f, setF] = useState<Omit<Debt, 'id'>>(
    debt ? { name: debt.name, balance: debt.balance, rate: debt.rate, minPayment: debt.minPayment, color: debt.color }
         : { ...EMPTY }
  )
  const [confirmDel, setConfirmDel] = useState(false)
  const [amountSheet, setAmountSheet] = useState<'balance' | 'rate' | 'minPayment' | null>(null)
  const p = <K extends keyof typeof f>(k: K, v: typeof f[K]) => setF(cur => ({ ...cur, [k]: v }))

  useMobileBackDismiss(amountSheet !== null, () => setAmountSheet(null))
  useMobileBackDismiss(amountSheet === null, onClose)
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose, amountSheet === null)

  return (
    <>
    <div ref={dialogRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={debt ? t('editDebt') : t('newDebt')} onClick={onClose}>
      <section className="mdebt-sheet" onClick={e => e.stopPropagation()}>
        <header>
          <span>{debt ? t('editDebt') : t('newDebt')}</span>
          <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="mdebt-sheet-body">
          <label className="mdebt-field">
            <span>{t('name')}</span>
            <input className="mdebt-input" value={f.name}
              placeholder={t('egCreditCard')} onChange={e => p('name', e.target.value)} />
          </label>

          <div className="mdebt-field-row">
            <div className="mdebt-field" style={{ flex: 1 }}>
              <span>{t('balance')}</span>
              <button className="mdebt-amount-row" onClick={() => setAmountSheet('balance')}>
                <span className={f.balance ? 'mdebt-amt-set' : 'mdebt-amt-ph'}>
                  {f.balance ? fmt(f.balance, currency) : '—'}
                </span>
                <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)' }} />
              </button>
            </div>
            <div className="mdebt-field" style={{ flex: 1 }}>
              <span>{t('annualInterestPctLabel')}</span>
              <button className="mdebt-amount-row" onClick={() => setAmountSheet('rate')}>
                <span className={f.rate ? 'mdebt-amt-set' : 'mdebt-amt-ph'}>
                  {f.rate ? `${f.rate}%` : '—'}
                </span>
                <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)' }} />
              </button>
            </div>
          </div>

          <div className="mdebt-field">
            <span>{t('monthlyMinPaymentLabel')}</span>
            <button className="mdebt-amount-row" onClick={() => setAmountSheet('minPayment')}>
              <span className={f.minPayment ? 'mdebt-amt-set' : 'mdebt-amt-ph'}>
                {f.minPayment ? fmt(f.minPayment, currency) : '—'}
              </span>
              <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)' }} />
            </button>
          </div>

          <div className="mdebt-field">
            <span>{t('color')}</span>
            <div className="mdebt-color-row">
              {COLORS.map(c => (
                <button key={c} className={`mdebt-color-dot${f.color === c ? ' on' : ''}`}
                  aria-label={t('colorOption').replace('{c}', c)} aria-pressed={f.color === c}
                  style={{ background: c }} onClick={() => p('color', c)} />
              ))}
            </div>
          </div>

          {debt && onDelete && (
            !confirmDel
              ? <button className="mdebt-del-btn" onClick={() => setConfirmDel(true)}>
                  <Icon name="trash" size={16} /> {t('deleteDebtLabel')}
                </button>
              : <div className="mdebt-confirm-del">
                  <p>{t('deleteQuotedConfirm').replace('{name}', debt.name)}</p>
                  <div>
                    <button onClick={() => setConfirmDel(false)}>{t('cancel')}</button>
                    <button className="danger" onClick={onDelete}>{t('delete')}</button>
                  </div>
                </div>
          )}
        </div>

        <div className="mdebt-sheet-actions">
          <button className="mdebt-btn-cancel" onClick={onClose}>{t('cancel')}</button>
          <button className="mdebt-btn-save" style={{ background: f.color }}
            onClick={() => {
              if (!f.name.trim()) { toast(t('enterNamePrompt'), { icon: 'alert' }); return }
              if (f.balance <= 0) { toast(t('balanceMustBePositive'), { icon: 'alert' }); return }
              onSave(f)
            }}>
            {debt ? t('save') : t('add')}
          </button>
        </div>
      </section>
    </div>

    {amountSheet === 'balance' && (
      <MobileAmountSheet
        title={t('debtBalanceTitle')}
        value={f.balance}
        currency={currency}
        onDone={v => { p('balance', v); setAmountSheet(null) }}
        onClose={() => setAmountSheet(null)}
      />
    )}
    {amountSheet === 'rate' && (
      <MobileAmountSheet
        title={t('annualInterestPctLabel')}
        value={f.rate}
        unit="%"
        onDone={v => { p('rate', v); setAmountSheet(null) }}
        onClose={() => setAmountSheet(null)}
      />
    )}
    {amountSheet === 'minPayment' && (
      <MobileAmountSheet
        title={t('monthlyMinPaymentLabel')}
        value={f.minPayment}
        currency={currency}
        onDone={v => { p('minPayment', v); setAmountSheet(null) }}
        onClose={() => setAmountSheet(null)}
      />
    )}
    </>
  )
}
