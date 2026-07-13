import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ThemeName, DensityName, OverdraftPolicy } from '@/types'
import { isAndroidTauri } from '@/lib/secureBlob'
import { saveAppLock } from '@/lib/appLockStorage'

interface SettingsState {
  theme:             ThemeName
  accent:            string
  density:           DensityName
  font:              string
  showSidebarLabels: boolean
  authEnabled:       boolean
  overdraftPolicy:   OverdraftPolicy
  budgetAlertThresholds: number[]
  anomalySensitivity: 'strict' | 'balanced' | 'relaxed'
  anomalyAlertsEnabled: boolean
  releaseChannel: 'stable' | 'beta'
  errorTelemetryEnabled: boolean
  displayName: string
  language: 'en' | 'es'
  languageAutoDetected: boolean
  requireBiometric: boolean
  appPin: string | null
  appPattern: string | null
  soundsEnabled: boolean
  soundProfile: 'silent' | 'soft' | 'full'
  soundVolume: number
  compactNumbers: boolean
  dismissedAlerts: string[]
  notifiedAlerts: string[]
  hasSeenOnboarding: boolean
  remindersEnabled: boolean
  widgetAccountIds: string[]
  lastWeeklyBackupAt: string | null
  weeklyAutoBackupEnabled: boolean
  weeklyAutoBackupDay: number
  weeklyAutoBackupHour: number
  fxAlertEnabled: boolean
  fxAlertCurrency: string
  fxAlertThreshold: number
  fxAlertDirection: 'above' | 'below'

  setTheme:             (v: ThemeName)  => void
  setAccent:            (v: string)     => void
  setDensity:           (v: DensityName)=> void
  setFont:              (v: string)     => void
  setShowSidebarLabels: (v: boolean)    => void
  setAuthEnabled:       (v: boolean)    => void
  setOverdraftPolicy:   (v: OverdraftPolicy) => void
  setBudgetAlertThresholds: (v: number[]) => void
  setAnomalySensitivity: (v: SettingsState['anomalySensitivity']) => void
  setAnomalyAlertsEnabled: (v: boolean) => void
  setReleaseChannel: (v: SettingsState['releaseChannel']) => void
  setErrorTelemetryEnabled: (v: boolean) => void
  setDisplayName: (v: string) => void
  setLanguage: (v: 'en' | 'es') => void
  setLanguageAutoDetected: (v: boolean) => void
  setRequireBiometric: (v: boolean) => void
  setAppPin: (v: string | null) => void
  setAppPattern: (v: string | null) => void
  setSoundsEnabled: (v: boolean) => void
  setSoundProfile: (v: SettingsState['soundProfile']) => void
  setSoundVolume: (v: number) => void
  setCompactNumbers: (v: boolean) => void
  dismissAlert: (id: string) => void
  markAlertNotified: (id: string) => void
  markOnboardingSeen: () => void
  setRemindersEnabled: (v: boolean) => void
  setWidgetAccountIds: (ids: string[]) => void
  setLastWeeklyBackupAt: (v: string | null) => void
  setWeeklyAutoBackupEnabled: (v: boolean) => void
  setWeeklyAutoBackupDay: (v: number) => void
  setWeeklyAutoBackupHour: (v: number) => void
  setFxAlertEnabled:    (v: boolean) => void
  setFxAlertCurrency:   (v: string) => void
  setFxAlertThreshold:  (v: number) => void
  setFxAlertDirection:  (v: 'above' | 'below') => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme:             'dark',
      accent:            '#3b82f6',
      density:           'regular',
      font:              'Plus Jakarta Sans',
      showSidebarLabels: true,
      authEnabled:       false,   // por defecto sin login
      overdraftPolicy:   'warn',
      budgetAlertThresholds: [50, 80, 100],
      anomalySensitivity: 'balanced',
      anomalyAlertsEnabled: false, // opt-in: hay que calibrar sensibilidad con uso real antes de avisar
      releaseChannel: 'stable',
      errorTelemetryEnabled: false,
      displayName: '',
      language: 'es',
      languageAutoDetected: false,
      requireBiometric: false,
      appPin: null,
      appPattern: null,
      soundsEnabled: true,
      soundProfile: 'soft',
      soundVolume: 0.55,
      compactNumbers: false,
      dismissedAlerts: [],
      notifiedAlerts: [],
      hasSeenOnboarding: false,
      remindersEnabled: true,
      widgetAccountIds: [],
      lastWeeklyBackupAt: null,
      weeklyAutoBackupEnabled: true,
      weeklyAutoBackupDay: 1,
      weeklyAutoBackupHour: 3,
      fxAlertEnabled: false,
      fxAlertCurrency: 'USD',
      fxAlertThreshold: 60,
      fxAlertDirection: 'above',

      setTheme:             (theme)             => set({ theme }),
      setAccent:            (accent)            => set({ accent }),
      setDensity:           (density)           => set({ density }),
      setFont:              (font)              => set({ font }),
      setShowSidebarLabels: (showSidebarLabels) => set({ showSidebarLabels }),
      setAuthEnabled:       (authEnabled)       => set({ authEnabled }),
      setOverdraftPolicy:   (overdraftPolicy)   => set({ overdraftPolicy }),
      setBudgetAlertThresholds: (budgetAlertThresholds) => set({ budgetAlertThresholds }),
      setAnomalySensitivity: (anomalySensitivity) => set({ anomalySensitivity }),
      setAnomalyAlertsEnabled: (anomalyAlertsEnabled) => set({ anomalyAlertsEnabled }),
      setReleaseChannel: (releaseChannel) => set({ releaseChannel }),
      setErrorTelemetryEnabled: (errorTelemetryEnabled) => set({ errorTelemetryEnabled }),
      setDisplayName: (displayName) => set({ displayName }),
      setLanguage: (language) => set({ language }),
      setLanguageAutoDetected: (languageAutoDetected) => set({ languageAutoDetected }),
      setRequireBiometric: (requireBiometric) => set({ requireBiometric }),
      setAppPin: (appPin) => set(state => {
        const appPattern = appPin ? null : state.appPattern
        void saveAppLock(appPin, appPattern)
        return {
          appPin,
          appPattern,
          requireBiometric: state.requireBiometric && !!(appPin || appPattern),
        }
      }),
      setAppPattern: (appPattern) => set(state => {
        const appPin = appPattern ? null : state.appPin
        void saveAppLock(appPin, appPattern)
        return {
          appPattern,
          appPin,
          requireBiometric: state.requireBiometric && !!(appPattern || appPin),
        }
      }),
      setSoundsEnabled: (soundsEnabled) => set({ soundsEnabled }),
      setSoundProfile: (soundProfile) => set({
        soundProfile,
        soundsEnabled: soundProfile !== 'silent',
        soundVolume: soundProfile === 'silent' ? 0 : soundProfile === 'soft' ? 0.45 : 0.8,
      }),
      setSoundVolume: (soundVolume) => set({ soundVolume: Math.min(1, Math.max(0, soundVolume)) }),
      setCompactNumbers: (compactNumbers) => set({ compactNumbers }),
      dismissAlert: (id) => set(state =>
        state.dismissedAlerts.includes(id) ? state : { dismissedAlerts: [...state.dismissedAlerts, id] }),
      markAlertNotified: (id) => set(state =>
        state.notifiedAlerts.includes(id) ? state : { notifiedAlerts: [...state.notifiedAlerts, id] }),
      markOnboardingSeen: () => set({ hasSeenOnboarding: true }),
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      setWidgetAccountIds: (widgetAccountIds) => set({ widgetAccountIds }),
      setLastWeeklyBackupAt: (lastWeeklyBackupAt) => set({ lastWeeklyBackupAt }),
      setWeeklyAutoBackupEnabled: (weeklyAutoBackupEnabled) => set({ weeklyAutoBackupEnabled }),
      setWeeklyAutoBackupDay: (weeklyAutoBackupDay) => set({ weeklyAutoBackupDay: Math.max(0, Math.min(6, weeklyAutoBackupDay)) }),
      setWeeklyAutoBackupHour: (weeklyAutoBackupHour) => set({ weeklyAutoBackupHour: Math.max(0, Math.min(23, weeklyAutoBackupHour)) }),
      setFxAlertEnabled:   (fxAlertEnabled) => set({ fxAlertEnabled }),
      setFxAlertCurrency:  (fxAlertCurrency) => set({ fxAlertCurrency }),
      setFxAlertThreshold: (fxAlertThreshold) => set({ fxAlertThreshold: Math.max(0, fxAlertThreshold) }),
      setFxAlertDirection: (fxAlertDirection) => set({ fxAlertDirection }),
    }),
    {
      name:    'sharky-settings-v2',
      storage: createJSONStorage(() => localStorage),
      // En Android, el PIN/patrón se cifran por separado vía Android Keystore
      // (ver src/lib/appLockStorage.ts) y no deben quedar en texto plano aquí.
      partialize: (state) => {
        if (!isAndroidTauri()) return state
        const { appPin: _appPin, appPattern: _appPattern, ...rest } = state
        return rest as SettingsState
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<SettingsState>
        const oldDark = ['midnight', 'slate', 'carbon']
        const validThemes: ThemeName[] = ['dark', 'light', 'amoled', 'system']
        const theme = oldDark.includes(p.theme as string)
          ? 'dark'
          : validThemes.includes(p.theme as ThemeName) ? (p.theme as ThemeName) : current.theme
        return { ...current, ...p, theme }
      },
    },
  ),
)
