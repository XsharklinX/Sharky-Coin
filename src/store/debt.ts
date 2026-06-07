import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Debt {
  id: string
  name: string
  balance: number
  rate: number      // annual interest %
  minPayment: number
  color: string
}

export type PayoffMethod = 'snowball' | 'avalanche'

export interface PayoffResult {
  months: number
  totalInterest: number
  order: string[]
}

export function simulatePayoff(debts: Debt[], monthlyExtra: number, method: PayoffMethod): PayoffResult {
  if (debts.length === 0) return { months: 0, totalInterest: 0, order: [] }

  const balances = new Map<string, number>(debts.map(d => [d.id, Math.max(0, d.balance)]))
  let extra = monthlyExtra
  const order: string[] = []
  let months = 0
  let totalInterest = 0

  while ([...balances.values()].some(b => b > 0.01) && months < 600) {
    months++
    let freed = 0

    for (const debt of debts) {
      const bal = balances.get(debt.id)!
      if (bal <= 0.01) continue
      const interest = bal * (debt.rate / 100 / 12)
      totalInterest += interest
      balances.set(debt.id, bal + interest)
    }

    for (const debt of debts) {
      const bal = balances.get(debt.id)!
      if (bal <= 0.01) continue
      const newBal = Math.max(0, bal - Math.min(debt.minPayment, bal))
      balances.set(debt.id, newBal)
      if (newBal < 0.01 && !order.includes(debt.id)) {
        order.push(debt.id)
        freed += debt.minPayment
      }
    }

    const active = debts.filter(d => (balances.get(d.id)!) > 0.01)
    if (active.length > 0) {
      const sorted = method === 'snowball'
        ? [...active].sort((a, b) => balances.get(a.id)! - balances.get(b.id)!)
        : [...active].sort((a, b) => b.rate - a.rate)

      let rem = extra
      for (const d of sorted) {
        if (rem <= 0.01) break
        const bal = balances.get(d.id)!
        const payment = Math.min(rem, bal)
        const newBal = Math.max(0, bal - payment)
        balances.set(d.id, newBal)
        rem -= payment
        if (newBal < 0.01 && !order.includes(d.id)) {
          order.push(d.id)
          freed += d.minPayment
        }
      }
    }

    extra += freed
  }

  return { months, totalInterest, order }
}

interface DebtState {
  debts: Debt[]
  extraPayment: number
  addDebt: (d: Omit<Debt, 'id'>) => void
  updateDebt: (id: string, d: Partial<Omit<Debt, 'id'>>) => void
  deleteDebt: (id: string) => void
  setExtraPayment: (v: number) => void
}

export const useDebt = create<DebtState>()(
  persist(
    (set) => ({
      debts: [],
      extraPayment: 0,
      addDebt: d => set(s => ({ debts: [...s.debts, { ...d, id: crypto.randomUUID() }] })),
      updateDebt: (id, d) => set(s => ({ debts: s.debts.map(debt => debt.id === id ? { ...debt, ...d } : debt) })),
      deleteDebt: id => set(s => ({ debts: s.debts.filter(d => d.id !== id) })),
      setExtraPayment: extraPayment => set({ extraPayment }),
    }),
    { name: 'sharky-debts-v1', storage: createJSONStorage(() => localStorage) }
  )
)
