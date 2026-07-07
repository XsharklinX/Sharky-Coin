import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useFinance } from '@/store/finance'
import { CAT_COLORS } from '@/constants'
import { useCategoryName, useT } from '@/i18n'
import { playConfirmSound, playDeleteSound } from '@/lib/sound'
import type { Category, IconName } from '@/types'
import { useMobileBackDismiss } from '../useMobileBackDismiss'
import { useDialogA11y } from '../useDialogA11y'
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
  const t = useT()
  const [catTab,    setCatTab]    = useState<'expense' | 'income'>('expense')
  const [editingCat, setEditingCat] = useState<Category | 'new-expense' | 'new-income' | null>(null)

  useMobileBackDismiss(!!editingCat, () => setEditingCat(null))

  const saveCategory = (fields: { name: string; type: 'expense' | 'income'; budget: number; color: string; icon: IconName }) => {
    if (!fields.name.trim()) { toast(t('enterCategoryName'), { icon: 'alert' }); return }
    try {
      if (editingCat === 'new-expense' || editingCat === 'new-income') {
        finance.addCategory({ name: fields.name.trim(), type: fields.type, budget: fields.budget, color: fields.color, icon: fields.icon })
        playConfirmSound()
        toast(t('categoryCreatedSimple'), { icon: 'check', type: 'ok' })
      } else if (editingCat) {
        finance.updateCategory(editingCat.id, { name: fields.name.trim(), budget: fields.budget, color: fields.color, icon: fields.icon })
        playConfirmSound()
        toast(t('categoryUpdated'), { icon: 'check', type: 'ok' })
      }
      setEditingCat(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : t('couldNotSaveCategory'), { icon: 'alert' })
    }
  }

  const removeCategory = (cat: Category) => {
    try {
      finance.deleteCategory(cat.id)
      playDeleteSound()
      toast(t('categoryDeleted'), { icon: 'trash' })
      setEditingCat(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : t('couldNotDelete'), { icon: 'alert' })
    }
  }

  return (
    <>
      <div className="mset-card">
        <SettingsRow icon="tag" iconColor="#c084fc" label={t('categorySettings')}
          onClick={() => onOpen('categories')} />
      </div>

      {activeSheet === 'categories' && (
        <SettingsSheet title={t('categoriesTitle')} onClose={onClose}>
          <div className="mset-sheet-body">
            <div className="mset-cat-tabs">
              <button className={catTab === 'expense' ? 'on' : ''} onClick={() => setCatTab('expense')}>
                <span style={{ background: '#ff6b8a22', color: '#ff6b8a', borderRadius: 8, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="cart" size={14} />
                </span>
                {t('expenses')}
                <span className="mset-cat-tab-count">{finance.categories.filter(c => c.type === 'expense').length}</span>
              </button>
              <button className={catTab === 'income' ? 'on' : ''} onClick={() => setCatTab('income')}>
                <span style={{ background: '#35d0a222', color: '#35d0a2', borderRadius: 8, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="wallet" size={14} />
                </span>
                {t('incomes')}
                <span className="mset-cat-tab-count">{finance.categories.filter(c => c.type === 'income').length}</span>
              </button>
            </div>
            <CategoryGroup
              title={catTab === 'expense' ? t('expenses') : t('incomes')}
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
  const t = useT()
  return (
    <div className="mset-cat-group">
      <div className="mset-cat-group-head">
        <span>{title}</span>
        <button onClick={onAdd}><Icon name="plus" size={14} /> {t('add')}</button>
      </div>
      {categories.length === 0 ? (
        <p className="mset-cat-empty">{type === 'expense' ? t('noExpenseCategories') : t('noIncomeCategories')}</p>
      ) : (
        <div className="mset-cat-list">
          {categories.map(cat => (
            <CategoryListRow key={cat.id} cat={cat} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryListRow({ cat, onEdit }: { cat: Category; onEdit: (c: Category) => void }) {
  const name = useCategoryName(cat)
  return (
    <button className="mset-cat-row" onClick={() => onEdit(cat)}>
      <span className="mset-cat-icon" style={{ color: cat.color, background: `color-mix(in oklab, ${cat.color} 16%, transparent)` }}>
        <Icon name={cat.icon} size={18} />
      </span>
      <span className="mset-cat-name">{name}</span>
      <Icon name="arrowUp" size={13} className="mset-chevron" />
    </button>
  )
}

function CategoryEditor({ category, type, onClose, onSave, onDelete }: {
  category?: Category
  type: 'expense' | 'income'
  onClose: () => void
  onSave: (f: { name: string; type: 'expense' | 'income'; budget: number; color: string; icon: IconName }) => void
  onDelete?: (c: Category) => void
}) {
  const t = useT()
  const initialName = useCategoryName(category ?? { id: '', name: '' })
  const [name,       setName]       = useState(category ? initialName : '')
  const [budget,     setBudget]     = useState(String(category?.budget ?? ''))
  const [color,      setColor]      = useState(category?.color ?? (CAT_COLORS as readonly string[])[0])
  const [icon,       setIcon]       = useState<IconName>(category?.icon ?? (type === 'income' ? 'wallet' : 'cart'))
  const [confirmDel, setConfirmDel] = useState(false)

  useMobileBackDismiss(true, onClose)
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose)

  return (
    <div ref={dialogRef} className="mobile-detail-sheet" role="dialog" aria-modal="true"
      aria-label={category ? t('editCategory') : (type === 'expense' ? t('newExpenseCategory') : t('newIncomeCategory'))} onClick={onClose}>
      <section className="mbud-editor-sheet" onClick={e => e.stopPropagation()}>
        <header>
          <span>{category ? t('editCategory') : (type === 'expense' ? t('newExpenseCategory') : t('newIncomeCategory'))}</span>
          <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="mbud-editor-body">
          <label className="mbud-field">
            <span>{t('name')}</span>
            <input className="mbud-input" type="text" value={name}
              placeholder={t('egCategoryName')} autoCapitalize="words"
              onChange={e => setName(e.target.value)} />
          </label>

          {type === 'expense' && (
            <label className="mbud-field">
              <span>{t('monthlyLimitLabel')}</span>
              <input className="mbud-input" type="number" inputMode="decimal"
                value={budget} placeholder="0" onChange={e => setBudget(e.target.value)} />
            </label>
          )}

          <div className="mbud-field">
            <span>{t('color')}</span>
            <div className="mbud-color-strip">
              {(CAT_COLORS as readonly string[]).map(c => (
                <button key={c} className={`mbud-color-dot${color === c ? ' on' : ''}`}
                  aria-label={`${t('color')} ${c}`} aria-pressed={color === c}
                  style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>

          <div className="mbud-field">
            <span>{t('icon')}</span>
            <div className="mbud-icon-grid-sheet">
              {CAT_ICONS.map(ic => (
                <button key={ic} className={`mbud-icon-btn-sheet${icon === ic ? ' on' : ''}`}
                  aria-label={`${t('icon')} ${ic}`} aria-pressed={icon === ic}
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
                <Icon name="trash" size={16} /> {t('deleteCategory')}
              </button>
            ) : (
              <div className="mbud-confirm-del">
                <p>{t('deleteCategoryConfirm').replace('{name}', name)}</p>
                <div>
                  <button onClick={() => setConfirmDel(false)}>{t('cancel')}</button>
                  <button className="danger" onClick={() => onDelete(category)}>
                    <Icon name="trash" size={16} /> {t('delete')}
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        <div className="mbud-editor-actions">
          <button className="mbud-btn-cancel" onClick={onClose}>{t('cancel')}</button>
          <button className="mbud-btn-save" style={{ background: color }}
            onClick={() => onSave({ name, type, budget: Number(budget) || 0, color, icon })}>
            {category ? t('save') : t('create')}
          </button>
        </div>
      </section>
    </div>
  )
}
