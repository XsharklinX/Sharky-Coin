import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { makeDemo, makeEmpty, newId } from '@/data/seed'
import { useSettings } from '@/store/settings'
import type { Account, Category, Transaction, Goal, CurrencyCode, OverdraftPolicy } from '@/types'

// ── Helpers de balance (inmutables) ──────────────────────
function applyBalance(accounts: Account[], tx: Transaction, sign: 1 | -1): Account[] {
  if (tx.type === 'transfer') {
    return accounts.map(a => {
      if (a.id === tx.fromAccount) return { ...a, balance: a.balance - sign * tx.amount }
      if (a.id === tx.toAccount)   return { ...a, balance: a.balance + sign * tx.amount }
      return a
    })
  }
  return accounts.map(a => {
    if (a.id !== tx.accountId) return a
    if (tx.type === 'income')  return { ...a, balance: a.balance + sign * tx.amount }
    if (tx.type === 'expense') return { ...a, balance: a.balance - sign * tx.amount }
    return a
  })
}

function sortTxns(txns: Transaction[]): Transaction[] {
  return [...txns].sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function assertAvailableBalance(accounts: Account[], accountId: string, amount: number): void {
  const account = accounts.find(a => a.id === accountId)
  if (!account) throw new Error('La cuenta seleccionada no existe.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('El monto debe ser mayor que cero.')
  if (account.type !== 'credit' && account.balance < amount) throw new Error(`Saldo insuficiente en ${account.name}.`)
}

export function canDeleteAccount(accountId: string, txns: Transaction[]): boolean {
  return !txns.some(tx => tx.accountId === accountId || tx.fromAccount === accountId || tx.toAccount === accountId)
}

export function canDeleteCategory(categoryId: string, txns: Transaction[]): boolean {
  return !txns.some(tx => tx.categoryId === categoryId)
}

function assertManualExpenseBalance(accounts: Account[], tx: Transaction, policy = useSettings.getState().overdraftPolicy): void {
  if (tx.type !== 'expense' || !tx.accountId) return
  if (policy !== 'block') return
  assertAvailableBalance(accounts, tx.accountId, tx.amount)
}

export function applyImportedBalances(accounts: Account[], txs: Transaction[], policy: OverdraftPolicy): Account[] {
  return txs.reduce((next, tx) => {
    assertManualExpenseBalance(next, tx, policy)
    return applyBalance(next, tx, 1)
  }, accounts)
}

// ── Tipos del store ───────────────────────────────────────
export interface FinanceState {
  accounts:     Account[]
  transactions: Transaction[]
  categories:   Category[]
  goals:        Goal[]
  currency:     CurrencyCode

  // Transacciones
  addTx:    (tx: Omit<Transaction, 'id'> & { id?: string }) => void
  importTxs: (txs: Array<Omit<Transaction, 'id'> & { id?: string }>) => void
  updateTx: (id: string, fields: Partial<Omit<Transaction, 'id'>>) => void
  deleteTx: (id: string) => void
  transfer: (p: { fromAccount: string; toAccount: string; amount: number; date: string; note?: string }) => void

  // Cuentas
  addAccount:    (account: Omit<Account, 'id'>) => void
  updateAccount: (id: string, fields: Partial<Omit<Account, 'id'>>) => void
  deleteAccount: (id: string) => void

  // Metas
  addGoal:     (g: Omit<Goal, 'id'>) => void
  updateGoal:  (id: string, fields: Partial<Goal>) => void
  deleteGoal:  (id: string) => void
  contribute:  (goalId: string, amount: number, fromAccountId: string) => void

  // Categorías
  addCategory:    (c: Omit<Category, 'id'>) => void
  updateCategory: (id: string, fields: Partial<Category>) => void
  deleteCategory: (id: string) => void

  // Config
  setCurrency: (code: CurrencyCode) => void

  // Datos
  startDemo:  () => void
  startEmpty: () => void
  restoreBackup: (data: Pick<FinanceState, 'accounts' | 'transactions' | 'categories' | 'goals' | 'currency'>) => void
}

// ── Store ─────────────────────────────────────────────────
export const useFinance = create<FinanceState>()(
  persist(
    (set) => ({
      ...makeDemo(),
      currency: 'DOP',

      // ── Transacciones ──────────────────────────────────
      addTx: (tx) => set(s => {
        const full: Transaction = { id: newId(), ...tx } as Transaction
        assertManualExpenseBalance(s.accounts, full)
        return {
          transactions: sortTxns([full, ...s.transactions]),
          accounts:     applyBalance(s.accounts, full, 1),
        }
      }),

      importTxs: (txs) => set(s => {
        const full = txs.map(tx => ({ id: newId(), ...tx } as Transaction))
        const accounts = applyImportedBalances(s.accounts, full, useSettings.getState().overdraftPolicy)
        return {
          transactions: sortTxns([...full, ...s.transactions]),
          accounts,
        }
      }),

      updateTx: (id, fields) => set(s => {
        const idx = s.transactions.findIndex(t => t.id === id)
        if (idx < 0) return s
        const old  = s.transactions[idx]
        const next = { ...old, ...fields }
        const reverted = applyBalance(s.accounts, old, -1)
        assertManualExpenseBalance(reverted, next)
        const accs = applyBalance(reverted, next, 1)
        const txns = [...s.transactions]
        txns[idx]  = next
        return { transactions: sortTxns(txns), accounts: accs }
      }),

      deleteTx: (id) => set(s => {
        const tx = s.transactions.find(t => t.id === id)
        if (!tx) return s
        return {
          transactions: s.transactions.filter(t => t.id !== id),
          accounts:     applyBalance(s.accounts, tx, -1),
        }
      }),

      transfer: ({ fromAccount, toAccount, amount, date, note }) => set(s => {
        if (fromAccount === toAccount) throw new Error('Selecciona dos cuentas distintas.')
        assertAvailableBalance(s.accounts, fromAccount, amount)
        if (!s.accounts.some(a => a.id === toAccount)) throw new Error('La cuenta de destino no existe.')
        const tx: Transaction = {
          id: newId(), type: 'transfer',
          amount, fromAccount, toAccount,
          date, note: note ?? 'Transferencia',
        }
        return {
          transactions: sortTxns([tx, ...s.transactions]),
          accounts:     applyBalance(s.accounts, tx, 1),
        }
      }),

      // Cuentas
      addAccount: (account) => set(s => ({
        accounts: [...s.accounts, { id: 'acc_' + Date.now().toString(36), ...account }],
      })),

      updateAccount: (id, fields) => set(s => ({
        accounts: s.accounts.map(account => account.id === id ? { ...account, ...fields } : account),
      })),

      deleteAccount: (id) => set(s => {
        if (!canDeleteAccount(id, s.transactions)) throw new Error('No puedes eliminar una cuenta con movimientos registrados.')
        return { accounts: s.accounts.filter(account => account.id !== id) }
      }),

      // ── Metas ──────────────────────────────────────────
      addGoal: (g) => set(s => ({
        goals: [...s.goals, { id: 'goal_' + Date.now().toString(36), ...g, saved: g.saved ?? 0 }],
      })),

      updateGoal: (id, fields) => set(s => ({
        goals: s.goals.map(g => g.id === id ? { ...g, ...fields } : g),
      })),

      deleteGoal: (id) => set(s => ({
        goals: s.goals.filter(g => g.id !== id),
      })),

      contribute: (goalId, amount, fromAccountId) => set(s => {
        assertAvailableBalance(s.accounts, fromAccountId, amount)
        if (!s.goals.some(g => g.id === goalId)) throw new Error('La meta seleccionada no existe.')
        return {
          goals:    s.goals.map(g => g.id === goalId ? { ...g, saved: g.saved + amount } : g),
          accounts: s.accounts.map(a => a.id === fromAccountId ? { ...a, balance: a.balance - amount } : a),
        }
      }),

      // ── Categorías ─────────────────────────────────────
      addCategory: (c) => set(s => ({
        categories: [...s.categories, { id: 'cat_' + Date.now().toString(36), ...c }],
      })),

      updateCategory: (id, fields) => set(s => ({
        categories: s.categories.map(c => c.id === id ? { ...c, ...fields } : c),
      })),

      deleteCategory: (id) => set(s => {
        if (!canDeleteCategory(id, s.transactions)) throw new Error('No puedes eliminar una categoría con movimientos registrados.')
        return { categories: s.categories.filter(c => c.id !== id) }
      }),

      // ── Config ─────────────────────────────────────────
      setCurrency: (currency) => set({ currency }),

      // ── Datos demo / vacío ─────────────────────────────
      startDemo:  () => set({ ...makeDemo(),  currency: 'DOP' }),
      startEmpty: () => set({ ...makeEmpty(), currency: 'DOP' }),
      restoreBackup: (data) => set(data),
    }),
    {
      name:    'sharky-finance-v2',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
