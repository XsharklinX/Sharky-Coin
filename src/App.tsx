import { lazy, useEffect, useState } from 'react'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { currentMonthKey, monthKeys } from '@/data/helpers'
import { Icon } from '@/components/ui/Icon'
import { ToastHost, toast } from '@/components/ui/Toast'
import { DialogProvider } from '@/components/ui/DialogProvider'
import { CommandPalette } from '@/components/CommandPalette'
import { Welcome } from '@/modals/Welcome'
import { AuthGate } from '@/modals/AuthGate'
import { TransactionForm } from '@/modals/TransactionForm'
import { SettingsModal } from '@/modals/SettingsModal'
import { useAuth } from '@/store/auth'
import { useRecurring } from '@/hooks/useRecurring'
import { useNotifications } from '@/hooks/useNotifications'
import { useAutoBackup } from '@/hooks/useAutoBackup'
import { useCloudWorkspace } from '@/hooks/useCloudWorkspace'
import { useAutoCloudSync } from '@/hooks/useAutoCloudSync'
import { DesktopShell } from '@/desktop/DesktopShell'
import { MobileShell } from '@/mobile/MobileShell'
import { MobileSettings } from '@/mobile/MobileSettings'
import { useMobileBackDismiss } from '@/mobile/useMobileBackDismiss'
import type { Transaction, ViewId, ViewProps } from '@/types'

type CreateTarget = NonNullable<ViewProps['createRequest']>['target'] | 'transaction'

const Dashboard    = lazy(() => import('@/views/Dashboard').then(m => ({ default: m.Dashboard })))
const Transactions = lazy(() => import('@/views/Transactions').then(m => ({ default: m.Transactions })))
const Accounts     = lazy(() => import('@/views/Accounts').then(m => ({ default: m.Accounts })))
const Stats        = lazy(() => import('@/views/Stats').then(m => ({ default: m.Stats })))
const Budgets      = lazy(() => import('@/views/Budgets').then(m => ({ default: m.Budgets })))
const Goals        = lazy(() => import('@/views/Goals').then(m => ({ default: m.Goals })))
const CalendarView = lazy(() => import('@/views/Calendar').then(m => ({ default: m.Calendar })))
const Annual       = lazy(() => import('@/views/Annual').then(m => ({ default: m.Annual })))

const NAV: { id: ViewId; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'dashboard',    label: 'Inicio',          icon: 'grid'   },
  { id: 'transactions', label: 'Transacciones',   icon: 'list'   },
  { id: 'accounts',     label: 'Cuentas',         icon: 'cards'  },
  { id: 'stats',        label: 'Estadísticas',    icon: 'chart'  },
  { id: 'budgets',      label: 'Presupuestos',    icon: 'target' },
  { id: 'goals',        label: 'Metas',           icon: 'trend'  },
  { id: 'calendar',     label: 'Calendario',      icon: 'calendar' },
  { id: 'annual',       label: 'Reporte anual',   icon: 'shark'  },
]

const NAV_GROUPS = [
  { label: 'General', items: NAV.slice(0, 4) },
  { label: 'Planificación', items: NAV.slice(4) },
]

const VIEWS: Record<ViewId, React.ComponentType<ViewProps>> = {
  dashboard: Dashboard, transactions: Transactions, accounts: Accounts,
  stats: Stats, budgets: Budgets, goals: Goals, calendar: CalendarView, annual: Annual,
}

// Atajos de teclado para navegar por vista (1-8)
const VIEW_KEYS: Record<string, ViewId> = {
  '1': 'dashboard', '2': 'transactions', '3': 'accounts',
  '4': 'stats', '5': 'budgets', '6': 'goals', '7': 'calendar', '8': 'annual',
}

// ─── Componente de bottom nav (móvil) ────────────────────
// ─── App principal ────────────────────────────────────────
export default function App() {
  const s = useSettings()
  const { user, initialized, recoveryMode, initialize } = useAuth()
  const { transactions, currency, setCurrency, addTx, deleteTx } = useFinance()

  const [view,    setView]    = useState<ViewId>('dashboard')
  const [mkey,    setMkey]    = useState(currentMonthKey())
  const [txForm,       setTxForm]       = useState<Transaction | 'new' | null>(null)
  const [cmdOpen,      setCmdOpen]      = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createOpen,   setCreateOpen]   = useState(false)
  const [createRequest, setCreateRequest] = useState<ViewProps['createRequest']>()
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 600px)').matches)
  const mobileOverlayOpen = isMobile && (!!txForm || cmdOpen || settingsOpen || createOpen)

  // hooks de funcionalidad
  useRecurring()
  useNotifications()
  useAutoBackup()
  useCloudWorkspace()
  useAutoCloudSync()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 600px)')
    const update = () => setIsMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useMobileBackDismiss(mobileOverlayOpen, () => {
    if (settingsOpen) setSettingsOpen(false)
    else if (cmdOpen) setCmdOpen(false)
    else if (txForm) setTxForm(null)
    else if (createOpen) setCreateOpen(false)
  })

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
  if (s.authEnabled && !initialized) return (
    <div className="app" {...themeProps}><div className="fatal-error"><p>Restaurando sesión segura...</p></div></div>
  )

  if ((s.authEnabled && !user) || recoveryMode) return (
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
    onAdd:      () => setCreateOpen(true),
    goto:       setView,
    onEditTx:   tx => setTxForm(tx),
    onDeleteTx: handleDeleteTx,
    createRequest,
  }

  const createNew = (target: CreateTarget) => {
    setCreateOpen(false)
    if (target === 'transaction') {
      setTxForm('new')
      return
    }
    if (target === 'account') setView('accounts')
    if (target === 'category') setView('budgets')
    if (target === 'goal') setView('goals')
    setCreateRequest({ target, nonce: Date.now() })
  }

  if (isMobile) return (
    <div className="app mobile-app" {...themeProps}>
      <DialogProvider>
        <MobileShell
          view={view}
          setView={setView}
          viewProps={viewProps}
          views={VIEWS}
          mkey={mkey}
          keys={keys}
          onMonth={setMkey}
          onSearch={() => setCmdOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onEditTx={tx => setTxForm(tx)}
          onCreateAccount={() => createNew('account')}
          onCreateGoal={() => createNew('goal')}
          userName={user?.name}
        />
        <ToastHost />
        {txForm       && <TransactionForm value={txForm} mkey={mkey} onClose={() => setTxForm(null)} onDelete={handleDeleteTx} />}
        {cmdOpen      && <CommandPalette onClose={() => setCmdOpen(false)} goto={v => { setView(v); setCmdOpen(false) }} onEditTx={tx => { setTxForm(tx); setCmdOpen(false) }} />}
        {settingsOpen && <MobileSettings onClose={() => setSettingsOpen(false)} />}
      </DialogProvider>
    </div>
  )

  return (
    <div className="app" {...themeProps}>
      <DialogProvider>
        <DesktopShell
          settings={s}
          user={user}
          nav={NAV}
          navGroups={NAV_GROUPS}
          view={view}
          setView={setView}
          viewComponent={ViewComp}
          viewProps={viewProps}
          currency={currency}
          setCurrency={setCurrency}
          mkey={mkey}
          keys={keys}
          mIdx={mIdx}
          setMkey={setMkey}
          onSearch={() => setCmdOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onCreate={() => setCreateOpen(true)}
        />
        <ToastHost />
        {txForm       && <TransactionForm value={txForm} mkey={mkey} onClose={() => setTxForm(null)} onDelete={handleDeleteTx} />}
        {createOpen   && <CreateMenu onClose={() => setCreateOpen(false)} onCreate={createNew} />}
        {cmdOpen      && <CommandPalette onClose={() => setCmdOpen(false)} goto={v => { setView(v); setCmdOpen(false) }} onEditTx={tx => { setTxForm(tx); setCmdOpen(false) }} />}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </DialogProvider>
    </div>
  )
}
function CreateMenu({ onClose, onCreate }: { onClose: () => void; onCreate: (target: CreateTarget) => void }) {
  const options: Array<{ target: CreateTarget; title: string; text: string; icon: Parameters<typeof Icon>[0]['name'] }> = [
    { target: 'transaction', title: 'Movimiento', text: 'Ingreso, gasto o transferencia.', icon: 'list' },
    { target: 'account', title: 'Cuenta', text: 'Banco, efectivo, crédito o ahorro.', icon: 'cards' },
    { target: 'category', title: 'Categoría', text: 'Nuevo límite de presupuesto.', icon: 'target' },
    { target: 'goal', title: 'Meta', text: 'Objetivo de ahorro con progreso.', icon: 'trend' },
  ]

  return (
    <div className="modal-overlay create-overlay" role="presentation" onMouseDown={onClose}>
      <section className="modal create-menu" role="dialog" aria-modal="true" aria-labelledby="create-menu-title"
        onMouseDown={event => event.stopPropagation()}>
        <header className="modal-head">
          <div>
            <span className="section-eyebrow">Acción rápida</span>
            <h2 id="create-menu-title">Crear nuevo</h2>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="create-grid">
          {options.map(option => (
            <button key={option.target} className="create-option" onClick={() => onCreate(option.target)}>
              <span><Icon name={option.icon} size={20} /></span>
              <strong>{option.title}</strong>
              <small>{option.text}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
