import { useState, useEffect, useRef, useCallback } from 'react'
import { useFinance } from '@/store/finance'
import { Icon } from '@/components/ui/Icon'
import type { IconName, ViewId } from '@/types'

interface Result {
  id:     string
  icon:   IconName
  label:  string
  sub?:   string
  color?: string
  action: () => void
}

const VIEWS: { id: ViewId; label: string; icon: IconName }[] = [
  { id: 'dashboard',    label: 'Inicio',          icon: 'grid'   },
  { id: 'transactions', label: 'Transacciones',   icon: 'list'   },
  { id: 'accounts',     label: 'Cuentas',         icon: 'cards'  },
  { id: 'stats',        label: 'Estadísticas',    icon: 'chart'  },
  { id: 'budgets',      label: 'Presupuestos',    icon: 'target' },
  { id: 'goals',        label: 'Metas',           icon: 'trend'  },
]

interface Props {
  onClose:  () => void
  goto:     (v: ViewId) => void
  onEditTx: (tx: import('@/types').Transaction) => void
}

export function CommandPalette({ onClose, goto, onEditTx }: Props) {
  const { transactions, accounts, goals, categories } = useFinance()
  const [q, setQ]       = useState('')
  const [idx, setIdx]   = useState(0)
  const inputRef        = useRef<HTMLInputElement>(null)
  const listRef         = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const results: Result[] = q.length < 1
    ? VIEWS.map(v => ({ id: v.id, icon: v.icon, label: v.label, action: () => { goto(v.id); onClose() } }))
    : (() => {
        const ql = q.toLowerCase()
        const out: Result[] = []

        // vistas
        VIEWS.filter(v => v.label.toLowerCase().includes(ql))
          .forEach(v => out.push({ id: v.id, icon: v.icon, label: v.label, sub: 'Vista', action: () => { goto(v.id); onClose() } }))

        // cuentas
        accounts.filter(a => a.name.toLowerCase().includes(ql)).slice(0, 3)
          .forEach(a => out.push({ id: a.id, icon: 'cards', label: a.name, sub: a.short, color: a.color, action: () => { goto('accounts'); onClose() } }))

        // metas
        goals.filter(g => g.name.toLowerCase().includes(ql)).slice(0, 3)
          .forEach(g => out.push({ id: g.id, icon: g.icon, label: g.name, sub: 'Meta de ahorro', color: g.color, action: () => { goto('goals'); onClose() } }))

        // transacciones (últimas 200)
        transactions.slice(0, 200)
          .filter(t => (t.note ?? '').toLowerCase().includes(ql))
          .slice(0, 5)
          .forEach(t => {
            const cat = categories.find(c => c.id === t.categoryId)
            out.push({
              id:    t.id,
              icon:  cat?.icon ?? 'list',
              label: t.note,
              sub:   `${t.date} · ${cat?.name ?? ''}`,
              color: cat?.color,
              action: () => { onEditTx(t); onClose() },
            })
          })

        return out
      })()

  const clampedIdx = Math.min(idx, Math.max(0, results.length - 1))

  const confirm = useCallback(() => {
    results[clampedIdx]?.action()
  }, [clampedIdx, results])

  useEffect(() => { setIdx(0) }, [q])

  useEffect(() => {
    const el = listRef.current?.children[clampedIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [clampedIdx])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); confirm() }
    if (e.key === 'Escape')    { e.preventDefault(); onClose() }
  }

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="cmd-panel" onMouseDown={e => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <Icon name="search" size={17} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Buscar transacciones, cuentas, metas, vistas…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
            aria-label="Búsqueda global"
          />
          <kbd className="cmd-esc" onClick={onClose}>Esc</kbd>
        </div>

        {results.length > 0 && (
          <div ref={listRef} className="cmd-results" role="listbox">
            {!q && <div className="cmd-section">Vistas rápidas</div>}
            {results.map((r, i) => (
              <button
                key={r.id}
                role="option"
                aria-selected={i === clampedIdx}
                className={`cmd-item${i === clampedIdx ? ' on' : ''}`}
                onMouseEnter={() => setIdx(i)}
                onClick={r.action}
              >
                <span className="cmd-icon" style={{ color: r.color ?? 'var(--accent)' }}>
                  <Icon name={r.icon} size={16} />
                </span>
                <span className="cmd-label">{r.label}</span>
                {r.sub && <span className="cmd-sub">{r.sub}</span>}
              </button>
            ))}
          </div>
        )}

        {q && results.length === 0 && (
          <div className="cmd-empty">Sin resultados para "{q}"</div>
        )}
      </div>
    </div>
  )
}
