import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useFinance } from '@/store/finance'
import { useDialogs } from '@/components/ui/DialogProvider'
import { useSettings } from '@/store/settings'
import { dateLocale, fmt } from '@/data/helpers'
import { playKeySound, playBackspaceSound, playDoneSound } from '@/lib/sound'
import { MobileDatePicker } from './MobileDatePicker'
import type { Goal, IconName, ViewProps } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'

const COLORS = [
  '#ffdd3d','#ff6b35','#e8445a','#c765ff','#5e5ce6',
  '#0a84ff','#30d158','#ffd60a','#ff9f0a','#64d2ff',
]

const ICONS: IconName[] = [
  'target','piggy','home','car','plane','book','heart','graduation',
  'gift','trophy','shield','star','briefcase','wallet','laptop','phone',
  'gym','coffee','tree','crown','map','package','tool','monitor',
  'banknote','coins','handCoins','landmark','receipt',
]

type Sheet = { type: 'add' | 'edit'; goal?: Goal } | { type: 'detail'; goal: Goal } | null

function pct(saved: number, target: number) {
  return Math.min(100, Math.round((saved / target) * 100))
}

function currencyPrefix(currency: string): string {
  if (currency === 'DOP') return 'RD$'
  if (currency === 'USD') return '$'
  if (currency === 'EUR') return '€'
  return currency
}

function fmtAmountText(text: string, prefix: string): string {
  if (!text) return `${prefix} 0`
  const n = parseFloat(text)
  if (isNaN(n)) return `${prefix} 0`
  if (text.endsWith('.')) return `${prefix} ${n.toLocaleString('en-US')}.`
  return `${prefix} ${n.toLocaleString('en-US', { minimumFractionDigits: text.includes('.') ? 2 : 0 })}`
}

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','.','0','back'] as const

function GoalNumpad({
  amountText,
  onPress,
  prefix,
  onDone,
}: {
  amountText: string
  onPress: (k: string) => void
  prefix: string
  onDone: () => void
}) {
  return (
    <div className="mgl-numpad-view">
      <div className="mgl-numpad-display">{fmtAmountText(amountText, prefix)}</div>
      <div className="mgl-numpad-grid">
        {NUMPAD_KEYS.map(k => (
          <button
            key={k}
            className={k === 'back' ? 'mgl-numpad-back' : 'mgl-numpad-key'}
            onClick={() => onPress(k)}
          >
            {k === 'back' ? <Icon name="close" size={18} /> : k}
          </button>
        ))}
      </div>
      <button className="mgl-numpad-done" onClick={onDone}>Listo</button>
    </div>
  )
}

function GoalCard({ goal, currency, onClick }: { goal: Goal; currency: string; onClick: () => void }) {
  const p = pct(goal.saved, goal.target)
  const cur = currency as Parameters<typeof fmt>[1]
  return (
    <button className="mgl-card" onClick={onClick}>
      <div className="mgl-card-top">
        <span className="mgl-icon" style={{ background: goal.color + '22', color: goal.color }}>
          <Icon name={goal.icon} size={22} />
        </span>
        <div className="mgl-card-info">
          <strong>{goal.name}</strong>
          {goal.deadline && <small>{new Date(goal.deadline).toLocaleDateString('es', { day:'numeric', month:'short', year:'numeric' })}</small>}
        </div>
        <span className="mgl-pct" style={{ color: goal.color }}>{p}%</span>
      </div>
      <div className="mgl-bar-track">
        <div className="mgl-bar-fill" style={{ width: `${p}%`, background: goal.color }} />
      </div>
      <div className="mgl-card-bottom">
        <span>{fmt(goal.saved, cur)}</span>
        <span className="mgl-dim"> de {fmt(goal.target, cur)}</span>
      </div>
    </button>
  )
}

function GoalForm({
  initial,
  currency,
  onSave,
  onClose,
}: {
  initial?: Goal
  currency: string
  onSave: (data: Omit<Goal,'id'|'saved'>) => void
  onClose: () => void
}) {
  const [name, setName]             = useState(initial?.name ?? '')
  const [amountText, setAmountText] = useState(initial?.target?.toString() ?? '')
  const [color, setColor]           = useState(initial?.color ?? COLORS[0])
  const [icon, setIcon]             = useState<IconName>(initial?.icon ?? 'target')
  const [deadline, setDeadline]     = useState(initial?.deadline ?? '')
  const [showNumpad, setShowNumpad] = useState(false)
  const [showDate, setShowDate]     = useState(false)

  const lang = useSettings(s => s.language)
  const prefix = currencyPrefix(currency)
  const today = new Date().toISOString().slice(0, 10)
  const deadlinePast = !!deadline && deadline < today

  useMobileBackDismiss(true, showNumpad ? () => setShowNumpad(false) : showDate ? () => setShowDate(false) : onClose)

  const pressAmt = (key: string) => {
    if (key === 'back') {
      playBackspaceSound()
      navigator.vibrate?.(10)
      setAmountText(v => v.slice(0, -1))
      return
    }
    playKeySound()
    navigator.vibrate?.(8)
    setAmountText(v => {
      if (key === '.') {
        if (v.includes('.')) return v
        return (v || '0') + '.'
      }
      if (v === '0' && key !== '.') return key
      const next = v + key
      const [, dec] = next.split('.')
      if (dec && dec.length > 2) return v
      return next
    })
  }

  const handleDone = () => {
    playDoneSound()
    navigator.vibrate?.(12)
    setShowNumpad(false)
  }

  const save = () => {
    const t = parseFloat(amountText)
    if (!name.trim() || !t || t <= 0) return
    onSave({ name: name.trim(), target: t, color, icon, deadline: deadline || undefined })
  }

  const deadlineLabel = deadline
    ? new Date(`${deadline}T00:00:00`).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Sin fecha límite'

  return (
    <div className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={initial ? 'Editar meta' : 'Nueva meta'} onClick={onClose}>
      <section className="mgl-form" onClick={e => e.stopPropagation()}>
        <header>
          <span>{initial ? 'Editar meta' : 'Nueva meta'}</span>
          <button aria-label="Cerrar" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        {showNumpad ? (
          <GoalNumpad amountText={amountText} onPress={pressAmt} prefix={prefix} onDone={handleDone} />
        ) : (
          <>
            <div className="mgl-form-body">
              <label className="mgl-field">
                <span>Nombre</span>
                <input
                  className="mgl-input"
                  placeholder="Ej. Fondo de emergencia"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </label>

              <div className="mgl-field">
                <span>Objetivo</span>
                <button className="mgl-amount-tap" onClick={() => setShowNumpad(true)}>
                  <span>{fmtAmountText(amountText, prefix)}</span>
                  <Icon name="edit" size={14} style={{ opacity: .4 }} />
                </button>
              </div>

              <div className="mgl-field">
                <span>Fecha límite <em>(opcional)</em></span>
                <button
                  className={`mgl-amount-tap${deadlinePast ? ' warn' : ''}`}
                  onClick={() => setShowDate(true)}
                >
                  <span style={deadlinePast ? { color: 'var(--m-warn, #f59e0b)' } : undefined}>{deadlineLabel}</span>
                  <Icon name="calendar" size={14} style={{ opacity: .4 }} />
                </button>
                {deadlinePast && (
                  <small style={{ color: 'var(--m-warn, #f59e0b)', marginTop: 4, display: 'block', fontSize: 11 }}>
                    Esta fecha ya pasó — la meta se mostrará como vencida
                  </small>
                )}
              </div>

              <div className="mgl-field">
                <span>Color</span>
                <div className="mgl-colors">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      className={`mgl-color-dot${color === c ? ' on' : ''}`}
                      aria-label={`Color ${c}`}
                      aria-pressed={color === c}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>

              <div className="mgl-field">
                <span>Icono</span>
                <div className="mgl-icons">
                  {ICONS.map(ic => (
                    <button
                      key={ic}
                      className={`mgl-icon-btn${icon === ic ? ' on' : ''}`}
                      aria-label={`Icono ${ic}`}
                      aria-pressed={icon === ic}
                      style={icon === ic ? { background: color + '33', color } : {}}
                      onClick={() => setIcon(ic)}
                    >
                      <Icon name={ic} size={18} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mgl-form-actions">
              <button className="mgl-btn-cancel" onClick={onClose}>Cancelar</button>
              <button className="mgl-btn-save" style={{ background: color }} onClick={save}>
                {initial ? 'Guardar' : 'Crear meta'}
              </button>
            </div>
          </>
        )}
      </section>

      {showDate && (
        <MobileDatePicker
          value={deadline || new Date().toISOString().slice(0, 10)}
          onChange={v => { setDeadline(v); setShowDate(false) }}
          onClose={() => setShowDate(false)}
        />
      )}
    </div>
  )
}

function ContributeSheet({ goal, currency, onClose }: { goal: Goal; currency: string; onClose: () => void }) {
  const { accounts, contribute } = useFinance()
  const [amountText, setAmountText] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [showNumpad, setShowNumpad] = useState(true)
  const cur = currency as Parameters<typeof fmt>[1]
  const prefix = currencyPrefix(currency)

  useMobileBackDismiss(true, showNumpad ? () => setShowNumpad(false) : onClose)

  const validAccounts = accounts.filter(a => a.type !== 'credit')

  const pressAmt = (key: string) => {
    if (key === 'back') {
      playBackspaceSound()
      navigator.vibrate?.(10)
      setAmountText(v => v.slice(0, -1))
      return
    }
    playKeySound()
    navigator.vibrate?.(8)
    setAmountText(v => {
      if (key === '.') {
        if (v.includes('.')) return v
        return (v || '0') + '.'
      }
      if (v === '0' && key !== '.') return key
      const next = v + key
      const [, dec] = next.split('.')
      if (dec && dec.length > 2) return v
      return next
    })
  }

  const handleDone = () => {
    playDoneSound()
    navigator.vibrate?.(12)
    setShowNumpad(false)
  }

  const submit = () => {
    const amt = parseFloat(amountText)
    if (!amt || amt <= 0 || !accountId) return
    try {
      contribute(goal.id, amt, accountId)
      onClose()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al aportar')
    }
  }

  return (
    <div className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={`Aportar a ${goal.name}`} onClick={onClose}>
      <section className="mgl-form" onClick={e => e.stopPropagation()}>
        <header>
          <span>Aportar a {goal.name}</span>
          <button aria-label="Cerrar" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        {showNumpad ? (
          <GoalNumpad amountText={amountText} onPress={pressAmt} prefix={prefix} onDone={handleDone} />
        ) : (
          <>
            <div className="mgl-form-body">
              <div className="mgl-contrib-display">
                <div className="mgl-contrib-ring" style={{ borderColor: goal.color }}>
                  <Icon name={goal.icon} size={28} style={{ color: goal.color }} />
                </div>
                <div>
                  <strong>{fmt(goal.saved, cur)}</strong>
                  <small> / {fmt(goal.target, cur)}</small>
                </div>
              </div>

              <div className="mgl-field">
                <span>Monto a aportar</span>
                <button className="mgl-amount-tap" onClick={() => setShowNumpad(true)}>
                  <span>{fmtAmountText(amountText, prefix)}</span>
                  <Icon name="edit" size={14} style={{ opacity: .4 }} />
                </button>
              </div>

              <label className="mgl-field">
                <span>Desde cuenta</span>
                <select className="mgl-input" value={accountId} onChange={e => setAccountId(e.target.value)}>
                  {validAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance, cur)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mgl-form-actions">
              <button className="mgl-btn-cancel" onClick={onClose}>Cancelar</button>
              <button className="mgl-btn-save" style={{ background: goal.color }} onClick={submit}>
                Aportar
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export function MobileGoals(_props: ViewProps) {
  const { goals, addGoal, updateGoal, deleteGoal, currency } = useFinance()
  const { confirm } = useDialogs()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null)

  const totalSaved  = goals.reduce((s, g) => s + g.saved, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target, 0)
  const done        = goals.filter(g => g.saved >= g.target).length
  const cur = currency as Parameters<typeof fmt>[1]

  return (
    <div className="mgl-root">
      {goals.length > 0 && (
        <div className="mgl-summary">
          <div className="mgl-sum-item">
            <span className="mgl-sum-label">Ahorrado</span>
            <strong className="mgl-sum-value">{fmt(totalSaved, cur)}</strong>
          </div>
          <div className="mgl-sum-div" />
          <div className="mgl-sum-item">
            <span className="mgl-sum-label">Objetivo</span>
            <strong className="mgl-sum-value">{fmt(totalTarget, cur)}</strong>
          </div>
          <div className="mgl-sum-div" />
          <div className="mgl-sum-item">
            <span className="mgl-sum-label">Listas</span>
            <strong className="mgl-sum-value">{done}/{goals.length}</strong>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="mgl-empty">
          <Icon name="target" size={48} style={{ opacity: .25 }} />
          <p>No tienes metas aún</p>
          <button className="mgl-empty-btn" onClick={() => setSheet({ type: 'add' })}>
            Crear primera meta
          </button>
        </div>
      ) : (
        <div className="mgl-list">
          {goals.map(g => (
            <div key={g.id} className="mgl-card-wrap">
              <GoalCard goal={g} currency={currency} onClick={() => setSheet({ type: 'detail', goal: g })} />
              <div className="mgl-card-actions">
                <button className="mgl-action-btn" onClick={() => setContributeGoal(g)}>
                  <Icon name="plus" size={15} /> Aportar
                </button>
                <button className="mgl-action-btn" aria-label={`Editar meta ${g.name}`} onClick={() => setSheet({ type: 'edit', goal: g })}>
                  <Icon name="edit" size={15} />
                </button>
                <button className="mgl-action-btn mgl-action-del" aria-label={`Eliminar meta ${g.name}`} onClick={() => {
                  void confirm({ title: `¿Eliminar "${g.name}"?`, description: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', icon: 'trash' }).then(ok => { if (ok) deleteGoal(g.id) })
                }}>
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="mgl-fab" aria-label="Nueva meta" onClick={() => setSheet({ type: 'add' })}>
        <Icon name="plus" size={24} />
      </button>

      {(sheet?.type === 'add' || sheet?.type === 'edit') && (
        <GoalForm
          initial={sheet.goal}
          currency={currency}
          onSave={data => {
            if (sheet.type === 'edit' && sheet.goal) {
              updateGoal(sheet.goal.id, data)
            } else {
              addGoal({ ...data, saved: 0 })
            }
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {contributeGoal && (
        <ContributeSheet goal={contributeGoal} currency={currency} onClose={() => setContributeGoal(null)} />
      )}
    </div>
  )
}
