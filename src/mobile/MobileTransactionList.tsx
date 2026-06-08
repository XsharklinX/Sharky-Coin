import { useMemo, useRef, useState } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { CatBadge } from '@/views/shared'
import { fmt, fmtCompact, getAccount, getCategory } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useFmt } from '@/hooks/useFmt'
import type { Transaction } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'

type TxFilter = 'all' | 'expense' | 'income' | 'transfer'

const FILTERS: Array<{ id: TxFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'expense', label: 'Gastos' },
  { id: 'income', label: 'Ingresos' },
  { id: 'transfer', label: 'Transferencias' },
]

function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    weekday: 'long',
  })
}

function signedAmount(tx: Transaction, currency: Parameters<typeof fmt>[1], compact: boolean): string {
  const f = (n: number) => compact ? fmtCompact(n, currency) : fmt(n, currency)
  if (tx.type === 'income') return `+${f(tx.amount)}`
  if (tx.type === 'expense') return `-${f(tx.amount)}`
  return f(tx.amount)
}

export function MobileTransactionList({
  transactions,
  onEdit,
  onDelete,
  compact = false,
}: {
  transactions: Transaction[]
  onEdit: (transaction: Transaction) => void
  onDelete?: (id: string) => void
  compact?: boolean
}) {
  const { accounts, categories, currency } = useFinance()
  const fmtVal = useFmt()
  const compactNumbers = useSettings(s => s.compactNumbers)
  const [filter, setFilter] = useState<TxFilter>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const startX = useRef(0)
  useMobileBackDismiss(searchOpen, () => setSearchOpen(false))
  useMobileBackDismiss(!!selected, () => setSelected(null))

  const closeSwipe = () => {
    setOpenActionId(null)
    setPendingDeleteId(null)
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions
      .filter(tx => filter === 'all' || tx.type === filter)
      .filter(tx => {
        if (!q) return true
        const category = getCategory(tx.categoryId, categories)?.name ?? ''
        const account = getAccount(tx.accountId, accounts)?.name ?? ''
        return `${tx.note} ${category} ${account}`.toLowerCase().includes(q)
      })
  }, [accounts, categories, filter, query, transactions])

  const grouped = rows.reduce<Record<string, Transaction[]>>((acc, tx) => {
    ;(acc[tx.date] ??= []).push(tx)
    return acc
  }, {})

  const showSearch = !compact

  return (
    <section
      className={`mobile-list-card${compact ? ' compact' : ''}`}
      onClick={openActionId ? closeSwipe : undefined}
    >
      {!compact && (
        <div className="mobile-movement-tools">
          <div className="mobile-filter-chips" role="tablist" aria-label="Filtrar movimientos">
            {FILTERS.map(item => (
              <button
                key={item.id}
                className={filter === item.id ? 'on' : ''}
                aria-selected={filter === item.id}
                role="tab"
                onClick={() => setFilter(item.id)}>
                {item.label}
              </button>
            ))}
            {showSearch && (
              <button className="mobile-search-chip" onClick={() => setSearchOpen(true)}>
                <Icon name="search" size={16} />
                Buscar
              </button>
            )}
          </div>
        </div>
      )}

      {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, dayRows]) => {
        const dayExpense = dayRows.reduce((sum, tx) => sum + (tx.type === 'expense' ? tx.amount : 0), 0)
        const dayIncome = dayRows.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : 0), 0)
        return (
          <div className="mobile-day-group" key={date}>
            <div className="mobile-day-header">
              <span>{dateLabel(date)}</span>
              <span className="mobile-day-totals">
                {dayExpense > 0 && <span className="day-exp">−{fmtVal(dayExpense, currency)}</span>}
                {dayIncome > 0 && <span className="day-inc">+{fmtVal(dayIncome, currency)}</span>}
              </span>
            </div>
            {dayRows.map(tx => {
              const category = getCategory(tx.categoryId, categories)
              const account = getAccount(tx.accountId, accounts)
              const income = tx.type === 'income'
              const opened = openActionId === tx.id
              return (
                <div
                  className={`mobile-tx-swipe${opened ? ' open' : ''}`}
                  key={tx.id}
                  onTouchStart={event => { startX.current = event.touches[0]?.clientX ?? 0 }}
                  onTouchEnd={event => {
                    const delta = (event.changedTouches[0]?.clientX ?? 0) - startX.current
                    if (delta < -42) { setOpenActionId(tx.id); setPendingDeleteId(null) }
                    if (delta > 42) closeSwipe()
                  }}
                  onClick={opened ? (event => { event.stopPropagation(); closeSwipe() }) : undefined}
                >
                  <button className="mobile-tx-row" onClick={() => setSelected(tx)}>
                    {tx.type === 'transfer'
                      ? <span className="mobile-transfer-icon"><Icon name="repeat" size={24} /></span>
                      : <CatBadge category={category} size={40} />}
                    <span>
                      <b>
                        {tx.type === 'transfer' ? 'Transferencia' : tx.note}
                        {tx.recurring && <i className="mobile-recur-dot" title="Recurrente"><Icon name="repeat" size={11} /></i>}
                      </b>
                      <small>{tx.type === 'transfer'
                        ? `${getAccount(tx.fromAccount, accounts)?.name ?? 'Origen'} → ${getAccount(tx.toAccount, accounts)?.name ?? 'Destino'}`
                        : `${category?.name ?? 'Sin categoría'} · ${account?.name ?? 'Sin cuenta'}`}</small>
                    </span>
                    <strong className={income ? 'income' : tx.type === 'transfer' ? 'transfer' : ''}>
                      {signedAmount(tx, currency, compactNumbers)}
                    </strong>
                  </button>
                  {!compact && (
                    <div className="mobile-row-actions" aria-label="Acciones del movimiento" onClick={event => event.stopPropagation()}>
                      <button onClick={() => { onEdit(tx); closeSwipe() }}><Icon name="edit" size={17} />Editar</button>
                      {onDelete && (
                        <button
                          className={`danger${pendingDeleteId === tx.id ? ' confirm' : ''}`}
                          onClick={() => {
                            if (pendingDeleteId === tx.id) {
                              navigator.vibrate?.([12, 40, 24])
                              onDelete(tx.id)
                              closeSwipe()
                            } else {
                              navigator.vibrate?.(8)
                              setPendingDeleteId(tx.id)
                            }
                          }}>
                          <Icon name="trash" size={17} />
                          {pendingDeleteId === tx.id ? '¿Seguro?' : 'Eliminar'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {rows.length === 0 && (
        <div className="mobile-empty-list">
          <BrandMark size={48} />
          <strong>Sin movimientos</strong>
          <span>Prueba otro filtro o registra un nuevo movimiento.</span>
        </div>
      )}

      {searchOpen && (
        <div className="mobile-search-overlay" role="dialog" aria-modal="true" aria-label="Buscar movimientos">
          <div className="mobile-search-head">
            <button onClick={() => setSearchOpen(false)}>Cancelar</button>
            <strong>Buscar</strong>
            <span />
          </div>
          <label className="mobile-search-input">
            <Icon name="search" size={18} />
            <input value={query} placeholder="Nota, categoría o cuenta" onChange={event => setQuery(event.target.value)} />
          </label>
          <MobileTransactionList transactions={rows} onEdit={onEdit} onDelete={onDelete} compact />
        </div>
      )}

      {selected && (
        <div className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <section onClick={event => event.stopPropagation()}>
            <header>
              <span className="sheet-icon">{selected.type === 'transfer' ? <Icon name="repeat" size={28} /> : <CatBadge category={getCategory(selected.categoryId, categories)} size={56} />}</span>
              <button onClick={() => setSelected(null)}><Icon name="close" size={18} /></button>
            </header>
            <h2>{selected.type === 'transfer' ? 'Transferencia' : selected.note}</h2>
            <strong className={selected.type === 'income' ? 'income' : ''}>{signedAmount(selected, currency, compactNumbers)}</strong>
            <dl>
              <div><dt>Fecha</dt><dd>{dateLabel(selected.date)}</dd></div>
              <div><dt>Categoría</dt><dd>{getCategory(selected.categoryId, categories)?.name ?? 'No aplica'}</dd></div>
              <div><dt>Cuenta</dt><dd>{selected.type === 'transfer'
                ? `${getAccount(selected.fromAccount, accounts)?.name ?? 'Origen'} -> ${getAccount(selected.toAccount, accounts)?.name ?? 'Destino'}`
                : getAccount(selected.accountId, accounts)?.name ?? 'Sin cuenta'}</dd></div>
              <div><dt>Monto exacto</dt><dd>{fmt(selected.amount, currency)}</dd></div>
            </dl>
            <div className="mobile-detail-actions">
              <button onClick={() => { onEdit(selected); setSelected(null) }}><Icon name="edit" size={18} />Editar</button>
              {onDelete && <button className="danger" onClick={() => { navigator.vibrate?.([12, 40, 24]); onDelete(selected.id); setSelected(null) }}><Icon name="trash" size={18} />Eliminar</button>}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
