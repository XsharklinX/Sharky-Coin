import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useFinance } from '@/store/finance'
import { CAT_COLORS } from '@/constants'
import type { Category, IconName } from '@/types'
import { useMobileBackDismiss } from '../useMobileBackDismiss'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'

const CAT_ICONS: IconName[] = [
  'cart','food','car','bolt','heart','home','bag','book','wallet','laptop','trend','play',
  'music','coffee','phone','gym','bus','building','gamepad','gift','scissors','baby','paw','pill',
  'plane','briefcase','shirt','pizza','star','fuel','flame','soda',
  'tree','sun','bike','train','tv','monitor','headphones','clock','key','tool',
  'brush','graduation','stethoscope','salad','wine','crown','trophy','shield','map','package',
]

export function SettingsCategories({ activeSheet, onOpen, onClose }: SheetProps) {
  const finance = useFinance()
  const [catTab,    setCatTab]    = useState<'expense' | 'income'>('expense')
  const [editingCat, setEditingCat] = useState<Category | 'new-expense' | 'new-income' | null>(null)

  useMobileBackDismiss(!!editingCat, () => setEditingCat(null))

  const saveCategory = (fields: { name: string; type: 'expense' | 'income'; budget: number; color: string; icon: IconName }) => {
    if (!fields.name.trim()) { toast('Escribe un nombre para la categoría.', { icon: 'alert' }); return }
    try {
      if (editingCat === 'new-expense' || editingCat === 'new-income') {
        finance.addCategory({ name: fields.name.trim(), type: fields.type, budget: fields.budget, color: fields.color, icon: fields.icon })
        toast('Categoría creada', { icon: 'check', type: 'ok' })
      } else if (editingCat) {
        finance.updateCategory(editingCat.id, { name: fields.name.trim(), budget: fields.budget, color: fields.color, icon: fields.icon })
        toast('Categoría actualizada', { icon: 'check', type: 'ok' })
      }
      setEditingCat(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar la categoría.', { icon: 'alert' })
    }
  }

  const removeCategory = (cat: Category) => {
    try {
      finance.deleteCategory(cat.id)
      toast('Categoría eliminada', { icon: 'trash' })
      setEditingCat(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo eliminar.', { icon: 'alert' })
    }
  }

  return (
    <>
      <div className="mset-card">
        <SettingsRow icon="tag" iconColor="#c084fc" label="Ajustes de categorías"
          onClick={() => onOpen('categories')} />
      </div>

      {activeSheet === 'categories' && (
        <SettingsSheet title="Categorías" onClose={onClose}>
          <div className="mset-sheet-body">
            <div className="mset-cat-tabs">
              <button className={catTab === 'expense' ? 'on' : ''} onClick={() => setCatTab('expense')}>
                <span style={{ background: '#ff6b8a22', color: '#ff6b8a', borderRadius: 8, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="cart" size={14} />
                </span>
                Gastos
                <span className="mset-cat-tab-count">{finance.categories.filter(c => c.type === 'expense').length}</span>
              </button>
              <button className={catTab === 'income' ? 'on' : ''} onClick={() => setCatTab('income')}>
                <span style={{ background: '#35d0a222', color: '#35d0a2', borderRadius: 8, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="wallet" size={14} />
                </span>
                Ingresos
                <span className="mset-cat-tab-count">{finance.categories.filter(c => c.type === 'income').length}</span>
              </button>
            </div>
            <CategoryGroup
              title={catTab === 'expense' ? 'Gastos' : 'Ingresos'}
              type={catTab}
              categories={finance.categories.filter(c => c.type === catTab)}
              onAdd={() => setEditingCat(catTab === 'expense' ? 'new-expense' : 'new-income')}
              onEdit={c => setEditingCat(c)}
            />
          </div>
        </SettingsSheet>
      )}

      {editingCat !== null && (
        <CategoryEditor
          category={typeof editingCat === 'string' ? undefined : editingCat}
          type={editingCat === 'new-income' ? 'income' : editingCat === 'new-expense' ? 'expense' : editingCat.type}
          onClose={() => setEditingCat(null)}
          onSave={saveCategory}
          onDelete={typeof editingCat !== 'string' ? removeCategory : undefined}
        />
      )}
    </>
  )
}

function CategoryGroup({ title, type, categories, onAdd, onEdit }: {
  title: string
  type: 'expense' | 'income'
  categories: Category[]
  onAdd: () => void
  onEdit: (c: Category) => void
}) {
  return (
    <div className="mset-cat-group">
      <div className="mset-cat-group-head">
        <span>{title}</span>
        <button onClick={onAdd}><Icon name="plus" size={14} /> Agregar</button>
      </div>
      {categories.length === 0 ? (
        <p className="mset-cat-empty">Sin categorías de {type === 'expense' ? 'gastos' : 'ingresos'} todavía.</p>
      ) : (
        <div className="mset-cat-list">
          {categories.map(cat => (
            <button key={cat.id} className="mset-cat-row" onClick={() => onEdit(cat)}>
              <span className="mset-cat-icon" style={{ color: cat.color, background: `color-mix(in oklab, ${cat.color} 16%, transparent)` }}>
                <Icon name={cat.icon} size={18} />
              </span>
              <span className="mset-cat-name">{cat.name}</span>
              <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: '#4a4a4a', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryEditor({ category, type, onClose, onSave, onDelete }: {
  category?: Category
  type: 'expense' | 'income'
  onClose: () => void
  onSave: (f: { name: string; type: 'expense' | 'income'; budget: number; color: string; icon: IconName }) => void
  onDelete?: (c: Category) => void
}) {
  const [name,       setName]       = useState(category?.name ?? '')
  const [budget,     setBudget]     = useState(String(category?.budget ?? ''))
  const [color,      setColor]      = useState(category?.color ?? (CAT_COLORS as readonly string[])[0])
  const [icon,       setIcon]       = useState<IconName>(category?.icon ?? (type === 'income' ? 'wallet' : 'cart'))
  const [confirmDel, setConfirmDel] = useState(false)

  useMobileBackDismiss(true, onClose)

  return (
    <div className="mobile-detail-sheet" role="dialog" aria-modal="true"
      aria-label={category ? 'Editar categoría' : 'Nueva categoría'} onClick={onClose}>
      <section className="mbud-editor-sheet" onClick={e => e.stopPropagation()}>
        <header>
          <span>{category ? 'Editar categoría' : `Nueva categoría de ${type === 'expense' ? 'gasto' : 'ingreso'}`}</span>
          <button aria-label="Cerrar" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="mbud-editor-body">
          <label className="mbud-field">
            <span>Nombre</span>
            <input className="mbud-input" type="text" value={name}
              placeholder="ej. Comida, Salario" autoCapitalize="words"
              onChange={e => setName(e.target.value)} />
          </label>

          {type === 'expense' && (
            <label className="mbud-field">
              <span>Límite mensual (0 = sin límite)</span>
              <input className="mbud-input" type="number" inputMode="decimal"
                value={budget} placeholder="0" onChange={e => setBudget(e.target.value)} />
            </label>
          )}

          <div className="mbud-field">
            <span>Color</span>
            <div className="mbud-color-strip">
              {(CAT_COLORS as readonly string[]).map(c => (
                <button key={c} className={`mbud-color-dot${color === c ? ' on' : ''}`}
                  aria-label={`Color ${c}`} aria-pressed={color === c}
                  style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>

          <div className="mbud-field">
            <span>Ícono</span>
            <div className="mbud-icon-grid-sheet">
              {CAT_ICONS.map(ic => (
                <button key={ic} className={`mbud-icon-btn-sheet${icon === ic ? ' on' : ''}`}
                  aria-label={`Ícono ${ic}`} aria-pressed={icon === ic}
                  style={icon === ic ? { color, background: `color-mix(in oklab, ${color} 18%, transparent)` } : {}}
                  onClick={() => setIcon(ic)}>
                  <Icon name={ic} size={20} />
                </button>
              ))}
            </div>
          </div>

          {category && onDelete && (
            !confirmDel ? (
              <button className="mbud-del-btn" onClick={() => setConfirmDel(true)}>
                <Icon name="trash" size={16} /> Eliminar categoría
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

        <div className="mbud-editor-actions">
          <button className="mbud-btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="mbud-btn-save" style={{ background: color }}
            onClick={() => onSave({ name, type, budget: Number(budget) || 0, color, icon })}>
            {category ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </section>
    </div>
  )
}
