import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Icon } from '@/components/ui/Icon'
import { ModalShell } from '@/components/ui/ModalShell'
import { toast } from '@/components/ui/Toast'
import { useDialogs } from '@/components/ui/DialogProvider'
import { fmtCompact, getAccount, getCategory, totals, txForMonth } from '@/data/helpers'
import {
  BANKS,
  analyzeBankCsv,
  learnCategoryRule,
  parseBankCsv,
  type BankId,
  type CsvAnalysis,
  type CsvColumnKey,
  type CsvColumnMap,
  type ImportedRow,
} from '@/data/bankCsv'
import { createBackup, parseBackup } from '@/data/backup'
import { recordAuditEvent } from '@/data/audit'
import { useFinance } from '@/store/finance'
import { useAuth } from '@/store/auth'
import type { Transaction, ViewProps } from '@/types'
import { BusyButton, Empty, MiniStat, TxRow } from './shared'

// ── Tipos para la lista virtualizada ────────────────────
type ListItem =
  | { kind: 'header'; date: string; count: number }
  | { kind: 'row';    tx: Transaction }
interface SavedFilter { name: string; query: string; type: string; cat: string; tagFilter: string | null }
const SAVED_FILTERS_KEY = 'sharky-saved-filters-v1'
const readSavedFilters = (): SavedFilter[] => {
  try { return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) ?? '[]') as SavedFilter[] }
  catch { return [] }
}

// ── Componente principal ─────────────────────────────────
export function Transactions({ txns, mkey, onEditTx }: ViewProps) {
  const { categories, accounts, currency, importTxs, deleteTx, updateTx, restoreBackup } = useFinance()
  const { confirm, prompt } = useDialogs()
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
  const [savedFilters, setSavedFilters] = useState(readSavedFilters)
  const [activeSavedFilter, setActiveSavedFilter] = useState('')

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
  const saveCurrentFilter = async () => {
    const name = await prompt({
      title: 'Guardar filtro',
      description: 'Guarda la búsqueda y los filtros activos para reutilizarlos luego.',
      label: 'Nombre del filtro',
      placeholder: 'Ej. Gastos de tarjeta',
      confirmLabel: 'Guardar filtro',
      icon: 'tag',
    })
    if (!name?.trim()) return
    const next = [...savedFilters.filter(filter => filter.name !== name.trim()), { name: name.trim(), query, type, cat, tagFilter }]
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next)); setSavedFilters(next)
    toast('Filtro guardado', { icon: 'check', type: 'ok' })
  }
  const applySavedFilter = (name: string) => {
    const filter = savedFilters.find(item => item.name === name)
    if (!filter) return
    setQuery(filter.query); setType(filter.type); setCat(filter.cat); setTagFilter(filter.tagFilter)
  }
  const deleteSavedFilter = () => {
    if (!activeSavedFilter) return
    const next = savedFilters.filter(filter => filter.name !== activeSavedFilter)
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next)); setSavedFilters(next); setActiveSavedFilter('')
    toast('Filtro eliminado', { icon: 'trash' })
  }

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

  const bulkDelete = async () => {
    const ok = await confirm({
      title: 'Eliminar movimientos',
      description: `Eliminaras ${selected.size} movimiento${selected.size > 1 ? 's' : ''} seleccionado${selected.size > 1 ? 's' : ''}. Esta accion no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      icon: 'trash',
      tone: 'danger',
    })
    if (!ok) return
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
    const csv = [['Fecha','Tipo','Categoria','Cuenta','Nota','Tags','Monto'], ...rows]
      .map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
    Object.assign(document.createElement('a'), { href: url, download: `sharky-${mkey}${onlySelected ? '-seleccion' : ''}.csv` }).click()
    URL.revokeObjectURL(url)
  }

  const exportBackup = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(createBackup(useFinance.getState()), null, 2)], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: `sharky-backup-${new Date().toISOString().slice(0, 10)}.json` }).click()
    URL.revokeObjectURL(url)
    recordAuditEvent('backup', 'Backup JSON exportado')
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    const ok = await confirm({
      title: 'Restaurar backup',
      description: 'Este backup reemplazara todos los datos actuales. Revisa que sea el archivo correcto antes de continuar.',
      confirmLabel: 'Restaurar backup',
      icon: 'upload',
      tone: 'danger',
    })
    if (!ok) {
      if (backupRef.current) backupRef.current.value = ''
      return
    }
    try { restoreBackup(parseBackup(await file.text())); recordAuditEvent('backup', 'Backup JSON restaurado'); toast('Backup restaurado', { icon: 'download', type: 'ok' }) }
    catch (e) { toast(e instanceof Error ? e.message : 'No se pudo restaurar el backup.', { icon: 'alert' }) }
    finally { if (backupRef.current) backupRef.current.value = '' }
  }

  const runExport = async (kind: 'excel' | 'pdf') => {
    setBusyExport(kind)
    try {
      const exporter = await import('@/data/professionalExport')
      if (kind === 'excel') await exporter.exportExcel(useFinance.getState())
      else await exporter.exportMonthlyPdf(useFinance.getState(), mkey, ownerName)
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
        <select aria-label="Filtros guardados" className="select" value={activeSavedFilter}
          onChange={event => { setActiveSavedFilter(event.target.value); applySavedFilter(event.target.value) }}>
          <option value="">Filtros guardados...</option>
          {savedFilters.map(filter => <option key={filter.name} value={filter.name}>{filter.name}</option>)}
        </select>
        <button className="btn-ghost" onClick={() => void saveCurrentFilter()}><Icon name="plus" size={14} />Guardar filtro</button>
        {activeSavedFilter && <button className="btn-ghost" onClick={deleteSavedFilter}><Icon name="trash" size={14} />Eliminar filtro</button>}
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
        <select aria-label="Categoria" className="select" value={cat} onChange={e => setCat(e.target.value)}>
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
            aria-label="Restaurar backup" onChange={e => void importBackup(e.target.files?.[0])} />
        </div>
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
          <button className="btn-danger" onClick={() => void bulkDelete()}>
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
            const importable = rows.filter(r => !r.duplicate && !r.skipped)
            try {
              importTxs(importable.map(r => ({ type: r.type, amount: r.amount, date: r.date, note: r.note, categoryId: r.categoryId, accountId })))
              rows.filter(r => r.categoryId).forEach(r => learnCategoryRule(r.note, r.categoryId!))
              recordAuditEvent('import', 'Importación CSV confirmada', `${importable.length} movimientos`)
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
  const [csvText,   setCsvText]   = useState('')
  const [mapping,   setMapping]   = useState<CsvColumnMap>({})
  const [analysis,  setAnalysis]  = useState<CsvAnalysis | null>(null)

  const parsePreview = (text: string, selectedBank = bank, selectedMapping = mapping) => {
    const nextAnalysis = analyzeBankCsv(text, selectedBank, selectedMapping)
    setAnalysis(nextAnalysis)
    setMapping(nextAnalysis.columns)
    setRows(parseBankCsv(text, transactions, categories, selectedBank, nextAnalysis.columns))
    setError('')
  }

  const readFile = async (file?: File) => {
    if (!file) return
    setReading(true)
    try {
      const text = await file.text()
      setCsvText(text)
      parsePreview(text)
    }
    catch (e) { setRows([]); setError(e instanceof Error ? e.message : 'No pudimos leer el archivo.') }
    finally { setReading(false) }
  }

  const changeBank = (value: BankId) => {
    setBank(value)
    if (!csvText) return
    try { parsePreview(csvText, value, {}) }
    catch (e) { setRows([]); setError(e instanceof Error ? e.message : 'No pudimos leer el archivo.') }
  }

  const changeMapping = (key: CsvColumnKey, value: string) => {
    const next = { ...mapping, [key]: value || undefined }
    setMapping(next)
    if (!csvText) return
    try { parsePreview(csvText, bank, next) }
    catch (e) {
      setRows([])
      setAnalysis(analyzeBankCsv(csvText, bank, next))
      setError(e instanceof Error ? e.message : 'No pudimos leer el archivo.')
    }
  }

  const patchRow = (index: number, patch: Partial<ImportedRow>) => {
    setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  const importable = rows.filter(r => !r.duplicate && !r.skipped)
  const duplicateCount = rows.filter(r => r.duplicate).length
  const skippedCount = rows.filter(r => r.skipped).length

  return (
    <ModalShell
      title="Importar CSV bancario"
      eyebrow="Bancos dominicanos"
      description="Detecta cuentas y tarjetas, revisa duplicados y confirma solo lo que quieres agregar."
      icon="upload"
      className="csv-modal"
      maxWidth={860}
      onClose={onClose}
      footer={(
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={reading || !importable.length || !accountId}
            onClick={() => onConfirm(rows, accountId)}>
            Importar {importable.length || ''}
          </button>
        </>
      )}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="csv-bank">Formato</label>
            <select id="csv-bank" className="select" value={bank} onChange={e => changeBank(e.target.value as BankId)}>
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
        {reading && <div className="inline-loading" role="status"><span className="spinner" /> Leyendo y detectando columnas...</div>}
        {analysis && (
          <div className="csv-detect-panel">
            <div>
              <b>{analysis.profile?.label ?? 'Formato detectado'}</b>
              <span>{analysis.profile?.kind === 'credit-card' ? 'Tarjeta' : analysis.profile?.kind === 'account' ? 'Cuenta' : 'Mixto'} · {analysis.profile?.version ?? 'auto'} · {analysis.rowCount} filas · {analysis.confidence}% confianza</span>
            </div>
            {analysis.profile?.notes && <p>{analysis.profile.notes}</p>}
            <div className="csv-map-grid">
              {(['date', 'note', 'amount', 'debit', 'credit'] as CsvColumnKey[]).map(key => (
                <label key={key}>
                  {key === 'date' ? 'Fecha' : key === 'note' ? 'Descripcion' : key === 'amount' ? 'Monto firmado' : key === 'debit' ? 'Debito' : 'Credito'}
                  <select className="select" value={mapping[key] ?? ''} onChange={event => changeMapping(key, event.target.value)}>
                    <option value="">Sin mapear</option>
                    {analysis.headers.map(header => <option key={`${key}-${header}`} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {rows.length > 0 && (
          <>
            <div className="csv-summary">
              <span>Conciliacion: {duplicateCount} duplicados, {skippedCount} omitidos manualmente · </span>
              <b>{importable.length}</b> listos · <b>{rows.length - importable.length}</b> duplicados omitidos
            </div>
            <div className="csv-preview">
              <table>
                <thead className="csv-modern-head"><tr><th>Importar</th><th>Fecha</th><th>Descripcion</th><th>Categoria</th><th>Monto</th><th>Estado</th></tr></thead>
                <tbody>
                  {rows.slice(0, 25).map((r, i) => (
                    <tr key={`${r.date}-${i}`}>
                      <td>
                        <input type="checkbox" checked={!r.skipped && !r.duplicate} disabled={r.duplicate}
                          onChange={event => patchRow(i, { skipped: !event.target.checked })} />
                      </td>
                      <td>{r.date}</td><td>{r.note}</td>
                      <td>
                        <select className="select compact-select" value={r.categoryId ?? ''}
                          onChange={event => patchRow(i, { categoryId: event.target.value || undefined })}>
                          <option value="">Sin categoria</option>
                          {categories.filter(category => category.type === r.type).map(category => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>{categories.find(c => c.id === r.categoryId)?.name ?? '—'}</td>
                      <td className={r.type}>{r.type === 'expense' ? '-' : '+'}{fmtCompact(r.amount, currency)}</td>
                      <td>{r.duplicate ? 'Duplicado' : r.skipped ? 'Omitido' : 'Nuevo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
    </ModalShell>
  )
}
