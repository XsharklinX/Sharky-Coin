import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmt } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useFmt } from '@/hooks/useFmt'
import { useDebt, simulatePayoff, type Debt, type PayoffMethod } from '@/store/debt'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { MobileAmountSheet } from './MobileAmountSheet'

const COLORS = ['#ff6b8a', '#5bc0ff', '#35d0a2', '#a78bfa', '#f59e0b', '#ffdd3d']
const EMPTY: Omit<Debt, 'id'> = { name: '', balance: 0, rate: 0, minPayment: 0, color: COLORS[0] }

function monthsLabel(m: number) {
  if (m <= 0) return '—'
  if (m >= 600) return '>50 años'
  const y = Math.floor(m / 12), mo = m % 12
  if (y === 0) return `${mo} mes${mo !== 1 ? 'es' : ''}`
  if (mo === 0) return `${y} año${y !== 1 ? 's' : ''}`
  return `${y}a ${mo}m`
}

export function MobileDebt() {
  const { currency } = useFinance()
  const fmtVal = useFmt()
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
        <p>Sin deudas registradas</p>
        <small>Agrega tus préstamos, tarjetas de crédito u otras deudas para ver tu plan de pago.</small>
        <button className="mdebt-add-btn" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Agregar deuda
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
        <div className="mdebt-hero-label">Deuda total</div>
        <div className="mdebt-hero-amount">{fmtVal(totalDebt, currency)}</div>
        <div className="mdebt-hero-sub">Mínimo mensual: {fmt(totalMin, currency)}/mes</div>
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
        {method === 'snowball'
          ? 'Paga la deuda de menor saldo primero. Victorias rápidas que mantienen la motivación.'
          : 'Paga la deuda con mayor interés primero. Ahorra más dinero en total.'}
      </p>

      {/* Result card */}
      <div className="mdebt-result-card">
        <div className="mdebt-result-row">
          <div className="mdebt-result-item">
            <div className="mdebt-result-val">{monthsLabel(active.months)}</div>
            <div className="mdebt-result-lbl">para liquidar</div>
          </div>
          <div className="mdebt-result-sep" />
          <div className="mdebt-result-item">
            <div className="mdebt-result-val">{fmtVal(active.totalInterest, currency)}</div>
            <div className="mdebt-result-lbl">interés total</div>
          </div>
        </div>
        {interestSavings > 0 && (
          <div className="mdebt-badge ok">
            Ahorras {fmtVal(interestSavings, currency)} vs {otherName}
            {monthSavings > 0 && ` · ${monthSavings} mes${monthSavings !== 1 ? 'es' : ''} menos`}
          </div>
        )}
        {interestSavings < 0 && (
          <div className="mdebt-badge warn">
            {otherName} ahorraría {fmtVal(-interestSavings, currency)} más
          </div>
        )}
      </div>

      {/* Extra payment */}
      <div className="mdebt-extra-card">
        <span className="mdebt-extra-label">Pago extra mensual</span>
        <button className="mdebt-extra-row mdebt-extra-tap" onClick={() => setExtraSheet(true)}>
          <span className={extraPayment > 0 ? 'mdebt-amt-set' : 'mdebt-amt-ph'}>
            {extraPayment > 0 ? fmt(extraPayment, currency) : '+ Agregar'}
          </span>
          <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)' }} />
        </button>
        {extraPayment > 0 && active.months < other.months + (method === 'snowball' ? 0 : 0) && (
          <small className="mdebt-extra-note">Reduce {other.months - active.months > 0 ? `${other.months - active.months} meses` : 'el tiempo de pago'}</small>
        )}
      </div>

      {/* Payoff order */}
      {active.order.length > 0 && (
        <>
          <div className="mdebt-section-title">Orden de pago</div>
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
        Deudas
        <button className="mdebt-add-inline" onClick={() => setEditing('new')}>
          <Icon name="plus" size={14} /> Agregar
        </button>
      </div>
      <div className="mdebt-list">
        {debts.map(debt => (
          <button key={debt.id} className="mdebt-row" onClick={() => setEditing(debt)}>
            <span className="mdebt-row-dot" style={{ background: debt.color }} />
            <div className="mdebt-row-info">
              <b>{debt.name}</b>
              <small>{debt.rate}% APR · mínimo {fmt(debt.minPayment, currency)}/mes</small>
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
            toast(editing === 'new' ? 'Deuda agregada' : 'Deuda actualizada', { icon: 'check', type: 'ok' })
            setEditing(null)
          }}
          onDelete={editing !== 'new' ? () => {
            deleteDebt(editing.id)
            toast('Deuda eliminada', { icon: 'trash' })
            setEditing(null)
          } : undefined}
        />
      )}

      {extraSheet && (
        <MobileAmountSheet
          title="Pago extra mensual"
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
  const [f, setF] = useState<Omit<Debt, 'id'>>(
    debt ? { name: debt.name, balance: debt.balance, rate: debt.rate, minPayment: debt.minPayment, color: debt.color }
         : { ...EMPTY }
  )
  const [confirmDel, setConfirmDel] = useState(false)
  const [amountSheet, setAmountSheet] = useState<'balance' | 'rate' | 'minPayment' | null>(null)
  const p = <K extends keyof typeof f>(k: K, v: typeof f[K]) => setF(cur => ({ ...cur, [k]: v }))

  useMobileBackDismiss(amountSheet !== null, () => setAmountSheet(null))
  useMobileBackDismiss(amountSheet === null, onClose)

  return (
    <>
    <div className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={debt ? 'Editar deuda' : 'Nueva deuda'} onClick={onClose}>
      <section className="mdebt-sheet" onClick={e => e.stopPropagation()}>
        <header>
          <span>{debt ? 'Editar deuda' : 'Nueva deuda'}</span>
          <button aria-label="Cerrar" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="mdebt-sheet-body">
          <label className="mdebt-field">
            <span>Nombre</span>
            <input className="mdebt-input" value={f.name}
              placeholder="ej. Tarjeta de crédito" onChange={e => p('name', e.target.value)} />
          </label>

          <div className="mdebt-field-row">
            <div className="mdebt-field" style={{ flex: 1 }}>
              <span>Saldo</span>
              <button className="mdebt-amount-row" onClick={() => setAmountSheet('balance')}>
                <span className={f.balance ? 'mdebt-amt-set' : 'mdebt-amt-ph'}>
                  {f.balance ? fmt(f.balance, currency) : '—'}
                </span>
                <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)' }} />
              </button>
            </div>
            <div className="mdebt-field" style={{ flex: 1 }}>
              <span>Interés anual (%)</span>
              <button className="mdebt-amount-row" onClick={() => setAmountSheet('rate')}>
                <span className={f.rate ? 'mdebt-amt-set' : 'mdebt-amt-ph'}>
                  {f.rate ? `${f.rate}%` : '—'}
                </span>
                <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)' }} />
              </button>
            </div>
          </div>

          <div className="mdebt-field">
            <span>Pago mínimo mensual</span>
            <button className="mdebt-amount-row" onClick={() => setAmountSheet('minPayment')}>
              <span className={f.minPayment ? 'mdebt-amt-set' : 'mdebt-amt-ph'}>
                {f.minPayment ? fmt(f.minPayment, currency) : '—'}
              </span>
              <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)' }} />
            </button>
          </div>

          <div className="mdebt-field">
            <span>Color</span>
            <div className="mdebt-color-row">
              {COLORS.map(c => (
                <button key={c} className={`mdebt-color-dot${f.color === c ? ' on' : ''}`}
                  aria-label={`Color ${c}`} aria-pressed={f.color === c}
                  style={{ background: c }} onClick={() => p('color', c)} />
              ))}
            </div>
          </div>

          {debt && onDelete && (
            !confirmDel
              ? <button className="mdebt-del-btn" onClick={() => setConfirmDel(true)}>
                  <Icon name="trash" size={16} /> Eliminar deuda
                </button>
              : <div className="mdebt-confirm-del">
                  <p>¿Eliminar "{debt.name}"?</p>
                  <div>
                    <button onClick={() => setConfirmDel(false)}>Cancelar</button>
                    <button className="danger" onClick={onDelete}>Eliminar</button>
                  </div>
                </div>
          )}
        </div>

        <div className="mdebt-sheet-actions">
          <button className="mdebt-btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="mdebt-btn-save" style={{ background: f.color }}
            onClick={() => {
              if (!f.name.trim()) { toast('Escribe un nombre', { icon: 'alert' }); return }
              if (f.balance <= 0) { toast('El saldo debe ser mayor a 0', { icon: 'alert' }); return }
              onSave(f)
            }}>
            {debt ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </section>
    </div>

    {amountSheet === 'balance' && (
      <MobileAmountSheet
        title="Saldo de la deuda"
        value={f.balance}
        currency={currency}
        onDone={v => { p('balance', v); setAmountSheet(null) }}
        onClose={() => setAmountSheet(null)}
      />
    )}
    {amountSheet === 'rate' && (
      <MobileAmountSheet
        title="Interés anual (%)"
        value={f.rate}
        unit="%"
        onDone={v => { p('rate', v); setAmountSheet(null) }}
        onClose={() => setAmountSheet(null)}
      />
    )}
    {amountSheet === 'minPayment' && (
      <MobileAmountSheet
        title="Pago mínimo mensual"
        value={f.minPayment}
        currency={currency}
        onDone={v => { p('minPayment', v); setAmountSheet(null) }}
        onClose={() => setAmountSheet(null)}
      />
    )}
    </>
  )
}
