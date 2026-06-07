import { lazy, Suspense, useState } from 'react'
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
import { MobileDebt } from './MobileDebt'
import { MobileSubscriptions } from './MobileSubscriptions'
const MobileCSVImport = lazy(() => import('./MobileCSVImport').then(m => ({ default: m.MobileCSVImport })))
import { MobileTopBar } from './MobileTopBar'
import { useMobileBackDismiss } from './useMobileBackDismiss'

type MobileViewRenderer = (props: ViewProps) => React.ReactNode

function routeFromView(view: ViewId): MobileRoute {
  if (view === 'stats') return 'analytics'
  if (view === 'annual' || view === 'budgets' || view === 'goals' || view === 'calendar' || view === 'reports' || view === 'subscriptions' || view === 'debt') return 'reports'
  return 'home'
}

function viewFromRoute(route: Exclude<MobileRoute, 'add'>): ViewId {
  if (route === 'analytics') return 'stats'
  if (route === 'reports') return 'reports'
  return 'dashboard'
}

const INTERNAL_TITLES: Partial<Record<ViewId, string>> = {
  annual:        'Informe anual',
  calendar:      'Calendario',
  budgets:       'Presupuestos',
  goals:         'Metas',
  reports:       'Reportes',
  subscriptions: 'Suscripciones',
  debt:          'Calculadora de deudas',
}

export function MobileShell({
  view,
  setView,
  viewProps,
  mobileViews,
  mkey,
  keys,
  onMonth,
  onMenu,
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
  onMenu: () => void
  onSettings: () => void
  onEditTx: (transaction: Transaction) => void
  userName?: string
}) {
  const [route, setRoute] = useState<MobileRoute>(routeFromView(view))
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const mIdx = keys.indexOf(mkey)

  // Back navigation: add-flow → home
  useMobileBackDismiss(route === 'add', () => {
    setRoute('home')
    setView('dashboard')
  })
  // Back navigation: sub-views inside reports → main reports
  const isInSubView = route === 'reports' && view !== 'reports'
  useMobileBackDismiss(isInSubView, () => setView('reports'))
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
          onEditTx={onEditTx}
          onDeleteTx={viewProps.onDeleteTx}
        />
      )
    }

    if (route === 'analytics') {
      return (
        <MobileAnalytics
          mkey={mkey}
          onBudgets={() => { setRoute('reports'); setView('budgets') }}
        />
      )
    }

    if (route === 'reports') {
      if (view === 'annual') return <MobileAnnual mkey={mkey} />
      if (view === 'subscriptions') return <MobileSubscriptions />
      if (view === 'debt') return <MobileDebt />
      const renderer = mobileViews[view]
      if (renderer) {
        return (
          <ViewErrorBoundary resetKey={`${route}:${view}`}>
            {renderer(viewProps)}
          </ViewErrorBoundary>
        )
      }
      return <MobileReports goto={v => setView(v)} onImport={() => setCsvOpen(true)} />
    }

    if (route === 'profile') {
      return (
        <MobileProfile
          userName={userName}
          onSettings={onSettings}
          createRequest={viewProps.createRequest}
          goto={next => { setRoute('reports'); setView(next) }}
        />
      )
    }

    return null
  }

  return (
    <main className="mobile-shell">
      {csvOpen && (
        <Suspense fallback={null}>
          <MobileCSVImport onClose={() => setCsvOpen(false)} />
        </Suspense>
      )}
      {currencyOpen && <MobileCurrencySheet onClose={() => setCurrencyOpen(false)} />}
      <MobileTopBar
        route={route}
        mkey={mkey}
        title={route === 'reports' ? INTERNAL_TITLES[view] : undefined}
        canGoBack={mIdx > 0}
        canGoForward={mIdx >= 0 && mIdx < keys.length - 1}
        onPrevMonth={() => mIdx > 0 && onMonth(keys[mIdx - 1])}
        onNextMonth={() => mIdx >= 0 && mIdx < keys.length - 1 && onMonth(keys[mIdx + 1])}
        onMenu={onMenu}
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
