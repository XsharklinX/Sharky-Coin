import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/charts'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useDialogs } from '@/components/ui/DialogProvider'
import { dateLocale, fmtCompact } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { Goal, ViewProps } from '@/types'
import { Card, Empty, MiniStat } from './shared'

/** Estima cuándo se alcanzará la meta basado en el ritmo actual de aportes */
function estimateCompletion(goal: Goal, transactions: import('@/types').Transaction[], locale = 'es-DO'): string | null {
  const remaining = goal.target - goal.saved
  if (remaining <= 0) return null

  // calcular promedio mensual de aportes a esta meta en los últimos 3 meses
  const now = new Date()
    // aportes = gastos de tipo 'expense' en cuentas asociadas no aplica;
    // se estima por la diferencia de saved histórica — simplificado:
    // usamos aportaciones reales en las transacciones marcadas hacia esta meta
    // Como no hay un campo goalId en Transaction, estimamos por variación de saved
    // Fallback: si no hay historial, no mostrar estimación

  // Si no tenemos datos de aportes históricos, usar el saved actual como base
  // (primer mes de uso): estimated = saved total / meses activos
  const firstTxDate = transactions.length ? transactions[transactions.length - 1].date : null
  if (!firstTxDate) return null

  const firstMonth = new Date(firstTxDate)
  const diffMonths = Math.max(1,
    (now.getFullYear() - firstMonth.getFullYear()) * 12 +
    (now.getMonth() - firstMonth.getMonth())
  )
  const avgMonthly = goal.saved / diffMonths
  if (avgMonthly <= 0) return null

  const monthsLeft = Math.ceil(remaining / avgMonthly)
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthsLeft, 1)
  return targetDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

export function Goals({ createRequest }: ViewProps) {
  const { goals, accounts, currency, transactions, goalContributions, addGoal, updateGoal, deleteGoal, contribute } = useFinance()
  const { confirm } = useDialogs()
  const lang = useSettings(s => s.language)
  const locale = dateLocale(lang)
  const [createOpen, setCreateOpen] = useState(false)
  const [name,       setName]       = useState('')
  const [target,     setTarget]     = useState('')
  const [deadline,   setDeadline]   = useState('')
  const [color,      setColor]      = useState('#38bdf8')
  const [selected,  setSelected]  = useState<Goal | null>(null)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [amount,    setAmount]    = useState('')
  const [accountId, setAccountId] = useState('')
  const [contributionNote, setContributionNote] = useState('')

  const available = accounts.filter(a => a.type !== 'credit')
  const totalSaved  = goals.reduce((s, g) => s + g.saved,  0)
  const totalTarget = goals.reduce((s, g) => s + g.target, 0)

  useEffect(() => {
    if (createRequest?.target === 'goal') setCreateOpen(true)
  }, [createRequest])

  const create = () => {
    const v = Number(target)
    if (!name.trim() || v <= 0)
      return toast('Ingresa nombre y monto objetivo.', { icon: 'target' })
    addGoal({ name: name.trim(), target: v, saved: 0, color, icon: 'target', deadline: deadline || undefined })
    toast('Meta creada', { icon: 'target', type: 'ok' })
    setName(''); setTarget(''); setDeadline(''); setColor('#38bdf8'); setCreateOpen(false)
  }

  const openContrib = (g: Goal) => {
    setSelected(g)
    setAmount('')
    setContributionNote('')
    setAccountId(available[0]?.id ?? '')
  }

  const addContrib = () => {
    try {
      const v = Number(amount)
      if (!selected || !accountId || v <= 0) return
      contribute(selected.id, v, accountId, contributionNote)
      toast(`Aportaste ${fmtCompact(v, currency)} a "${selected.name}"`, { icon: 'target', type: 'ok' })
      setSelected(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo registrar el aporte.', { icon: 'target' })
    }
  }

  const removeGoal = async (goal: Goal) => {
    const ok = await confirm({
      title: 'Eliminar meta',
      description: `Eliminarás la meta "${goal.name}". Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar meta',
      icon: 'trash',
      tone: 'danger',
    })
    if (!ok) return
    deleteGoal(goal.id)
    toast('Meta eliminada', { icon: 'trash' })
  }

  return (
    <div className="view">
      <div className="goals-intro">
        <div>
          <span className="section-eyebrow">Plan de ahorro</span>
          <h2>Convierte tus planes en objetivos medibles</h2>
          <p>Define una meta, registra aportes y sigue tu avance desde un solo lugar.</p>
        </div>
        <button className="btn-primary lg" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={16} stroke={2.5} />Nueva meta
        </button>
      </div>

      {goalContributions.length > 0 && (
        <Card title="Historial de aportes" sub="Movimientos registrados hacia tus metas">
          <div className="recovery-list">
            {goalContributions.slice(0, 12).map(contribution => (
              <div className="recovery-item" key={contribution.id}>
                <div>
                  <b>{goals.find(goal => goal.id === contribution.goalId)?.name ?? 'Meta eliminada'}</b>
                  <span>{contribution.date} · {accounts.find(account => account.id === contribution.fromAccountId)?.name ?? 'Cuenta eliminada'}{contribution.note ? ` · ${contribution.note}` : ''}</span>
                </div>
                <strong style={{ color: 'var(--income)' }}>{fmtCompact(contribution.amount, currency)}</strong>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <MiniStat label="Ahorrado total" amount={totalSaved}  color="var(--income)" />
        <MiniStat label="Meta total"     amount={totalTarget} />
        <MiniStat label="Progreso"
          value={totalTarget ? `${Math.round(totalSaved / totalTarget * 100)}%` : '—'}
          color="var(--accent)" />
      </div>

      <div className="grid-acc dashboard-section">
        {goals.map(goal => {
          const progress   = Math.min(100, goal.saved / goal.target * 100)
          const done       = goal.saved >= goal.target
          const estimated  = done ? null : estimateCompletion(goal, transactions, locale)

          return (
            <article className="card goal-card" key={goal.id}>
              <div className="goal-head">
                <span style={{ color: goal.color, background: `color-mix(in oklab, ${goal.color} 18%, transparent)`,
                  width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center' }}>
                  <Icon name={goal.icon} size={19} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 650, color: 'var(--text)' }}>{goal.name}</h3>
                  <small style={{ color: 'var(--text-dim)', fontSize: 11.5 }}>
                    {done
                      ? '¡Meta cumplida! 🎉'
                      : estimated
                        ? `Estimado: ${estimated}`
                        : goal.deadline
                          ? `Límite: ${new Date(goal.deadline + 'T00:00:00').toLocaleDateString(locale, { month: 'short', year: 'numeric' })}`
                          : 'Sin fecha límite'}
                  </small>
                </div>
                <div className="goal-actions">
                  <button className="icon-btn" aria-label={`Editar ${goal.name}`}
                    onClick={() => setEditingGoal(goal)}>
                    <Icon name="edit" size={15} />
                  </button>
                  <button className="icon-btn danger" aria-label={`Eliminar ${goal.name}`}
                    onClick={() => void removeGoal(goal)}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>

              <div style={{ margin: '14px 0 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
                  <AnimatedMoney value={goal.saved} decimals={0} />
                </strong>
                <small style={{ color: 'var(--text-dim)' }}>de {fmtCompact(goal.target, currency)}</small>
              </div>

              <Progress value={goal.saved} max={goal.target} height={9} color={goal.color} />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                <span style={{ color: done ? 'var(--income)' : 'var(--text-dim)', fontWeight: 600 }}>
                  {done ? '100%' : `${progress.toFixed(0)}% completado`}
                </span>
                {!done && (
                  <span style={{ color: 'var(--text-dim)' }}>
                    Faltan {fmtCompact(goal.target - goal.saved, currency)}
                  </span>
                )}
              </div>

              <button className="btn-soft" style={{ marginTop: 14 }}
                disabled={done} onClick={() => openContrib(goal)}>
                <Icon name="plus" size={15} stroke={2.3} />Aportar
              </button>
            </article>
          )
        })}

        {goals.length === 0 && (
          <Card>
            <Empty icon="target" title="No tienes metas todavía"
              text="Crea un objetivo para empezar a ahorrar con propósito."
              action={<button className="btn-primary" onClick={() => setCreateOpen(true)}>Crear mi primera meta</button>} />
          </Card>
        )}
      </div>

      {createOpen && (
        <div className="modal-overlay" role="presentation" onMouseDown={() => setCreateOpen(false)}>
          <section className="modal goal-create-modal" role="dialog" aria-modal="true"
            aria-labelledby="goal-create-title" onMouseDown={e => e.stopPropagation()}>
            <header className="modal-head">
              <div className="modal-title-wrap">
                <span className="modal-title-icon"><Icon name="target" size={19} /></span>
                <div>
                  <span className="section-eyebrow">Nuevo objetivo</span>
                  <h2 id="goal-create-title">Crear una meta de ahorro</h2>
                </div>
              </div>
              <button className="icon-btn" aria-label="Cerrar" onClick={() => setCreateOpen(false)}>
                <Icon name="close" size={16} />
              </button>
            </header>

            <p className="modal-lead">Ponle un nombre a tu próximo logro y define cuánto quieres ahorrar.</p>

            <div className="field">
              <label htmlFor="goal-name">Nombre de la meta</label>
              <input id="goal-name" autoFocus className="select" value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej. Fondo de emergencia" />
            </div>

            <div className="field">
              <label htmlFor="goal-target">Monto objetivo</label>
              <div className="amount-field">
                <span>RD$</span>
                <input id="goal-target" type="number" inputMode="decimal" value={target}
                  placeholder="0.00" onChange={e => setTarget(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && create()} />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="goal-deadline">Fecha objetivo <em>opcional</em></label>
                <input id="goal-deadline" className="select" type="date" value={deadline}
                  onChange={e => setDeadline(e.target.value)} />
              </div>
              <div className="field">
                <label>Color de identificación</label>
                <div className="goal-color-list" aria-label="Color de la meta">
                  {['#38bdf8', '#22c55e', '#a78bfa', '#f59e0b', '#f43f5e'].map(option => (
                    <button key={option} type="button" className={color === option ? 'selected' : ''}
                      style={{ background: option }} aria-label={`Usar color ${option}`}
                      aria-pressed={color === option} onClick={() => setColor(option)} />
                  ))}
                </div>
              </div>
            </div>

            <footer className="modal-actions">
              <button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={create}>
                <Icon name="plus" size={15} />Crear meta
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* modal contribución */}
      {editingGoal && (
        <EditGoalModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSave={(fields) => {
            updateGoal(editingGoal.id, fields)
            toast(`Meta "${fields.name ?? editingGoal.name}" actualizada`, { icon: 'edit', type: 'ok' })
            setEditingGoal(null)
          }}
        />
      )}

      {selected && (
        <div className="modal-overlay" role="presentation" onMouseDown={() => setSelected(null)}>
          <section className="modal" style={{ maxWidth: 400 }} role="dialog" aria-modal="true"
            aria-labelledby="contrib-title" onMouseDown={e => e.stopPropagation()}>
            <header className="modal-head">
              <h2 id="contrib-title">Aportar a {selected.name}</h2>
              <button className="icon-btn" aria-label="Cerrar" onClick={() => setSelected(null)}>
                <Icon name="close" size={16} />
              </button>
            </header>
            <div className="amount-field">
              <span>RD$</span>
              <input autoFocus type="number" value={amount} placeholder="0.00"
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addContrib()} />
            </div>
            <div className="field">
              <label htmlFor="contrib-account">Desde la cuenta</label>
              <select id="contrib-account" className="select" value={accountId}
                onChange={e => setAccountId(e.target.value)}>
                {available.map(a => (
                  <option key={a.id} value={a.id}>{a.name} · {fmtCompact(a.balance, currency)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="contrib-note">Nota <em>opcional</em></label>
              <input id="contrib-note" className="select" value={contributionNote}
                onChange={event => setContributionNote(event.target.value)} placeholder="Ej. Ahorro quincenal" />
            </div>
            <footer className="modal-actions">
              <button className="btn-ghost" onClick={() => setSelected(null)}>Cancelar</button>
              <button className="btn-primary" onClick={addContrib}>Aportar</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}

function EditGoalModal({
  goal,
  onClose,
  onSave,
}: {
  goal: Goal
  onClose: () => void
  onSave: (fields: Partial<Goal>) => void
}) {
  const [name, setName] = useState(goal.name)
  const [target, setTarget] = useState(String(goal.target))
  const [deadline, setDeadline] = useState(goal.deadline ?? '')
  const [color, setColor] = useState(goal.color)

  const save = () => {
    const cleanName = name.trim()
    const targetValue = Number(target)
    if (cleanName.length < 2 || targetValue <= 0) {
      return toast('Ingresa un nombre y un objetivo valido.', { icon: 'target' })
    }
    onSave({
      name: cleanName,
      target: targetValue,
      deadline: deadline || undefined,
      color,
    })
  }

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <section className="modal goal-create-modal" role="dialog" aria-modal="true"
        aria-labelledby="goal-edit-title" onMouseDown={event => event.stopPropagation()}>
        <header className="modal-head">
          <div className="modal-title-wrap">
            <span className="modal-title-icon"><Icon name="edit" size={19} /></span>
            <div>
              <span className="section-eyebrow">Objetivo de ahorro</span>
              <h2 id="goal-edit-title">Editar meta</h2>
            </div>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className="field">
          <label htmlFor="goal-edit-name">Nombre de la meta</label>
          <input id="goal-edit-name" autoFocus className="select" value={name}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && save()} />
        </div>

        <div className="field">
          <label htmlFor="goal-edit-target">Monto objetivo</label>
          <div className="amount-field">
            <span>RD$</span>
            <input id="goal-edit-target" type="number" inputMode="decimal" value={target}
              onChange={event => setTarget(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && save()} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="goal-edit-deadline">Fecha objetivo <em>opcional</em></label>
            <input id="goal-edit-deadline" className="select" type="date" value={deadline}
              onChange={event => setDeadline(event.target.value)} />
          </div>
          <div className="field">
            <label>Color de identificacion</label>
            <div className="goal-color-list" aria-label="Color de la meta">
              {['#38bdf8', '#22c55e', '#a78bfa', '#f59e0b', '#f43f5e'].map(option => (
                <button key={option} type="button" className={color === option ? 'selected' : ''}
                  style={{ background: option }} aria-label={`Usar color ${option}`}
                  aria-pressed={color === option} onClick={() => setColor(option)} />
              ))}
            </div>
          </div>
        </div>

        <footer className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save}>
            <Icon name="edit" size={15} />Guardar cambios
          </button>
        </footer>
      </section>
    </div>
  )
}
