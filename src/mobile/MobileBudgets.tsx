import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { fmt, fmtCompact, txForMonth } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { MobileAmountSheet } from './MobileAmountSheet'
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
    if (!fields.name.trim()) { toast('Write a category name.', { icon: 'alert' }); return }
    if (editing === 'new') {
      addCategory({ name: fields.name.trim(), type: 'expense', budget: fields.budget, color: fields.color, icon: fields.icon })
      toast('Category created', { icon: 'check', type: 'ok' })
    } else if (editing) {
      updateCategory(editing.id, { name: fields.name.trim(), budget: fields.budget, color: fields.color, icon: fields.icon })
      toast('Category updated', { icon: 'check', type: 'ok' })
    }
    setEditing(null)
  }

  const remove = (cat: Category) => {
    try {
      deleteCategory(cat.id)
      toast('Category deleted', { icon: 'trash' })
      setEditing(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete.', { icon: 'alert' })
    }
  }

  useMobileBackDismiss(!!editing, () => setEditing(null))

  return (
    <div className="mbud-root">
      <div className="mbud-summary">
        <div className="mbud-summary-top">
          <div>
            <span className="mbud-summary-label">Total budget</span>
            <strong className="mbud-summary-total">
              <AnimatedMoney value={totalBudget} compact />
            </strong>
          </div>
          <button className="mbud-add-btn" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> New
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
              <small>Spent</small>
            </div>
          </div>
          <div className="mbud-pill-sep" />
          <div className="mbud-pill">
            <Icon name="target" size={13} style={{ color: '#35d0a2' }} />
            <div>
              <strong className={totalLeft < 0 ? 'over' : ''}><AnimatedMoney value={Math.abs(totalLeft)} compact /></strong>
              <small>{totalLeft < 0 ? 'Over budget' : 'Available'}</small>
            </div>
          </div>
          {overCount > 0 && (
            <>
              <div className="mbud-pill-sep" />
              <div className="mbud-pill">
                <Icon name="alert" size={13} style={{ color: '#f59e0b' }} />
                <div>
                  <strong style={{ color: '#f59e0b' }}>{overCount}</strong>
                  <small>Over limit</small>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mbud-list">
        {cats.length === 0 ? (
          <div className="mbud-empty">
            <span><Icon name="target" size={32} /></span>
            <strong>No budgets yet</strong>
            <p>Create expense categories with a monthly limit</p>
            <button onClick={() => setEditing('new')}>
              <Icon name="plus" size={16} /> Create first category
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
                      {cat.budget > 0 ? `${Math.round(pct)}%` : 'No limit'}
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
                    <span>{fmtCompact(s, currency)} spent</span>
                    {cat.budget > 0 && (
                      <span className={over ? 'over' : ''}>
                        {over ? `+${fmtCompact(Math.abs(left), currency)} over` : `${fmtCompact(left, currency)} free`}
                      </span>
                    )}
                  </div>
                </div>
                <Icon name="arrowUp" size={14} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', flexShrink: 0 }} />
              </button>
            )
          })
        )}
      </div>

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
  const { currency } = useFinance()
  const [name,       setName]       = useState(category?.name ?? '')
  const [budget,     setBudget]     = useState(category?.budget ?? 0)
  const [color,      setColor]      = useState(category?.color ?? COLORS[0])
  const [icon,       setIcon]       = useState<IconName>(category?.icon ?? 'cart')
  const [confirmDel, setConfirmDel] = useState(false)
  const [budgetSheet, setBudgetSheet] = useState(false)

  useMobileBackDismiss(budgetSheet, () => setBudgetSheet(false))
  useMobileBackDismiss(!budgetSheet, onClose)

  return (
    <>
    <div className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={category ? 'Edit category' : 'New category'} onClick={onClose}>
      <section className="mbud-editor-sheet" onClick={e => e.stopPropagation()}>
        <header>
          <span>{category ? 'Edit category' : 'New category'}</span>
          <button aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="mbud-editor-body">
          <label className="mbud-field">
            <span>Name</span>
            <input
              className="mbud-input"
              type="text"
              value={name}
              placeholder="e.g. Food, Gas"
              autoCapitalize="words"
              onChange={e => setName(e.target.value)}
            />
          </label>

          <div className="mbud-field">
            <span>Límite mensual</span>
            <button className="mdebt-amount-row" onClick={() => setBudgetSheet(true)}>
              <span className={budget > 0 ? 'mdebt-amt-set' : 'mdebt-amt-ph'}>
                {budget > 0 ? fmt(budget, currency) : 'Sin límite'}
              </span>
              <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)' }} />
            </button>
          </div>

          <div className="mbud-field">
            <span>Color</span>
            <div className="mbud-color-strip">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`mbud-color-dot${color === c ? ' on' : ''}`}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="mbud-field">
            <span>Icon</span>
            <div className="mbud-icon-grid-sheet">
              {ALL_ICONS.map(ic => (
                <button
                  key={ic}
                  className={`mbud-icon-btn-sheet${icon === ic ? ' on' : ''}`}
                  aria-label={`Icon ${ic}`}
                  aria-pressed={icon === ic}
                  style={icon === ic ? { color, background: `color-mix(in oklab, ${color} 18%, transparent)` } : {}}
                  onClick={() => setIcon(ic)}
                >
                  <Icon name={ic} size={20} />
                </button>
              ))}
            </div>
          </div>

          {category && onDelete && (
            !confirmDel ? (
              <button className="mbud-del-btn" onClick={() => setConfirmDel(true)}>
                <Icon name="trash" size={16} /> Delete category
              </button>
            ) : (
              <div className="mbud-confirm-del">
                <p>Delete "{category.name}"? This cannot be undone.</p>
                <div>
                  <button onClick={() => setConfirmDel(false)}>Cancel</button>
                  <button className="danger" onClick={() => onDelete(category)}>
                    <Icon name="trash" size={16} /> Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        <div className="mbud-editor-actions">
          <button className="mbud-btn-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="mbud-btn-save"
            style={{ background: color }}
            onClick={() => onSave({ name, budget, color, icon })}
          >
            {category ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </section>
    </div>

    {budgetSheet && (
      <MobileAmountSheet
        title="Límite mensual"
        value={budget}
        currency={currency}
        onDone={v => { setBudget(v); setBudgetSheet(false) }}
        onClose={() => setBudgetSheet(false)}
      />
    )}
    </>
  )
}
