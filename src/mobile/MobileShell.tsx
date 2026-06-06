import { useMemo, useState } from 'react'
import { Empty, MiniStat } from '@/views/shared'
import { totals, txForMonth } from '@/data/helpers'
import { ViewErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { Transaction, ViewId, ViewProps } from '@/types'
import { MobileBottomNav, type MobileRoute } from './MobileBottomNav'
import { MobileAnalytics } from './MobileAnalytics'
import { MobileAnnual } from './MobileAnnual'
import { MobileCreateFlow } from './MobileCreateFlow'
import { MobileCurrencySheet } from './MobileCurrencySheet'
import { MobileHome } from './MobileHome'
import { MobileProfile } from './MobileProfile'
import { MobileReports } from './MobileReports'
import { MobileTopBar } from './MobileTopBar'
import { MobileTransactionList } from './MobileTransactionList'
import { useMobileBackDismiss } from './useMobileBackDismiss'

type MobileViewRenderer = (props: ViewProps) => React.ReactNode

function routeFromView(view: ViewId): MobileRoute {
  if (view === 'transactions') return 'movements'
  if (view === 'stats') return 'analytics'
  if (view === 'accounts' || view === 'annual' || view === 'budgets' || view === 'goals' || view === 'calendar') return 'reports'
  return 'home'
}

function viewFromRoute(route: Exclude<MobileRoute, 'add'>): ViewId {
  if (route === 'movements') return 'transactions'
  if (route === 'analytics') return 'stats'
  if (route === 'reports') return 'accounts'
  return 'dashboard'
}

const INTERNAL_TITLES: Partial<Record<ViewId, string>> = {
  annual: 'Reporte anual',
  calendar: 'Calendario',
  budgets: 'Presupuestos',
  goals: 'Metas',
}

export function MobileShell({
  view,
  setView,
  viewProps,
  mobileViews,
  mkey,
  keys,
  onMonth,
  onSearch,
  onSettings,
  onEditTx,
  userName,
}: {
  view: ViewId
  setView: (view: ViewId) => void
  viewProps: ViewProps
  mobileViews: Partial<Record<ViewId, MobileViewRenderer>>
  mkey: string
  keys: string[]
  onMonth: (mkey: string) => void
  onSearch: () => void
  onSettings: () => void
  onEditTx: (transaction: Transaction) => void
  userName?: string
}) {
  const [route, setRoute] = useState<MobileRoute>(routeFromView(view))
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const monthTx = useMemo(() => txForMonth(viewProps.txns, mkey), [viewProps.txns, mkey])
  const monthTotals = totals(monthTx)
  const mIdx = keys.indexOf(mkey)

  // Back navigation: add-flow → home
  useMobileBackDismiss(route === 'add', () => {
    setRoute('home')
    setView('dashboard')
  })
  // Back navigation: sub-views inside reports → main reports (accounts)
  const isInSubView = route === 'reports' && view !== 'accounts'
  useMobileBackDismiss(isInSubView, () => setView('accounts'))
  // Back navigation: movements → home
  useMobileBackDismiss(route === 'movements', () => {
    setRoute('home')
    setView('dashboard')
  })

  const goRoute = (next: MobileRoute) => {
    setRoute(next)
    if (next !== 'add') setView(viewFromRoute(next))
  }

  const renderMain = () => {
    if (route === 'add') {
      return (
        <MobileCreateFlow
          mkey={mkey}
          onSaved={() => { setRoute('home'); setView('dashboard') }}
        />
      )
    }

    if (route === 'home') {
      return (
        <MobileHome
          mkey={mkey}
          onAdd={() => setRoute('add')}
          onMovements={() => { setRoute('movements'); setView('transactions') }}
          onBudgets={() => { setRoute('reports'); setView('budgets') }}
          onEditTx={onEditTx}
          onDeleteTx={viewProps.onDeleteTx}
        />
      )
    }

    if (view === 'transactions') {
      return (
        <div className="mobile-route">
          <div className="mobile-summary-strip">
            <MiniStat label="Gastos" amount={monthTotals.expense} color="var(--expense)" />
            <MiniStat label="Ingresos" amount={monthTotals.income} color="var(--income)" />
            <MiniStat label="Balance" amount={monthTotals.net} color="var(--accent)" />
          </div>
          {monthTx.length
            ? <MobileTransactionList transactions={monthTx} onEdit={onEditTx} onDelete={viewProps.onDeleteTx} />
            : <Empty icon="list" title="Sin movimientos" text="Agrega tu primer movimiento del mes." />}
        </div>
      )
    }

    if (route === 'analytics') return <MobileAnalytics mkey={mkey} />

    if (route === 'reports' && view === 'accounts') {
      return <MobileReports goto={setView} onSettings={onSettings} createRequest={viewProps.createRequest} />
    }

    if (route === 'profile') {
      return (
        <MobileProfile
          userName={userName}
          onSettings={onSettings}
          goto={next => { setRoute('reports'); setView(next) }}
        />
      )
    }

    // Sub-vistas: annual (nativa mobile), budgets, goals, calendar (via mobileViews)
    if (view === 'annual') return <MobileAnnual mkey={mkey} />

    const renderer = mobileViews[view]
    if (renderer) {
      return (
        <ViewErrorBoundary resetKey={`${route}:${view}`}>
          {renderer(viewProps)}
        </ViewErrorBoundary>
      )
    }

    return null
  }

  return (
    <main className="mobile-shell">
      {currencyOpen && <MobileCurrencySheet onClose={() => setCurrencyOpen(false)} />}
      <MobileTopBar
        route={route}
        mkey={mkey}
        title={route === 'reports' ? INTERNAL_TITLES[view] : undefined}
        canGoBack={mIdx > 0}
        canGoForward={mIdx >= 0 && mIdx < keys.length - 1}
        onPrevMonth={() => mIdx > 0 && onMonth(keys[mIdx - 1])}
        onNextMonth={() => mIdx >= 0 && mIdx < keys.length - 1 && onMonth(keys[mIdx + 1])}
        onSearch={onSearch}
        onSettings={onSettings}
        onCurrency={() => setCurrencyOpen(true)}
      />
      {route === 'add' ? (
        renderMain()
      ) : (
        <>
          <div className="mobile-content">
            {renderMain()}
          </div>
          <MobileBottomNav route={route} onRoute={goRoute} />
        </>
      )}
    </main>
  )
}
