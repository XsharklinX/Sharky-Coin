import { useEffect, useState } from 'react'
import { Donut, Progress } from '@/components/ui/charts'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useDialogs } from '@/components/ui/DialogProvider'
import { categoryParts, currentMonthKey, fmtCompact, monthLabel, transactionsForTotals, txForMonth } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import type { Category, ViewProps } from '@/types'
import { Card, CatBadge, Empty, MiniStat } from './shared'

// Constantes
const CAT_COLORS = ['#6366f1','#2dd4bf','#f59e0b','#38bdf8','#c084fc','#f472b6','#fb7185','#facc15','#22c55e']
const CAT_ICONS = ['home','cart','food','car','bolt','play','heart','bag','book','trend','wallet','laptop'] as const
type CatIcon = typeof CAT_ICONS[number]

export function Budgets({ txns, mkey, createRequest }: ViewProps) {
  const { accounts, categories, currency, updateCategory, deleteCategory } = useFinance()
  const { confirm } = useDialogs()
  const [addOpen, setAddOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'annual'>('monthly')
  const visTxns = transactionsForTotals(txns, accounts, currency)

  useEffect(() => {
    if (createRequest?.target === 'category') setAddOpen(true)
  }, [createRequest])

  const isCurrent   = mkey === currentMonthKey()
  const [yy, mm]    = mkey.split('-').map(Number)
  const daysInMonth = new Date(yy, mm, 0).getDate()
  const dayNow      = isCurrent ? new Date().getDate() : daysInMonth
  const timePct     = (dayNow / daysInMonth) * 100

  const budgetFor = (category: typeof categories[number]) => period === 'weekly'
    ? category.weeklyBudget ?? Math.round(category.budget / 4.33)
    : period === 'annual' ? category.annualBudget ?? category.budget * 12 : category.budget
  const periodTx = period === 'annual'
    ? visTxns.filter(tx => tx.date.startsWith(mkey.slice(0, 4)))
    : period === 'weekly'
      ? txForMonth(visTxns, mkey).filter(tx => {
          const anchor = isCurrent ? new Date() : new Date(yy, mm - 1, 1)
          const start = new Date(anchor); start.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7))
          const end = new Date(start); end.setDate(start.getDate() + 7)
          const date = new Date(`${tx.date}T00:00:00`)
          return date >= start && date < end
        })
    : txForMonth(visTxns, mkey)

  // Calcular gasto por categoría
  const spent: Record<string, number> = {}
  periodTx.forEach(tx => {
    if (tx.type !== 'expense') return
    categoryParts(tx).forEach(part => {
      if (part.categoryId) spent[part.categoryId] = (spent[part.categoryId] ?? 0) + part.amount
    })
  })

  const cats        = categories.filter(c => c.type === 'expense')
  const totalBudget = cats.reduce((s, c) => s + budgetFor(c), 0)
  const totalUsed   = cats.reduce((s, c) => s + (spent[c.id] ?? 0), 0)
  const totalLeft   = totalBudget - totalUsed
  const totalPct    = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0

  // Proyección al fin de mes
  const projected   = dayNow > 0 ? (totalUsed / dayNow) * daysInMonth : totalUsed
  const overBudget  = cats.filter(c => (spent[c.id] ?? 0) > budgetFor(c)).length

  // Ritmo de gasto: rojo si %gasto > %tiempo + 10, verde si < -10
  const pace = totalPct - timePct
  const paceLabel = pace > 10 ? '⚡ Acelerado' : pace < -10 ? '✓ Saludable' : '↔ Al ritmo'
  const paceColor = pace > 10 ? 'var(--expense)' : pace < -10 ? 'var(--income)' : 'var(--text-dim)'

  const removeCategory = async (category: typeof cats[number]) => {
    const ok = await confirm({
      title: 'Eliminar categoría',
      description: `Eliminarás "${category.name}" de tus presupuestos. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar categoría',
      icon: 'trash',
      tone: 'danger',
    })
    if (!ok) return
    try {
      deleteCategory(category.id)
      toast(`Categoría "${category.name}" eliminada`, { icon: 'trash' })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo eliminar la categoría.', { icon: 'alert' })
    }
  }

  return (
    <div className="view">
      <div className="seg" style={{ marginBottom: 12 }}>
        {([['weekly', 'Semanal'], ['monthly', 'Mensual'], ['annual', 'Anual']] as const).map(([value, label]) =>
          <button key={value} className={period === value ? 'on' : ''} onClick={() => setPeriod(value)}>{label}</button>)}
      </div>
      {/* Nota de reinicio mensual */}
      <div className="reset-note">
        <Icon name="calendar" size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span>
          Estás revisando el presupuesto {period === 'weekly' ? 'semanal' : period === 'annual' ? 'anual' : 'mensual'} de{' '}
          <b style={{ color: 'var(--text)' }}>{monthLabel(mkey)}</b>
          {isCurrent ? ` · día ${dayNow} de ${daysInMonth}` : ''}.
        </span>
      </div>

      {/* KPIs */}
      <div className="grid-3 dashboard-section">
        <MiniStat label="Presupuesto total" amount={totalBudget} />
        <MiniStat label="Gastado"           amount={totalUsed}   color="var(--expense)" />
        <MiniStat label="Disponible"        amount={totalLeft}
          color={totalLeft >= 0 ? 'var(--income)' : 'var(--expense)'} />
      </div>

      {/* Dona + Resumen */}
      <div className="grid-2-1">
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <Donut size={180} thickness={22}
              data={[
                { label: 'Gastado',    value: totalUsed,              color: totalPct > 100 ? 'var(--expense)' : 'var(--accent)' },
                { label: 'Disponible', value: Math.max(0, totalLeft), color: 'var(--track-strong)' },
              ]}
              centerTop={`${totalPct.toFixed(0)}%`}
              centerBottom={fmtCompact(totalUsed, currency)}
            />
            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <BudgetStat label="Presupuesto"   value={fmtCompact(totalBudget, currency)} />
              <BudgetStat label="Gastado"       value={fmtCompact(totalUsed,   currency)} color="var(--expense)" />
              <BudgetStat label="Disponible"    value={fmtCompact(totalLeft,   currency)}
                color={totalLeft >= 0 ? 'var(--income)' : 'var(--expense)'} />
              {isCurrent && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>
                  Proyección fin de mes:{' '}
                  <b style={{ color: projected > totalBudget ? 'var(--expense)' : 'var(--text)' }}>
                    {fmtCompact(projected, currency)}
                  </b>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card title="Resumen" sub="Estado del mes">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SummaryRow label="Categorías en presupuesto"
              value={`${cats.filter(c => (spent[c.id] ?? 0) <= budgetFor(c)).length} / ${cats.length}`} />
            <SummaryRow label="Categorías excedidas"
              value={String(overBudget)} danger={overBudget > 0} />
            <SummaryRow label="% del mes transcurrido"
              value={isCurrent ? `${timePct.toFixed(0)}%` : '100%'} />
            <SummaryRow label="Ritmo de gasto"
              value={paceLabel} color={paceColor} />
            {isCurrent && (
              <SummaryRow label="Días restantes"
                value={String(daysInMonth - dayNow)} />
            )}
          </div>
        </Card>
      </div>

      {/* Lista por categoría */}
      <Card
        title="Presupuesto por categoría"
        sub="Edita los límites directamente"
        style={{ marginTop: 16 }}
        action={
          <button className="btn-ghost" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={14} />Nueva categoría
          </button>
        }
      >
        <div className="budget-list">
          <div className="budget-list-head">
            <span>Categoría</span>
            <span>Límite {period === 'weekly' ? 'semanal' : period === 'annual' ? 'anual' : 'mensual'}</span>
            <span>Disponible</span>
            <span />
          </div>
          {cats.map(c => {
            const amount = spent[c.id] ?? 0
            const categoryBudget = budgetFor(c)
            const rem    = categoryBudget - amount
            const cpct   = categoryBudget > 0 ? (amount / categoryBudget) * 100 : 0
            const over   = amount > categoryBudget && categoryBudget > 0
            // Ritmo por categoría
            const catPace = categoryBudget > 0 ? cpct - timePct : null

            return (
              <div className="budget-row" key={c.id}>
                <div className="budget-category-main">
                  <CatBadge category={c} />
                  <div className="budget-category-copy">
                    <div className="budget-category-title">
                      <span>{c.name}</span>
                      <span style={{ color: over ? 'var(--expense)' : 'var(--text-dim)' }}>
                        <b>{fmtCompact(amount, currency)}</b>
                        {' / '}{fmtCompact(categoryBudget, currency)}
                        {catPace !== null && (
                          <i style={{ color: catPace > 12 ? 'var(--expense)' : catPace < -12 ? 'var(--income)' : 'var(--text-dim)' }}>
                            {catPace > 12 ? '⚡' : catPace < -12 ? '✓' : '·'}
                          </i>
                        )}
                      </span>
                    </div>
                    <Progress value={amount} max={categoryBudget} height={7} color={c.color} />
                  </div>
                </div>

                {/* Edit budget inline */}
                <label className="budget-input">
                  <span>RD$</span>
                  <input
                    type="number"
                    value={categoryBudget}
                    aria-label={`Presupuesto ${c.name}`}
                    onChange={e => updateCategory(c.id, period === 'weekly'
                      ? { weeklyBudget: Number(e.target.value) || 0 }
                      : period === 'annual' ? { annualBudget: Number(e.target.value) || 0 }
                        : { budget: Number(e.target.value) || 0 })}
                  />
                </label>

                {/* Disponible / excedido */}
                <div className="budget-available" style={{ width: 80, textAlign: 'right', fontSize: 11.5,
                  fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                  color: over ? 'var(--expense)' : 'var(--income)', fontWeight: 600 }}>
                  {over ? `−${fmtCompact(Math.abs(rem), currency)}` : fmtCompact(rem, currency)}
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>
                    {over ? 'excedido' : 'disponible'}
                  </div>
                </div>

                <div className="budget-actions">
                  <button className="icon-btn" title={`Editar ${c.name}`} aria-label={`Editar ${c.name}`}
                    onClick={() => setEditingCategory(c)}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button className="icon-btn danger" title={`Eliminar ${c.name}`} aria-label={`Eliminar ${c.name}`}
                    onClick={() => void removeCategory(c)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            )
          })}

          {cats.length === 0 && (
            <Empty icon="target" title="No hay categorías de gasto"
              text="Crea una categoría para empezar a controlar tus límites mensuales."
              action={<button className="btn-primary" onClick={() => setAddOpen(true)}><Icon name="plus" size={14} /> Nueva categoría</button>} />
          )}
        </div>
      </Card>

      {/* Modal agregar categoría */}
      {addOpen && <CategoryModal onClose={() => setAddOpen(false)} />}
      {editingCategory && <CategoryModal category={editingCategory} onClose={() => setEditingCategory(null)} />}
    </div>
  )
}

// Modal crear/editar categoría
function CategoryModal({ category, onClose }: { category?: Category; onClose: () => void }) {
  const { addCategory, updateCategory } = useFinance()
  const [name,   setName]   = useState(category?.name ?? '')
  const [budget, setBudget] = useState(category ? String(category.budget) : '')
  const [color,  setColor]  = useState(category?.color ?? CAT_COLORS[0])
  const [icon,   setIcon]   = useState<CatIcon>((category?.icon as CatIcon | undefined) ?? CAT_ICONS[0])
  const isEditing = Boolean(category)

  const submit = () => {
    const cleanName = name.trim()
    if (category) {
      if (cleanName.length < 2 || !/[a-zA-Z]/.test(cleanName)) {
        return toast('Escribe un nombre válido para la categoría.', { icon: 'alert' })
      }
      updateCategory(category.id, { name: cleanName, budget: Number(budget) || 0, color, icon })
      toast(`Categoría "${cleanName}" actualizada`, { icon: 'edit', type: 'ok' })
      onClose()
      return
    }
    if (cleanName.length < 2 || !/[a-zA-Záéíóúüñ]/.test(cleanName)) {
      return toast('Escribe un nombre válido para la categoría.', { icon: 'alert' })
    }
    addCategory({ name: cleanName, type: 'expense', budget: Number(budget) || 0, color, icon })
    toast(`Categoría "${cleanName}" creada`, { icon: 'bag', type: 'ok' })
    onClose()
  }

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <section className="modal" style={{ maxWidth: 440 }} role="dialog" aria-modal="true"
        aria-labelledby="add-cat-title" onMouseDown={e => e.stopPropagation()}>
        <header className="modal-head">
          <h2 id="add-cat-title">{isEditing ? 'Editar categoría' : 'Nueva categoría de gasto'}</h2>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className="field-row" style={{ marginTop: 0 }}>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="cat-name">Nombre</label>
            <input id="cat-name" className="select" autoFocus
              value={name} placeholder="Ej. Mascotas"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="cat-budget">Presupuesto (RD$)</label>
            <input id="cat-budget" className="select" type="number"
              value={budget} placeholder="3000"
              onChange={e => setBudget(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CAT_COLORS.map(c => (
              <button key={c} type="button" aria-label={`Usar color ${c}`}
                aria-pressed={color === c} onClick={() => setColor(c)} style={{
                width: 28, height: 28, borderRadius: 8, background: c, cursor: 'pointer',
                border: color === c ? '2.5px solid var(--text)' : '2.5px solid transparent',
              }} />
            ))}
          </div>
        </div>

        <div className="field">
          <label>Ícono</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CAT_ICONS.map(ic => (
              <button key={ic} type="button" className="icon-btn"
                aria-label={`Usar ícono ${ic}`} aria-pressed={icon === ic}
                style={{ width: 34, height: 34,
                  color:        icon === ic ? 'var(--accent)' : 'var(--text-dim)',
                  borderColor:  icon === ic ? 'var(--accent)' : 'var(--border)',
                  background:   icon === ic ? 'color-mix(in oklab, var(--accent) 12%, transparent)' : undefined,
                }}
                onClick={() => setIcon(ic)}>
                <Icon name={ic} size={16} />
              </button>
            ))}
          </div>
        </div>

        <footer className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={submit}>
            <Icon name={isEditing ? 'edit' : 'plus'} size={15} />
            {isEditing ? 'Guardar cambios' : 'Crear categoría'}
          </button>
        </footer>
      </section>
    </div>
  )
}

// Helpers de UI
function BudgetStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: color ?? 'var(--text)',
        fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function SummaryRow({ label, value, danger, color }: {
  label: string; value: string; danger?: boolean; color?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontWeight: 650, color: color ?? (danger ? 'var(--expense)' : 'var(--text)') }}>{value}</span>
    </div>
  )
}
