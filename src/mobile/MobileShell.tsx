import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ViewErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useT } from '@/i18n'
import type { AppShortcut } from '@/hooks/useAppShortcut'
import type { SharedReceipt } from '@/hooks/useTauri'
import type { Transaction, ViewId, ViewProps } from '@/types'
import { MobileBottomNav, type MobileRoute, type QuickAddMode } from './MobileBottomNav'
import { MobileAnalytics } from './MobileAnalytics'
import { MobileAnnual } from './MobileAnnual'
import { MobileCreateFlow } from './MobileCreateFlow'
import { MobileCurrencySheet } from './MobileCurrencySheet'
import { MobileCalendar } from './MobileCalendar'
import { MobileGlobalSearch } from './MobileGlobalSearch'
import { MobileHome } from './MobileHome'
import { MobileProfile } from './MobileProfile'
import { MobileReports } from './MobileReports'
import { MobileDebt } from './MobileDebt'
import { MobileQuickAddSheet } from './MobileQuickAddSheet'
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

function internalTitles(t: ReturnType<typeof useT>): Partial<Record<ViewId, string>> {
  return {
    annual:        t('annualReport'),
    calendar:      t('calendarLabel'),
    budgets:       t('budgets'),
    goals:         t('goals'),
    reports:       t('reports'),
    subscriptions: t('subscriptions'),
    debt:          t('debtCalculator'),
  }
}

export function MobileShell({
  view,
  setView,
  viewProps,
  mobileViews,
  mkey,
  keys,
  onMonth,
  onSettings,
  onEditTx,
  userName,
  sharedReceipt,
  onConsumeSharedReceipt,
  appShortcut,
  onConsumeAppShortcut,
}: {
  view: ViewId
  setView: (view: ViewId) => void
  viewProps: ViewProps
  mobileViews: Partial<Record<ViewId, MobileViewRenderer>>
  mkey: string
  keys: string[]
  onMonth: (mkey: string) => void
  onSettings: () => void
  onEditTx: (transaction: Transaction) => void
  userName?: string
  sharedReceipt?: SharedReceipt | null
  onConsumeSharedReceipt?: () => void
  appShortcut?: AppShortcut | null
  onConsumeAppShortcut?: () => void
}) {
  const t = useT()
  const [route, setRoute] = useState<MobileRoute>(routeFromView(view))
  const [quickAddMode, setQuickAddMode] = useState<QuickAddMode | null>(null)
  const [quickAddSheet, setQuickAddSheet] = useState<'expense' | 'income' | null>(null)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [createKey, setCreateKey] = useState(0)
  const prevIsAdd = useRef(false)
  const [visibleMonth, setVisibleMonth] = useState(mkey)
  useEffect(() => { setVisibleMonth(mkey) }, [mkey])
  const activeMkey = route === 'home' ? visibleMonth : mkey
  const mIdx = keys.indexOf(activeMkey)

  // Remount MobileCreateFlow each time the add route is entered so state resets
  useEffect(() => {
    if (route === 'add' && !prevIsAdd.current) setCreateKey(k => k + 1)
    prevIsAdd.current = route === 'add'
  }, [route])

  // Back navigation: add-flow → home
  useMobileBackDismiss(route === 'add', () => {
    setRoute('home')
    setView('dashboard')
    onConsumeSharedReceipt?.()
  })
  // Back navigation: sub-views inside reports → main reports
  const isInSubView = route === 'reports' && view !== 'reports'
  useMobileBackDismiss(isInSubView, () => setView('reports'))
  // Recibo compartido desde otra app (Galería, WhatsApp, etc.) → abrir "agregar gasto" con vista previa
  useEffect(() => {
    if (!sharedReceipt) return
    setQuickAddMode('expense')
    setRoute('add')
  }, [sharedReceipt])
  // Accesos directos del ícono (mantener presionado — ver res/xml/shortcuts.xml):
  // abre la mini ventana de captura rápida sobre la pantalla actual, sin
  // navegar al flujo completo de "agregar".
  useEffect(() => {
    if (!appShortcut) return
    if (appShortcut === 'add-expense' || appShortcut === 'add-income') {
      setQuickAddSheet(appShortcut === 'add-expense' ? 'expense' : 'income')
    } else if (appShortcut === 'reports') {
      setRoute('reports')
      setView('reports')
    }
    onConsumeAppShortcut?.()
  }, [appShortcut])

  const goRoute = (next: MobileRoute) => {
    if (next !== 'add') {
      setQuickAddMode(null)
      onConsumeSharedReceipt?.()
    }
    setRoute(next)
    if (next !== 'add') setView(viewFromRoute(next))
  }

  const renderMain = () => {
    if (route === 'add') {
      return (
        <MobileCreateFlow
          key={createKey}
          mkey={mkey}
          initialMode={quickAddMode ?? undefined}
          receiptPreview={sharedReceipt ?? undefined}
          onSaved={() => {
            setQuickAddMode(null); setRoute('home'); setView('dashboard')
            onConsumeSharedReceipt?.()
          }}
        />
      )
    }

    if (route === 'home') {
      return (
        <MobileHome
          mkey={mkey}
          visibleMonth={visibleMonth}
          onVisibleMonthChange={setVisibleMonth}
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
      if (view === 'calendar') return <MobileCalendar mkey={mkey} onEditTx={onEditTx} onDeleteTx={viewProps.onDeleteTx} />
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
      return <MobileReports goto={v => setView(v)} onImport={() => setCsvOpen(true)} mkey={mkey} />
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
      {searchOpen && (
        <MobileGlobalSearch
          onClose={() => setSearchOpen(false)}
          onEditTx={onEditTx}
          onGotoAccounts={() => setRoute('profile')}
          onGotoCategories={() => { setRoute('reports'); setView('budgets') }}
          onGotoGoals={() => { setRoute('reports'); setView('goals') }}
        />
      )}
      <MobileTopBar
        route={route}
        mkey={activeMkey}
        title={route === 'reports' ? internalTitles(t)[view] : undefined}
        canGoBack={mIdx > 0}
        canGoForward={mIdx >= 0 && mIdx < keys.length - 1}
        onPrevMonth={() => mIdx > 0 && onMonth(keys[mIdx - 1])}
        onNextMonth={() => mIdx >= 0 && mIdx < keys.length - 1 && onMonth(keys[mIdx + 1])}
        onSettings={onSettings}
        onCurrency={() => setCurrencyOpen(true)}
        onCalendar={route === 'home' ? () => { setRoute('reports'); setView('calendar') } : undefined}
        onSearch={() => setSearchOpen(true)}
      />
      {route === 'add' ? (
        renderMain()
      ) : (
        <>
          <div className="mobile-content">
            {renderMain()}
          </div>
          <MobileBottomNav route={route} onRoute={goRoute}
            onQuickAdd={mode => { setQuickAddMode(mode); setRoute('add') }} />
        </>
      )}
      {quickAddSheet && (
        <MobileQuickAddSheet
          mode={quickAddSheet}
          onClose={() => setQuickAddSheet(null)}
          onSaved={() => setQuickAddSheet(null)}
          onOpenFull={() => {
            setQuickAddMode(quickAddSheet)
            setQuickAddSheet(null)
            setRoute('add')
          }}
        />
      )}
    </main>
  )
}
