import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmt, fmtCompact } from '@/data/helpers'
import { advanceRecurrenceDate } from '@/hooks/useRecurring'
import { useFinance } from '@/store/finance'
import { MobileDatePicker } from './MobileDatePicker'
import type { Category, IconName, RecurrenceFrequency, Transaction } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'

type MobileTxMode = Transaction['type']

const today = () => new Date().toISOString().slice(0, 10)
const keypad = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'] as const
const CATEGORY_COLORS = ['#ffdd3d', '#35d0a2', '#5bc0ff', '#a78bfa', '#ff6b8a', '#f59e0b']
const CATEGORY_ICONS: IconName[] = [
  'cart', 'food', 'car', 'bolt', 'heart', 'home',
  'bag', 'book', 'wallet', 'laptop', 'trend', 'play',
  'music', 'coffee', 'phone', 'gym', 'bus', 'building',
  'gamepad', 'gift', 'scissors', 'baby', 'paw', 'pill',
  'plane', 'briefcase', 'shirt', 'pizza', 'star', 'fuel', 'flame', 'soda',
  'tree', 'sun', 'bike', 'train', 'tv', 'monitor', 'headphones', 'clock',
  'key', 'tool', 'brush', 'graduation', 'stethoscope', 'salad', 'wine',
  'crown', 'trophy', 'shield', 'map', 'package',
]

const ACCT_ICONS: Record<string, IconName> = {
  cash: 'wallet', debit: 'cards', savings: 'piggy', credit: 'cards',
}

function cleanAmount(value: string): string {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '')
  const [integer = '', ...rest] = normalized.split('.')
  const decimal = rest.join('').slice(0, 2)
  const safeInteger = integer.replace(/^0+(?=\d)/, '')
  return rest.length ? `${safeInteger || '0'}.${decimal}` : safeInteger
}

function notePlaceholder(mode: MobileTxMode, category?: Category): string {
  if (mode === 'transfer') return 'Ej. Transferencia a ahorros'
  if (category) return `Ej. ${category.name}`
  return mode === 'income' ? 'Ej. Pago recibido' : 'Ej. Compra'
}

function formatDateShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
}

export function MobileCreateFlow({
  mkey,
  onSaved,
}: {
  mkey: string
  onSaved: () => void
}) {
  const { accounts, categories, currency, addTx, transfer, addCategory } = useFinance()
  const [mode, setMode] = useState<MobileTxMode>('expense')
  const [amountText, setAmountText] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [fromAccount, setFromAccount] = useState(accounts[0]?.id ?? '')
  const [toAccount, setToAccount] = useState(accounts[1]?.id ?? accounts[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false)
  const [transferPicker, setTransferPicker] = useState<'from' | 'to' | null>(null)
  const [accountPicker, setAccountPicker] = useState(false)
  const [datePicker, setDatePicker] = useState(false)
  const [date, setDate] = useState(() => {
    const current = today()
    return current.startsWith(mkey) ? current : `${mkey}-01`
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [shaking,   setShaking]   = useState(false)
  const [recurring, setRecurring] = useState(false)
  const [recurFreq, setRecurFreq] = useState<RecurrenceFrequency>('monthly')
  const [recurEnd,  setRecurEnd]  = useState('')
  const [recurEndPicker, setRecurEndPicker] = useState(false)

  const amount = Number(amountText || 0)
  const categoryType = mode === 'income' ? 'income' : 'expense'
  const visibleCategories = useMemo(
    () => categories.filter(c => c.type === categoryType).slice(0, 24),
    [categories, categoryType],
  )
  const activeCategory = visibleCategories.find(c => c.id === categoryId) ?? visibleCategories[0]
  const activeAccountId = accounts.some(a => a.id === accountId) ? accountId : accounts[0]?.id ?? ''
  const activeAccount = accounts.find(a => a.id === activeAccountId)
  const fromAccountObj = accounts.find(a => a.id === fromAccount)
  const toAccountObj = accounts.find(a => a.id === toAccount)
  const validTransfer = mode === 'transfer' && !!fromAccount && !!toAccount && fromAccount !== toAccount
  const canSave = amount > 0 && date && accounts.length > 0 && (
    mode === 'transfer' ? validTransfer : !!activeCategory && !!activeAccountId
  )
  const isToday = date === today()

  useMobileBackDismiss(categoryEditorOpen, () => setCategoryEditorOpen(false))
  useMobileBackDismiss(!!transferPicker, () => setTransferPicker(null))
  useMobileBackDismiss(accountPicker, () => setAccountPicker(false))
  useMobileBackDismiss(datePicker, () => setDatePicker(false))
  useMobileBackDismiss(recurEndPicker, () => setRecurEndPicker(false))

  const switchMode = (next: MobileTxMode) => { setMode(next); setCategoryId(null); setNote('') }

  const pressKey = (key: (typeof keypad)[number]) => {
    setFormError(null)
    if (key === 'back') { setAmountText(v => v.slice(0, -1)); return }
    if (key === '.' && amountText.includes('.')) return
    setAmountText(v => cleanAmount(v + key))
  }

  const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 420)
  }

  const save = () => {
    if (!canSave) {
      const msg = amount <= 0
        ? 'Ingresa un monto mayor a 0'
        : mode !== 'transfer' && !activeCategory
          ? 'Selecciona una categoría'
          : mode === 'transfer' && fromAccount === toAccount
            ? 'Elige dos cuentas distintas'
            : 'Completa todos los campos'
      setFormError(msg)
      triggerShake()
      return
    }
    setFormError(null)
    try {
      if (mode === 'transfer') {
        transfer({ fromAccount, toAccount, amount, date, note: note.trim() || 'Transferencia' })
      } else {
        addTx({
          type: mode, amount, date,
          note: note.trim() || activeCategory!.name,
          categoryId: activeCategory!.id,
          accountId: activeAccountId,
          ...(recurring ? {
            recurring: recurFreq,
            recurringStart: date,
            recurringEnd: recurEnd || undefined,
            recurringNext: advanceRecurrenceDate(date, recurFreq),
          } : {}),
        })
      }
      navigator.vibrate?.(18)
      toast(
        recurring
          ? `Movimiento ${recurFreq === 'weekly' ? 'semanal' : 'mensual'} programado`
          : mode === 'transfer' ? 'Transferencia registrada' : 'Movimiento guardado',
        { icon: 'check', type: 'ok' },
      )
      setAmountText('')
      setNote('')
      setCategoryId(null)
      setRecurring(false)
      setRecurEnd('')
      onSaved()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo guardar.', { icon: 'alert' })
    }
  }

  const createCategory = (fields: { name: string; icon: IconName; color: string; budget: number }) => {
    const name = fields.name.trim()
    if (!name) { toast('Escribe un nombre para la categoría.', { icon: 'alert' }); return }
    addCategory({ name, icon: fields.icon, color: fields.color, budget: fields.budget, type: categoryType })
    toast(`Categoría "${name}" creada`, { icon: 'check', type: 'ok' })
    setCategoryEditorOpen(false)
  }

  const amountColor = mode === 'income' ? '#35d0a2' : mode === 'transfer' ? '#ffdd3d' : '#f65574'
  const currencyPrefix = currency === 'DOP' ? 'RD$' : currency === 'USD' ? '$' : '€'

  return (
    <div className="mobile-create-flow" aria-label="Agregar movimiento">

      {/* ─── Scrollable top section ─── */}
      <div className="mobile-create-scroll">

        {/* Mode tabs */}
        <div className="mobile-segment" role="tablist" aria-label="Tipo de movimiento">
          {([['expense', 'Gasto'], ['income', 'Ingreso'], ['transfer', 'Transferencia']] as const).map(([value, label]) => (
            <button key={value} className={mode === value ? 'on' : ''} role="tab" aria-selected={mode === value}
              onClick={() => switchMode(value)}>
              {label}
            </button>
          ))}
        </div>

        {mode !== 'transfer' ? (
          <>
            {/* Category header */}
            <div className="mobile-create-section-header">
              <span>Categoría</span>
              <button className="mobile-create-new-btn" onClick={() => setCategoryEditorOpen(true)}>
                <Icon name="plus" size={12} /> Nueva
              </button>
            </div>

            {/* Category grid */}
            {visibleCategories.length ? (
              <div className="mobile-category-grid">
                {visibleCategories.map(category => {
                  const selected = activeCategory?.id === category.id
                  return (
                    <button key={category.id} className={selected ? 'on' : ''} aria-pressed={selected}
                      onClick={() => setCategoryId(category.id)}>
                      <span style={{ color: category.color, background: `color-mix(in oklab, ${category.color} 22%, transparent)` }}>
                        <Icon name={category.icon} size={20} />
                      </span>
                      <small>{category.name}</small>
                    </button>
                  )
                })}
                <button className="mobile-category-add" onClick={() => setCategoryEditorOpen(true)}>
                  <span><Icon name="plus" size={20} /></span>
                  <small>Nueva</small>
                </button>
              </div>
            ) : (
              <button className="mobile-empty-action" onClick={() => setCategoryEditorOpen(true)}>
                Crear una categoría para continuar
              </button>
            )}

            {/* Account + Date + Note */}
            {accounts.length > 0 && (
              <div className="mobile-create-meta-row">
                <button className="mobile-create-account-pill" onClick={() => setAccountPicker(true)}>
                  <span style={{ color: activeAccount?.color ?? '#ffdd3d' }}>
                    <Icon name={ACCT_ICONS[activeAccount?.type ?? 'debit']} size={15} />
                  </span>
                  <span className="mobile-create-account-name">{activeAccount?.name ?? 'Cuenta'}</span>
                  <Icon name="arrowDn" size={12} style={{ color: '#5a5a5a', marginLeft: 'auto' }} />
                </button>
                <button className="mobile-create-date-pill" onClick={() => setDatePicker(true)}>
                  <Icon name="calendar" size={13} />
                  <span>{isToday ? 'Hoy' : formatDateShort(date)}</span>
                </button>
              </div>
            )}

            {/* Note — in scrollable area to avoid keyboard overlap */}
            <div className="mobile-create-note-input">
              <Icon name="edit" size={14} />
              <input
                type="text"
                value={note}
                placeholder={notePlaceholder(mode, activeCategory)}
                enterKeyHint="done"
                autoCapitalize="sentences"
                autoCorrect="on"
                onChange={e => setNote(e.target.value)}
              />
            </div>

            {/* Recurring toggle */}
            <button
              className={`mobile-create-recurring-toggle${recurring ? ' active' : ''}`}
              onClick={() => setRecurring(r => !r)}
            >
              <span className="mobile-recur-icon">
                <Icon name="repeat" size={15} />
              </span>
              <span className="mobile-recur-label">Repetir movimiento</span>
              <span className={`mobile-recur-switch${recurring ? ' on' : ''}`} />
            </button>

            {recurring && (
              <div className="mobile-create-recurring-opts">
                <div className="mobile-segment mobile-recur-freq">
                  <button className={recurFreq === 'weekly' ? 'on' : ''} onClick={() => setRecurFreq('weekly')}>
                    Semanal
                  </button>
                  <button className={recurFreq === 'monthly' ? 'on' : ''} onClick={() => setRecurFreq('monthly')}>
                    Mensual
                  </button>
                </div>
                <button className="mobile-create-date-pill" onClick={() => setRecurEndPicker(true)}>
                  <Icon name="calendar" size={13} />
                  <span>{recurEnd ? `Hasta ${formatDateShort(recurEnd)}` : 'Sin fecha límite'}</span>
                  {recurEnd && (
                    <span style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); setRecurEnd('') }}>
                      <Icon name="close" size={12} />
                    </span>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Transfer: visual account cards */}
            <div className="mobile-transfer-cards">
              <button className="mobile-transfer-card" onClick={() => setTransferPicker('from')}>
                <span style={{ color: fromAccountObj?.color ?? '#ffdd3d', background: `color-mix(in oklab, ${fromAccountObj?.color ?? '#ffdd3d'} 16%, transparent)` }}>
                  <Icon name={ACCT_ICONS[fromAccountObj?.type ?? 'cash']} size={26} />
                </span>
                <b>{fromAccountObj?.name ?? 'Origen'}</b>
                <small>{fromAccountObj ? fmtCompact(fromAccountObj.balance, currency) : '—'}</small>
                <em>Origen</em>
              </button>
              <div className="mobile-transfer-arrow">→</div>
              <button className="mobile-transfer-card" onClick={() => setTransferPicker('to')}>
                <span style={{ color: toAccountObj?.color ?? '#35d0a2', background: `color-mix(in oklab, ${toAccountObj?.color ?? '#35d0a2'} 16%, transparent)` }}>
                  <Icon name={ACCT_ICONS[toAccountObj?.type ?? 'cash']} size={26} />
                </span>
                <b>{toAccountObj?.name ?? 'Destino'}</b>
                <small>{toAccountObj ? fmtCompact(toAccountObj.balance, currency) : '—'}</small>
                <em>Destino</em>
              </button>
            </div>

            {/* Date + Note for transfer */}
            <div className="mobile-create-meta-row">
              <button className="mobile-create-date-pill" style={{ flex: 1 }} onClick={() => setDatePicker(true)}>
                <Icon name="calendar" size={13} />
                <span>{isToday ? 'Hoy' : formatDateShort(date)}</span>
              </button>
            </div>

            <div className="mobile-create-note-input">
              <Icon name="edit" size={14} />
              <input
                type="text"
                value={note}
                placeholder={notePlaceholder(mode, activeCategory)}
                enterKeyHint="done"
                autoCapitalize="sentences"
                autoCorrect="on"
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {/* ─── Fixed bottom: amount + keypad + save ─── */}
      <div className="mobile-create-bottom">
        {/* Amount display */}
        <div className={`mobile-create-amount-row${shaking ? ' shake' : ''}`}>
          <span className="mobile-create-amount-label">
            {mode === 'expense' ? 'Gasto' : mode === 'income' ? 'Ingreso' : 'Monto'}
          </span>
          <strong className="mobile-create-amount-value" style={{ color: amountText ? amountColor : '#3a3a3a' }}>
            {amountText
              ? fmt(amount, currency, { decimals: amountText.includes('.') ? 2 : 0 })
              : `${currencyPrefix} 0`}
          </strong>
        </div>
        {formError && (
          <div className="mobile-create-error">
            <Icon name="alert" size={13} />
            {formError}
          </div>
        )}

        {/* Numpad */}
        <div className="mobile-keypad-compact">
          {keypad.map(key => (
            <button key={key} onClick={() => pressKey(key)}>
              {key === 'back' ? <Icon name="close" size={18} /> : key}
            </button>
          ))}
        </div>

        {/* Save */}
        <button className="mobile-save-button" disabled={!canSave} onClick={save}>
          <Icon name="check" size={20} />
          {mode === 'transfer' ? 'Transferir' : 'Guardar'}
        </button>
      </div>

      {/* Single account picker */}
      {accountPicker && (
        <div className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={() => setAccountPicker(false)}>
          <section onClick={e => e.stopPropagation()}>
            <header>
              <span>Seleccionar cuenta</span>
              <button onClick={() => setAccountPicker(false)}><Icon name="close" size={18} /></button>
            </header>
            <div className="mobile-picker-list">
              {accounts.map(account => (
                <button key={account.id}
                  className={`mobile-picker-row${account.id === activeAccountId ? ' active' : ''}`}
                  onClick={() => { setAccountId(account.id); setAccountPicker(false) }}>
                  <span style={{ color: account.color }}>
                    <Icon name={ACCT_ICONS[account.type] ?? 'wallet'} size={22} />
                  </span>
                  <b>{account.name}</b>
                  <small>{fmtCompact(account.balance, currency)}</small>
                  {account.id === activeAccountId && <Icon name="check" size={16} style={{ color: '#ffdd3d', marginLeft: 4 }} />}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Transfer account picker sheet */}
      {transferPicker && (
        <div className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={() => setTransferPicker(null)}>
          <section onClick={e => e.stopPropagation()}>
            <header>
              <span>{transferPicker === 'from' ? 'Cuenta origen' : 'Cuenta destino'}</span>
              <button onClick={() => setTransferPicker(null)}><Icon name="close" size={18} /></button>
            </header>
            <div className="mobile-picker-list">
              {accounts
                .filter(a => transferPicker === 'from' ? a.id !== toAccount : a.id !== fromAccount)
                .map(account => (
                  <button key={account.id} className="mobile-picker-row"
                    onClick={() => {
                      if (transferPicker === 'from') setFromAccount(account.id)
                      else setToAccount(account.id)
                      setTransferPicker(null)
                    }}>
                    <span style={{ color: account.color }}>
                      <Icon name={ACCT_ICONS[account.type] ?? 'wallet'} size={22} />
                    </span>
                    <b>{account.name}</b>
                    <small>{fmtCompact(account.balance, currency)}</small>
                  </button>
                ))}
            </div>
          </section>
        </div>
      )}

      {/* Date picker */}
      {datePicker && (
        <MobileDatePicker
          value={date}
          onChange={setDate}
          onClose={() => setDatePicker(false)}
          mkey={mkey}
        />
      )}

      {/* Recurring end date picker */}
      {recurEndPicker && (
        <MobileDatePicker
          value={recurEnd || date}
          onChange={v => setRecurEnd(v)}
          onClose={() => setRecurEndPicker(false)}
          mkey={mkey}
        />
      )}

      {categoryEditorOpen && (
        <MobileCategoryEditor
          type={categoryType}
          onClose={() => setCategoryEditorOpen(false)}
          onSave={createCategory}
        />
      )}
    </div>
  )
}

export type MobileCreateTarget = Transaction | 'new'

function MobileCategoryEditor({
  type,
  onClose,
  onSave,
}: {
  type: Category['type']
  onClose: () => void
  onSave: (fields: { name: string; icon: IconName; color: string; budget: number }) => void
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<IconName>(type === 'income' ? 'wallet' : 'cart')
  const [color, setColor] = useState(type === 'income' ? '#35d0a2' : '#ffdd3d')
  const [budget, setBudget] = useState('')

  useMobileBackDismiss(true, onClose)

  return (
    <div className="mobile-editor-screen" role="dialog" aria-modal="true">
      <header>
        <button onClick={onClose}>Cancelar</button>
        <strong>Nueva categoría</strong>
        <button onClick={() => onSave({ name, icon, color, budget: Number(budget) || 0 })}>Crear</button>
      </header>
      <div className="mobile-editor-body">
        <label>
          <span>Tipo</span>
          <input value={type === 'income' ? 'Ingreso' : 'Gasto'} readOnly />
        </label>
        <label>
          <span>Nombre</span>
          <input
            autoFocus
            type="text"
            value={name}
            placeholder={type === 'income' ? 'Ej. Bono' : 'Ej. Mascotas'}
            autoCapitalize="words"
            autoCorrect="on"
            enterKeyHint="done"
            onChange={event => setName(event.target.value)}
          />
        </label>
        {type === 'expense' && (
          <label>
            <span>Presupuesto mensual</span>
            <input type="number" value={budget} placeholder="3000" onChange={event => setBudget(event.target.value)} />
          </label>
        )}
        <div>
          <span className="mobile-editor-label">Icono</span>
          <div className="mobile-icon-grid">
            {CATEGORY_ICONS.map(item => (
              <button key={item} className={icon === item ? 'on' : ''} onClick={() => setIcon(item)}>
                <Icon name={item} size={22} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mobile-editor-label">Color</span>
          <div className="mobile-color-grid">
            {CATEGORY_COLORS.map(item => (
              <button key={item} className={color === item ? 'on' : ''} style={{ background: item }} onClick={() => setColor(item)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
