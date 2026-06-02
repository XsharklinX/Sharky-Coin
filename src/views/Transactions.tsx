import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmtCompact, getAccount, getCategory, totals, txForMonth } from '@/data/helpers'
import { BANKS, learnCategoryRule, parseBankCsv, type BankId, type ImportedRow } from '@/data/bankCsv'
import { createBackup, parseBackup } from '@/data/backup'
import { exportExcel, exportMonthlyPdf } from '@/data/professionalExport'
import { useFinance } from '@/store/finance'
import { useAuth } from '@/store/auth'
import type { Transaction, ViewProps } from '@/types'
import { BusyButton, Empty, MiniStat, TxRow } from './shared'

// ── Tipos para la lista virtualizada ────────────────────
type ListItem =
  | { kind: 'header'; date: string; count: number }
  | { kind: 'row';    tx: Transaction }

// ── Componente principal ─────────────────────────────────
export function Transactions({ txns, mkey, onAdd, onEditTx }: ViewProps) {
  const { categories, accounts, currency, importTxs, deleteTx, updateTx, restoreBackup } = useFinance()
  const ownerName   = useAuth(s => s.user?.name ?? 'Usuario')
  const backupRef   = useRef<HTMLInputElement>(null)
  const listRef     = useRef<HTMLDivElement>(null)

  // ── Filtros ──────────────────────────────────────────────
  const [query,     setQuery]     = useState('')
  const [type,      setType]      = useState('all')
  const [cat,       setCat]       = useState('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [busyExport, setBusyExport] = useState<'excel' | 'pdf' | null>(null)

  // ── Selección múltiple ───────────────────────────────────
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [lastSelected, setLastSelected] = useState<string | null>(null)
  const [bulkCat,      setBulkCat]      = useState('')

  // ── Datos filtrados ──────────────────────────────────────
  const monthTx = txForMonth(txns, mkey)
  const filtered = useMemo(() => monthTx.filter(tx => {
    if (type !== 'all' && tx.type !== type) return false
    if (cat  !== 'all' && tx.categoryId !== cat) return false
    if (tagFilter && !(tx.tags ?? []).includes(tagFilter)) return false
    if (query) {
      const hay = `${tx.note} ${getCategory(tx.categoryId, categories)?.name ?? ''}`.toLowerCase()
      if (!hay.includes(query.toLowerCase())) return false
    }
    return true
  }), [monthTx, type, cat, tagFilter, query, categories])

  const t = totals(filtered)

  // Tags disponibles en el mes
  const availableTags = useMemo(() => {
    const s = new Set<string>()
    monthTx.forEach(tx => tx.tags?.forEach(tag => s.add(tag)))
    return Array.from(s).sort()
  }, [monthTx])

  // ── Lista virtualizada (header de fecha + filas) ─────────
  const grouped = useMemo(() => {
    const g: Record<string, Transaction[]> = {}
    filtered.forEach(tx => { (g[tx.date] ??= []).push(tx) })
    return g
  }, [filtered])

  const flatItems = useMemo((): ListItem[] => {
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .flatMap(([date, rows]) => [
        { kind: 'header' as const, date, count: rows.length },
        ...rows.map(tx => ({ kind: 'row' as const, tx })),
      ])
  }, [grouped])

  const virtualizer = useVirtualizer({
    count:           flatItems.length,
    getScrollElement: () => listRef.current,
    estimateSize:    i => flatItems[i].kind === 'header' ? 44 : 56,
    overscan:        8,
  })

  // ── Multi-select ─────────────────────────────────────────
  const toggleRow = (id: string, shift: boolean) => {
    if (shift && lastSelected) {
      const ids  = filtered.map(tx => tx.id)
      const a    = ids.indexOf(lastSelected), b = ids.indexOf(id)
      const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1)
      setSelected(prev => { const n = new Set(prev); range.forEach(r => n.add(r)); return n })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }
    setLastSelected(id)
  }
  const selectAll  = () => setSelected(new Set(filtered.map(t => t.id)))
  const clearSel   = () => { setSelected(new Set()); setLastSelected(null) }

  const bulkDelete = () => {
    if (!window.confirm(`¿Eliminar ${selected.size} movimiento${selected.size > 1 ? 's' : ''}?`)) return
    selected.forEach(id => deleteTx(id))
    toast(`${selected.size} eliminados`, { icon: 'trash' })
    clearSel()
  }

  const bulkRename = (catId: string) => {
    if (!catId) return
    selected.forEach(id => updateTx(id, { categoryId: catId }))
    toast(`${selected.size} recategorizados`, { icon: 'edit', type: 'ok' })
    clearSel()
  }

  // ── Export ───────────────────────────────────────────────
  const exportCSV = (onlySelected = false) => {
    const rows = (onlySelected && selected.size > 0 ? filtered.filter(tx => selected.has(tx.id)) : filtered)
      .map(tx => [
        tx.date,
        tx.type === 'income' ? 'Ingreso' : tx.type === 'expense' ? 'Gasto' : 'Transferencia',
        getCategory(tx.categoryId, categories)?.name ?? '',
        tx.type === 'transfer'
          ? `${getAccount(tx.fromAccount, accounts)?.name} -> ${getAccount(tx.toAccount, accounts)?.name}`
          : getAccount(tx.accountId, accounts)?.name ?? '',
        tx.note,
        (tx.tags ?? []).join(' '),
        tx.amount,
      ])
    const csv = [['Fecha','Tipo','Categoría','Cuenta','Nota','Tags','Monto'], ...rows]
      .map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
    Object.assign(document.createElement('a'), { href: url, download: `sharky-${mkey}${onlySelected ? '-seleccion' : ''}.csv` }).click()
    URL.revokeObjectURL(url)
  }

  const exportBackup = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(createBackup(useFinance.getState()), null, 2)], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: `sharky-backup-${new Date().toISOString().slice(0, 10)}.json` }).click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (file?: File) => {
    if (!file || !window.confirm('Este backup reemplazará todos los datos. ¿Deseas continuar?')) return
    try { restoreBackup(parseBackup(await file.text())); toast('Backup restaurado', { icon: 'download', type: 'ok' }) }
    catch (e) { toast(e instanceof Error ? e.message : 'No se pudo restaurar el backup.', { icon: 'alert' }) }
    finally { if (backupRef.current) backupRef.current.value = '' }
  }

  const runExport = async (kind: 'excel' | 'pdf') => {
    setBusyExport(kind)
    try {
      if (kind === 'excel') await exportExcel(useFinance.getState())
      else await exportMonthlyPdf(useFinance.getState(), mkey, ownerName)
      toast(`${kind === 'excel' ? 'Excel' : 'PDF'} exportado`, { icon: 'download', type: 'ok' })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo exportar el archivo.', { icon: 'alert' })
    } finally {
      setBusyExport(null)
    }
  }

  return (
    <div className="view">
      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input aria-label="Buscar movimiento" value={query}
            onChange={e => setQuery(e.target.value)} placeholder="Buscar…" />
        </div>
        <div className="seg">
          {[['all','Todos'],['expense','Gastos'],['income','Ingresos'],['transfer','Transfers']].map(([v,l]) => (
            <button key={v} className={type === v ? 'on' : ''} onClick={() => setType(v)}>{l}</button>
          ))}
        </div>
        <select aria-label="Categoría" className="select" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="all">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-ghost" onClick={() => setImportOpen(true)}>
            <Icon name="upload" size={14} />Importar CSV
          </button>
          <button className="btn-ghost" onClick={() => exportCSV()}>
            <Icon name="download" size={14} />CSV
          </button>
          <BusyButton className="btn-ghost" busy={busyExport === 'excel'} busyLabel="Excel…"
            onClick={() => runExport('excel')}><Icon name="download" size={14} />Excel</BusyButton>
          <BusyButton className="btn-ghost" busy={busyExport === 'pdf'} busyLabel="PDF…"
            onClick={() => runExport('pdf')}><Icon name="print" size={14} />PDF</BusyButton>
          <button className="btn-ghost" onClick={exportBackup}>
            <Icon name="fileJson" size={14} />Backup
          </button>
          <button className="btn-ghost" onClick={() => backupRef.current?.click()}>
            <Icon name="upload" size={14} />Restaurar
          </button>
          <input ref={backupRef} className="sr-only" type="file" accept=".json"
            aria-label="Restaurar backup" onChange={e => importBackup(e.target.files?.[0])} />
        </div>
        <button className="btn-primary" onClick={onAdd}>
          <Icon name="plus" size={15} />Agregar
        </button>
      </div>

      {/* ── Filtro por tags ── */}
      {availableTags.length > 0 && (
        <div className="tag-filter-row">
          <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>Etiquetas:</span>
          <button className={`tag-filter-chip${tagFilter === null ? ' on' : ''}`}
            onClick={() => setTagFilter(null)}>Todas</button>
          {availableTags.map(tag => (
            <button key={tag} className={`tag-filter-chip${tagFilter === tag ? ' on' : ''}`}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* ── Mini stats ── */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <MiniStat label="Ingresos filtrados"  amount={t.income}  color="var(--income)"  />
        <MiniStat label="Gastos filtrados"    amount={t.expense} color="var(--expense)" />
        <MiniStat label="Balance filtrado"    amount={t.net}     color="var(--accent)"  />
      </div>

      {/* ── Barra de acciones en lote ── */}
      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} seleccionado{selected.size > 1 ? 's' : ''}</span>
          <button className="btn-ghost" onClick={selectAll}>Seleccionar todo ({filtered.length})</button>
          <select className="select" value={bulkCat}
            onChange={e => { setBulkCat(e.target.value); bulkRename(e.target.value) }}
            style={{ fontSize: 12 }}>
            <option value="">Recategorizar…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-ghost" onClick={() => exportCSV(true)}>
            <Icon name="download" size={14} />Exportar selección
          </button>
          <button className="btn-danger" onClick={bulkDelete}>
            <Icon name="trash" size={14} />Eliminar
          </button>
          <button className="icon-btn" onClick={clearSel} title="Cancelar selección">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {/* ── Lista virtualizada ── */}
      <section className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {filtered.length === 0
          ? <Empty icon="list" title="No encontramos movimientos"
              text="Prueba otros filtros o agrega un movimiento para empezar." />
          : (
            <>
              {/* Header de selección */}
              <div className="tx-select-header" style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-dim)', cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={e => e.target.checked ? selectAll() : clearSel()}
                    style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                  {filtered.length} movimientos
                </label>
              </div>

              {/* Lista virtual */}
              <div ref={listRef} style={{ height: Math.min(600, virtualizer.getTotalSize() + 8), overflowY: 'auto' }}>
                <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
                  {virtualizer.getVirtualItems().map(vItem => {
                    const item = flatItems[vItem.index]
                    return (
                      <div key={vItem.key}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%',
                          transform: `translateY(${vItem.start}px)` }}
                        data-index={vItem.index}
                        ref={virtualizer.measureElement}>
                        {item.kind === 'header'
                          ? <DateHeader date={item.date} count={item.count} />
                          : <SelectableTxRow
                              tx={item.tx}
                              isSelected={selected.has(item.tx.id)}
                              onToggle={(shift) => toggleRow(item.tx.id, shift)}
                              onEdit={() => onEditTx(item.tx)}
                            />
                        }
                      </div>
                    )
                  })}
                </div>
              </div>

              <footer className="tx-footer">
                {filtered.length} movimientos · {fmtCompact(t.net, currency)} netos
                {selected.size > 0 && ` · ${selected.size} seleccionados`}
              </footer>
            </>
          )
        }
      </section>

      {/* ── Modal CSV ── */}
      {importOpen && (
        <CsvImportModal onClose={() => setImportOpen(false)}
          onConfirm={(rows, accountId) => {
            const importable = rows.filter(r => !r.duplicate)
            try {
              importTxs(importable.map(r => ({ type: r.type, amount: r.amount, date: r.date, note: r.note, categoryId: r.categoryId, accountId })))
              rows.filter(r => r.categoryId).forEach(r => learnCategoryRule(r.note, r.categoryId!))
              toast(`${importable.length} movimientos importados`, { icon: 'download', type: 'ok' })
              setImportOpen(false)
            } catch (error) {
              toast(error instanceof Error ? error.message : 'No se pudieron importar los movimientos.', { icon: 'alert' })
            }
          }} />
      )}
    </div>
  )
}

// ── Fila seleccionable ───────────────────────────────────
function SelectableTxRow({ tx, isSelected, onToggle, onEdit }: {
  tx:         Transaction
  isSelected: boolean
  onToggle:   (shift: boolean) => void
  onEdit:     () => void
}) {
  return (
    <div className={`tx-select-wrap${isSelected ? ' selected' : ''}`}>
      <label className="tx-checkbox" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={isSelected}
          style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
          onChange={e => onToggle((e.nativeEvent as MouseEvent).shiftKey)} />
      </label>
      <div style={{ flex: 1, minWidth: 0 }}>
        <TxRow tx={tx} onClick={onEdit} />
        {tx.tags && tx.tags.length > 0 && (
          <div className="tx-tags">
            {tx.tags.map(tag => <span key={tag} className="tag-chip mini">#{tag}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Header de fecha ──────────────────────────────────────
function DateHeader({ date, count }: { date: string; count: number }) {
  const dt = new Date(`${date}T00:00:00`)
  return (
    <div className="tx-date-header">
      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
        {dt.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
      <span>{count}</span>
    </div>
  )
}

// ── Modal de importación CSV ─────────────────────────────
function CsvImportModal({ onClose, onConfirm }: {
  onClose:   () => void
  onConfirm: (rows: ImportedRow[], accountId: string) => void
}) {
  const { accounts, categories, transactions, currency } = useFinance()
  const [bank,      setBank]      = useState<BankId>('auto')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [rows,      setRows]      = useState<ImportedRow[]>([])
  const [error,     setError]     = useState('')
  const [reading,   setReading]   = useState(false)

  const readFile = async (file?: File) => {
    if (!file) return
    setReading(true)
    try { setRows(parseBankCsv(await file.text(), transactions, categories, bank)); setError('') }
    catch (e) { setRows([]); setError(e instanceof Error ? e.message : 'No pudimos leer el archivo.') }
    finally { setReading(false) }
  }

  const importable = rows.filter(r => !r.duplicate)

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <section className="modal csv-modal" role="dialog" aria-modal="true"
        aria-labelledby="csv-title" onMouseDown={e => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2 id="csv-title">Importar CSV bancario</h2>
            <p className="card-copy">Revisa los movimientos antes de agregarlos.</p>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="field-row">
          <div className="field">
            <label htmlFor="csv-bank">Formato</label>
            <select id="csv-bank" className="select" value={bank} onChange={e => setBank(e.target.value as BankId)}>
              <option value="auto">Detectar automáticamente</option>
              {Object.entries(BANKS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="csv-account">Cuenta destino</label>
            <select id="csv-account" className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="csv-file">Archivo CSV</label>
          <input id="csv-file" className="select" type="file" accept=".csv,text/csv"
            onChange={e => readFile(e.target.files?.[0])} />
        </div>
        {reading && <div className="inline-loading" role="status"><span className="spinner" /> Leyendo y detectando columnas…</div>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {rows.length > 0 && (
          <>
            <div className="csv-summary">
              <b>{importable.length}</b> listos · <b>{rows.length - importable.length}</b> duplicados omitidos
            </div>
            <div className="csv-preview">
              <table>
                <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th><th>Estado</th></tr></thead>
                <tbody>
                  {rows.slice(0, 12).map((r, i) => (
                    <tr key={`${r.date}-${i}`}>
                      <td>{r.date}</td><td>{r.note}</td>
                      <td>{categories.find(c => c.id === r.categoryId)?.name ?? '—'}</td>
                      <td className={r.type}>{r.type === 'expense' ? '−' : '+'}{fmtCompact(r.amount, currency)}</td>
                      <td>{r.duplicate ? 'Duplicado' : 'Nuevo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <footer className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={reading || !importable.length || !accountId}
            onClick={() => onConfirm(rows, accountId)}>
            Importar {importable.length || ''}
          </button>
        </footer>
      </section>
    </div>
  )
}
