import { lazy, Suspense, useEffect, useState } from 'react'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { currentMonthKey, monthKeys, monthLabel } from '@/data/helpers'
import { Icon } from '@/components/ui/Icon'
import { BrandMark } from '@/components/ui/BrandMark'
import { ViewErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ToastHost, toast } from '@/components/ui/Toast'
import { CommandPalette } from '@/components/CommandPalette'
import { Welcome } from '@/modals/Welcome'
import { AuthGate } from '@/modals/AuthGate'
import { TransactionForm } from '@/modals/TransactionForm'
import { SettingsModal } from '@/modals/SettingsModal'
import { Dashboard, Transactions, Accounts, Budgets, Goals } from '@/views'
import { useAuth } from '@/store/auth'
import { useRecurring } from '@/hooks/useRecurring'
import { useNotifications } from '@/hooks/useNotifications'
import type { Transaction, ViewId, ViewProps } from '@/types'

const Stats  = lazy(() => import('@/views/Stats').then(m => ({ default: m.Stats })))
const Annual = lazy(() => import('@/views/Annual').then(m => ({ default: m.Annual })))

const NAV: { id: ViewId; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'dashboard',    label: 'Inicio',          icon: 'grid'   },
  { id: 'transactions', label: 'Transacciones',   icon: 'list'   },
  { id: 'accounts',     label: 'Cuentas',         icon: 'cards'  },
  { id: 'stats',        label: 'Estadísticas',    icon: 'chart'  },
  { id: 'budgets',      label: 'Presupuestos',    icon: 'target' },
  { id: 'goals',        label: 'Metas',           icon: 'trend'  },
  { id: 'annual',       label: 'Resumen anual',   icon: 'shark'  },
]

const NAV_GROUPS = [
  { label: 'General', items: NAV.slice(0, 4) },
  { label: 'Planificación', items: NAV.slice(4) },
]

const VIEWS: Record<ViewId, React.ComponentType<ViewProps>> = {
  dashboard: Dashboard, transactions: Transactions, accounts: Accounts,
  stats: Stats, budgets: Budgets, goals: Goals, annual: Annual,
}

// Atajos de teclado para navegar por vista (1-7)
const VIEW_KEYS: Record<string, ViewId> = {
  '1': 'dashboard', '2': 'transactions', '3': 'accounts',
  '4': 'stats', '5': 'budgets', '6': 'goals', '7': 'annual',
}

// ─── Componente de bottom nav (móvil) ────────────────────
function BottomNav({ view, setView, onAdd }: { view: ViewId; setView: (v: ViewId) => void; onAdd: () => void }) {
  const BOTTOM = NAV.slice(0, 4) // Dashboard, Transacciones, Cuentas, Stats
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {BOTTOM.map(n => (
        <button key={n.id} className={`bottom-nav-item${view === n.id ? ' on' : ''}`}
          onClick={() => setView(n.id)} aria-label={n.label} aria-current={view === n.id ? 'page' : undefined}>
          <Icon name={n.icon} size={20} />
          <span>{n.label}</span>
        </button>
      ))}
      <button className="bottom-nav-fab" onClick={onAdd} aria-label="Agregar movimiento">
        <Icon name="plus" size={22} stroke={2.4} />
      </button>
    </nav>
  )
}

// ─── App principal ────────────────────────────────────────
export default function App() {
  const s = useSettings()
  const { user } = useAuth()
  const { transactions, currency, setCurrency, addTx, deleteTx } = useFinance()

  const [view,    setView]    = useState<ViewId>('dashboard')
  const [mkey,    setMkey]    = useState(currentMonthKey())
  const [txForm,       setTxForm]       = useState<Transaction | 'new' | null>(null)
  const [cmdOpen,      setCmdOpen]      = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // hooks de funcionalidad
  useRecurring()
  useNotifications()

  // ── Keyboard shortcuts ──────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // Cmd/Ctrl + K → command palette (funciona siempre)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setCmdOpen(v => !v); return
      }
      // Esc → cerrar palette (lo maneja el propio componente con onClose)
      if (typing) return

      // N → nueva transacción
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setTxForm('new'); return }

      // 1-7 → navegar a vista
      if (VIEW_KEYS[e.key]) { setView(VIEW_KEYS[e.key]); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Guardas de autenticación / onboarding ───────────────
  const themeProps = {
    'data-theme':   s.theme,
    'data-density': s.density,
    style: { '--accent': s.accent, fontFamily: `"${s.font}", system-ui, sans-serif` } as React.CSSProperties,
  }

  // Auth es opcional — solo se activa si el usuario lo habilitó en Configuración
  if (s.authEnabled && !user) return (
    <div className="app" {...themeProps}><AuthGate /></div>
  )

  const hasOnboarded = !!localStorage.getItem('sharky-finance-v2')
  if (!hasOnboarded) return (
    <div className="app" {...themeProps}><Welcome /></div>
  )

  const keys  = monthKeys(transactions)
  const mIdx  = keys.indexOf(mkey)
  const ViewComp = VIEWS[view]

  // ── Undo de borrado (buffer de 1 tx, 5 segundos) ─────────
  const handleDeleteTx = (id: string) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) return
    deleteTx(id)
    toast('Movimiento eliminado', {
      icon: 'trash',
      duration: 5000,
      action: { label: 'Deshacer', onClick: () => addTx(tx) },
    })
  }

  const viewProps: ViewProps = {
    txns:       transactions,
    mkey,
    onAdd:      () => setTxForm('new'),
    goto:       setView,
    onEditTx:   tx => setTxForm(tx),
    onDeleteTx: handleDeleteTx,
  }

  return (
    <div className="app" {...themeProps}>

      {/* ── Sidebar (desktop) ─────────────────────── */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <BrandMark size={38} />
          </span>
          {s.showSidebarLabels && (
            <span className="brand-name">
              <span style={{ color: 'var(--accent)' }}>$</span>harky
            </span>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => (
            <section className="nav-section" key={group.label}>
              {s.showSidebarLabels && <p>{group.label}</p>}
              {group.items.map(n => (
                <button key={n.id}
                  className={`nav-item${view === n.id ? ' on' : ''}`}
                  onClick={() => setView(n.id)} title={`${n.label} (${NAV.indexOf(n) + 1})`}>
                  <Icon name={n.icon} size={18} />
                  {s.showSidebarLabels && <span>{n.label}</span>}
                </button>
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button className="add-fab" onClick={() => setTxForm('new')} title="Agregar movimiento (N)">
            <Icon name="plus" size={18} stroke={2.6} />
            {s.showSidebarLabels && <span>Agregar</span>}
          </button>
          <div className="user-chip" onClick={() => setSettingsOpen(true)}
            role="button" tabIndex={0} title="Configuración"
            style={{ cursor: 'pointer' }}>
            <span className="avatar">
              {user ? user.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() : '⚙'}
            </span>
            {s.showSidebarLabels && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name ?? 'Mi cuenta'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Plan Personal</div>
              </div>
            )}
            {s.showSidebarLabels && (
              <Icon name="settings" size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────── */}
      <main className="main">
        <header className="topbar">
          <div>
            <h1>{NAV.find(n => n.id === view)?.label}</h1>
            <p>Hola {user?.name.split(/\s+/)[0] ?? 'bienvenido'}, este es tu resumen financiero.</p>
          </div>
          <div className="topbar-right">
            {/* búsqueda global */}
            <button className="search-trigger" onClick={() => setCmdOpen(true)}
              title="Búsqueda global (Ctrl+K)">
              <Icon name="search" size={15} style={{ color: 'var(--text-dim)' }} />
              <span>Buscar…</span>
              <kbd>⌘K</kbd>
            </button>

            <select aria-label="Tema visual" className="select" value={s.theme}
              onChange={e => s.setTheme(e.target.value as typeof s.theme)}
              style={{ fontSize: 12, padding: '6px 10px' }}>
              <option value="midnight">Oscuro</option>
              <option value="slate">Pizarra</option>
              <option value="carbon">Carbón</option>
              <option value="light">Claro</option>
            </select>

            <select className="select" value={currency} aria-label="Moneda"
              onChange={e => setCurrency(e.target.value as typeof currency)}
              style={{ fontSize: 12, padding: '6px 10px' }}>
              <option value="DOP">RD$ DOP</option>
              <option value="USD">US$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>

            <div className="month-nav">
              <button aria-label="Mes anterior" disabled={mIdx <= 0}
                onClick={() => mIdx > 0 && setMkey(keys[mIdx - 1])}>
                <Icon name="arrowUp" size={15} style={{ transform: 'rotate(-90deg)' }} />
              </button>
              <span>
                <Icon name="calendar" size={14} style={{ color: 'var(--text-dim)' }} />
                {monthLabel(mkey)}
              </span>
              <button aria-label="Mes siguiente" disabled={mIdx >= keys.length - 1}
                onClick={() => mIdx < keys.length - 1 && setMkey(keys[mIdx + 1])}>
                <Icon name="arrowUp" size={15} style={{ transform: 'rotate(90deg)' }} />
              </button>
            </div>

            <button className="btn-primary" onClick={() => setTxForm('new')} title="Nueva transacción (N)">
              <Icon name="plus" size={16} stroke={2.4} />Agregar
            </button>
          </div>
        </header>

        <div className="scroll">
          <Suspense fallback={<div className="card card-copy">Cargando…</div>}>
            <ViewErrorBoundary resetKey={view}>
              <ViewComp {...viewProps} />
            </ViewErrorBoundary>
          </Suspense>
        </div>
      </main>

      {/* ── Bottom nav (móvil < 600px) ────────────── */}
      <BottomNav view={view} setView={setView} onAdd={() => setTxForm('new')} />

      {/* ── Overlays / modales ────────────────────── */}
      <ToastHost />
      {txForm       && <TransactionForm value={txForm} mkey={mkey} onClose={() => setTxForm(null)} onDelete={handleDeleteTx} />}
      {cmdOpen      && <CommandPalette onClose={() => setCmdOpen(false)} goto={v => { setView(v); setCmdOpen(false) }} onEditTx={tx => { setTxForm(tx); setCmdOpen(false) }} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
