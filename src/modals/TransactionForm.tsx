import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useDialogs } from '@/components/ui/DialogProvider'
import { dateLocale, fmt } from '@/data/helpers'
import { CURRENCIES } from '@/data/seed'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { advanceRecurrenceDate } from '@/hooks/useRecurring'
import { useT } from '@/i18n'
import { playConfirmSound, playDeleteSound } from '@/lib/sound'
import { MobileAmountSheet } from '@/mobile/MobileAmountSheet'
import { MobileTextSheet } from '@/mobile/MobileTextSheet'
import { MobileDatePicker } from '@/mobile/MobileDatePicker'
import { useMobileBackDismiss } from '@/mobile/useMobileBackDismiss'
import type { CurrencyCode, IconName, RecurrenceFrequency, Transaction, TxSplit, TxType } from '@/types'

function currencyPrefix(c: CurrencyCode): string {
  return CURRENCIES[c].symbol
}

type Sub = 'amount' | 'note' | 'account' | 'category' | 'date' | 'recurEnd' | null
type SplitSub = { kind: 'amount' | 'category'; index: number } | null

const ACCT_ICONS: Record<string, IconName> = {
  cash: 'wallet', debit: 'cards', savings: 'piggy', credit: 'cards',
}

function fmtDate(iso: string, locale: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function TransactionForm({ value, mkey, onClose, onDelete }: {
  value: Transaction | 'new'
  mkey: string
  onClose: () => void
  onDelete?: (id: string) => void
}) {
  const { accounts, categories, currency, addTx, updateTx, deleteTx } = useFinance()
  const settings = useSettings()
  const overdraftPolicy = settings.overdraftPolicy
  const locale = dateLocale(settings.language)
  const { confirm } = useDialogs()
  const t = useT()
  const editing = value !== 'new'

  const [type,           setType]           = useState<Exclude<TxType, 'transfer'>>('expense')
  const [amount,         setAmount]         = useState(0)
  const [note,           setNote]           = useState('')
  const [date,           setDate]           = useState(`${mkey}-01`)
  const [accountId,      setAccountId]      = useState(accounts[0]?.id ?? '')
  const [categoryId,     setCategoryId]     = useState('')
  const [recurring,      setRecurring]      = useState(false)
  const [recurFreq,      setRecurFreq]      = useState<RecurrenceFrequency>('monthly')
  const [recurringStart, setRecurringStart] = useState(`${mkey}-01`)
  const [recurringEnd,   setRecurringEnd]   = useState('')
  const [tags,           setTags]           = useState<string[]>([])
  const [sub,            setSub]            = useState<Sub>(null)
  const [splitOn,        setSplitOn]        = useState(false)
  const [splits,         setSplits]         = useState<TxSplit[]>([])
  const [splitSub,       setSplitSub]       = useState<SplitSub>(null)

  useEffect(() => {
    if (!editing) return
    setType(value.type === 'income' ? 'income' : 'expense')
    setAmount(value.amount)
    setNote(value.note)
    setDate(value.date)
    setAccountId(value.accountId ?? accounts[0]?.id ?? '')
    setCategoryId(value.categoryId ?? '')
    setRecurring(!!value.recurring)
    setRecurFreq(value.recurring ?? 'monthly')
    setRecurringStart(value.recurringStart ?? value.date)
    setRecurringEnd(value.recurringEnd ?? '')
    setTags(value.tags ?? [])
    if (value.splits && value.splits.length >= 2) {
      setSplitOn(true)
      setSplits(value.splits)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleCats = categories.filter(c => c.type === type)
  useEffect(() => {
    if (!visibleCats.some(c => c.id === categoryId))
      setCategoryId('')
  }, [categoryId, visibleCats])

  const activeAccount  = accounts.find(a => a.id === accountId)  ?? null
  const activeCategory = visibleCats.find(c => c.id === categoryId) ?? null
  const typeColor      = type === 'income' ? '#35d0a2' : '#f65574'

  useMobileBackDismiss(sub !== null || splitSub !== null, () => { setSub(null); setSplitSub(null) })

  const splitsSum = splits.reduce((sum, split) => sum + split.amount, 0)
  const splitsRemaining = amount - splitsSum
  const splitsActive = splitOn && type === 'expense'

  const toggleSplit = () => {
    if (splitOn) { setSplitOn(false); return }
    setSplits(current => current.length >= 2 ? current : [
      { categoryId: categoryId || '', amount },
      { categoryId: '', amount: 0 },
    ])
    setSplitOn(true)
  }

  const updateSplit = (index: number, patch: Partial<TxSplit>) => {
    setSplits(current => current.map((split, i) => i === index ? { ...split, ...patch } : split))
  }

  const submit = () => {
    if (!amount)
      return toast(t('amountError'), { icon: 'alert' })
    if (!note.trim())
      return toast(t('fillAllError'), { icon: 'alert' })
    if (!accountId)
      return toast(t('accountError'), { icon: 'alert' })

    let cleanSplits: TxSplit[] | undefined
    let mainCategoryId = categoryId
    if (splitsActive) {
      cleanSplits = splits.filter(split => split.categoryId && split.amount > 0)
      if (cleanSplits.length < 2)
        return toast(t('splitNeedsTwoParts'), { icon: 'alert' })
      const sum = cleanSplits.reduce((total, split) => total + split.amount, 0)
      if (Math.abs(sum - amount) >= 0.01)
        return toast(t('splitSumMismatch'), { icon: 'alert' })
      // La categoría principal es la parte de mayor monto (para listas/búsqueda)
      mainCategoryId = [...cleanSplits].sort((a, b) => b.amount - a.amount)[0].categoryId
    }
    if (!mainCategoryId)
      return toast(t('categoryError'), { icon: 'alert' })

    const fields = {
      type, amount, note: note.trim(), date, accountId, categoryId: mainCategoryId,
      splits: cleanSplits,
      ...(recurring ? {
        recurring: recurFreq,
        recurringStart,
        recurringEnd: recurringEnd || undefined,
        recurringNext: editing && value.recurringNext
          ? value.recurringNext
          : advanceRecurrenceDate(recurringStart || date, recurFreq),
      } : { recurring: null, recurringStart: undefined, recurringEnd: undefined, recurringNext: undefined }),
      tags: tags.length ? tags : undefined,
    }

    const acct = accounts.find(a => a.id === accountId)
    const prev = editing && value.type === 'expense' && value.accountId === accountId ? value.amount : 0
    if (type === 'expense' && acct?.type !== 'credit' && (acct?.balance ?? 0) + prev < amount
      && (acct?.overdraftPolicy ?? overdraftPolicy) === 'warn')
      toast(t('negativeBalanceWarn').replace('{name}', acct?.name ?? t('account')), { icon: 'alert' })

    try {
      if (editing) updateTx(value.id, fields)
      else addTx(fields)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('couldNotSave'), { icon: 'alert' }); return
    }
    playConfirmSound()
    toast(editing ? t('movementUpdated') : t('movementSaved'), { icon: 'check', type: 'ok' })
    onClose()
  }

  const remove = () => {
    if (!editing) return
    void confirm({ title: t('deleteMovementTitle'), description: t('actionCannotBeUndone'), confirmLabel: t('delete'), icon: 'trash' })
      .then(ok => { if (ok) { playDeleteSound(); if (onDelete) onDelete(value.id); else { deleteTx(value.id); toast(t('movementDeleted'), { icon: 'trash' }) }; onClose() } })
  }

  const arrow = <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', flexShrink: 0 }} />
  // El monto se registra en la divisa de la cuenta seleccionada
  const txCurrency = activeAccount?.currency ?? currency
  const pfx = currencyPrefix(txCurrency)

  return (
    <>
      {/* ── Full-screen overlay ── */}
      <div className="txf-overlay" role="dialog" aria-modal="true">

        <header className="mpr-editor-header">
          <div className="mpr-editor-header-icon" style={{ background: typeColor + '28', color: typeColor }}>
            <Icon name={type === 'income' ? 'arrowUp' : 'arrowDn'} size={18} />
          </div>
          <span className="mpr-editor-name-input" style={{ cursor: 'default' }}>
            {editing ? t('editMovement') : t('newMovement')}
          </span>
          <button className="mpr-editor-close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="txf-body">

          {/* Type */}
          <div className="mpr-form-section">
            <button
              className={`mpr-type-pill${type === 'expense' ? ' on' : ''}`}
              style={type === 'expense' ? { borderColor: '#f65574', background: '#f6557420', color: '#f65574' } : {}}
              onClick={() => setType('expense')}
            >
              <Icon name="arrowDn" size={14} /> {t('expense')}
            </button>
            <button
              className={`mpr-type-pill${type === 'income' ? ' on' : ''}`}
              style={type === 'income' ? { borderColor: '#35d0a2', background: '#35d0a220', color: '#35d0a2' } : {}}
              onClick={() => setType('income')}
            >
              <Icon name="arrowUp" size={14} /> {t('income')}
            </button>
          </div>

          {/* Amount hero */}
          <button className="txf-amount-hero" onClick={() => setSub('amount')}>
            <span className="txf-amount-label">{type === 'expense' ? t('totalExpenseLabel') : t('totalIncomeLabel')}</span>
            <span className="txf-amount-value" style={{ color: amount > 0 ? typeColor : 'var(--m-muted)' }}>
              {amount > 0 ? `${pfx} ${amount.toLocaleString('en-US', { minimumFractionDigits: CURRENCIES[txCurrency].decimals, maximumFractionDigits: CURRENCIES[txCurrency].decimals })}` : `${pfx} 0`}
            </span>
            <span className="txf-amount-tap">{t('tapToEditLabel')}</span>
          </button>

          {/* Detail rows */}
          <div className="mpr-form-rows txf-rows">
            <button className="mpr-form-row" onClick={() => setSub('note')}>
              <Icon name="edit" size={16} style={{ color: 'var(--m-muted)', flexShrink: 0 }} />
              <span className="mpr-form-row-label">{t('descriptionLabel')}</span>
              <span className={note ? 'mpr-form-row-val' : 'mpr-form-row-dim'}>{note || t('requiredLabel')}</span>
              {arrow}
            </button>

            <button className="mpr-form-row" onClick={() => setSub('account')}>
              <Icon
                name={activeAccount ? ACCT_ICONS[activeAccount.type] : 'wallet'}
                size={16}
                style={{ color: activeAccount?.color ?? 'var(--m-muted)', flexShrink: 0 }}
              />
              <span className="mpr-form-row-label">{t('account')}</span>
              <span className={activeAccount ? 'mpr-form-row-val' : 'mpr-form-row-dim'}>
                {activeAccount?.name ?? t('selectLabel')}
              </span>
              {arrow}
            </button>

            {!splitsActive && (
              <button className="mpr-form-row" onClick={() => setSub('category')}>
                <Icon
                  name={(activeCategory?.icon as IconName | undefined) ?? 'tag'}
                  size={16}
                  style={{ color: activeCategory?.color ?? 'var(--m-muted)', flexShrink: 0 }}
                />
                <span className="mpr-form-row-label">{t('category')}</span>
                <span className={activeCategory ? 'mpr-form-row-val' : 'mpr-form-row-dim'}>
                  {activeCategory?.name ?? t('selectLabel')}
                </span>
                {arrow}
              </button>
            )}

            <button className="mpr-form-row" onClick={() => setSub('date')}>
              <Icon name="calendar" size={16} style={{ color: 'var(--m-muted)', flexShrink: 0 }} />
              <span className="mpr-form-row-label">{t('date')}</span>
              <span className="mpr-form-row-val">{fmtDate(date, locale)}</span>
              {arrow}
            </button>
          </div>

          {/* Split entre categorías (solo gastos) */}
          {type === 'expense' && (
            <button
              className={`mobile-create-recurring-toggle${splitOn ? ' active' : ''}`}
              onClick={toggleSplit}
            >
              <span className="mobile-recur-icon"><Icon name="scissors" size={15} /></span>
              <span className="mobile-recur-label">{t('splitToggleLabel')}</span>
              <span className={`mobile-recur-switch${splitOn ? ' on' : ''}`} />
            </button>
          )}

          {splitsActive && (
            <div className="mpr-form-rows txf-rows txf-splits">
              {splits.map((split, index) => {
                const cat = visibleCats.find(c => c.id === split.categoryId) ?? null
                return (
                  <div className="mpr-form-row txf-split-row" key={index}>
                    <button className="txf-split-cat" onClick={() => setSplitSub({ kind: 'category', index })}>
                      <Icon
                        name={(cat?.icon as IconName | undefined) ?? 'tag'}
                        size={16}
                        style={{ color: cat?.color ?? 'var(--m-muted)', flexShrink: 0 }}
                      />
                      <span className={cat ? 'mpr-form-row-val' : 'mpr-form-row-dim'}>
                        {cat?.name ?? t('selectLabel')}
                      </span>
                    </button>
                    <button className="txf-split-amount" onClick={() => setSplitSub({ kind: 'amount', index })}>
                      {split.amount > 0 ? fmt(split.amount, txCurrency) : `${pfx} 0`}
                    </button>
                    {splits.length > 2 && (
                      <button
                        className="txf-split-remove"
                        aria-label={t('delete')}
                        onClick={() => setSplits(current => current.filter((_, i) => i !== index))}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
              <div className="txf-split-footer">
                <button className="txf-split-add" onClick={() => setSplits(current => [...current, { categoryId: '', amount: 0 }])}>
                  <Icon name="plus" size={13} /> {t('splitAddPart')}
                </button>
                <span className={`txf-split-remaining${Math.abs(splitsRemaining) < 0.01 ? ' ok' : ''}`}>
                  {Math.abs(splitsRemaining) < 0.01
                    ? t('splitBalanced')
                    : t('splitRemaining').replace('{amount}', fmt(splitsRemaining, txCurrency))}
                </span>
              </div>
            </div>
          )}

          {/* Recurring */}
          <button
            className={`mobile-create-recurring-toggle${recurring ? ' active' : ''}`}
            onClick={() => setRecurring(r => !r)}
          >
            <span className="mobile-recur-icon"><Icon name="repeat" size={15} /></span>
            <span className="mobile-recur-label">{t('scheduleRecurrenceLabel')}</span>
            <span className={`mobile-recur-switch${recurring ? ' on' : ''}`} />
          </button>

          {recurring && (
            <div className="mpr-form-rows txf-rows">
              <div className="mpr-form-row">
                <Icon name="repeat" size={16} style={{ color: 'var(--m-muted)', flexShrink: 0 }} />
                <span className="mpr-form-row-label">{t('frequencyLabel')}</span>
                <div className="mpr-pill-row" style={{ flex: 1, justifyContent: 'flex-end' }}>
                  {(['weekly', 'monthly'] as RecurrenceFrequency[]).map(f => (
                    <button
                      key={f}
                      className={`mpr-pill${recurFreq === f ? ' on' : ''}`}
                      style={recurFreq === f ? { borderColor: 'var(--m-text)', color: 'var(--m-text)' } : {}}
                      onClick={() => setRecurFreq(f)}
                    >
                      {f === 'weekly' ? t('weekly') : t('monthly')}
                    </button>
                  ))}
                </div>
              </div>
              <button className="mpr-form-row" onClick={() => setSub('recurEnd')}>
                <Icon name="calendar" size={16} style={{ color: 'var(--m-muted)', flexShrink: 0 }} />
                <span className="mpr-form-row-label">{t('until')}</span>
                <span className={recurringEnd ? 'mpr-form-row-val' : 'mpr-form-row-dim'}>
                  {recurringEnd ? fmtDate(recurringEnd, locale) : t('noEndDate')}
                </span>
                {arrow}
              </button>
            </div>
          )}

        </div>

        <div className="mpr-editor-actions">
          {editing && (
            <button className="mpr-del-btn" onClick={remove}>
              <Icon name="trash" size={15} /> {t('delete')}
            </button>
          )}
          <button className="mpr-btn-cancel" onClick={onClose}>{t('cancel')}</button>
          <button className="mpr-btn-save" style={{ background: 'var(--m-primary, #ffdd3d)' }} onClick={submit}>
            {editing ? t('save') : t('add')}
          </button>
        </div>

      </div>

      {/* ── Sub-sheets ── */}

      {sub === 'amount' && (
        <MobileAmountSheet
          title={t('amount')}
          value={amount}
          currency={txCurrency}
          onDone={v => { setAmount(v); setSub(null) }}
          onClose={() => setSub(null)}
        />
      )}

      {sub === 'note' && (
        <MobileTextSheet
          title={t('descriptionLabel')}
          value={note}
          placeholder={t('notePlaceholder')}
          onDone={v => { setNote(v); setSub(null) }}
          onClose={() => setSub(null)}
        />
      )}

      {sub === 'date' && (
        <MobileDatePicker
          value={date}
          onChange={v => { setDate(v); setSub(null) }}
          onClose={() => setSub(null)}
        />
      )}

      {sub === 'recurEnd' && (
        <MobileDatePicker
          value={recurringEnd || date}
          onChange={v => { setRecurringEnd(v); setSub(null) }}
          onClose={() => setSub(null)}
        />
      )}

      {sub === 'account' && (
        <div className="mobile-detail-sheet" style={{ zIndex: 200 }} role="dialog" aria-modal="true" onClick={() => setSub(null)}>
          <section onClick={e => e.stopPropagation()}>
            <header>
              <span>{t('selectAccount')}</span>
              <button aria-label={t('close')} onClick={() => setSub(null)}><Icon name="close" size={18} /></button>
            </header>
            <div className="mobile-picker-list">
              {accounts.map(a => (
                <button
                  key={a.id}
                  className={`mobile-picker-row${a.id === accountId ? ' active' : ''}`}
                  onClick={() => { setAccountId(a.id); setSub(null) }}
                >
                  <span style={{ color: a.color }}>
                    <Icon name={ACCT_ICONS[a.type]} size={22} />
                  </span>
                  <b>{a.name}</b>
                  <small>{fmt(a.balance, a.currency ?? currency)}</small>
                  {a.id === accountId && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 4 }} />}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {splitSub?.kind === 'amount' && (
        <MobileAmountSheet
          title={t('amount')}
          value={splits[splitSub.index]?.amount ?? 0}
          currency={txCurrency}
          onDone={v => { updateSplit(splitSub.index, { amount: v }); setSplitSub(null) }}
          onClose={() => setSplitSub(null)}
        />
      )}

      {splitSub?.kind === 'category' && (
        <div className="mobile-detail-sheet" style={{ zIndex: 200 }} role="dialog" aria-modal="true" onClick={() => setSplitSub(null)}>
          <section className="mobile-detail-sheet mpr-editor-sheet" onClick={e => e.stopPropagation()}>
            <header className="mpr-editor-header">
              <span className="mpr-editor-name-input" style={{ cursor: 'default' }}>{t('selectCategory')}</span>
              <button className="mpr-editor-close" onClick={() => setSplitSub(null)}>
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className="mpr-editor-body" style={{ overflowY: 'auto' }}>
              <div className="mobile-category-grid">
                {visibleCats.map(c => (
                  <button
                    key={c.id}
                    className={splits[splitSub.index]?.categoryId === c.id ? 'on' : ''}
                    aria-pressed={splits[splitSub.index]?.categoryId === c.id}
                    onClick={() => { updateSplit(splitSub.index, { categoryId: c.id }); setSplitSub(null) }}
                  >
                    <span style={{ color: c.color, background: `color-mix(in oklab, ${c.color} 22%, transparent)` }}>
                      <Icon name={c.icon as IconName} size={20} />
                    </span>
                    <small>{c.name}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {sub === 'category' && (
        <div className="mobile-detail-sheet" style={{ zIndex: 200 }} role="dialog" aria-modal="true" onClick={() => setSub(null)}>
          <section className="mobile-detail-sheet mpr-editor-sheet" onClick={e => e.stopPropagation()}>
            <header className="mpr-editor-header">
              <span className="mpr-editor-name-input" style={{ cursor: 'default' }}>{t('selectCategory')}</span>
              <button className="mpr-editor-close" onClick={() => setSub(null)}>
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className="mpr-editor-body" style={{ overflowY: 'auto' }}>
              <div className="mobile-category-grid">
                {visibleCats.map(c => (
                  <button
                    key={c.id}
                    className={categoryId === c.id ? 'on' : ''}
                    aria-pressed={categoryId === c.id}
                    onClick={() => { setCategoryId(c.id); setSub(null) }}
                  >
                    <span style={{ color: c.color, background: `color-mix(in oklab, ${c.color} 22%, transparent)` }}>
                      <Icon name={c.icon as IconName} size={20} />
                    </span>
                    <small>{c.name}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
