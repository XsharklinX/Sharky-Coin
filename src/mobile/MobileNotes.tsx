import { useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useDialogs } from '@/components/ui/DialogProvider'
import { localToday, transactionsForTotals, txForMonth } from '@/data/helpers'
import { itemLineTotal, itemPriceLabel, noteProgress, noteShareText, noteTotals, orderedItems, type Note, type NoteItem, type NoteType } from '@/data/notes'
import { useNotes } from '@/store/notes'
import { deleteWithUndo } from '@/lib/undoDelete'
import { useFinance } from '@/store/finance'
import { useFmt } from '@/hooks/useFmt'
import { shareText } from '@/lib/nativeShare'
import { useT, type LangKey } from '@/i18n'
import type { Account, IconName, ViewProps } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { useDialogA11y } from './useDialogA11y'
import { MobileAmountSheet } from './MobileAmountSheet'
import { SheetPortal } from './SheetPortal'

const TYPE_META: Record<NoteType, { icon: IconName; color: string; key: LangKey; descKey: LangKey }> = {
  shopping:  { icon: 'cart',  color: '#35d0a2', key: 'noteTypeShopping',  descKey: 'noteTypeShoppingDesc' },
  checklist: { icon: 'grid',  color: '#5bc0ff', key: 'noteTypeChecklist', descKey: 'noteTypeChecklistDesc' },
  note:      { icon: 'edit',  color: '#ffdd3d', key: 'noteTypeNote',      descKey: 'noteTypeNoteDesc' },
}

export function MobileNotes({ mkey }: ViewProps) {
  const t = useT()
  const notes = useNotes(s => s.notes)
  const addNote = useNotes(s => s.addNote)
  const [openId, setOpenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const activeNotes = notes.filter(n => !n.archived).sort((a, b) => b.updatedAt - a.updatedAt)
  const archivedNotes = notes.filter(n => n.archived).sort((a, b) => b.updatedAt - a.updatedAt)

  const finance = useFinance()
  const fmtVal = useFmt()
  const money = (n: number) => fmtVal(n, finance.currency)

  const openNote = notes.find(n => n.id === openId) ?? null
  // El back-dismiss del detalle vive AQUÍ, en el padre estable, no dentro de
  // NoteDetail: un `useMobileBackDismiss` montado junto con el sheet se dispara
  // solo bajo StrictMode (su cleanup hace history.back() y cierra el sheet al
  // instante). Al vivir en el padre, el efecto corre una vez al abrir. Mismo
  // patrón que MobileSettings con `activeSheet`.
  useMobileBackDismiss(picking, () => setPicking(false))
  useMobileBackDismiss(!!openNote, () => setOpenId(null))

  // Gasto del mes por categoría — para el aviso de "no cabe en tu presupuesto".
  const spentByCat = useMemo(() => {
    const monthTx = txForMonth(transactionsForTotals(finance.transactions, finance.accounts, finance.currency), mkey)
    const map: Record<string, number> = {}
    for (const tx of monthTx) {
      if (tx.type === 'expense' && tx.categoryId) map[tx.categoryId] = (map[tx.categoryId] ?? 0) + tx.amount
    }
    return map
  }, [finance.transactions, finance.accounts, finance.currency, mkey])

  const createNote = (type: NoteType) => {
    const id = addNote({ type })
    setPicking(false)
    setOpenId(id)
  }

  return (
    <div className="mnote-root">
      {notes.length === 0 ? (
        <div className="mnote-empty">
          <span className="mnote-empty-icon"><Icon name="clipboard" size={30} /></span>
          <strong>{t('notesEmptyTitle')}</strong>
          <p>{t('notesEmptyDesc')}</p>
          <button className="mnote-empty-btn" onClick={() => setPicking(true)}>
            <Icon name="plus" size={16} /> {t('newListLabel')}
          </button>
        </div>
      ) : (
        <>
          <div className="mnote-list">
            {activeNotes.map(note => (
              <NoteCard key={note.id} note={note} money={money} onOpen={() => setOpenId(note.id)} />
            ))}
          </div>
          <button className="mnote-new" onClick={() => setPicking(true)}>
            <Icon name="plus" size={16} /> {t('newListLabel')}
          </button>

          {archivedNotes.length > 0 && (
            <>
              <button className="mnote-archived-toggle" onClick={() => setShowArchived(v => !v)}>
                <Icon name={showArchived ? 'eyeOff' : 'eye'} size={14} />
                {t('archivedListsLabel').replace('{n}', String(archivedNotes.length))}
                <Icon name="arrowUp" size={12} style={{ transform: showArchived ? 'rotate(180deg)' : 'none', marginLeft: 'auto' }} />
              </button>
              {showArchived && (
                <div className="mnote-list mnote-list-archived">
                  {archivedNotes.map(note => (
                    <NoteCard key={note.id} note={note} money={money} onOpen={() => setOpenId(note.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {picking && <TypePicker onPick={createNote} onClose={() => setPicking(false)} />}
      {openNote && (
        <NoteDetail
          note={openNote}
          money={money}
          spent={openNote.categoryId ? (spentByCat[openNote.categoryId] ?? 0) : 0}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

function NoteCard({ note, money, onOpen }: { note: Note; money: (n: number) => string; onOpen: () => void }) {
  const t = useT()
  const totals = noteTotals(note)
  const pct = Math.round(noteProgress(note) * 100)
  const showMoney = note.type === 'shopping' && totals.pricedCount > 0

  return (
    <button className="mnote-card" onClick={onOpen}>
      <div className="mnote-card-top">
        <span className="mnote-chip" style={{ background: `color-mix(in oklab, ${note.color} 16%, transparent)`, color: note.color }}>
          <Icon name={note.icon} size={18} />
        </span>
        <span className="mnote-card-body">
          <b>{note.title || t('untitledList')}</b>
          <small>
            {note.type === 'note'
              ? t('noteTypeNote')
              : t('itemsProgress').replace('{done}', String(totals.boughtCount)).replace('{total}', String(totals.totalCount))}
          </small>
        </span>
        {showMoney && (
          <span className="mnote-card-tot">{money(totals.total)}<small>{t('estimatedLabel')}</small></span>
        )}
      </div>
      {note.type !== 'note' && totals.totalCount > 0 && (
        <>
          <div className="mnote-bar"><i style={{ width: `${pct}%`, background: showMoney ? note.color : '#5bc0ff' }} /></div>
          {showMoney && (
            <div className="mnote-card-meta">
              <span>{t('boughtLabel')} {money(totals.bought)}</span>
              <span>{t('remainingLabel')} {money(totals.remaining)}</span>
            </div>
          )}
        </>
      )}
    </button>
  )
}

function TypePicker({ onPick, onClose }: { onPick: (type: NoteType) => void; onClose: () => void }) {
  const t = useT()
  const ref = useDialogA11y<HTMLDivElement>(onClose)
  return (
    <SheetPortal>
      <div ref={ref} className="mobile-detail-sheet" style={{ zIndex: 340 }} role="dialog" aria-modal="true" aria-label={t('newListLabel')} onClick={onClose}>
        <section className="mnote-typepicker" onClick={e => e.stopPropagation()}>
          <header>
            <span>{t('newListLabel')}</span>
            <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
          </header>
          <div className="mnote-type-list">
            {(['shopping', 'checklist', 'note'] as NoteType[]).map(type => {
              const m = TYPE_META[type]
              return (
                <button key={type} className="mnote-type-row" onClick={() => onPick(type)}>
                  <span className="mnote-chip" style={{ background: `color-mix(in oklab, ${m.color} 16%, transparent)`, color: m.color }}>
                    <Icon name={m.icon} size={20} />
                  </span>
                  <span className="mnote-type-text">
                    <b>{t(m.key)}</b>
                    <small>{t(m.descKey)}</small>
                  </span>
                  <Icon name="arrowUp" size={13} className="mnote-chevron" />
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </SheetPortal>
  )
}

function NoteDetail({ note, money, spent, onClose }: {
  note: Note
  money: (n: number) => string
  spent: number
  onClose: () => void
}) {
  const t = useT()
  const finance = useFinance()
  const { confirm } = useDialogs()
  const { updateNote, deleteNote, restoreNote, duplicateNote, addItem, updateItem, toggleItem, removeItem } = useNotes.getState()
  const [newText, setNewText] = useState('')
  const addItemRef = useRef<HTMLInputElement>(null)
  const [editingItem, setEditingItem] = useState<NoteItem | null>(null)
  const [picker, setPicker] = useState<'category' | 'account' | 'goal' | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  // El back-dismiss del detalle lo gobierna MobileNotes (padre estable). Aquí
  // solo Escape + bloqueo de scroll y el cierre por toque fuera (backdrop
  // onClick). autoFocus=false: escribir es OPCIONAL en una lista, así que no
  // robamos el foco al título (abría el teclado solo al entrar y cada vez que
  // volvías de un sub-sheet).
  const ref = useDialogA11y<HTMLDivElement>(onClose, !editingItem && !picker, false)

  const totals = noteTotals(note)
  const isShopping = note.type === 'shopping'
  const isNote = note.type === 'note'
  const category = finance.categories.find(c => c.id === note.categoryId)
  const account = finance.accounts.find(a => a.id === note.accountId)
  // Meta enlazada: una lista con precios es una meta de compra. El total de la
  // lista es el objetivo; el ahorro de la meta dice cuánto falta para poder
  // comprarla completa.
  const goal = note.goalId ? finance.goals.find(g => g.id === note.goalId) : undefined
  const goalRemaining = goal ? Math.max(0, totals.total - goal.saved) : 0
  const goalPct = goal && totals.total > 0 ? Math.min(100, Math.round((goal.saved / totals.total) * 100)) : 0

  const duplicate = () => {
    const id = duplicateNote(note.id)
    if (id) { onClose(); toast(t('listDuplicatedToast'), { icon: 'check', type: 'ok' }) }
  }
  const toggleArchive = () => {
    updateNote(note.id, { archived: !note.archived })
    onClose()
    toast(note.archived ? t('listUnarchivedToast') : t('listArchivedToast'), { icon: 'check', type: 'ok' })
  }

  // Aviso de presupuesto: lo que falta por comprar + lo ya gastado en la categoría
  // este mes supera su límite.
  const remainingBudget = category && category.budget > 0 ? category.budget - spent : null
  const overBudget = remainingBudget != null && totals.remaining > remainingBudget
  const overBy = overBudget ? totals.remaining - remainingBudget : 0

  const addNewItem = () => {
    const text = newText.trim()
    if (!text) return
    addItem(note.id, { text })
    setNewText('')
    // Mantener el foco en el campo para escribir el siguiente ítem sin tener
    // que volver a tocarlo — clave para armar una lista rápido.
    addItemRef.current?.focus()
  }

  const registerExpense = async () => {
    const amount = totals.bought > 0 ? totals.bought : totals.total
    if (amount <= 0) { toast(t('noteAddPricesFirst'), { icon: 'alert' }); return }
    if (!note.accountId) { setPicker('account'); toast(t('notePickAccountFirst'), { icon: 'alert' }); return }
    const ok = await confirm({
      title: t('registerExpenseLabel'),
      description: t('registerExpenseConfirm')
        .replace('{amount}', money(amount))
        .replace('{account}', account?.name ?? '')
        .replace('{category}', category ? category.name : t('noCategoryLabel')),
      confirmLabel: t('registerExpenseLabel'),
      icon: 'check',
    })
    if (!ok) return
    finance.addTx({
      type: 'expense',
      amount,
      date: localToday(),
      note: note.title || t('untitledList'),
      accountId: note.accountId,
      categoryId: note.categoryId,
    })
    toast(t('expenseRegisteredToast').replace('{amount}', money(amount)), { icon: 'check', type: 'ok' })
  }

  const share = async () => {
    const text = noteShareText(note, money, { withPrices: isShopping })
    const shared = await shareText(text, note.title || t('untitledList'))
    if (shared) return
    try {
      await navigator.clipboard?.writeText(text)
      toast(t('listCopiedToast'), { icon: 'check', type: 'ok' })
    } catch {
      toast(t('couldNotShare'), { icon: 'alert' })
    }
  }

  return (
    <SheetPortal>
      <div ref={ref} className="mobile-detail-sheet mnote-detail-wrap" style={{ zIndex: 320 }} role="dialog" aria-modal="true" aria-label={note.title || t('untitledList')} onClick={onClose}>
        <section className="mnote-detail" onClick={e => e.stopPropagation()}>
          <header>
            <input
              className="mnote-title-input"
              value={note.title}
              placeholder={t('listTitlePlaceholder')}
              onChange={e => updateNote(note.id, { title: e.target.value })}
            />
            <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
          </header>

          <div className="mnote-detail-body">
            {isNote ? (
              <textarea
                className="mnote-textarea"
                value={note.body ?? ''}
                placeholder={t('noteBodyPlaceholder')}
                onChange={e => updateNote(note.id, { body: e.target.value })}
              />
            ) : (
              <>
                <div className="mnote-items">
                  {note.items.length === 0 && <p className="mnote-items-empty">{t('noItemsYet')}</p>}
                  {orderedItems(note.items).map(item => {
                    const priceLabel = isShopping ? itemPriceLabel(item, money) : null
                    return (
                      <div key={item.id} className={`mnote-item${item.done ? ' done' : ''}`}>
                        <button className={`mnote-cbox${item.done ? ' on' : ''}`} aria-label={t('toggleDone')} onClick={() => toggleItem(note.id, item.id)}>
                          {item.done && <Icon name="check" size={13} />}
                        </button>
                        <button className="mnote-item-text" onClick={() => setEditingItem(item)}>
                          <span className="mnote-item-name">
                            {item.important && !item.done && <Icon name="star" size={12} className="mnote-item-star" />}
                            {item.text}
                          </span>
                          {priceLabel && <span className="mnote-item-price">{priceLabel}</span>}
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div className="mnote-additem">
                  <input
                    ref={addItemRef}
                    value={newText}
                    placeholder={t('addItemPlaceholder')}
                    enterKeyHint="done"
                    onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewItem() } }}
                  />
                  <button aria-label={t('add')} disabled={!newText.trim()} onClick={addNewItem}><Icon name="plus" size={18} /></button>
                </div>

                {isShopping && totals.pricedCount > 0 && (
                  <div className="mnote-totbar">
                    <div className="mnote-totrow"><span>{t('boughtLabel')} ({totals.boughtCount})</span><b style={{ color: '#35d0a2' }}>{money(totals.bought)}</b></div>
                    <div className="mnote-totrow"><span>{t('remainingLabel')} ({totals.totalCount - totals.boughtCount})</span><b style={{ color: 'var(--m-muted)' }}>{money(totals.remaining)}</b></div>
                    <div className="mnote-totrow big"><span>{t('estimatedTotalLabel')}</span><b>{money(totals.total)}</b></div>
                  </div>
                )}

                {overBudget && (
                  <div className="mnote-warn">
                    <Icon name="alert" size={16} />
                    <span>{t('overBudgetWarn').replace('{amount}', money(overBy)).replace('{category}', category?.name ?? '')}</span>
                  </div>
                )}

                {/* Meta enlazada: progreso de ahorro contra el total de la lista */}
                {goal && totals.total > 0 && (
                  <div className="mnote-goal">
                    <div className="mnote-goal-head">
                      <span className="mnote-chip" style={{ background: `color-mix(in oklab, ${goal.color} 16%, transparent)`, color: goal.color }}>
                        <Icon name="target" size={16} />
                      </span>
                      <span className="mnote-goal-title"><b>{goal.name}</b><small>{t('goalLinkedLabel')}</small></span>
                      <button className="mnote-goal-unlink" aria-label={t('unlinkGoalLabel')} onClick={() => updateNote(note.id, { goalId: undefined })}>
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                    <div className="mnote-goal-bar"><i style={{ width: `${goalPct}%` }} /></div>
                    <div className="mnote-goal-meta">
                      <span>{t('savedOfTotal').replace('{saved}', money(goal.saved)).replace('{total}', money(totals.total))}</span>
                      <span>{goalPct}%</span>
                    </div>
                    <p className="mnote-goal-hint">
                      {goalRemaining > 0
                        ? t('goalRemainingHint').replace('{amount}', money(goalRemaining))
                        : t('goalReachedHint')}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Configuración: categoría, cuenta y meta (para registrar el gasto,
                avisar del presupuesto y ver el progreso de ahorro) */}
            {isShopping && (
              <div className="mnote-config">
                <button className="mnote-config-row" onClick={() => setPicker('category')}>
                  <span className="mnote-config-k"><Icon name="tag" size={14} /> {t('categoryLabel')}</span>
                  <span className="mnote-config-v">{category ? category.name : t('chooseLabel')} <Icon name="arrowUp" size={11} className="mnote-chevron" /></span>
                </button>
                <button className="mnote-config-row" onClick={() => setPicker('account')}>
                  <span className="mnote-config-k"><Icon name="wallet" size={14} /> {t('accountLabel')}</span>
                  <span className="mnote-config-v">{account ? account.name : t('chooseLabel')} <Icon name="arrowUp" size={11} className="mnote-chevron" /></span>
                </button>
                <button className="mnote-config-row" onClick={() => setPicker('goal')}>
                  <span className="mnote-config-k"><Icon name="target" size={14} /> {t('goalLabel')}</span>
                  <span className="mnote-config-v">{goal ? goal.name : t('chooseLabel')} <Icon name="arrowUp" size={11} className="mnote-chevron" /></span>
                </button>
              </div>
            )}
          </div>

          <div className="mnote-actions">
            {isShopping && (
              <button className="mnote-btn-primary" onClick={() => void registerExpense()}>
                <Icon name="check" size={16} /> {totals.pricedCount > 0
                  ? t('registerExpenseAmount').replace('{amount}', money(totals.bought > 0 ? totals.bought : totals.total))
                  : t('registerExpenseLabel')}
              </button>
            )}
            {!isNote && (
              <button className="mnote-btn-ghost" onClick={() => void share()}>
                <Icon name="share" size={16} /> {t('shareLabel')}
              </button>
            )}
            {isNote && (
              <button className="mnote-btn-ghost" style={{ flex: 1 }} onClick={() => void share()}>
                <Icon name="share" size={16} /> {t('shareLabel')}
              </button>
            )}
          </div>

          <div className="mnote-secondary-actions">
            <button onClick={duplicate}><Icon name="repeat" size={14} /> {t('duplicateLabel')}</button>
            <button onClick={toggleArchive}>
              <Icon name={note.archived ? 'eye' : 'eyeOff'} size={14} /> {note.archived ? t('unarchiveLabel') : t('archiveLabel')}
            </button>
          </div>

          {!confirmDel ? (
            <button className="mnote-delete" onClick={() => setConfirmDel(true)}>
              <Icon name="trash" size={15} /> {t('deleteListLabel')}
            </button>
          ) : (
            <div className="mnote-confirm-del">
              <span>{t('deleteListConfirm')}</span>
              <div>
                <button onClick={() => setConfirmDel(false)}>{t('cancel')}</button>
                <button className="danger" onClick={() => {
                  deleteWithUndo({
                    message: t('listDeleted'),
                    onDelete: () => deleteNote(note.id),
                    onRestore: () => restoreNote(note),
                  })
                  onClose()
                }}>{t('delete')}</button>
              </div>
            </div>
          )}
        </section>
      </div>

      {editingItem && (
        <ItemEditor
          item={editingItem}
          shopping={isShopping}
          currency={finance.currency}
          onSave={patch => { updateItem(note.id, editingItem.id, patch); setEditingItem(null) }}
          onDelete={() => { removeItem(note.id, editingItem.id); setEditingItem(null) }}
          onClose={() => setEditingItem(null)}
        />
      )}

      {picker && (
        <PickerSheet
          title={picker === 'category' ? t('categoryLabel') : picker === 'account' ? t('accountLabel') : t('goalLabel')}
          options={picker === 'category'
            ? finance.categories.filter(c => c.type === 'expense').map(c => ({ id: c.id, name: c.name, color: c.color, icon: c.icon }))
            : picker === 'account'
              ? finance.accounts.map(a => ({ id: a.id, name: a.name, color: a.color, icon: acctIcon(a) }))
              : finance.goals.map(g => ({ id: g.id, name: g.name, color: g.color, icon: g.icon }))}
          selectedId={picker === 'category' ? note.categoryId : picker === 'account' ? note.accountId : note.goalId}
          emptyLabel={picker === 'goal' ? t('noGoalsYet') : undefined}
          onPick={id => {
            updateNote(note.id, picker === 'category' ? { categoryId: id } : picker === 'account' ? { accountId: id } : { goalId: id })
            setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </SheetPortal>
  )
}

function acctIcon(a: Account): IconName {
  return a.type === 'cash' ? 'wallet' : a.type === 'savings' ? 'piggy' : 'cards'
}

function ItemEditor({ item, shopping, currency, onSave, onDelete, onClose }: {
  item: NoteItem
  shopping: boolean
  currency: string
  onSave: (patch: Partial<Omit<NoteItem, 'id'>>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const t = useT()
  const [text, setText] = useState(item.text)
  const [price, setPrice] = useState<number | undefined>(item.price)
  const [qty, setQty] = useState(item.qty && item.qty > 0 ? item.qty : 1)
  const [important, setImportant] = useState(!!item.important)
  const [amountSheet, setAmountSheet] = useState(false)
  const fmtVal = useFmt()
  const ref = useDialogA11y<HTMLDivElement>(onClose, !amountSheet)
  useMobileBackDismiss(!amountSheet, onClose)
  useMobileBackDismiss(amountSheet, () => setAmountSheet(false))

  const save = () => {
    if (!text.trim()) { onClose(); return }
    onSave({ text: text.trim(), price, qty: qty > 1 ? qty : undefined, done: item.done, important: important || undefined })
  }

  return (
    <>
      <SheetPortal>
        <div ref={ref} className="mobile-detail-sheet" style={{ zIndex: 440 }} role="dialog" aria-modal="true" aria-label={t('editItemLabel')} onClick={onClose}>
          <section className="mnote-itemeditor" onClick={e => e.stopPropagation()}>
            <header>
              <span>{t('editItemLabel')}</span>
              <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
            </header>
            <div className="mnote-itemeditor-body">
              <input className="mnote-input" value={text} placeholder={t('itemNamePlaceholder')} autoFocus onChange={e => setText(e.target.value)} />
              {shopping && (
                <div className="mnote-price-row">
                  <button className="mnote-price-btn" onClick={() => setAmountSheet(true)}>
                    <span>{t('priceLabel')}</span>
                    <b>{price != null ? fmtVal(price, currency) : t('optionalLabel')}</b>
                  </button>
                  <div className="mnote-qty">
                    <span>{t('qtyLabel')}</span>
                    <div className="mnote-qty-stepper">
                      <button aria-label="-" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                      <b>{qty}</b>
                      <button aria-label="+" onClick={() => setQty(q => q + 1)}>+</button>
                    </div>
                  </div>
                </div>
              )}
              {shopping && price != null && qty > 1 && (
                <p className="mnote-line-hint">{qty} × {fmtVal(price, currency)} = <b>{fmtVal(itemLineTotal({ ...item, price, qty }), currency)}</b></p>
              )}
              <button className={`mnote-important-toggle${important ? ' on' : ''}`} onClick={() => setImportant(v => !v)}>
                <Icon name="star" size={16} />
                <span>{t('importantLabel')}</span>
                <span className={`mnote-important-check${important ? ' on' : ''}`}>{important && <Icon name="check" size={12} />}</span>
              </button>
            </div>
            <div className="mnote-itemeditor-actions">
              <button className="mnote-item-del" onClick={onDelete}><Icon name="trash" size={15} /> {t('delete')}</button>
              <button className="mnote-item-save" onClick={save}>{t('save')}</button>
            </div>
          </section>
        </div>
      </SheetPortal>
      {amountSheet && (
        <MobileAmountSheet
          title={t('priceLabel')}
          value={price ?? 0}
          currency={currency}
          onDone={v => { setPrice(v > 0 ? v : undefined); setAmountSheet(false) }}
          onClose={() => setAmountSheet(false)}
        />
      )}
    </>
  )
}

interface PickOption { id: string; name: string; color: string; icon: IconName }
function PickerSheet({ title, options, selectedId, emptyLabel, onPick, onClose }: {
  title: string
  options: PickOption[]
  selectedId?: string
  emptyLabel?: string
  onPick: (id: string) => void
  onClose: () => void
}) {
  const t = useT()
  const ref = useDialogA11y<HTMLDivElement>(onClose)
  useMobileBackDismiss(true, onClose)
  return (
    <SheetPortal>
      <div ref={ref} className="mobile-detail-sheet" style={{ zIndex: 440 }} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
        <section className="mnote-picker" onClick={e => e.stopPropagation()}>
          <header>
            <span>{title}</span>
            <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
          </header>
          <div className="mnote-picker-list">
            {options.length === 0 && <p className="mnote-items-empty">{emptyLabel ?? t('noOptionsYet')}</p>}
            {options.map(o => (
              <button key={o.id} className={`mnote-picker-row${selectedId === o.id ? ' on' : ''}`} onClick={() => onPick(o.id)}>
                <span className="mnote-chip" style={{ background: `color-mix(in oklab, ${o.color} 16%, transparent)`, color: o.color }}>
                  <Icon name={o.icon} size={18} />
                </span>
                <b>{o.name}</b>
                {selectedId === o.id && <Icon name="check" size={16} style={{ color: 'var(--accent, #35d0a2)' }} />}
              </button>
            ))}
          </div>
        </section>
      </div>
    </SheetPortal>
  )
}
