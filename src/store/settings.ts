import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ThemeName, DensityName, OverdraftPolicy } from '@/types'

interface SettingsState {
  theme:             ThemeName
  accent:            string
  density:           DensityName
  font:              string
  showSidebarLabels: boolean
  authEnabled:       boolean   // false = sin login obligatorio
  overdraftPolicy:   OverdraftPolicy

  setTheme:             (v: ThemeName)  => void
  setAccent:            (v: string)     => void
  setDensity:           (v: DensityName)=> void
  setFont:              (v: string)     => void
  setShowSidebarLabels: (v: boolean)    => void
  setAuthEnabled:       (v: boolean)    => void
  setOverdraftPolicy:   (v: OverdraftPolicy) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme:             'midnight',
      accent:            '#3b82f6',
      density:           'regular',
      font:              'Plus Jakarta Sans',
      showSidebarLabels: true,
      authEnabled:       false,   // por defecto sin login
      overdraftPolicy:   'warn',

      setTheme:             (theme)             => set({ theme }),
      setAccent:            (accent)            => set({ accent }),
      setDensity:           (density)           => set({ density }),
      setFont:              (font)              => set({ font }),
      setShowSidebarLabels: (showSidebarLabels) => set({ showSidebarLabels }),
      setAuthEnabled:       (authEnabled)       => set({ authEnabled }),
      setOverdraftPolicy:   (overdraftPolicy)   => set({ overdraftPolicy }),
    }),
    {
      name:    'sharky-settings-v2',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
