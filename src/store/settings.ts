import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ThemeName, DensityName, OverdraftPolicy } from '@/types'

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
  releaseChannel: 'stable' | 'beta'
  errorTelemetryEnabled: boolean
  displayName: string
  language: 'en' | 'es'
  requireBiometric: boolean

  setTheme:             (v: ThemeName)  => void
  setAccent:            (v: string)     => void
  setDensity:           (v: DensityName)=> void
  setFont:              (v: string)     => void
  setShowSidebarLabels: (v: boolean)    => void
  setAuthEnabled:       (v: boolean)    => void
  setOverdraftPolicy:   (v: OverdraftPolicy) => void
  setBudgetAlertThresholds: (v: number[]) => void
  setAnomalySensitivity: (v: SettingsState['anomalySensitivity']) => void
  setReleaseChannel: (v: SettingsState['releaseChannel']) => void
  setErrorTelemetryEnabled: (v: boolean) => void
  setDisplayName: (v: string) => void
  setLanguage: (v: 'en' | 'es') => void
  setRequireBiometric: (v: boolean) => void
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
      releaseChannel: 'stable',
      errorTelemetryEnabled: false,
      displayName: '',
      language: 'es',
      requireBiometric: false,

      setTheme:             (theme)             => set({ theme }),
      setAccent:            (accent)            => set({ accent }),
      setDensity:           (density)           => set({ density }),
      setFont:              (font)              => set({ font }),
      setShowSidebarLabels: (showSidebarLabels) => set({ showSidebarLabels }),
      setAuthEnabled:       (authEnabled)       => set({ authEnabled }),
      setOverdraftPolicy:   (overdraftPolicy)   => set({ overdraftPolicy }),
      setBudgetAlertThresholds: (budgetAlertThresholds) => set({ budgetAlertThresholds }),
      setAnomalySensitivity: (anomalySensitivity) => set({ anomalySensitivity }),
      setReleaseChannel: (releaseChannel) => set({ releaseChannel }),
      setErrorTelemetryEnabled: (errorTelemetryEnabled) => set({ errorTelemetryEnabled }),
      setDisplayName: (displayName) => set({ displayName }),
      setLanguage: (language) => set({ language }),
      setRequireBiometric: (requireBiometric) => set({ requireBiometric }),
    }),
    {
      name:    'sharky-settings-v2',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = persisted as Partial<SettingsState>
        const oldDark = ['midnight', 'slate', 'carbon']
        const theme = oldDark.includes(p.theme as string) ? 'dark' : (p.theme === 'light' ? 'light' : current.theme)
        return { ...current, ...p, theme }
      },
    },
  ),
)
