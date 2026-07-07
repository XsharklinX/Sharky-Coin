import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { categoryRollover, fmt, fmtCompact, prevMonthKey, transactionsForTotals, txForMonth } from '@/data/helpers'
import { CAT_COLORS } from '@/constants'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { translateCategoryName, useCategoryName, useT } from '@/i18n'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { useDialogA11y } from './useDialogA11y'
import { MobileAmountSheet } from './MobileAmountSheet'
import type { Category, IconName, ViewProps } from '@/types'

const COLORS = CAT_COLORS

const ALL_ICONS: IconName[] = [
  'cart','food','car','bolt','heart','home','bag','book','wallet','laptop','trend','play',
  'music','coffee','phone','gym','bus','building','gamepad','gift','scissors','baby','paw','pill',
  'plane','briefcase','shirt','pizza','star','fuel','flame','soda',
  'tree','sun','bike','train','tv','monitor','headphones','clock','key','tool',
  'brush','graduation','stethoscope','salad','wine','crown','trophy','shield','map','package',
]

export function MobileBudgets({ txns, mkey }: ViewProps) {
  const { accounts, categories, currency, addCategory, updateCategory, deleteCategory } = useFinance()
  const t = useT()
  const settings = useSettings()
  const lang = (settings.language ?? 'es') as 'en' | 'es'
  const budgetAlertThresholds = settings.budgetAlertThresholds
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const visTxns = transactionsForTotals(txns, accounts)
  const monthTx = txForMonth(visTxns, mkey)
  const prevMonthTx = txForMonth(visTxns, prevMonthKey(mkey))
  const cats = categories.filter(c => c.type === 'expense')

  const spent: Record<string, number> = {}
  monthTx.forEach(tx => {
    if (tx.type === 'expense' && tx.categoryId)
      spent[tx.categoryId] = (spent[tx.categoryId] ?? 0) + tx.amount
  })

  const rollover: Record<string, number> = {}
  const effectiveBudget: Record<string, number> = {}
  cats.forEach(c => {
    rollover[c.id] = categoryRollover(c, prevMonthTx)
    effectiveBudget[c.id] = c.budget > 0 ? Math.max(0, c.budget + rollover[c.id]) : c.budget
  })

  const totalBudget = cats.reduce((s, c) => s + effectiveBudget[c.id], 0)
  const totalSpent  = cats.reduce((s, c) => s + (spent[c.id] ?? 0), 0)
  const totalLeft   = totalBudget - totalSpent
  const globalPct   = totalBudget > 0 ? Math.min(100, totalSpent / totalBudget * 100) : 0
  const overCount   = cats.filter(c => (spent[c.id] ?? 0) > effectiveBudget[c.id] && c.budget > 0).length

  const save = (fields: { name: string; budget: number; color: string; icon: IconName; rolloverEnabled: boolean }) => {
    if (!fields.name.trim()) { toast(t('enterCategoryName'), { icon: 'alert' }); return }
    if (editing === 'new') {
      addCategory({ name: fields.name.trim(), type: 'expense', budget: fields.budget, color: fields.color, icon: fields.icon, rolloverEnabled: fields.rolloverEnabled })
      toast(t('categoryCreatedSimple'), { icon: 'check', type: 'ok' })
    } else if (editing) {
      updateCategory(editing.id, { name: fields.name.trim(), budget: fields.budget, color: fields.color, icon: fields.icon, rolloverEnabled: fields.rolloverEnabled })
      toast(t('categoryUpdated'), { icon: 'check', type: 'ok' })
    }
    setEditing(null)
  }

  const remove = (cat: Category) => {
    try {
      deleteCategory(cat.id)
      toast(t('categoryDeleted'), { icon: 'trash' })
      setEditing(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : t('couldNotDelete'), { icon: 'alert' })
    }
  }

  useMobileBackDismiss(!!editing, () => setEditing(null))

  return (
    <div className="mbud-root">
      <div className="mbud-summary">
        <div className="mbud-summary-top">
          <div>
            <span className="mbud-summary-label">{t('totalBudgetLabel')}</span>
            <strong className="mbud-summary-total">
              <AnimatedMoney value={totalBudget} compact />
            </strong>
          </div>
          <button className="mbud-add-btn" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> {t('new')}
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
              <small>{t('spentLabel')}</small>
            </div>
          </div>
          <div className="mbud-pill-sep" />
          <div className="mbud-pill">
            <Icon name="target" size={13} style={{ color: '#35d0a2' }} />
            <div>
              <strong className={totalLeft < 0 ? 'over' : ''}><AnimatedMoney value={Math.abs(totalLeft)} compact /></strong>
              <small>{totalLeft < 0 ? t('overBudgetLabel') : t('availableLabel')}</small>
            </div>
          </div>
          {overCount > 0 && (
            <>
              <div className="mbud-pill-sep" />
              <div className="mbud-pill">
                <Icon name="alert" size={13} style={{ color: '#f59e0b' }} />
                <div>
                  <strong style={{ color: '#f59e0b' }}>{overCount}</strong>
                  <small>{t('overLimitLabel')}</small>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {cats.length > 0 && (
        <div className="mbud-list-head">
          <div>
            <span>{t('categoriesTitle')}</span>
            <small>{t('monthlyBudget')}</small>
          </div>
          <strong>{cats.length}</strong>
        </div>
      )}

      <div className="mbud-list">
        {cats.length === 0 ? (
          <div className="mbud-empty">
            <span><Icon name="target" size={32} /></span>
            <strong>{t('noBudgetsYet')}</strong>
            <p>{t('createExpenseCategoriesHint')}</p>
            <button onClick={() => setEditing('new')}>
              <Icon name="plus" size={16} /> {t('createFirstCategory')}
            </button>
          </div>
        ) : (
          cats.map(cat => {
            const s = spent[cat.id] ?? 0
            const budget = effectiveBudget[cat.id]
            const roll = rollover[cat.id]
            const pct = budget > 0 ? Math.min(100, s / budget * 100) : 0
            const over = budget > 0 && s > budget
            const left = budget - s
            const reachedThreshold = budget > 0
              ? [...budgetAlertThresholds].sort((a, b) => a - b).filter(threshold => pct >= threshold).pop()
              : undefined
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
                    <span className="mbud-row-name">{translateCategoryName(cat, lang)}</span>
                    <span className={`mbud-row-pct${over ? ' over' : pct >= 80 ? ' warn' : ''}`}>
                      {budget > 0 ? `${Math.round(pct)}%` : t('noLimitLabel')}
                    </span>
                  </div>
                  {budget > 0 && (
                    <div className="mbud-row-bar">
                      <div className="mbud-row-fill" style={{
                        width: `${pct}%`,
                        background: over ? '#ff6b8a' : pct >= 80 ? '#f59e0b' : cat.color,
                      }} />
                    </div>
                  )}
                  <div className="mbud-row-meta">
                    <span>{t('spentAmount').replace('{amount}', fmtCompact(s, currency))}</span>
                    {budget > 0 && (
                      <span className={over ? 'over' : ''}>
                        {over
                          ? t('overAmount').replace('{amount}', fmtCompact(Math.abs(left), currency))
                          : t('freeAmount').replace('{amount}', fmtCompact(left, currency))}
                      </span>
                    )}
                  </div>
                  {cat.rolloverEnabled && roll !== 0 && (
                    <div className="mbud-row-rollover">
                      <Icon name="repeat" size={11} />
                      {roll > 0
                        ? t('rolloverAddedLabel').replace('{amount}', fmtCompact(roll, currency))
                        : t('rolloverDeductedLabel').replace('{amount}', fmtCompact(Math.abs(roll), currency))}
                    </div>
                  )}
                  {reachedThreshold !== undefined && (
                    <div className={`mbud-row-rollover${over ? ' over' : pct >= 80 ? ' warn' : ''}`}>
                      <Icon name={over ? 'alert' : 'bell'} size={11} />
                      {t('budgetThresholdBody')
                        .replace('{threshold}', String(reachedThreshold))
                        .replace('{spent}', fmtCompact(s, currency))
                        .replace('{budget}', fmtCompact(budget, currency))
                        .replace('{pct}', String(Math.round(pct)))}
                    </div>
                  )}
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
  onSave: (f: { name: string; budget: number; color: string; icon: IconName; rolloverEnabled: boolean }) => void
  onDelete?: (c: Category) => void
}) {
  const { currency } = useFinance()
  const t = useT()
  const initialName = useCategoryName(category ?? { id: '', name: '' })
  const [name,       setName]       = useState(category ? initialName : '')
  const [budget,     setBudget]     = useState(category?.budget ?? 0)
  const [color,      setColor]      = useState(category?.color ?? COLORS[0])
  const [icon,       setIcon]       = useState<IconName>(category?.icon ?? 'cart')
  const [rolloverEnabled, setRolloverEnabled] = useState(category?.rolloverEnabled ?? false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [budgetSheet, setBudgetSheet] = useState(false)

  useMobileBackDismiss(budgetSheet, () => setBudgetSheet(false))
  useMobileBackDismiss(!budgetSheet, onClose)
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose, !budgetSheet)

  return (
    <>
    <div ref={dialogRef} className="mobile-detail-sheet mbud-editor-overlay" role="dialog" aria-modal="true" aria-label={category ? t('editCategory') : t('newCategory')} onClick={onClose}>
      <section className="mbud-editor-sheet" onClick={e => e.stopPropagation()}>
        <header>
          <span>{category ? t('editCategory') : t('newCategory')}</span>
          <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="mbud-editor-body">
          <label className="mbud-field">
            <span>{t('name')}</span>
            <input
              className="mbud-input"
              type="text"
              value={name}
              placeholder={t('egCategoryName')}
              autoCapitalize="words"
              onChange={e => setName(e.target.value)}
            />
          </label>

          <div className="mbud-field">
            <span>{t('monthlyBudget')}</span>
            <button className="mdebt-amount-row" onClick={() => setBudgetSheet(true)}>
              <span className={budget > 0 ? 'mdebt-amt-set' : 'mdebt-amt-ph'}>
                {budget > 0 ? fmt(budget, currency) : t('noLimitLabel')}
              </span>
              <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)' }} />
            </button>
          </div>

          {budget > 0 && (
            <div className="mpr-form-section mpr-toggle-row">
              <div className="mpr-toggle-row-text">
                <span className="mpr-toggle-row-label">{t('rolloverLabel')}</span>
                <small className="mpr-toggle-row-desc">{t('rolloverDesc')}</small>
              </div>
              <label className="mset-toggle-wrap">
                <input
                  type="checkbox"
                  className="mset-toggle-input"
                  checked={rolloverEnabled}
                  onChange={e => setRolloverEnabled(e.target.checked)}
                />
                <span className="mset-toggle" />
              </label>
            </div>
          )}

          <div className="mbud-field">
            <span>{t('color')}</span>
            <div className="mbud-color-strip">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`mbud-color-dot${color === c ? ' on' : ''}`}
                  aria-label={t('colorOption').replace('{c}', c)}
                  aria-pressed={color === c}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="mbud-field">
            <span>{t('icon')}</span>
            <div className="mbud-icon-grid-sheet">
              {ALL_ICONS.map(ic => (
                <button
                  key={ic}
                  className={`mbud-icon-btn-sheet${icon === ic ? ' on' : ''}`}
                  aria-label={t('iconOption').replace('{ic}', ic)}
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
                <Icon name="trash" size={16} /> {t('deleteCategory')}
              </button>
            ) : (
              <div className="mbud-confirm-del">
                <p>{t('deleteCategoryConfirm').replace('{name}', initialName)}</p>
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
          <button
            className="mbud-btn-save"
            style={{ background: color }}
            onClick={() => onSave({ name, budget, color, icon, rolloverEnabled })}
          >
            {category ? t('save') : t('create')}
          </button>
        </div>
      </section>
    </div>

    {budgetSheet && (
      <MobileAmountSheet
        title={t('monthlyBudget')}
        value={budget}
        currency={currency}
        onDone={v => { setBudget(v); setBudgetSheet(false) }}
        onClose={() => setBudgetSheet(false)}
      />
    )}
    </>
  )
}
