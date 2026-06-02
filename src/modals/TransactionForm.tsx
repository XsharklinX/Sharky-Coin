import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { Transaction, TxType } from '@/types'

export function TransactionForm({ value, mkey, onClose, onDelete }: {
  value:     Transaction | 'new'
  mkey:      string
  onClose:   () => void
  onDelete?: (id: string) => void   // si se pasa, usa undo-aware delete del App
}) {
  const { accounts, categories, transactions, addTx, updateTx, deleteTx } = useFinance()
  const overdraftPolicy = useSettings(s => s.overdraftPolicy)
  const editing = value !== 'new'

  const [type,       setType]       = useState<Exclude<TxType, 'transfer'>>('expense')
  const [amount,     setAmount]     = useState('')
  const [note,       setNote]       = useState('')
  const [date,       setDate]       = useState(`${mkey}-01`)
  const [accountId,  setAccountId]  = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [recurring,  setRecurring]  = useState(false)
  const [tags,       setTags]       = useState<string[]>([])
  const [tagInput,   setTagInput]   = useState('')
  const [noteSugg,   setNoteSugg]   = useState<string[]>([])
  const [tagSugg,    setTagSugg]    = useState<string[]>([])

  useEffect(() => {
    if (editing) {
      setType(value.type === 'income' ? 'income' : 'expense')
      setAmount(String(value.amount)); setNote(value.note); setDate(value.date)
      setAccountId(value.accountId ?? accounts[0]?.id ?? '')
      setCategoryId(value.categoryId ?? '')
      setRecurring(value.recurring === 'monthly')
      setTags(value.tags ?? [])
    }
  }, [accounts, editing, value])

  const visibleCats = categories.filter(c => c.type === type)
  useEffect(() => {
    if (!visibleCats.some(c => c.id === categoryId)) setCategoryId(visibleCats[0]?.id ?? '')
  }, [categoryId, visibleCats])

  // autocomplete de notas
  useEffect(() => {
    if (!note || note.length < 2) { setNoteSugg([]); return }
    const nl = note.toLowerCase()
    const seen = new Set<string>()
    setNoteSugg(transactions
      .filter(t => t.note?.toLowerCase().startsWith(nl) && t.note !== note)
      .map(t => t.note).filter(n => { if (seen.has(n)) return false; seen.add(n); return true })
      .slice(0, 4))
  }, [note, transactions])

  // tags existentes para sugerencias
  const allTags = useMemo(() => {
    const s = new Set<string>()
    transactions.forEach(t => t.tags?.forEach(tag => s.add(tag)))
    return Array.from(s).sort()
  }, [transactions])

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/[^a-zA-Z0-9áéíóúüñ-]/g, '')
    if (!tag || tags.includes(tag)) return
    setTags(p => [...p, tag]); setTagInput(''); setTagSugg([])
  }
  const removeTag = (tag: string) => setTags(p => p.filter(t => t !== tag))

  const submit = () => {
    const amt = Number(amount)
    if (!amt || amt <= 0 || !note.trim() || !accountId || !categoryId)
      return toast('Completa monto, descripción, cuenta y categoría.', { icon: 'edit' })
    const fields = {
      type, amount: amt, note: note.trim(), date, accountId, categoryId,
      recurring: recurring ? 'monthly' as const : null,
      tags: tags.length ? tags : undefined,
    }
    const account = accounts.find(a => a.id === accountId)
    const previousAmount = editing && value.type === 'expense' && value.accountId === accountId ? value.amount : 0
    const available = (account?.balance ?? 0) + previousAmount
    if (type === 'expense' && account?.type !== 'credit' && available < amt && overdraftPolicy === 'warn') {
      toast(`Aviso: el gasto dejará ${account?.name ?? 'la cuenta'} con saldo negativo.`, { icon: 'alert' })
    }
    try {
      if (editing) updateTx(value.id, fields)
      else         addTx(fields)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo guardar el movimiento.', { icon: 'alert' })
      return
    }
    toast(editing ? 'Movimiento actualizado' : 'Movimiento agregado', { icon: 'edit', type: 'ok' })
    onClose()
  }

  const remove = () => {
    if (!editing) return
    // Usar el delete undo-aware del App si está disponible
    if (onDelete) onDelete(value.id)
    else { deleteTx(value.id); toast('Movimiento eliminado', { icon: 'trash' }) }
    onClose()
  }

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true"
        aria-labelledby="tx-title" onMouseDown={e => e.stopPropagation()}>
        <header className="modal-head">
          <h2 id="tx-title">{editing ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className="seg seg-lg" style={{ marginTop: 16 }}>
          <button className={type === 'expense' ? 'on' : ''} onClick={() => setType('expense')}>Gasto</button>
          <button className={type === 'income'  ? 'on' : ''} onClick={() => setType('income')}>Ingreso</button>
        </div>

        <div className="field">
          <label htmlFor="tx-amount">Monto (RD$)</label>
          <input id="tx-amount" autoFocus className="select" type="number" inputMode="decimal"
            value={amount} onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        <div className="field" style={{ position: 'relative' }}>
          <label htmlFor="tx-note">Descripción</label>
          <input id="tx-note" className="select" value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Ej. Compra supermercado" autoComplete="off" />
          {noteSugg.length > 0 && (
            <ul className="note-suggestions">
              {noteSugg.map(s => (
                <li key={s}><button onClick={() => { setNote(s); setNoteSugg([]) }}>{s}</button></li>
              ))}
            </ul>
          )}
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="tx-account">Cuenta</label>
            <select id="tx-account" className="select" value={accountId}
              onChange={e => setAccountId(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tx-category">Categoría</label>
            <select id="tx-category" className="select" value={categoryId}
              onChange={e => setCategoryId(e.target.value)}>
              {visibleCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="tx-date">Fecha</label>
          <input id="tx-date" className="select" type="date" value={date}
            onChange={e => setDate(e.target.value)} />
        </div>

        {/* ── Tags ── */}
        <div className="field">
          <label htmlFor="tx-tags">Etiquetas <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(opcional)</span></label>
          {tags.length > 0 && (
            <div className="tags-list">
              {tags.map(tag => (
                <span key={tag} className="tag-chip">
                  #{tag}
                  <button aria-label={`Quitar etiqueta ${tag}`} onClick={() => removeTag(tag)}>×</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <input id="tx-tags" className="select" value={tagInput}
              placeholder="trabajo, viaje, regalo… Enter para agregar"
              autoComplete="off"
              onChange={e => {
                setTagInput(e.target.value)
                const q = e.target.value.toLowerCase()
                setTagSugg(q.length > 0
                  ? allTags.filter(t => t.startsWith(q) && !tags.includes(t)).slice(0, 5)
                  : [])
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
                if (e.key === 'Backspace' && !tagInput && tags.length) removeTag(tags[tags.length - 1])
              }} />
            {tagSugg.length > 0 && (
              <ul className="note-suggestions">
                {tagSugg.map(s => (
                  <li key={s}><button onClick={() => addTag(s)}>#{s}</button></li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Recurrente ── */}
        <label className="recurring-toggle">
          <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
          <span><Icon name="repeat" size={14} />Repetir mensualmente</span>
          {recurring && <span className="recurring-badge">Recurrente</span>}
        </label>

        <footer className="modal-actions">
          {editing && (
            <button className="btn-danger" onClick={remove}>
              <Icon name="trash" size={15} />Eliminar
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={submit}>
            {editing ? 'Guardar' : 'Agregar'}
          </button>
        </footer>
      </section>
    </div>
  )
}
