import { lazy, Suspense, useEffect, useState } from 'react'
import { useFinance } from '@/store/finance'
import { useAuth } from '@/store/auth'
import { flushPendingFeedback } from '@/data/feedback'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import { currentMonthKey, monthKeys } from '@/data/helpers'
import { ToastHost, toast } from '@/components/ui/Toast'
import { DialogProvider } from '@/components/ui/DialogProvider'
import { MobileWelcomeHub } from '@/mobile/MobileWelcomeHub'
import { TransactionForm } from '@/modals/TransactionForm'
import { useRecurring } from '@/hooks/useRecurring'
import { useGoalAutoContributions } from '@/hooks/useGoalAutoContributions'
import { useNotifications } from '@/hooks/useNotifications'
import { useUpcomingPaymentAlerts } from '@/hooks/useUpcomingPaymentAlerts'
import { useNotificationActions } from '@/hooks/useNotificationActions'
import { useLocalReminders } from '@/hooks/useLocalReminders'
import { useBankNotifications } from '@/hooks/useBankNotifications'
import { useHomeWidget } from '@/hooks/useHomeWidget'
import { useSharedReceipt } from '@/hooks/useSharedReceipt'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { useAndroidChrome } from '@/hooks/useAndroidChrome'
import { useAppShortcut } from '@/hooks/useAppShortcut'
import { useNotificationTarget } from '@/hooks/useNotificationTarget'
import { useAutoBackup } from '@/hooks/useAutoBackup'
import { useScheduledBackup } from '@/hooks/useScheduledBackup'
import { useWeeklyAutoBackup } from '@/hooks/useWeeklyAutoBackup'
import { useUpdateCheck } from '@/hooks/useUpdateCheck'
import { MobileUpdateDialog } from '@/mobile/MobileUpdateDialog'
import { useCloudWorkspace } from '@/hooks/useCloudWorkspace'
import { useAutoCloudSync } from '@/hooks/useAutoCloudSync'
import { useLiveExchangeRates } from '@/hooks/useLiveExchangeRates'
import { useAppLockHydration } from '@/hooks/useAppLockHydration'
import { MobileBiometricGate } from '@/mobile/MobileBiometricGate'
import { MobilePinGate } from '@/mobile/MobilePinGate'
import { MobilePatternGate } from '@/mobile/MobilePatternGate'
import { MobileShell } from '@/mobile/MobileShell'
import { MobileSettings } from '@/mobile/MobileSettings'
import { MobileSplash } from '@/mobile/MobileSplash'
import { MobileBudgets } from '@/mobile/MobileBudgets'
import { MobileGoals } from '@/mobile/MobileGoals'
import { useMobileBackDismiss } from '@/mobile/useMobileBackDismiss'
import type { Sheet } from '@/mobile/settings/shared'
import type { Transaction, ViewId, ViewProps } from '@/types'

const CalendarView = lazy(() => import('@/views/Calendar').then(m => ({ default: m.Calendar })))
const MobileNotesView = lazy(() => import('@/mobile/MobileNotes').then(m => ({ default: m.MobileNotes })))

export default function App() {
  const s = useSettings()
  const t = useT()
  const { transactions, addTx, deleteTx } = useFinance()

  const { hydrated } = useAppLockHydration()

  const hasAppLock = !!(s.appPin || s.appPattern)
  const [bioUnlocked, setBioUnlocked]  = useState(!s.requireBiometric)
  const [credUnlocked, setCredUnlocked] = useState(!hasAppLock)
  const [splashDone,   setSplashDone]   = useState(false)
  const [view,         setView]         = useState<ViewId>('dashboard')
  const [mkey,         setMkey]         = useState(currentMonthKey())
  const [txForm,       setTxForm]       = useState<Transaction | 'new' | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialSheet, setSettingsInitialSheet] = useState<Sheet | null>(null)

  const initializeAuth = useAuth(state => state.initialize)
  useEffect(() => { initializeAuth() }, [initializeAuth])

  // Reintentar comentarios que quedaron encolados sin conexión
  useEffect(() => { void flushPendingFeedback() }, [])

  // Primer arranque: adoptar el idioma del dispositivo si el usuario aún no
  // pasó por el onboarding (después de eso, respetamos su elección manual).
  useEffect(() => {
    if (!hydrated || s.languageAutoDetected) return
    if (!s.hasSeenOnboarding) {
      const deviceLang = navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es'
      s.setLanguage(deviceLang)
    }
    s.setLanguageAutoDetected(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, s.languageAutoDetected, s.hasSeenOnboarding])

  // Tras hidratar el PIN/patrón cifrados (Android), re-bloquear si corresponde:
  // `credUnlocked` se inicializó antes de conocer el valor real de `hasAppLock`.
  useEffect(() => {
    if (hydrated && hasAppLock) setCredUnlocked(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  useRecurring()
  useGoalAutoContributions()
  useNotifications()
  useUpcomingPaymentAlerts()
  useNotificationActions()
  useLocalReminders()
  useHomeWidget()
  // Vive en la raíz (no solo dentro de Ajustes > Detección de transacciones):
  // si el listener solo existiera mientras esa pantalla está montada, cualquier
  // notificación bancaria que llegue en otro momento se pierde sin dejar rastro.
  useBankNotifications()
  const [sharedReceipt, consumeSharedReceipt] = useSharedReceipt()
  const [appShortcut, consumeAppShortcut] = useAppShortcut()
  const [notificationTarget, consumeNotificationTarget] = useNotificationTarget()
  useAutoBackup()
  // Backup semanal: en Android lo ejecuta WorkManager aunque la app esté
  // cerrada (useScheduledBackup mantiene el archivo al día y programa el
  // worker). useWeeklyAutoBackup es el respaldo para desktop/PWA, donde no hay
  // WorkManager: ahí sigue corriendo al abrir la app.
  useScheduledBackup()
  useWeeklyAutoBackup()
  const availableUpdate = useUpdateCheck()
  useCloudWorkspace()
  useAutoCloudSync()
  useLiveExchangeRates()

  const overlayOpen = !!txForm || settingsOpen
  useMobileBackDismiss(overlayOpen, () => {
    if (settingsOpen) {
      setSettingsOpen(false)
      setSettingsInitialSheet(null)
    }
    else if (txForm) setTxForm(null)
  })

  const resolvedTheme = useResolvedTheme()
  const isAndroidShell = /android/i.test(navigator.userAgent)
  useAndroidChrome(resolvedTheme, isAndroidShell)
  const themeProps = {
    'data-theme':   resolvedTheme,
    'data-density': s.density,
    style: { '--accent': s.accent, fontFamily: `"${s.font}", system-ui, sans-serif` } as React.CSSProperties,
  }

  if (!hydrated) return <div className="app mobile-app" {...themeProps} />

  if (s.requireBiometric && !bioUnlocked) return (
    <div className="app mobile-app" {...themeProps}>
      <MobileBiometricGate
        onUnlocked={() => setBioUnlocked(true)}
        onUnavailable={() => setBioUnlocked(true)}
      />
    </div>
  )

  if (hasAppLock && !credUnlocked) return (
    <div className="app mobile-app" {...themeProps}>
      {s.appPattern
        ? <MobilePatternGate pattern={s.appPattern} onUnlocked={() => setCredUnlocked(true)} />
        : <MobilePinGate pin={s.appPin!} onUnlocked={() => setCredUnlocked(true)} />}
    </div>
  )

  if (!s.hasSeenOnboarding) return (
    <div className="app mobile-app" {...themeProps}>
      <MobileWelcomeHub />
    </div>
  )

  const keys = monthKeys(transactions)

  const handleDeleteTx = (id: string) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) return
    deleteTx(id)
    toast(t('movementDeleted'), {
      icon: 'trash',
      duration: 5000,
      action: {
        label: t('undo'),
        onClick: () => {
          try {
            addTx(tx)
          } catch (error) {
            toast(error instanceof Error ? error.message : t('couldNotSave'), { icon: 'alert' })
          }
        },
      },
    })
  }

  const handleEditTx = (tx: Transaction) => {
    setTxForm(tx)
  }

  const viewProps: ViewProps = {
    txns:       transactions,
    mkey,
    onAdd:      () => setTxForm('new'),
    goto:       setView,
    onEditTx:   handleEditTx,
    onDeleteTx: handleDeleteTx,
    createRequest: undefined,
  }

  const mobileViews = {
    budgets: (props: ViewProps) => <MobileBudgets {...props} />,
    goals: (props: ViewProps) => <MobileGoals {...props} />,
    notes: (props: ViewProps) => (
      <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-dim)' }}>{t('loading')}</div>}>
        <MobileNotesView {...props} />
      </Suspense>
    ),
    calendar: (props: ViewProps) => (
      <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-dim)' }}>{t('loading')}</div>}>
        <CalendarView {...props} />
      </Suspense>
    ),
  } as const

  return (
    <div className="app mobile-app" {...themeProps}>
      {!splashDone && <MobileSplash onGone={() => setSplashDone(true)} />}
      <DialogProvider>
        <MobileShell
          view={view}
          setView={setView}
          viewProps={viewProps}
          mobileViews={mobileViews}
          mkey={mkey}
          keys={keys}
          onMonth={setMkey}
          onSettings={(sheet) => {
            setSettingsInitialSheet(sheet ?? null)
            setSettingsOpen(true)
          }}
          onEditTx={handleEditTx}
          userName={s.displayName || undefined}
          sharedReceipt={sharedReceipt}
          onConsumeSharedReceipt={consumeSharedReceipt}
          appShortcut={appShortcut}
          onConsumeAppShortcut={consumeAppShortcut}
          notificationTarget={notificationTarget}
          onConsumeNotificationTarget={consumeNotificationTarget}
        />
        <ToastHost />
        {availableUpdate && !s.dismissedAlerts.includes(`update-${availableUpdate.version}`) && (
          <MobileUpdateDialog update={availableUpdate} onDismiss={() => s.dismissAlert(`update-${availableUpdate.version}`)} />
        )}
        {txForm       && <TransactionForm value={txForm} mkey={mkey} onClose={() => setTxForm(null)} onDelete={handleDeleteTx} />}
        {settingsOpen && (
          <MobileSettings
            mkey={mkey}
            initialSheet={settingsInitialSheet}
            onClose={() => {
              setSettingsOpen(false)
              setSettingsInitialSheet(null)
            }}
          />
        )}
      </DialogProvider>
    </div>
  )
}
