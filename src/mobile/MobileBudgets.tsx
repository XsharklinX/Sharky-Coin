import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { fmtCompact, txForMonth } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import type { Category, IconName, ViewProps } from '@/types'

const COLORS = ['#ffdd3d','#35d0a2','#5bc0ff','#a78bfa','#ff6b8a','#f59e0b','#fb7185','#22c55e','#c084fc','#38bdf8']

const ALL_ICONS: IconName[] = [
  'cart','food','car','bolt','heart','home','bag','book','wallet','laptop','trend','play',
  'music','coffee','phone','gym','bus','building','gamepad','gift','scissors','baby','paw','pill',
  'plane','briefcase','shirt','pizza','star','fuel','flame','soda',
  'tree','sun','bike','train','tv','monitor','headphones','clock','key','tool',
  'brush','graduation','stethoscope','salad','wine','crown','trophy','shield','map','package',
]

export function MobileBudgets({ txns, mkey }: ViewProps) {
  const { categories, currency, addCategory, updateCategory, deleteCategory } = useFinance()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const monthTx = txForMonth(txns, mkey)
  const cats = categories.filter(c => c.type === 'expense')

  const spent: Record<string, number> = {}
  monthTx.forEach(tx => {
    if (tx.type === 'expense' && tx.categoryId)
      spent[tx.categoryId] = (spent[tx.categoryId] ?? 0) + tx.amount
  })

  const totalBudget = cats.reduce((s, c) => s + c.budget, 0)
  const totalSpent  = cats.reduce((s, c) => s + (spent[c.id] ?? 0), 0)
  const totalLeft   = totalBudget - totalSpent
  const globalPct   = totalBudget > 0 ? Math.min(100, totalSpent / totalBudget * 100) : 0
  const overCount   = cats.filter(c => (spent[c.id] ?? 0) > c.budget && c.budget > 0).length

  const save = (fields: { name: string; budget: number; color: string; icon: IconName }) => {
    if (!fields.name.trim()) { toast('Escribe un nombre para la categoría.', { icon: 'alert' }); return }
    if (editing === 'new') {
      addCategory({ name: fields.name.trim(), type: 'expense', budget: fields.budget, color: fields.color, icon: fields.icon })
      toast('Categoría creada', { icon: 'check', type: 'ok' })
    } else if (editing) {
      updateCategory(editing.id, { name: fields.name.trim(), budget: fields.budget, color: fields.color, icon: fields.icon })
      toast('Categoría actualizada', { icon: 'check', type: 'ok' })
    }
    setEditing(null)
  }

  const remove = (cat: Category) => {
    try {
      deleteCategory(cat.id)
      toast('Categoría eliminada', { icon: 'trash' })
      setEditing(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo eliminar.', { icon: 'alert' })
    }
  }

  useMobileBackDismiss(!!editing, () => setEditing(null))

  return (
    <div className="mbud-root">

      {/* ─── Resumen global ─── */}
      <div className="mbud-summary">
        <div className="mbud-summary-top">
          <div>
            <span className="mbud-summary-label">Presupuesto total</span>
            <strong className="mbud-summary-total">
              <AnimatedMoney value={totalBudget} compact />
            </strong>
          </div>
          <button className="mbud-add-btn" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> Nueva
          </button>
        </div>

        <div className="mbud-global-bar-wrap">
          <div className="mbud-global-bar-track">
            <div className="mbud-global-bar-fill" style={{
              width: `${globalPct}%`,
              background: globalPct >= 100 ? '#ff6b8a' : globalPct >= 80 ? '#f59e0b' : 'var(--accent, #ffdd3d)',
            }} />
          </div>
          <span className={`mbud-global-pct${globalPct >= 100 ? ' over' : globalPct >= 80 ? ' warn' : ''}`}>
            {Math.round(globalPct)}%
          </span>
        </div>

        <div className="mbud-summary-pills">
          <div className="mbud-pill">
            <Icon name="arrowUp" size={13} style={{ color: '#ff6b8a' }} />
            <div>
              <strong><AnimatedMoney value={totalSpent} compact /></strong>
              <small>Gastado</small>
            </div>
          </div>
          <div className="mbud-pill-sep" />
          <div className="mbud-pill">
            <Icon name="target" size={13} style={{ color: '#35d0a2' }} />
            <div>
              <strong className={totalLeft < 0 ? 'over' : ''}><AnimatedMoney value={Math.abs(totalLeft)} compact /></strong>
              <small>{totalLeft < 0 ? 'Excedido' : 'Disponible'}</small>
            </div>
          </div>
          {overCount > 0 && (
            <>
              <div className="mbud-pill-sep" />
              <div className="mbud-pill">
                <Icon name="alert" size={13} style={{ color: '#f59e0b' }} />
                <div>
                  <strong style={{ color: '#f59e0b' }}>{overCount}</strong>
                  <small>Excedidas</small>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Lista de categorías ─── */}
      <div className="mbud-list">
        {cats.length === 0 ? (
          <div className="mbud-empty">
            <span><Icon name="target" size={32} /></span>
            <strong>Sin presupuestos</strong>
            <p>Crea categorías de gasto y ponles un límite mensual</p>
            <button onClick={() => setEditing('new')}>
              <Icon name="plus" size={16} /> Crear primera categoría
            </button>
          </div>
        ) : (
          cats.map(cat => {
            const s = spent[cat.id] ?? 0
            const pct = cat.budget > 0 ? Math.min(100, s / cat.budget * 100) : 0
            const over = cat.budget > 0 && s > cat.budget
            const left = cat.budget - s
            return (
              <button key={cat.id} className="mbud-row" onClick={() => setEditing(cat)}>
                <span className="mbud-row-icon" style={{
                  color: cat.color,
                  background: `color-mix(in oklab, ${cat.color} 16%, transparent)`,
                }}>
                  <Icon name={cat.icon} size={20} />
                </span>
                <div className="mbud-row-body">
                  <div className="mbud-row-top">
                    <span className="mbud-row-name">{cat.name}</span>
                    <span className={`mbud-row-pct${over ? ' over' : pct >= 80 ? ' warn' : ''}`}>
                      {cat.budget > 0 ? `${Math.round(pct)}%` : 'Sin límite'}
                    </span>
                  </div>
                  {cat.budget > 0 && (
                    <div className="mbud-row-bar">
                      <div className="mbud-row-fill" style={{
                        width: `${pct}%`,
                        background: over ? '#ff6b8a' : pct >= 80 ? '#f59e0b' : cat.color,
                      }} />
                    </div>
                  )}
                  <div className="mbud-row-meta">
                    <span>{fmtCompact(s, currency)} gastado</span>
                    {cat.budget > 0 && (
                      <span className={over ? 'over' : ''}>
                        {over ? `+${fmtCompact(Math.abs(left), currency)} excedido` : `${fmtCompact(left, currency)} libre`}
                      </span>
                    )}
                  </div>
                </div>
                <Icon name="arrowUp" size={14} style={{ transform: 'rotate(90deg)', color: '#4a4a4a', flexShrink: 0 }} />
              </button>
            )
          })
        )}
      </div>

      {/* ─── Editor ─── */}
      {editing !== null && (
        <BudgetEditor
          category={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={editing !== 'new' ? remove : undefined}
        />
      )}
    </div>
  )
}

function BudgetEditor({
  category,
  onClose,
  onSave,
  onDelete,
}: {
  category?: Category
  onClose: () => void
  onSave: (f: { name: string; budget: number; color: string; icon: IconName }) => void
  onDelete?: (c: Category) => void
}) {
  const [name,   setName]   = useState(category?.name ?? '')
  const [budget, setBudget] = useState(String(category?.budget ?? ''))
  const [color,  setColor]  = useState(category?.color ?? COLORS[0])
  const [icon,   setIcon]   = useState<IconName>(category?.icon ?? 'cart')
  const [confirmDel, setConfirmDel] = useState(false)

  useMobileBackDismiss(true, onClose)

  return (
    <div className="mobile-editor-screen" role="dialog" aria-modal="true">
      <header>
        <button onClick={onClose}>Cancelar</button>
        <strong>{category ? 'Editar' : 'Nueva categoría'}</strong>
        <button onClick={() => onSave({ name, budget: Number(budget) || 0, color, icon })}>
          Guardar
        </button>
      </header>
      <div className="mobile-editor-body">

        <label>
          <span>Nombre</span>
          <input
            autoFocus
            type="text"
            value={name}
            placeholder="Ej. Comida, Gasolina"
            autoCapitalize="words"
            onChange={e => setName(e.target.value)}
          />
        </label>

        <label>
          <span>Límite mensual (RD$)</span>
          <input
            type="number"
            inputMode="decimal"
            value={budget}
            placeholder="0 = sin límite"
            onChange={e => setBudget(e.target.value)}
          />
        </label>

        <div>
          <span className="mobile-editor-label">Icono</span>
          <div className="mbud-icon-grid">
            {ALL_ICONS.map(ic => (
              <button
                key={ic}
                className={`mbud-icon-btn${icon === ic ? ' on' : ''}`}
                style={icon === ic ? { color, background: `color-mix(in oklab, ${color} 18%, transparent)`, borderColor: color } : {}}
                onClick={() => setIcon(ic)}
              >
                <Icon name={ic} size={22} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mobile-editor-label">Color</span>
          <div className="mobile-color-grid">
            {COLORS.map(c => (
              <button
                key={c}
                className={`mbud-color-btn${color === c ? ' on' : ''}`}
                style={{ background: c, borderColor: color === c ? '#fff' : 'transparent' }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        {category && onDelete && (
          !confirmDel ? (
            <button className="mobile-delete-button" onClick={() => setConfirmDel(true)}>
              <Icon name="trash" size={18} /> Eliminar categoría
            </button>
          ) : (
            <div className="mbud-confirm-del">
              <p>¿Eliminar "{category.name}"? Esta acción no se puede deshacer.</p>
              <div>
                <button onClick={() => setConfirmDel(false)}>Cancelar</button>
                <button className="danger" onClick={() => onDelete(category)}>
                  <Icon name="trash" size={16} /> Eliminar
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
