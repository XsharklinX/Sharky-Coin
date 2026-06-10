import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { RawBankNotification } from '@/lib/bankNotifications'

const MAX_ITEMS = 200

export interface CapturedNotification extends RawBankNotification {
  id: string
}

interface NotificationInboxState {
  enabled: boolean
  items: CapturedNotification[]
  setEnabled: (enabled: boolean) => void
  add: (item: RawBankNotification) => void
  clear: () => void
}

export const useNotificationInbox = create<NotificationInboxState>()(
  persist(
    (set) => ({
      enabled: false,
      items: [],
      setEnabled: (enabled) => set({ enabled }),
      add: (item) =>
        set((state) => ({
          items: [
            { ...item, id: `${item.postTime}-${Math.random().toString(36).slice(2)}` },
            ...state.items,
          ].slice(0, MAX_ITEMS),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'sharky-notification-inbox-v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
