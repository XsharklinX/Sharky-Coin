import { useState } from 'react'
import { Progress } from '@/components/ui/charts'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmtCompact } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import type { Goal, ViewProps } from '@/types'
import { Card, Empty, MiniStat } from './shared'

/** Estima cuándo se alcanzará la meta basado en el ritmo actual de aportes */
function estimateCompletion(goal: Goal, transactions: import('@/types').Transaction[]): string | null {
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
  return targetDate.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
}

export function Goals(_: ViewProps) {
  const { goals, accounts, currency, transactions, addGoal, deleteGoal, contribute } = useFinance()
  const [name,      setName]      = useState('')
  const [target,    setTarget]    = useState('')
  const [selected,  setSelected]  = useState<Goal | null>(null)
  const [amount,    setAmount]    = useState('')
  const [accountId, setAccountId] = useState('')

  const available = accounts.filter(a => a.type !== 'credit')
  const totalSaved  = goals.reduce((s, g) => s + g.saved,  0)
  const totalTarget = goals.reduce((s, g) => s + g.target, 0)

  const create = () => {
    const v = Number(target)
    if (!name.trim() || v <= 0)
      return toast('Ingresa nombre y monto objetivo.', { icon: 'target' })
    addGoal({ name: name.trim(), target: v, saved: 0, color: '#38bdf8', icon: 'target' })
    toast('Meta creada', { icon: 'target', type: 'ok' })
    setName(''); setTarget('')
  }

  const openContrib = (g: Goal) => {
    setSelected(g)
    setAmount('')
    setAccountId(available[0]?.id ?? '')
  }

  const addContrib = () => {
    try {
      const v = Number(amount)
      if (!selected || !accountId || v <= 0) return
      contribute(selected.id, v, accountId)
      toast(`Aportaste ${fmtCompact(v, currency)} a "${selected.name}"`, { icon: 'target', type: 'ok' })
      setSelected(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo registrar el aporte.', { icon: 'target' })
    }
  }

  return (
    <div className="view">
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <MiniStat label="Ahorrado total" amount={totalSaved}  color="var(--income)" />
        <MiniStat label="Meta total"     amount={totalTarget} />
        <MiniStat label="Progreso"
          value={totalTarget ? `${Math.round(totalSaved / totalTarget * 100)}%` : '—'}
          color="var(--accent)" />
      </div>

      <Card title="Nueva meta" sub="Define un objetivo de ahorro">
        <div className="inline-form">
          <input className="select" value={name}   onChange={e => setName(e.target.value)}
            placeholder="Ej. Fondo de emergencia" aria-label="Nombre de la meta" />
          <input className="select" type="number" value={target} onChange={e => setTarget(e.target.value)}
            placeholder="Monto objetivo (RD$)" aria-label="Monto objetivo" />
          <button className="btn-primary" onClick={create}>
            <Icon name="plus" size={15} />Crear meta
          </button>
        </div>
      </Card>

      <div className="grid-acc dashboard-section">
        {goals.map(goal => {
          const progress   = Math.min(100, goal.saved / goal.target * 100)
          const done       = goal.saved >= goal.target
          const estimated  = done ? null : estimateCompletion(goal, transactions)

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
                          ? `Límite: ${new Date(goal.deadline + 'T00:00:00').toLocaleDateString('es-DO', { month: 'short', year: 'numeric' })}`
                          : 'Sin fecha límite'}
                  </small>
                </div>
                <button className="icon-btn" style={{ width: 30, height: 30 }}
                  aria-label={`Eliminar ${goal.name}`}
                  onClick={() => {
                    if (!window.confirm(`¿Eliminar la meta "${goal.name}"? Esta acción no se puede deshacer.`)) return
                    deleteGoal(goal.id); toast('Meta eliminada', { icon: 'trash' })
                  }}>
                  <Icon name="trash" size={15} />
                </button>
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
              text="Crea un objetivo para empezar a ahorrar con propósito." />
          </Card>
        )}
      </div>

      {/* modal contribución */}
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
