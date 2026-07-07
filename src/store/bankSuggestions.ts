import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const MAX_ITEMS = 50

export interface BankSuggestion {
  id: string
  date: string // YYYY-MM-DD
  amount: number
  type: 'income' | 'expense'
  note: string
  postTime: number
}

interface BankSuggestionsState {
  enabled: boolean
  items: BankSuggestion[]
  setEnabled: (enabled: boolean) => void
  add: (item: Omit<BankSuggestion, 'id'>) => void
  remove: (id: string) => void
  clear: () => void
}

export const useBankSuggestions = create<BankSuggestionsState>()(
  persist(
    (set, get) => ({
      enabled: false,
      items: [],
      setEnabled: (enabled) => set({ enabled }),
      add: (item) => {
        // Evita duplicados cuando el banco actualiza/reemplaza la misma notificación.
        const isDuplicate = get().items.some(existing =>
          existing.date === item.date
          && existing.amount === item.amount
          && existing.type === item.type
          && Math.abs(existing.postTime - item.postTime) < 5 * 60_000)
        if (isDuplicate) return
        set((state) => ({
          items: [
            { ...item, id: `${item.postTime}-${Math.random().toString(36).slice(2)}` },
            ...state.items,
          ].slice(0, MAX_ITEMS),
        }))
      },
      remove: (id) => set((state) => ({ items: state.items.filter(item => item.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'sharky-bank-suggestions-v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
