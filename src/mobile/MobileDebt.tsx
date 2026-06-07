import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmt, fmtCompact } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useDebt, simulatePayoff, type Debt, type PayoffMethod } from '@/store/debt'
import { useMobileBackDismiss } from './useMobileBackDismiss'

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
  const { debts, extraPayment, addDebt, updateDebt, deleteDebt, setExtraPayment } = useDebt()
  const [method, setMethod] = useState<PayoffMethod>('avalanche')
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)
  const [extraInput, setExtraInput] = useState(String(extraPayment))

  useMobileBackDismiss(!!editing, () => setEditing(null))

  const snowball  = useMemo(() => simulatePayoff(debts, extraPayment, 'snowball'),  [debts, extraPayment])
  const avalanche = useMemo(() => simulatePayoff(debts, extraPayment, 'avalanche'), [debts, extraPayment])
  const active = method === 'snowball' ? snowball : avalanche
  const other  = method === 'snowball' ? avalanche : snowball
  const otherName = method === 'snowball' ? 'Avalanche' : 'Snowball'

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
  const totalMin  = debts.reduce((s, d) => s + d.minPayment, 0)
  const interestSavings = other.totalInterest - active.totalInterest
  const monthSavings    = other.months - active.months

  const commitExtra = () => {
    const v = parseFloat(extraInput.replace(',', '.')) || 0
    setExtraPayment(Math.max(0, v))
  }

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
        <div className="mdebt-hero-amount">{fmtCompact(totalDebt, currency)}</div>
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
            <div className="mdebt-result-val">{fmtCompact(active.totalInterest, currency)}</div>
            <div className="mdebt-result-lbl">interés total</div>
          </div>
        </div>
        {interestSavings > 0 && (
          <div className="mdebt-badge ok">
            Ahorras {fmtCompact(interestSavings, currency)} vs {otherName}
            {monthSavings > 0 && ` · ${monthSavings} mes${monthSavings !== 1 ? 'es' : ''} menos`}
          </div>
        )}
        {interestSavings < 0 && (
          <div className="mdebt-badge warn">
            {otherName} ahorraría {fmtCompact(-interestSavings, currency)} más
          </div>
        )}
      </div>

      {/* Extra payment */}
      <div className="mdebt-extra-card">
        <span className="mdebt-extra-label">Pago extra mensual</span>
        <div className="mdebt-extra-row">
          <input className="mdebt-extra-input" type="number" inputMode="decimal"
            value={extraInput} placeholder="0"
            onChange={e => setExtraInput(e.target.value)}
            onBlur={commitExtra}
            onKeyDown={e => e.key === 'Enter' && commitExtra()} />
          <span className="mdebt-extra-cur">{currency}</span>
        </div>
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
            <strong>{fmtCompact(debt.balance, currency)}</strong>
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
    </div>
  )
}

function DebtSheet({ debt, onClose, onSave, onDelete }: {
  debt?: Debt
  onClose: () => void
  onSave: (d: Omit<Debt, 'id'>) => void
  onDelete?: () => void
}) {
  const [f, setF] = useState<Omit<Debt, 'id'>>(
    debt ? { name: debt.name, balance: debt.balance, rate: debt.rate, minPayment: debt.minPayment, color: debt.color }
         : { ...EMPTY }
  )
  const [confirmDel, setConfirmDel] = useState(false)
  const p = <K extends keyof typeof f>(k: K, v: typeof f[K]) => setF(cur => ({ ...cur, [k]: v }))

  useMobileBackDismiss(true, onClose)

  return (
    <div className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={debt ? 'Editar deuda' : 'Nueva deuda'} onClick={onClose}>
      <section className="mdebt-sheet" onClick={e => e.stopPropagation()}>
        <header>
          <span>{debt ? 'Editar deuda' : 'Nueva deuda'}</span>
          <button aria-label="Cerrar" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="mdebt-sheet-body">
          <label className="mdebt-field">
            <span>Nombre</span>
            <input className="mdebt-input" autoFocus value={f.name}
              placeholder="ej. Tarjeta de crédito" onChange={e => p('name', e.target.value)} />
          </label>

          <div className="mdebt-field-row">
            <label className="mdebt-field" style={{ flex: 1 }}>
              <span>Saldo</span>
              <input className="mdebt-input" type="number" inputMode="decimal"
                value={f.balance || ''} placeholder="0" onChange={e => p('balance', Number(e.target.value))} />
            </label>
            <label className="mdebt-field" style={{ flex: 1 }}>
              <span>Interés anual (%)</span>
              <input className="mdebt-input" type="number" inputMode="decimal"
                value={f.rate || ''} placeholder="0" onChange={e => p('rate', Number(e.target.value))} />
            </label>
          </div>

          <label className="mdebt-field">
            <span>Pago mínimo mensual</span>
            <input className="mdebt-input" type="number" inputMode="decimal"
              value={f.minPayment || ''} placeholder="0" onChange={e => p('minPayment', Number(e.target.value))} />
          </label>

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
  )
}
