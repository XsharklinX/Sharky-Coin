import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { makeDemo, makeEmpty, newId, CURRENCIES } from '@/data/seed'
import { learnCategoryRule } from '@/data/bankCsv'
import { convertCurrency } from '@/data/currencies'
import { accountMovementsTotal, localToday } from '@/data/helpers'
import { createRecoverySnapshot } from '@/data/recovery'
import { tt } from '@/i18n'
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
  'banknote','coins','handCoins','landmark','receipt',
])

// Migración: nombres de categorías semilla originalmente en inglés → español
// Solo se aplica si el nombre actual coincide con alguno de los nombres ingleses conocidos
const CAT_MIGRATE: Record<string, { es: string; oldEn: string[] }> = {
  'cat_renta':   { es: 'Vivienda',        oldEn: ['Housing', 'Rent', 'Vivienda'] },
  'cat_super':   { es: 'Supermercado',    oldEn: ['Groceries', 'Supermarket', 'Supermercado'] },
  'cat_rest':    { es: 'Restaurantes',    oldEn: ['Restaurants', 'Dining', 'Restaurantes'] },
  'cat_trans':   { es: 'Transporte',      oldEn: ['Transport', 'Transportation', 'Transporte'] },
  'cat_serv':    { es: 'Servicios',       oldEn: ['Services', 'Bills', 'Utilities', 'Servicios'] },
  'cat_ocio':    { es: 'Entretenimiento', oldEn: ['Entertainment', 'Leisure', 'Entretenimiento'] },
  'cat_salud':   { es: 'Salud',           oldEn: ['Health', 'Healthcare', 'Salud'] },
  'cat_compras': { es: 'Compras',         oldEn: ['Shopping', 'Purchases', 'Compras'] },
  'cat_edu':     { es: 'Educación',       oldEn: ['Education', 'Educación', 'Educacion'] },
  'cat_salario': { es: 'Salario',         oldEn: ['Salary', 'Payroll', 'Salario'] },
  'cat_free':    { es: 'Freelance',       oldEn: ['Freelance'] },
  'cat_inv':     { es: 'Inversiones',     oldEn: ['Investments', 'Inversions', 'Inversiones'] },
}
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
    .map(category => {
      const migration = CAT_MIGRATE[category.id]
      const migratedName = migration && migration.oldEn.includes(category.name)
        ? migration.es
        : category.name
      return {
        ...category,
        icon: ICONS.has(category.icon) ? category.icon : 'wallet' as const,
        name: migratedName,
      }
    })
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
  // Back-derivar el saldo de apertura de cuentas antiguas (sin tocar el saldo
  // mostrado): opening = saldo actual − movimientos. Una vez fijado, persiste y
  // permite auditar/recalcular más adelante.
  const accountsWithOpening = accounts.map(account =>
    amount(account.openingBalance)
      ? account
      : { ...account, openingBalance: account.balance - accountMovementsTotal(account.id, transactions, goalContributions) })
  return {
    accounts: accountsWithOpening, categories, goals, transactions, goalContributions,
    currency: ['DOP','USD','EUR','MXN','GBP','COP','ARS','BRL','CAD'].includes(data.currency ?? '') ? data.currency! : 'DOP',
  }
}

/**
 * Recalcula el saldo de cada cuenta desde su saldo de apertura inmutable más la
 * suma de todos sus movimientos. Devuelve las cuentas corregidas; es idempotente
 * cuando no hay deriva.
 */
export function recomputeAccountBalances(
  accounts: Account[], txns: Transaction[], contributions: GoalContribution[],
): Account[] {
  return accounts.map(account => {
    const opening = account.openingBalance ?? account.balance - accountMovementsTotal(account.id, txns, contributions)
    const balance = opening + accountMovementsTotal(account.id, txns, contributions)
    return { ...account, openingBalance: opening, balance }
  })
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

function assertTransactionShape(tx: Transaction, accounts: Account[], categories: Category[]): void {
  if (!['income', 'expense', 'transfer'].includes(tx.type)) throw new Error(tt('errInvalidTransaction'))
  if (!Number.isFinite(tx.amount) || tx.amount <= 0) throw new Error(tt('errAmountPositive'))
  if (!date(tx.date) || !text(tx.note)) throw new Error(tt('fillAllError'))

  const accountIds = new Set(accounts.map(account => account.id))
  const categoryIds = new Set(categories.map(category => category.id))

  if (tx.type === 'transfer') {
    if (!tx.fromAccount || !tx.toAccount || tx.fromAccount === tx.toAccount) throw new Error(tt('errSameAccount'))
    if (!accountIds.has(tx.fromAccount)) throw new Error(tt('errAccountNotExist'))
    if (!accountIds.has(tx.toAccount)) throw new Error(tt('errDestAccountNotExist'))
    return
  }

  if (!tx.accountId || !accountIds.has(tx.accountId)) throw new Error(tt('errAccountNotExist'))
  if (tx.categoryId && categoryIds.size > 0 && !categoryIds.has(tx.categoryId)) throw new Error(tt('categoryError'))
}

function normalizeTransaction(tx: Transaction): Transaction {
  if (tx.type === 'transfer') {
    const { id, type, amount, date, note, fromAccount, toAccount, tags } = tx
    return { id, type, amount, date, note, fromAccount, toAccount, ...(tags?.length ? { tags } : {}) }
  }

  const {
    id, type, amount, date, note, categoryId, accountId,
    recurring, recurringStart, recurringEnd, recurringNext, skippedDates, tags,
  } = tx
  return {
    id, type, amount, date, note, categoryId, accountId,
    ...(recurring ? { recurring, recurringStart, recurringEnd, recurringNext, skippedDates } : {}),
    ...(tags?.length ? { tags } : {}),
  }
}

export function assertAvailableBalance(accounts: Account[], accountId: string, amount: number): void {
  const account = accounts.find(a => a.id === accountId)
  if (!account) throw new Error(tt('errAccountNotExist'))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(tt('errAmountPositive'))
  if (account.type === 'credit') {
    if (account.limit !== undefined && account.balance - amount < -account.limit)
      throw new Error(tt('errCreditLimitExceeded', { name: account.name }))
    return
  }
  if (account.balance < amount) throw new Error(tt('errInsufficientBalance', { name: account.name }))
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
  reconcileAccount: (id: string, balance: number) => void

  // Metas
  addGoal:     (g: Omit<Goal, 'id'>) => void
  updateGoal:  (id: string, fields: Partial<Goal>) => void
  deleteGoal:  (id: string) => void
  contribute:  (goalId: string, amount: number, fromAccountId: string, note?: string, date?: string) => void

  // Categorías
  addCategory:    (c: Omit<Category, 'id'>) => void
  updateCategory: (id: string, fields: Partial<Category>) => void
  deleteCategory: (id: string) => void

  // Config
  setCurrency: (code: CurrencyCode) => void

  // Integridad: recalcula los saldos desde apertura + movimientos.
  // Devuelve cuántas cuentas estaban derivadas (se corrigieron).
  recomputeBalances: () => number

  // Datos
  startDemo:  () => void
  startEmpty: () => void
  restoreBackup: (data: Pick<FinanceState, 'accounts' | 'transactions' | 'categories' | 'goals' | 'goalContributions' | 'currency'>) => void
}

// ── Store ─────────────────────────────────────────────────
export const useFinance = create<FinanceState>()(
  persist(
    (set, get) => ({
      ...makeDemo(),
      goalContributions: [],
      currency: 'DOP',

      // ── Transacciones ──────────────────────────────────
      addTx: (tx) => set(s => {
        const full: Transaction = normalizeTransaction({ id: newId(), ...tx } as Transaction)
        assertTransactionShape(full, s.accounts, s.categories)
        if (full.type === 'transfer') assertAvailableBalance(s.accounts, full.fromAccount!, full.amount)
        assertManualExpenseBalance(s.accounts, full)
        if (full.type !== 'transfer' && full.categoryId) learnCategoryRule(full.note, full.categoryId)
        return {
          transactions: sortTxns([full, ...s.transactions]),
          accounts:     applyBalance(s.accounts, full, 1),
        }
      }),

      importTxs: (txs) => set(s => {
        const full = txs.map(tx => normalizeTransaction({ id: newId(), ...tx } as Transaction))
        full.forEach(tx => assertTransactionShape(tx, s.accounts, s.categories))
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
        if (old.type === 'transfer' && fields.type && fields.type !== 'transfer') throw new Error(tt('errEditTransferAsMovement'))
        if (old.type !== 'transfer' && fields.type === 'transfer') throw new Error(tt('errUseTransferFlow'))
        const next = normalizeTransaction({ ...old, ...fields } as Transaction)
        assertTransactionShape(next, s.accounts, s.categories)
        const reverted = applyBalance(s.accounts, old, -1)
        if (next.type === 'transfer') assertAvailableBalance(reverted, next.fromAccount!, next.amount)
        assertManualExpenseBalance(reverted, next)
        if (next.type !== 'transfer' && next.categoryId && next.categoryId !== old.categoryId) {
          learnCategoryRule(next.note, next.categoryId)
        }
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
        if (fromAccount === toAccount) throw new Error(tt('errSameAccount'))
        assertAvailableBalance(s.accounts, fromAccount, amount)
        if (!s.accounts.some(a => a.id === toAccount)) throw new Error(tt('errDestAccountNotExist'))
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
        // Cuenta nueva sin movimientos: el saldo de apertura es el saldo inicial.
        accounts: [...s.accounts, { id: newId('acc_'), ...account, openingBalance: account.openingBalance ?? account.balance }],
      })),

      updateAccount: (id, fields) => set(s => ({
        accounts: s.accounts.map(account => {
          if (account.id !== id) return account
          const next = { ...account, ...fields }
          // Editar el saldo a mano es una corrección del saldo actual: ajustamos
          // el saldo de apertura para preservar la invariante opening + movimientos.
          if (fields.balance !== undefined && fields.openingBalance === undefined) {
            next.openingBalance = fields.balance - accountMovementsTotal(id, s.transactions, s.goalContributions)
          }
          return next
        }),
      })),

      deleteAccount: (id) => set(s => {
        if (!canDeleteAccount(id, s.transactions)) throw new Error(tt('errDeleteAccountWithTxns'))
        if (s.goalContributions.some(contribution => contribution.fromAccountId === id)) throw new Error(tt('errDeleteAccountWithContribs'))
        return { accounts: s.accounts.filter(account => account.id !== id) }
      }),

      reconcileAccount: (id, balance) => set(s => ({
        accounts: s.accounts.map(account => account.id === id
          ? {
              ...account,
              balance,
              openingBalance: balance - accountMovementsTotal(id, s.transactions, s.goalContributions),
            }
          : account),
      })),

      // ── Metas ──────────────────────────────────────────
      addGoal: (g) => set(s => ({
        goals: [...s.goals, { id: newId('goal_'), ...g, saved: g.saved ?? 0 }],
      })),

      updateGoal: (id, fields) => set(s => ({
        goals: s.goals.map(g => g.id === id ? { ...g, ...fields } : g),
      })),

      deleteGoal: (id) => set(s => ({
        goals: s.goals.filter(g => g.id !== id),
        goalContributions: s.goalContributions.filter(contribution => contribution.goalId !== id),
      })),

      contribute: (goalId, amount, fromAccountId, note, date) => set(s => {
        assertAvailableBalance(s.accounts, fromAccountId, amount)
        if (!s.goals.some(g => g.id === goalId)) throw new Error(tt('errGoalNotExist'))
        const contribution: GoalContribution = {
          id: newId('contrib_'),
          goalId,
          amount,
          fromAccountId,
          date: date ?? localToday(),
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
        return { categories: [...s.categories, { id: newId('cat_'), ...c, name: c.name.trim() }] }
      }),

      updateCategory: (id, fields) => set(s => {
        if (fields.name !== undefined && (!text(fields.name) || !/\p{L}/u.test(fields.name))) throw new Error('Escribe un nombre válido para la categoría.')
        return { categories: s.categories.map(c => c.id === id ? { ...c, ...fields, ...(fields.name ? { name: fields.name.trim() } : {}) } : c) }
      }),

      deleteCategory: (id) => set(s => {
        if (!canDeleteCategory(id, s.transactions)) throw new Error(tt('errDeleteCategoryWithTxns'))
        return { categories: s.categories.filter(c => c.id !== id) }
      }),

      // ── Config ─────────────────────────────────────────
      // Cambia la moneda activa y convierte todos los montos ya
      // registrados (cuentas, transacciones, metas, presupuestos) a su
      // equivalente real en la nueva moneda, según las tasas de cambio.
      setCurrency: (currency) => set(s => {
        if (currency === s.currency) return { currency }

        const decimals = CURRENCIES[currency].decimals
        const factor = 10 ** decimals
        const conv = (n: number) => Math.round(convertCurrency(n, s.currency, currency) * factor) / factor

        return {
          currency,
          accounts: s.accounts.map(a => ({
            ...a,
            balance: conv(a.balance),
            ...(a.openingBalance !== undefined ? { openingBalance: conv(a.openingBalance) } : {}),
            ...(a.limit !== undefined ? { limit: conv(a.limit) } : {}),
          })),
          transactions: s.transactions.map(t => ({ ...t, amount: conv(t.amount) })),
          categories: s.categories.map(c => ({
            ...c,
            budget: conv(c.budget),
            ...(c.weeklyBudget !== undefined ? { weeklyBudget: conv(c.weeklyBudget) } : {}),
            ...(c.annualBudget !== undefined ? { annualBudget: conv(c.annualBudget) } : {}),
          })),
          goals: s.goals.map(g => ({ ...g, target: conv(g.target), saved: conv(g.saved) })),
          goalContributions: s.goalContributions.map(gc => ({ ...gc, amount: conv(gc.amount) })),
        }
      }),

      // ── Integridad de saldos ───────────────────────────
      recomputeBalances: () => {
        const { accounts, transactions, goalContributions } = get()
        const recomputed = recomputeAccountBalances(accounts, transactions, goalContributions)
        const drifted = recomputed.reduce((n, account, i) =>
          Math.abs(account.balance - accounts[i].balance) > 0.005 ? n + 1 : n, 0)
        set({ accounts: recomputed })
        return drifted
      },

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
