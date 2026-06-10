import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { CatBadge } from '@/views/shared'
import { dateLocale, fmt, fmtCompact, getAccount, getCategory } from '@/data/helpers'
import { useDialogs } from '@/components/ui/DialogProvider'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useFmt } from '@/hooks/useFmt'
import type { Transaction } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'

type TxFilter = 'all' | 'expense' | 'income' | 'transfer'

type ListItem =
  | { kind: 'header'; date: string; dayExpense: number; dayIncome: number }
  | { kind: 'tx'; tx: Transaction }

const HEADER_ESTIMATE = 32
const ROW_ESTIMATE = 60

const FILTERS: Array<{ id: TxFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'expense', label: 'Gastos' },
  { id: 'income', label: 'Ingresos' },
  { id: 'transfer', label: 'Transferencias' },
]

function dateLabel(date: string, locale: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale, {
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

// Encuentra el ancestro con scroll propio (o el del documento si no hay ninguno)
function findScrollParent(el: HTMLElement): HTMLElement {
  let node = el.parentElement
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return node
    node = node.parentElement
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
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
  const { confirm } = useDialogs()
  const fmtVal = useFmt()
  const settings = useSettings()
  const { compactNumbers } = settings
  const locale = dateLocale(settings.language)
  const [filter, setFilter] = useState<TxFilter>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const containerRef = useRef<HTMLElement>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const startX = useRef(0)
  useMobileBackDismiss(searchOpen, () => setSearchOpen(false))
  useMobileBackDismiss(!!selected, () => setSelected(null))

  const closeSwipe = () => { setOpenActionId(null) }

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

  // Aplanar las filas agrupadas por día en una lista plana para virtualización
  const items = useMemo<ListItem[]>(() => {
    const groups = new Map<string, Transaction[]>()
    for (const tx of rows) {
      const existing = groups.get(tx.date)
      if (existing) existing.push(tx)
      else groups.set(tx.date, [tx])
    }
    const dates = [...groups.keys()].sort((a, b) => b.localeCompare(a))
    const out: ListItem[] = []
    for (const date of dates) {
      const dayRows = groups.get(date)!
      const dayExpense = dayRows.reduce((sum, tx) => sum + (tx.type === 'expense' ? tx.amount : 0), 0)
      const dayIncome = dayRows.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : 0), 0)
      out.push({ kind: 'header', date, dayExpense, dayIncome })
      for (const tx of dayRows) out.push({ kind: 'tx', tx })
    }
    return out
  }, [rows])

  // Localizar el contenedor con scroll y calcular el desplazamiento de esta lista dentro de él
  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return
    const scrollEl = findScrollParent(root)
    setScrollElement(scrollEl)

    let contentEl: HTMLElement = root
    while (contentEl.parentElement && contentEl.parentElement !== scrollEl) contentEl = contentEl.parentElement

    const recompute = () => {
      const rootRect = root.getBoundingClientRect()
      const scrollRect = scrollEl.getBoundingClientRect()
      const next = rootRect.top - scrollRect.top + scrollEl.scrollTop
      setScrollMargin(prev => Math.abs(next - prev) > 1 ? next : prev)
    }
    recompute()

    const observer = new ResizeObserver(() => requestAnimationFrame(recompute))
    observer.observe(contentEl)
    window.addEventListener('resize', recompute)
    return () => { observer.disconnect(); window.removeEventListener('resize', recompute) }
  }, [])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize: index => items[index]?.kind === 'header' ? HEADER_ESTIMATE : ROW_ESTIMATE,
    overscan: 6,
    scrollMargin,
  })

  const showSearch = !compact

  const renderTxRow = (tx: Transaction) => {
    const category = getCategory(tx.categoryId, categories)
    const account = getAccount(tx.accountId, accounts)
    const income = tx.type === 'income'
    const opened = openActionId === tx.id
    return (
      <div
        className={`mobile-tx-swipe${opened ? ' open' : ''}`}
        onTouchStart={event => { startX.current = event.touches[0]?.clientX ?? 0 }}
        onTouchEnd={event => {
          const delta = (event.changedTouches[0]?.clientX ?? 0) - startX.current
          if (delta < -42) { setOpenActionId(tx.id) }
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
                className="danger"
                onClick={() => {
                  const label = tx.note || (tx.type === 'transfer' ? 'Transferencia' : 'Movimiento')
                  void confirm({ title: `¿Eliminar "${label}"?`, description: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', icon: 'trash' }).then(ok => {
                    if (ok) { navigator.vibrate?.([12, 40, 24]); onDelete(tx.id); closeSwipe() }
                  })
                }}>
                <Icon name="trash" size={17} />
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderDayHeader = (date: string, dayExpense: number, dayIncome: number) => (
    <div className="mobile-day-header">
      <span>{dateLabel(date, locale)}</span>
      <span className="mobile-day-totals">
        {dayExpense > 0 && <span className="day-exp">−{fmtVal(dayExpense, currency)}</span>}
        {dayIncome > 0 && <span className="day-inc">+{fmtVal(dayIncome, currency)}</span>}
      </span>
    </div>
  )

  return (
    <section
      ref={containerRef}
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

      {rows.length === 0 ? (
        <div className="mobile-empty-list">
          <BrandMark size={48} />
          <strong>Sin movimientos</strong>
          <span>Prueba otro filtro o registra un nuevo movimiento.</span>
        </div>
      ) : (
        <div style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map(virtualItem => {
            const item = items[virtualItem.index]
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${virtualItem.start - scrollMargin}px)`,
                }}
              >
                {item.kind === 'header'
                  ? renderDayHeader(item.date, item.dayExpense, item.dayIncome)
                  : renderTxRow(item.tx)}
              </div>
            )
          })}
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
              <div><dt>Fecha</dt><dd>{dateLabel(selected.date, locale)}</dd></div>
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
