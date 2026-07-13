import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ViewErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'
import type { AppShortcut } from '@/hooks/useAppShortcut'
import type { SharedReceipt } from '@/hooks/useTauri'
import type { Transaction, ViewId, ViewProps } from '@/types'
import { MobileBottomNav, type MobileRoute, type QuickAddMode } from './MobileBottomNav'
import { MobileAccounts } from './MobileAccounts'
import { MobileAnalytics } from './MobileAnalytics'
import { MobileCreateFlow } from './MobileCreateFlow'
import { SheetPortal } from './SheetPortal'
import { MobileMovements } from './MobileMovements'
import { MobileProfile } from './MobileProfile'
// Lazy: ninguna de estas pantallas se ve en el primer render (Movimientos).
// Diferirlas achica el bundle que hay que parsear/hidratar al abrir la app.
const MobileAnnual = lazy(() => import('./MobileAnnual').then(m => ({ default: m.MobileAnnual })))
const MobileCalendar = lazy(() => import('./MobileCalendar').then(m => ({ default: m.MobileCalendar })))
const MobileDebt = lazy(() => import('./MobileDebt').then(m => ({ default: m.MobileDebt })))
const MobileCashflow = lazy(() => import('./MobileCashflow').then(m => ({ default: m.MobileCashflow })))
const MobileSubscriptions = lazy(() => import('./MobileSubscriptions').then(m => ({ default: m.MobileSubscriptions })))
const MobileCurrencySheet = lazy(() => import('./MobileCurrencySheet').then(m => ({ default: m.MobileCurrencySheet })))
const MobileCurrencyConverter = lazy(() => import('./MobileCurrencyConverter').then(m => ({ default: m.MobileCurrencyConverter })))
const MobileGlobalSearch = lazy(() => import('./MobileGlobalSearch').then(m => ({ default: m.MobileGlobalSearch })))
const MobileCSVImport = lazy(() => import('./MobileCSVImport').then(m => ({ default: m.MobileCSVImport })))
const MobileReceiptBatch = lazy(() => import('./MobileReceiptBatch').then(m => ({ default: m.MobileReceiptBatch })))
import { MobileQuickAddSheet } from './MobileQuickAddSheet'
import { MobileTopBar } from './MobileTopBar'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { useDialogA11y } from './useDialogA11y'
import type { Sheet } from './settings/shared'

type MobileViewRenderer = (props: ViewProps) => React.ReactNode
// Orden visual de las sub-pestañas: Cuentas primero (landing por defecto del
// tab "Cuentas" en el bottom nav), luego Informes, luego Metas.
const REPORT_TAB_VIEWS: ViewId[] = ['accounts', 'goals']
const TOOL_VIEWS: ViewId[] = ['budgets', 'subscriptions']

function MobileSkeletonScreen() {
  return (
    <div className="mobile-skeleton-screen" aria-hidden="true">
      <div className="mobile-skeleton-line short" />
      <div className="mobile-skeleton-card" />
      <div className="mobile-skeleton-pill" />
      <div className="mobile-skeleton-card" />
      <div className="mobile-skeleton-line medium" />
    </div>
  )
}

function routeFromView(view: ViewId): MobileRoute {
  if (view === 'transactions') return 'home'
  if (view === 'stats') return 'analysis'
  if (view === 'annual' || view === 'calendar' || view === 'debt' || view === 'cashflow' || view === 'accounts' || view === 'goals') {
    return 'reports'
  }
  if (view === 'budgets' || view === 'subscriptions') return 'profile'
  return 'home'
}

function viewFromRoute(route: Exclude<MobileRoute, 'add'>): ViewId {
  if (route === 'analysis') return 'stats'
  if (route === 'reports') return 'accounts'
  if (route === 'profile') return 'dashboard'
  return 'transactions'
}

function internalTitles(t: ReturnType<typeof useT>): Partial<Record<ViewId, string>> {
  return {
    annual: t('annualReport'),
    calendar: t('calendarLabel'),
    budgets: t('budgets'),
    subscriptions: t('subscriptions'),
    debt: t('debtCalculator'),
    cashflow: t('cashflowTitle'),
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
  onSettings: (sheet?: Sheet) => void
  onEditTx: (transaction: Transaction) => void
  userName?: string
  sharedReceipt?: SharedReceipt[]
  onConsumeSharedReceipt?: () => void
  appShortcut?: AppShortcut | null
  onConsumeAppShortcut?: () => void
}) {
  const t = useT()
  const [route, setRoute] = useState<MobileRoute>(routeFromView(view))
  const [quickAddMode, setQuickAddMode] = useState<QuickAddMode | null>(null)
  const [batchReceipts, setBatchReceipts] = useState<{ dataUrl: string; name: string }[] | null>(null)
  const [quickAddSheet, setQuickAddSheet] = useState<'expense' | 'income' | null>(null)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [converterOpen, setConverterOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [createKey, setCreateKey] = useState(0)
  const [reportTransition, setReportTransition] = useState<'next' | 'prev'>('next')
  const [toolTransition, setToolTransition] = useState<'next' | 'prev'>('next')
  const prevIsAdd = useRef(false)
  const previousReportTab = useRef(Math.max(0, REPORT_TAB_VIEWS.indexOf(view)))
  const previousToolTab = useRef(Math.max(0, TOOL_VIEWS.indexOf(view)))
  const contentRef = useRef<HTMLDivElement | null>(null)
  const scrollPositions = useRef<Record<string, number>>({})
  const activeScrollKey = useRef('')
  const activeMkey = mkey

  const rememberScroll = () => {
    const scroller = contentRef.current
    if (scroller && activeScrollKey.current) scrollPositions.current[activeScrollKey.current] = scroller.scrollTop
  }

  useEffect(() => {
    if (route === 'add' && !prevIsAdd.current) setCreateKey(k => k + 1)
    prevIsAdd.current = route === 'add'
  }, [route])

  useEffect(() => {
    if (route === 'home' && view !== 'transactions') {
      setView('transactions')
    }
  }, [route, setView, view])

  const gotoView = (next: ViewId) => {
    rememberScroll()
    setRoute(routeFromView(next))
    setView(next)
  }

  useMobileBackDismiss(route === 'add', () => {
    setRoute('home')
    setView('transactions')
    onConsumeSharedReceipt?.()
  })
  useMobileBackDismiss(toolsOpen, () => setToolsOpen(false))
  const toolsRef = useDialogA11y<HTMLDivElement>(() => setToolsOpen(false), toolsOpen)

  const lastReportsHome = useRef<ViewId>('accounts')
  useEffect(() => {
    if (view === 'accounts' || view === 'goals') {
      lastReportsHome.current = view
    }
  }, [view])

  useEffect(() => {
    if (route !== 'reports') return
    const nextIndex = REPORT_TAB_VIEWS.indexOf(view)
    if (nextIndex === -1) return

    setReportTransition(nextIndex >= previousReportTab.current ? 'next' : 'prev')
    previousReportTab.current = nextIndex
  }, [route, view])

  const isInReportsSub = route === 'reports' && view !== 'accounts' && view !== 'goals'
  useMobileBackDismiss(isInReportsSub, () => { rememberScroll(); setView(lastReportsHome.current) })

  const isInProfileSub = route === 'profile' && (view === 'budgets' || view === 'subscriptions')
  useMobileBackDismiss(isInProfileSub, () => { rememberScroll(); setView('dashboard') })

  useEffect(() => {
    if (route !== 'profile') return
    const nextIndex = TOOL_VIEWS.indexOf(view)
    if (nextIndex === -1) return

    setToolTransition(nextIndex >= previousToolTab.current ? 'next' : 'prev')
    previousToolTab.current = nextIndex
  }, [route, view])

  useEffect(() => {
    if (!sharedReceipt?.length) return
    setQuickAddMode('expense')
    setRoute('add')
  }, [sharedReceipt])

  useEffect(() => {
    if (!appShortcut) return
    if (appShortcut === 'add-expense' || appShortcut === 'add-income') {
      setQuickAddSheet(appShortcut === 'add-expense' ? 'expense' : 'income')
    } else if (appShortcut === 'reports') {
      gotoView('accounts')
    } else if (appShortcut === 'accounts') {
      gotoView('accounts')
    } else if (appShortcut === 'budgets') {
      gotoView('budgets')
    } else if (appShortcut === 'converter') {
      setConverterOpen(true)
    }
    onConsumeAppShortcut?.()
  }, [appShortcut, onConsumeAppShortcut])

  const goRoute = (next: MobileRoute) => {
    rememberScroll()
    if (next !== 'add') {
      setQuickAddMode(null)
      onConsumeSharedReceipt?.()
    }
    setRoute(next)
    if (next !== 'add') setView(viewFromRoute(next))
  }

  const renderReportsRoute = () => {
    if (view === 'annual') {
      return (
        <Suspense fallback={<MobileSkeletonScreen />}>
          <MobileAnnual mkey={mkey} />
        </Suspense>
      )
    }
    if (view === 'calendar') {
      return (
        <Suspense fallback={<MobileSkeletonScreen />}>
          <MobileCalendar mkey={mkey} onEditTx={onEditTx} onDeleteTx={viewProps.onDeleteTx} />
        </Suspense>
      )
    }
    if (view === 'debt') {
      return (
        <Suspense fallback={<MobileSkeletonScreen />}>
          <MobileDebt />
        </Suspense>
      )
    }
    if (view === 'cashflow') {
      return (
        <Suspense fallback={<MobileSkeletonScreen />}>
          <MobileCashflow />
        </Suspense>
      )
    }

    const goalsRenderer = mobileViews.goals

    return (
      <>
        <div className="mobile-tab-segment">
          <div className="mobile-segment mobile-segment-2" role="tablist" aria-label={t('accounts')}>
            <button
              className={view === 'accounts' ? 'on' : ''}
              role="tab"
              aria-selected={view === 'accounts'}
              onClick={() => gotoView('accounts')}
            >
              {t('accounts')}
            </button>
            <button
              className={view === 'goals' ? 'on' : ''}
              role="tab"
              aria-selected={view === 'goals'}
              onClick={() => gotoView('goals')}
            >
              {t('goals')}
            </button>
          </div>
        </div>
        <div className={`mobile-report-pane mobile-report-pane-${reportTransition}`} key={view}>
          {view === 'goals'
            ? (goalsRenderer && (
                <ViewErrorBoundary resetKey={`${route}:goals`}>
                  {goalsRenderer(viewProps)}
                </ViewErrorBoundary>
              ))
            : <MobileAccounts mkey={mkey} createRequest={viewProps.createRequest} onEditTx={onEditTx} onDeleteTx={viewProps.onDeleteTx} />}
        </div>
      </>
    )
  }

  const renderMain = () => {
    if (route === 'add') {
      const batch = batchReceipts ?? (sharedReceipt && sharedReceipt.length > 1 ? sharedReceipt : null)
      if (batch) {
        return (
          <Suspense fallback={null}>
            <MobileReceiptBatch
              receipts={batch}
              mkey={mkey}
              onDone={() => {
                setQuickAddMode(null)
                setBatchReceipts(null)
                setRoute('home')
                setView('transactions')
                onConsumeSharedReceipt?.()
              }}
              onCancel={() => {
                setQuickAddMode(null)
                setBatchReceipts(null)
                setRoute('home')
                onConsumeSharedReceipt?.()
              }}
            />
          </Suspense>
        )
      }
      return (
        <MobileCreateFlow
          key={createKey}
          mkey={mkey}
          initialMode={quickAddMode ?? undefined}
          receiptPreview={sharedReceipt?.[0] ?? undefined}
          onOpenBatch={setBatchReceipts}
          onSaved={() => {
            setQuickAddMode(null)
            setRoute('home')
            setView('transactions')
            onConsumeSharedReceipt?.()
          }}
        />
      )
    }

    if (route === 'home') {
      return (
        <MobileMovements
          mkey={mkey}
          onAdd={() => setRoute('add')}
          onEditTx={onEditTx}
          onDeleteTx={viewProps.onDeleteTx}
          onOpenSecurity={() => onSettings('pin')}
        />
      )
    }

    if (route === 'analysis') {
      return <MobileAnalytics mkey={mkey} onBudgets={() => gotoView('budgets')} onImport={() => setCsvOpen(true)} />
    }

    if (route === 'reports') {
      return renderReportsRoute()
    }

    if (route === 'profile') {
      if (view === 'subscriptions') {
        return (
          <div className={`mobile-tool-pane mobile-tool-pane-${toolTransition}`} key={view}>
            <Suspense fallback={<MobileSkeletonScreen />}>
              <MobileSubscriptions />
            </Suspense>
          </div>
        )
      }
      if (view === 'budgets') {
        const renderer = mobileViews.budgets
        return renderer ? (
          <div className={`mobile-tool-pane mobile-tool-pane-${toolTransition}`} key={view}>
            <ViewErrorBoundary resetKey={`${route}:${view}`}>
              {renderer(viewProps)}
            </ViewErrorBoundary>
          </div>
        ) : null
      }
      return (
        <MobileProfile
          userName={userName}
          goto={gotoView}
        />
      )
    }

    return null
  }

  const topBarBack = (() => {
    if (route === 'add') {
      return () => {
        setQuickAddMode(null)
        setRoute('home')
        setView('transactions')
        onConsumeSharedReceipt?.()
      }
    }
    if (isInReportsSub) return () => { rememberScroll(); setView(lastReportsHome.current) }
    if (isInProfileSub) return () => { rememberScroll(); setView('dashboard') }
    return undefined
  })()
  const routeResetKey = `${route}:${view}:${mkey}`
  useEffect(() => {
    activeScrollKey.current = routeResetKey
    if (route === 'add') return
    const scroller = contentRef.current
    if (!scroller) return
    const top = scrollPositions.current[routeResetKey] ?? 0
    requestAnimationFrame(() => scroller.scrollTo({ top, behavior: 'auto' }))
  }, [routeResetKey, route])

  const handleContentScroll = () => {
    const scroller = contentRef.current
    if (!scroller || !activeScrollKey.current) return
    scrollPositions.current[activeScrollKey.current] = scroller.scrollTop
  }

  const mainContent = (
    <ViewErrorBoundary resetKey={routeResetKey}>
      {renderMain()}
    </ViewErrorBoundary>
  )

  return (
    <main className="mobile-shell">
      {csvOpen && (
        <Suspense fallback={<div className="mobile-loading-overlay mobile-loading-skeleton" aria-live="polite"><MobileSkeletonScreen /></div>}>
          <MobileCSVImport onClose={() => setCsvOpen(false)} />
        </Suspense>
      )}
      {currencyOpen && (
        <Suspense fallback={null}>
          <MobileCurrencySheet onClose={() => setCurrencyOpen(false)} />
        </Suspense>
      )}
      {converterOpen && (
        <Suspense fallback={null}>
          <MobileCurrencyConverter onClose={() => setConverterOpen(false)} />
        </Suspense>
      )}
      {searchOpen && (
        <Suspense fallback={null}>
          <MobileGlobalSearch
            onClose={() => setSearchOpen(false)}
            onEditTx={onEditTx}
            onGotoAccounts={() => gotoView('accounts')}
            onGotoCategories={() => gotoView('budgets')}
            onGotoGoals={() => gotoView('goals')}
          />
        </Suspense>
      )}
      {toolsOpen && (
        <SheetPortal>
        <div
          ref={toolsRef}
          className="mobile-detail-sheet mobile-tools-sheet-wrap"
          role="dialog"
          aria-modal="true"
          aria-label={t('toolsLabel')}
          onClick={() => setToolsOpen(false)}
        >
          <section className="mobile-tools-sheet" onClick={event => event.stopPropagation()}>
            <header>
              <span>{t('toolsLabel')}</span>
              <button aria-label={t('close')} onClick={() => setToolsOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </header>

            <div className="mobile-tools-group">
              <div className="mobile-tools-group-title">{t('toolsLabel')}</div>
              <div className="mobile-tools-list">
                <button className="mobile-tools-row" onClick={() => { setToolsOpen(false); gotoView('budgets') }}>
                  <span className="mobile-tools-row-icon" style={{ background: '#22c55e22', color: '#22c55e' }}>
                    <Icon name="wallet" size={20} />
                  </span>
                  <div>
                    <b>{t('budgets')}</b>
                    <small>{t('budgetsQuickDesc')}</small>
                  </div>
                  <Icon name="arrowUp" size={13} className="mobile-tools-row-arrow" />
                </button>
                <button className="mobile-tools-row" onClick={() => { setToolsOpen(false); gotoView('goals') }}>
                  <span className="mobile-tools-row-icon" style={{ background: '#35d0a222', color: '#35d0a2' }}>
                    <Icon name="target" size={20} />
                  </span>
                  <div>
                    <b>{t('goals')}</b>
                    <small>{t('goalsQuickDesc')}</small>
                  </div>
                  <Icon name="arrowUp" size={13} className="mobile-tools-row-arrow" />
                </button>
                <button className="mobile-tools-row" onClick={() => { setToolsOpen(false); gotoView('annual') }}>
                  <span className="mobile-tools-row-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
                    <Icon name="chart" size={20} />
                  </span>
                  <div>
                    <b>{t('annualReport')}</b>
                    <small>{t('annualQuickDesc')}</small>
                  </div>
                  <Icon name="arrowUp" size={13} className="mobile-tools-row-arrow" />
                </button>
                <button className="mobile-tools-row" onClick={() => { setToolsOpen(false); gotoView('calendar') }}>
                  <span className="mobile-tools-row-icon" style={{ background: '#f59e0b22', color: '#f59e0b' }}>
                    <Icon name="calendar" size={20} />
                  </span>
                  <div>
                    <b>{t('calendarLabel')}</b>
                    <small>{t('calendarQuickDesc')}</small>
                  </div>
                  <Icon name="arrowUp" size={13} className="mobile-tools-row-arrow" />
                </button>
                <button className="mobile-tools-row" onClick={() => { setToolsOpen(false); gotoView('subscriptions') }}>
                  <span className="mobile-tools-row-icon" style={{ background: '#5bc0ff22', color: '#5bc0ff' }}>
                    <Icon name="repeat" size={20} />
                  </span>
                  <div>
                    <b>{t('subscriptions')}</b>
                    <small>{t('subscriptionsQuickDesc')}</small>
                  </div>
                  <Icon name="arrowUp" size={13} className="mobile-tools-row-arrow" />
                </button>
                <button className="mobile-tools-row" onClick={() => { setToolsOpen(false); gotoView('debt') }}>
                  <span className="mobile-tools-row-icon" style={{ background: '#ff6b8a22', color: '#ff6b8a' }}>
                    <Icon name="dollar" size={20} />
                  </span>
                  <div>
                    <b>{t('debtsLabel')}</b>
                    <small>{t('debtQuickDesc')}</small>
                  </div>
                  <Icon name="arrowUp" size={13} className="mobile-tools-row-arrow" />
                </button>
                <button className="mobile-tools-row" onClick={() => { setToolsOpen(false); gotoView('cashflow') }}>
                  <span className="mobile-tools-row-icon" style={{ background: '#38bdf822', color: '#38bdf8' }}>
                    <Icon name="trend" size={20} />
                  </span>
                  <div>
                    <b>{t('cashflowTitle')}</b>
                    <small>{t('cashflowQuickDesc')}</small>
                  </div>
                  <Icon name="arrowUp" size={13} className="mobile-tools-row-arrow" />
                </button>
                <button className="mobile-tools-row" onClick={() => { setToolsOpen(false); setConverterOpen(true) }}>
                  <span className="mobile-tools-row-icon" style={{ background: '#ffdd3d22', color: '#eab308' }}>
                    <Icon name="coins" size={20} />
                  </span>
                  <div>
                    <b>{t('converterTitle')}</b>
                    <small>{t('converterQuickDesc')}</small>
                  </div>
                  <Icon name="arrowUp" size={13} className="mobile-tools-row-arrow" />
                </button>
              </div>
            </div>
          </section>
        </div>
        </SheetPortal>
      )}
      <MobileTopBar
        route={route}
        view={view}
        mkey={activeMkey}
        monthKeys={keys}
        title={(route === 'reports' || route === 'profile') ? internalTitles(t)[view] : undefined}
        onBack={topBarBack}
        onMenu={route === 'home' ? (() => setToolsOpen(true)) : undefined}
        onSelectMonth={onMonth}
        onSettings={() => {
          if (route === 'profile') return onSettings()
          onSettings()
        }}
        onCurrency={() => setCurrencyOpen(true)}
        onCalendar={route === 'home' ? () => gotoView('calendar') : undefined}
        onSearch={() => setSearchOpen(true)}
      />
      {route === 'add' ? (
        mainContent
      ) : (
        <>
          <div className="mobile-content" ref={contentRef} onScroll={handleContentScroll}>
            <div className="mobile-route" key={routeResetKey}>
              {mainContent}
            </div>
          </div>
          <MobileBottomNav
            route={route}
            onRoute={goRoute}
            onQuickAdd={mode => {
              setQuickAddMode(mode)
              setRoute('add')
            }}
          />
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
