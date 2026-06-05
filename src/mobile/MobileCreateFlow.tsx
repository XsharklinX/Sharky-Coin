import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmt } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import type { Category, IconName, Transaction } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'

type MobileTxMode = Transaction['type']

const today = () => new Date().toISOString().slice(0, 10)
const keypad = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'] as const
const CATEGORY_COLORS = ['#ffdd3d', '#35d0a2', '#5bc0ff', '#a78bfa', '#ff6b8a', '#f59e0b']
const CATEGORY_ICONS: IconName[] = ['cart', 'food', 'car', 'bolt', 'play', 'heart', 'bag', 'book', 'wallet', 'laptop', 'trend', 'home']

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

export function MobileCreateFlow({
  mkey,
  onSaved,
  onCreateAccount,
  onCreateGoal,
}: {
  mkey: string
  onSaved: () => void
  onCreateAccount: () => void
  onCreateGoal: () => void
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
  const [date, setDate] = useState(() => {
    const current = today()
    return current.startsWith(mkey) ? current : `${mkey}-01`
  })

  const amount = Number(amountText || 0)
  const categoryType = mode === 'income' ? 'income' : 'expense'
  const visibleCategories = useMemo(
    () => categories.filter(category => category.type === categoryType).slice(0, 16),
    [categories, categoryType],
  )
  const activeCategory = visibleCategories.find(category => category.id === categoryId) ?? visibleCategories[0]
  const activeAccountId = accounts.some(account => account.id === accountId) ? accountId : accounts[0]?.id ?? ''
  const validTransfer = mode === 'transfer' && !!fromAccount && !!toAccount && fromAccount !== toAccount
  const canSave = amount > 0 && date && accounts.length > 0 && (
    mode === 'transfer' ? validTransfer : !!activeCategory && !!activeAccountId
  )

  const switchMode = (next: MobileTxMode) => {
    setMode(next)
    setCategoryId(null)
    setNote('')
  }

  const pressKey = (key: (typeof keypad)[number]) => {
    if (key === 'back') {
      setAmountText(value => value.slice(0, -1))
      return
    }
    if (key === '.' && amountText.includes('.')) return
    setAmountText(value => cleanAmount(value + key))
  }

  const resetEntry = () => {
    setAmountText('')
    setNote('')
    setCategoryId(null)
  }

  const save = () => {
    if (!canSave) {
      toast('Completa monto, cuenta y categoría.', { icon: 'alert' })
      return
    }

    try {
      if (mode === 'transfer') {
        transfer({
          fromAccount,
          toAccount,
          amount,
          date,
          note: note.trim() || 'Transferencia',
        })
      } else {
        addTx({
          type: mode,
          amount,
          date,
          note: note.trim() || activeCategory!.name,
          categoryId: activeCategory!.id,
          accountId: activeAccountId,
        })
      }
      navigator.vibrate?.(18)
      toast(mode === 'transfer' ? 'Transferencia registrada' : 'Movimiento guardado', {
        icon: 'check',
        type: 'ok',
      })
      resetEntry()
      onSaved()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo guardar.', { icon: 'alert' })
    }
  }

  const createCategory = (fields: { name: string; icon: IconName; color: string; budget: number }) => {
    const name = fields.name.trim()
    if (!name) {
      toast('Escribe un nombre para la categoría.', { icon: 'alert' })
      return
    }
    addCategory({ name, icon: fields.icon, color: fields.color, budget: fields.budget, type: categoryType })
    toast(`Categoría "${name}" creada`, { icon: 'check', type: 'ok' })
    setCategoryEditorOpen(false)
  }

  return (
    <div className="mobile-create-flow" aria-label="Agregar movimiento">
      <div className="mobile-segment" role="tablist" aria-label="Tipo de movimiento">
        {([
          ['expense', 'Gasto'],
          ['income', 'Ingreso'],
          ['transfer', 'Transferencia'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            className={mode === value ? 'on' : ''}
            aria-selected={mode === value}
            role="tab"
            onClick={() => switchMode(value)}>
            {label}
          </button>
        ))}
      </div>

      <section className="mobile-amount-panel">
        <small>{mode === 'transfer' ? 'Monto a transferir' : 'Monto'}</small>
        <strong>{fmt(amount, currency, { decimals: amountText.includes('.') ? 2 : 0 })}</strong>
      </section>

      {mode !== 'transfer' && (
        <section className="mobile-create-section">
          <div className="mobile-section-title">
            <h2>Categoría</h2>
            <button onClick={() => setCategoryEditorOpen(true)}><Icon name="plus" size={15} /> Nueva</button>
          </div>
          {visibleCategories.length ? (
            <div className="mobile-category-grid">
              {visibleCategories.map(category => {
                const selected = activeCategory?.id === category.id
                return (
                  <button
                    key={category.id}
                    className={selected ? 'on' : ''}
                    aria-pressed={selected}
                    onClick={() => setCategoryId(category.id)}>
                    <span style={{
                      color: category.color,
                      background: `color-mix(in oklab, ${category.color} 22%, transparent)`,
                    }}>
                      <Icon name={category.icon} size={25} />
                    </span>
                    <small>{category.name}</small>
                  </button>
                )
              })}
              <button className="mobile-category-add" onClick={() => setCategoryEditorOpen(true)}>
                <span><Icon name="plus" size={24} /></span>
                <small>Nueva</small>
              </button>
            </div>
          ) : (
            <button className="mobile-empty-action" onClick={() => setCategoryEditorOpen(true)}>
              Crear una categoría para continuar
            </button>
          )}
        </section>
      )}

      <section className="mobile-create-section mobile-quick-fields">
        {mode === 'transfer' ? (
          <div className="mobile-field-grid two">
            <label>
              <span>Desde</span>
              <select value={fromAccount} onChange={event => setFromAccount(event.target.value)}>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
            <label>
              <span>Hacia</span>
              <select value={toAccount} onChange={event => setToAccount(event.target.value)}>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
          </div>
        ) : (
          <label>
            <span>Cuenta</span>
            <select value={activeAccountId} onChange={event => setAccountId(event.target.value)}>
              {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
        )}
        <div className="mobile-field-grid two">
          <label>
            <span>Fecha</span>
            <input type="date" value={date} onChange={event => setDate(event.target.value)} />
          </label>
          <label>
            <span>Nota</span>
            <input
              value={note}
              placeholder={notePlaceholder(mode, activeCategory)}
              enterKeyHint="done"
              onChange={event => setNote(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="mobile-keypad" aria-label="Teclado numérico">
        {keypad.map(key => (
          <button key={key} onClick={() => pressKey(key)}>
            {key === 'back' ? <Icon name="close" size={22} /> : key}
          </button>
        ))}
      </section>

      <button className="mobile-save-button" disabled={!canSave} onClick={save}>
        <Icon name="check" size={21} />
        Guardar
      </button>

      <section className="mobile-secondary-actions">
        <button onClick={onCreateAccount}><Icon name="cards" size={18} /> Cuenta</button>
        <button onClick={onCreateGoal}><Icon name="target" size={18} /> Meta</button>
      </section>

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
          <input autoFocus value={name} placeholder={type === 'income' ? 'Ej. Bono' : 'Ej. Mascotas'} onChange={event => setName(event.target.value)} />
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
