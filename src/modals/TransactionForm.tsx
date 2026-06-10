import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useDialogs } from '@/components/ui/DialogProvider'
import { dateLocale, fmt } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { advanceRecurrenceDate } from '@/hooks/useRecurring'
import { MobileAmountSheet } from '@/mobile/MobileAmountSheet'
import { MobileTextSheet } from '@/mobile/MobileTextSheet'
import { MobileDatePicker } from '@/mobile/MobileDatePicker'
import { useMobileBackDismiss } from '@/mobile/useMobileBackDismiss'
import type { CurrencyCode, IconName, RecurrenceFrequency, Transaction, TxType } from '@/types'

function currencyPrefix(c: CurrencyCode): string {
  return c === 'DOP' ? 'RD$' : c === 'USD' ? '$' : c === 'EUR' ? '€' : c
}

type Sub = 'amount' | 'note' | 'account' | 'category' | 'date' | 'recurEnd' | null

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleCats = categories.filter(c => c.type === type)
  useEffect(() => {
    if (visibleCats.length && !visibleCats.some(c => c.id === categoryId))
      setCategoryId(visibleCats[0]?.id ?? '')
  }, [categoryId, visibleCats])

  const activeAccount  = accounts.find(a => a.id === accountId)  ?? null
  const activeCategory = visibleCats.find(c => c.id === categoryId) ?? null
  const typeColor      = type === 'income' ? '#35d0a2' : '#f65574'

  useMobileBackDismiss(sub !== null, () => setSub(null))

  const submit = () => {
    if (!amount || !note.trim() || !accountId || !categoryId)
      return toast('Completa todos los campos requeridos.', { icon: 'alert' })

    const fields = {
      type, amount, note: note.trim(), date, accountId, categoryId,
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
      toast(`Aviso: dejará ${acct?.name ?? 'la cuenta'} con saldo negativo.`, { icon: 'alert' })

    try {
      if (editing) updateTx(value.id, fields)
      else addTx(fields)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo guardar.', { icon: 'alert' }); return
    }
    toast(editing ? 'Movimiento actualizado' : 'Movimiento agregado', { icon: 'check', type: 'ok' })
    onClose()
  }

  const remove = () => {
    if (!editing) return
    void confirm({ title: '¿Eliminar movimiento?', description: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', icon: 'trash' })
      .then(ok => { if (ok) { if (onDelete) onDelete(value.id); else { deleteTx(value.id); toast('Movimiento eliminado', { icon: 'trash' }) }; onClose() } })
  }

  const arrow = <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', flexShrink: 0 }} />
  const pfx = currencyPrefix(currency)

  return (
    <>
      {/* ── Full-screen overlay ── */}
      <div className="txf-overlay" role="dialog" aria-modal="true">

        <header className="mpr-editor-header">
          <div className="mpr-editor-header-icon" style={{ background: typeColor + '28', color: typeColor }}>
            <Icon name={type === 'income' ? 'arrowUp' : 'arrowDn'} size={18} />
          </div>
          <span className="mpr-editor-name-input" style={{ cursor: 'default' }}>
            {editing ? 'Editar movimiento' : 'Nuevo movimiento'}
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
              <Icon name="arrowDn" size={14} /> Gasto
            </button>
            <button
              className={`mpr-type-pill${type === 'income' ? ' on' : ''}`}
              style={type === 'income' ? { borderColor: '#35d0a2', background: '#35d0a220', color: '#35d0a2' } : {}}
              onClick={() => setType('income')}
            >
              <Icon name="arrowUp" size={14} /> Ingreso
            </button>
          </div>

          {/* Amount hero */}
          <button className="txf-amount-hero" onClick={() => setSub('amount')}>
            <span className="txf-amount-label">{type === 'expense' ? 'Gasto total' : 'Ingreso total'}</span>
            <span className="txf-amount-value" style={{ color: amount > 0 ? typeColor : 'var(--m-muted)' }}>
              {amount > 0 ? fmt(amount, currency) : `${pfx} 0`}
            </span>
            <span className="txf-amount-tap">toca para editar</span>
          </button>

          {/* Detail rows */}
          <div className="mpr-form-rows txf-rows">
            <button className="mpr-form-row" onClick={() => setSub('note')}>
              <Icon name="edit" size={16} style={{ color: 'var(--m-muted)', flexShrink: 0 }} />
              <span className="mpr-form-row-label">Descripción</span>
              <span className={note ? 'mpr-form-row-val' : 'mpr-form-row-dim'}>{note || 'Requerido'}</span>
              {arrow}
            </button>

            <button className="mpr-form-row" onClick={() => setSub('account')}>
              <Icon
                name={activeAccount ? ACCT_ICONS[activeAccount.type] : 'wallet'}
                size={16}
                style={{ color: activeAccount?.color ?? 'var(--m-muted)', flexShrink: 0 }}
              />
              <span className="mpr-form-row-label">Cuenta</span>
              <span className={activeAccount ? 'mpr-form-row-val' : 'mpr-form-row-dim'}>
                {activeAccount?.name ?? 'Seleccionar'}
              </span>
              {arrow}
            </button>

            <button className="mpr-form-row" onClick={() => setSub('category')}>
              <Icon
                name={(activeCategory?.icon as IconName | undefined) ?? 'tag'}
                size={16}
                style={{ color: activeCategory?.color ?? 'var(--m-muted)', flexShrink: 0 }}
              />
              <span className="mpr-form-row-label">Categoría</span>
              <span className={activeCategory ? 'mpr-form-row-val' : 'mpr-form-row-dim'}>
                {activeCategory?.name ?? 'Seleccionar'}
              </span>
              {arrow}
            </button>

            <button className="mpr-form-row" onClick={() => setSub('date')}>
              <Icon name="calendar" size={16} style={{ color: 'var(--m-muted)', flexShrink: 0 }} />
              <span className="mpr-form-row-label">Fecha</span>
              <span className="mpr-form-row-val">{fmtDate(date, locale)}</span>
              {arrow}
            </button>
          </div>

          {/* Recurring */}
          <button
            className={`mobile-create-recurring-toggle${recurring ? ' active' : ''}`}
            onClick={() => setRecurring(r => !r)}
          >
            <span className="mobile-recur-icon"><Icon name="repeat" size={15} /></span>
            <span className="mobile-recur-label">Programar recurrencia</span>
            <span className={`mobile-recur-switch${recurring ? ' on' : ''}`} />
          </button>

          {recurring && (
            <div className="mpr-form-rows txf-rows">
              <div className="mpr-form-row">
                <Icon name="repeat" size={16} style={{ color: 'var(--m-muted)', flexShrink: 0 }} />
                <span className="mpr-form-row-label">Frecuencia</span>
                <div className="mpr-pill-row" style={{ flex: 1, justifyContent: 'flex-end' }}>
                  {(['weekly', 'monthly'] as RecurrenceFrequency[]).map(f => (
                    <button
                      key={f}
                      className={`mpr-pill${recurFreq === f ? ' on' : ''}`}
                      style={recurFreq === f ? { borderColor: 'var(--m-text)', color: 'var(--m-text)' } : {}}
                      onClick={() => setRecurFreq(f)}
                    >
                      {f === 'weekly' ? 'Semanal' : 'Mensual'}
                    </button>
                  ))}
                </div>
              </div>
              <button className="mpr-form-row" onClick={() => setSub('recurEnd')}>
                <Icon name="calendar" size={16} style={{ color: 'var(--m-muted)', flexShrink: 0 }} />
                <span className="mpr-form-row-label">Hasta</span>
                <span className={recurringEnd ? 'mpr-form-row-val' : 'mpr-form-row-dim'}>
                  {recurringEnd ? fmtDate(recurringEnd, locale) : 'Sin fin'}
                </span>
                {arrow}
              </button>
            </div>
          )}

        </div>

        <div className="mpr-editor-actions">
          {editing && (
            <button className="mpr-del-btn" onClick={remove}>
              <Icon name="trash" size={15} /> Eliminar
            </button>
          )}
          <button className="mpr-btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="mpr-btn-save" style={{ background: 'var(--m-primary, #ffdd3d)' }} onClick={submit}>
            {editing ? 'Guardar' : 'Agregar'}
          </button>
        </div>

      </div>

      {/* ── Sub-sheets ── */}

      {sub === 'amount' && (
        <MobileAmountSheet
          title="Monto"
          value={amount}
          currency={currency}
          onDone={v => { setAmount(v); setSub(null) }}
          onClose={() => setSub(null)}
        />
      )}

      {sub === 'note' && (
        <MobileTextSheet
          title="Descripción"
          value={note}
          placeholder="Ej. Compra supermercado"
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
          <section className="mobile-detail-sheet mpr-editor-sheet" onClick={e => e.stopPropagation()}>
            <header className="mpr-editor-header">
              <span className="mpr-editor-name-input" style={{ cursor: 'default' }}>Seleccionar cuenta</span>
              <button className="mpr-editor-close" onClick={() => setSub(null)}>
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className="mpr-editor-body" style={{ overflowY: 'auto' }}>
              <div className="mpr-form-rows">
                {accounts.map(a => (
                  <button
                    key={a.id}
                    className={`mpr-form-row${a.id === accountId ? ' txf-selected' : ''}`}
                    onClick={() => { setAccountId(a.id); setSub(null) }}
                  >
                    <Icon name={ACCT_ICONS[a.type]} size={15} style={{ color: a.color, flexShrink: 0 }} />
                    <span className="mpr-form-row-label" style={{ minWidth: 0, flex: 1 }}>{a.name}</span>
                    <span className="mpr-form-row-dim">{fmt(a.balance, currency)}</span>
                    {a.id === accountId && <Icon name="check" size={14} style={{ color: 'var(--m-primary, #ffdd3d)', flexShrink: 0 }} />}
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
              <span className="mpr-editor-name-input" style={{ cursor: 'default' }}>Seleccionar categoría</span>
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
