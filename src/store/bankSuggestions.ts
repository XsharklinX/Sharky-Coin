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
  /** Paquete de la app que generó el aviso (ej. "com.bhd.bankingapp") — para recordar a qué cuenta mapearlo. */
  pkg: string
  /** Últimos 4 dígitos de la tarjeta/cuenta, si el banco los incluyó en el texto. */
  cardLast4?: string
  /** Moneda detectada en el aviso; ayuda a elegir la cuenta correcta (DOP vs USD). */
  currency?: 'DOP' | 'USD'
}

interface BankSuggestionsState {
  enabled: boolean
  items: BankSuggestion[]
  /** Recuerda a qué cuenta asignar los avisos de cada app bancaria, una vez que el usuario confirma una. */
  packageAccountMap: Record<string, string>
  setEnabled: (enabled: boolean) => void
  add: (item: Omit<BankSuggestion, 'id'>) => void
  remove: (id: string) => void
  clear: () => void
  rememberAccountForPackage: (pkg: string, accountId: string) => void
  forgetAccountForPackage: (pkg: string) => void
}

export const useBankSuggestions = create<BankSuggestionsState>()(
  persist(
    (set, get) => ({
      enabled: false,
      items: [],
      packageAccountMap: {},
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
      rememberAccountForPackage: (pkg, accountId) => set((state) => ({
        packageAccountMap: { ...state.packageAccountMap, [pkg]: accountId },
      })),
      forgetAccountForPackage: (pkg) => set((state) => {
        const { [pkg]: _removed, ...rest } = state.packageAccountMap
        return { packageAccountMap: rest }
      }),
    }),
    {
      name: 'sharky-bank-suggestions-v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
