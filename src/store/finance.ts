import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { makeDemo, makeEmpty, newId } from '@/data/seed'
import { createRecoverySnapshot } from '@/data/recovery'
import { useSettings } from '@/store/settings'
import type { Account, Category, Transaction, Goal, GoalContribution, CurrencyCode, OverdraftPolicy } from '@/types'

type FinanceData = Pick<FinanceState, 'accounts' | 'transactions' | 'categories' | 'goals' | 'goalContributions' | 'currency'>
const ICONS = new Set([
  'home','cart','food','car','bolt','play','heart','bag','book','wallet','laptop','trend',
  'music','coffee','phone','gym','building','bus','gamepad','gift','scissors','baby','paw',
  'pill','plane','briefcase','shirt','pizza','star','fuel','flame','soda',
  'grid','list','cards','chart','target','plus','arrowUp','arrowDn','shark','search',
  'bell','close','calendar','dots','edit','trash','download','print','settings','logout',
  'repeat','tag','camera','check','alert','refresh','dollar','piggy','sliders','upload',
  'fileJson','eye','eyeOff','info','lock','user','palette',
  'tree','sun','bike','train','tv','monitor','headphones','clock','key','tool',
  'brush','graduation','stethoscope','salad','wine','crown','trophy','shield','map','package',
])
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

export function sanitizeFinanceData(value: unknown): FinanceData {
  const data = (value && typeof value === 'object' ? value : {}) as Partial<FinanceData>
  const accounts = (Array.isArray(data.accounts) ? data.accounts : []).filter(account =>
    text(account.id) && text(account.name) && text(account.short) && text(account.color)
    && ['debit', 'savings', 'credit', 'cash'].includes(account.type) && amount(account.balance))
  const accountIds = new Set(accounts.map(account => account.id))
  const categories = (Array.isArray(data.categories) ? data.categories : []).filter(category =>
    text(category.id) && text(category.name) && /\p{L}/u.test(category.name) && text(category.color)
    && ['expense', 'income'].includes(category.type) && amount(category.budget))
    .map(category => ({ ...category, icon: ICONS.has(category.icon) ? category.icon : 'wallet' as const }))
  const categoryIds = new Set(categories.map(category => category.id))
  const goals = (Array.isArray(data.goals) ? data.goals : []).filter(goal =>
    text(goal.id) && text(goal.name) && text(goal.color) && amount(goal.target) && goal.target > 0 && amount(goal.saved))
  const goalIds = new Set(goals.map(goal => goal.id))
  const transactions = (Array.isArray(data.transactions) ? data.transactions : []).filter(tx => {
    if (!text(tx.id) || !['income', 'expense', 'transfer'].includes(tx.type) || !amount(tx.amount) || tx.amount <= 0 || !date(tx.date) || !text(tx.note)) return false
    if (tx.type === 'transfer') return !!tx.fromAccount && !!tx.toAccount && accountIds.has(tx.fromAccount) && accountIds.has(tx.toAccount) && tx.fromAccount !== tx.toAccount
    return !!tx.accountId && !!tx.categoryId && accountIds.has(tx.accountId) && categoryIds.has(tx.categoryId)
  })
  const goalContributions = (Array.isArray(data.goalContributions) ? data.goalContributions : []).filter(contribution =>
    text(contribution.id) && text(contribution.goalId) && text(contribution.fromAccountId)
    && goalIds.has(contribution.goalId) && accountIds.has(contribution.fromAccountId)
    && amount(contribution.amount) && contribution.amount > 0 && date(contribution.date))
  return {
    accounts, categories, goals, transactions, goalContributions,
    currency: ['DOP','USD','EUR','MXN','GBP','COP','ARS','BRL','CAD'].includes(data.currency ?? '') ? data.currency! : 'DOP',
  }
}

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
  const accountPolicy = accounts.find(account => account.id === tx.accountId)?.overdraftPolicy ?? policy
  if (accountPolicy !== 'block') return
  assertAvailableBalance(accounts, tx.accountId, tx.amount)
}

export function applyImportedBalances(accounts: Account[], txs: Transaction[], policy: OverdraftPolicy): Account[] {
  return txs.reduce((next, tx) => {
    assertManualExpenseBalance(next, tx, policy)
    return applyBalance(next, tx, 1)
  }, accounts)
}

export function restoreFinanceDataWithSnapshot(
  current: FinanceState,
  data: Pick<FinanceState, 'accounts' | 'transactions' | 'categories' | 'goals' | 'goalContributions' | 'currency'>,
): FinanceData {
  createRecoverySnapshot(current, 'pre-restore')
  return sanitizeFinanceData(data)
}

// ── Tipos del store ───────────────────────────────────────
export interface FinanceState {
  accounts:     Account[]
  transactions: Transaction[]
  categories:   Category[]
  goals:        Goal[]
  goalContributions: GoalContribution[]
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
  contribute:  (goalId: string, amount: number, fromAccountId: string, note?: string) => void

  // Categorías
  addCategory:    (c: Omit<Category, 'id'>) => void
  updateCategory: (id: string, fields: Partial<Category>) => void
  deleteCategory: (id: string) => void

  // Config
  setCurrency: (code: CurrencyCode) => void

  // Datos
  startDemo:  () => void
  startEmpty: () => void
  restoreBackup: (data: Pick<FinanceState, 'accounts' | 'transactions' | 'categories' | 'goals' | 'goalContributions' | 'currency'>) => void
}

// ── Store ─────────────────────────────────────────────────
export const useFinance = create<FinanceState>()(
  persist(
    (set) => ({
      ...makeDemo(),
      goalContributions: [],
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
        if (s.goalContributions.some(contribution => contribution.fromAccountId === id)) throw new Error('No puedes eliminar una cuenta con aportes a metas registrados.')
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
        goalContributions: s.goalContributions.filter(contribution => contribution.goalId !== id),
      })),

      contribute: (goalId, amount, fromAccountId, note) => set(s => {
        assertAvailableBalance(s.accounts, fromAccountId, amount)
        if (!s.goals.some(g => g.id === goalId)) throw new Error('La meta seleccionada no existe.')
        const contribution: GoalContribution = {
          id: 'contrib_' + Date.now().toString(36),
          goalId,
          amount,
          fromAccountId,
          date: new Date().toISOString().slice(0, 10),
          note: note?.trim() || undefined,
        }
        return {
          goals:    s.goals.map(g => g.id === goalId ? { ...g, saved: g.saved + amount } : g),
          accounts: s.accounts.map(a => a.id === fromAccountId ? { ...a, balance: a.balance - amount } : a),
          goalContributions: [contribution, ...s.goalContributions],
        }
      }),

      // ── Categorías ─────────────────────────────────────
      addCategory: (c) => set(s => {
        if (!text(c.name) || !/\p{L}/u.test(c.name)) throw new Error('Escribe un nombre válido para la categoría.')
        return { categories: [...s.categories, { id: 'cat_' + Date.now().toString(36), ...c, name: c.name.trim() }] }
      }),

      updateCategory: (id, fields) => set(s => {
        if (fields.name !== undefined && (!text(fields.name) || !/\p{L}/u.test(fields.name))) throw new Error('Escribe un nombre válido para la categoría.')
        return { categories: s.categories.map(c => c.id === id ? { ...c, ...fields, ...(fields.name ? { name: fields.name.trim() } : {}) } : c) }
      }),

      deleteCategory: (id) => set(s => {
        if (!canDeleteCategory(id, s.transactions)) throw new Error('No puedes eliminar una categoría con movimientos registrados.')
        return { categories: s.categories.filter(c => c.id !== id) }
      }),

      // ── Config ─────────────────────────────────────────
      setCurrency: (currency) => set({ currency }),

      // ── Datos demo / vacío ─────────────────────────────
      startDemo:  () => set({ ...makeDemo(), goalContributions: [], currency: 'DOP' }),
      startEmpty: () => set({ ...makeEmpty(), goalContributions: [], currency: 'DOP' }),
      restoreBackup: (data) => set(s => restoreFinanceDataWithSnapshot(s, data)),
    }),
    {
      name:    'sharky-finance-v2',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => ({ ...current, ...sanitizeFinanceData(persisted) }),
    },
  ),
)
