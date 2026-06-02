import type { FinanceState } from '@/store/finance'
import type { Account, Category, CurrencyCode, Goal, Transaction } from '@/types'

export interface FinanceBackup {
  version: 1
  exportedAt: string
  data: {
    accounts: Account[]
    categories: Category[]
    goals: Goal[]
    transactions: Transaction[]
    currency: CurrencyCode
  }
}

export function createBackup(state: FinanceState): FinanceBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      accounts: state.accounts,
      categories: state.categories,
      goals: state.goals,
      transactions: state.transactions,
      currency: state.currency,
    },
  }
}

export function parseBackup(value: string): FinanceBackup['data'] {
  let backup: Partial<FinanceBackup>
  try {
    backup = JSON.parse(value) as Partial<FinanceBackup>
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  const data = backup.data
  if (backup.version !== 1 || !data || !Array.isArray(data.accounts) || !Array.isArray(data.categories) || !Array.isArray(data.goals) || !Array.isArray(data.transactions)) {
    throw new Error('El archivo no es un backup válido de $harky.')
  }
  if (!['DOP', 'USD', 'EUR'].includes(data.currency)) throw new Error('El backup contiene una moneda no compatible.')
  assertUniqueIds(data.accounts, 'cuentas')
  assertUniqueIds(data.categories, 'categorías')
  assertUniqueIds(data.goals, 'metas')
  assertUniqueIds(data.transactions, 'transacciones')
  if (!data.accounts.every(account => isText(account.id) && isText(account.name) && isText(account.short)
    && ['debit', 'savings', 'credit', 'cash'].includes(account.type) && isText(account.color)
    && isFiniteNumber(account.balance) && (account.last4 === null || typeof account.last4 === 'string')
    && (account.limit === undefined || isNonNegativeNumber(account.limit)))) {
    throw new Error('El backup contiene cuentas inválidas.')
  }
  if (!data.categories.every(category => isText(category.id) && isText(category.name)
    && ['expense', 'income'].includes(category.type) && isText(category.color)
    && isNonNegativeNumber(category.budget) && isText(category.icon))) {
    throw new Error('El backup contiene categorías inválidas.')
  }
  if (!data.goals.every(goal => isText(goal.id) && isText(goal.name) && isText(goal.color) && isText(goal.icon)
    && isNonNegativeNumber(goal.target) && isNonNegativeNumber(goal.saved)
    && (goal.deadline === undefined || isDate(goal.deadline)))) {
    throw new Error('El backup contiene metas inválidas.')
  }
  const accountIds = new Set(data.accounts.map(account => account.id))
  const categoryIds = new Set(data.categories.map(category => category.id))
  if (!data.transactions.every(tx => isValidTransaction(tx, accountIds, categoryIds))) {
    throw new Error('El backup contiene transacciones inválidas o referencias inexistentes.')
  }
  return data
}

function assertUniqueIds(items: { id: string }[], label: string): void {
  const ids = items.map(item => item.id)
  if (ids.some(id => !isText(id)) || new Set(ids).size !== ids.length) {
    throw new Error(`El backup contiene ${label} duplicadas o sin identificador.`)
  }
}

function isValidTransaction(tx: Transaction, accounts: Set<string>, categories: Set<string>): boolean {
  if (!isText(tx.id) || !['income', 'expense', 'transfer'].includes(tx.type)
    || !isFiniteNumber(tx.amount) || tx.amount <= 0 || !isDate(tx.date) || !isText(tx.note)
    || (tx.tags !== undefined && (!Array.isArray(tx.tags) || !tx.tags.every(isText)))) return false
  if (tx.type === 'transfer') {
    return isText(tx.fromAccount) && isText(tx.toAccount) && tx.fromAccount !== tx.toAccount
      && accounts.has(tx.fromAccount) && accounts.has(tx.toAccount)
  }
  return isText(tx.accountId) && isText(tx.categoryId)
    && accounts.has(tx.accountId) && categories.has(tx.categoryId)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`))
}
