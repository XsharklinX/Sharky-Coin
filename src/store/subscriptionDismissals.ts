import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface SubscriptionDismissalsState {
  dismissed: string[]
  dismiss: (key: string) => void
}

/** Sugerencias de "suscripción detectada" que el usuario marcó como no relevantes. */
export const useSubscriptionDismissals = create<SubscriptionDismissalsState>()(
  persist(
    (set, get) => ({
      dismissed: [],
      dismiss: (key) => {
        if (get().dismissed.includes(key)) return
        set((state) => ({ dismissed: [...state.dismissed, key] }))
      },
    }),
    {
      name: 'sharky-subscription-dismissals-v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
