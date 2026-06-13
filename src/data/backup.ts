import { z } from 'zod'
import { CURRENCY_CODES } from '@/constants'
import { tt } from '@/i18n'
import type { FinanceState } from '@/store/finance'
import type { Account, Category, CurrencyCode, Goal, GoalContribution, IconName, Transaction } from '@/types'

export interface FinanceBackup {
  version: 1
  exportedAt: string
  data: {
    accounts: Account[]
    categories: Category[]
    goals: Goal[]
    goalContributions: GoalContribution[]
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
      goalContributions: state.goalContributions ?? [],
      transactions: state.transactions,
      currency: state.currency,
    },
  }
}

const nonEmptyText = z.string().refine(value => value.trim().length > 0, 'No puede estar vacío.')

const dateSchema = z.string().refine(
  value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`)),
  'Fecha inválida.',
)

const iconSchema = nonEmptyText.transform(value => value as IconName)

const AccountSchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText,
  short: nonEmptyText,
  type: z.enum(['debit', 'savings', 'credit', 'cash']),
  color: nonEmptyText,
  balance: z.number().finite(),
  last4: z.string().nullable(),
  limit: z.number().finite().nonnegative().optional(),
  overdraftPolicy: z.enum(['block', 'warn', 'allow']).optional(),
})

const CategorySchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText,
  type: z.enum(['expense', 'income']),
  color: nonEmptyText,
  budget: z.number().finite().nonnegative(),
  weeklyBudget: z.number().finite().nonnegative().optional(),
  annualBudget: z.number().finite().nonnegative().optional(),
  icon: iconSchema,
})

const GoalSchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText,
  target: z.number().finite().nonnegative(),
  saved: z.number().finite().nonnegative(),
  color: nonEmptyText,
  icon: iconSchema,
  deadline: dateSchema.optional(),
})

const TransactionSchema = z.object({
  id: nonEmptyText,
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().finite().positive(),
  date: dateSchema,
  note: nonEmptyText,
  categoryId: nonEmptyText.optional(),
  accountId: nonEmptyText.optional(),
  fromAccount: nonEmptyText.optional(),
  toAccount: nonEmptyText.optional(),
  recurring: z.enum(['weekly', 'monthly']).nullable().optional(),
  recurringStart: dateSchema.optional(),
  recurringEnd: dateSchema.optional(),
  recurringNext: dateSchema.optional(),
  tags: z.array(nonEmptyText).optional(),
})

const GoalContributionSchema = z.object({
  id: nonEmptyText,
  goalId: nonEmptyText,
  amount: z.number().finite().positive(),
  fromAccountId: nonEmptyText,
  date: dateSchema,
  note: z.string().optional(),
})

function assertUniqueIds(items: { id: string }[], label: string, ctx: z.RefinementCtx): void {
  const ids = items.map(item => item.id)
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', message: `El backup contiene ${label} duplicadas o sin identificador.` })
  }
}

const BackupDataSchema = z.object({
  accounts: z.array(AccountSchema),
  categories: z.array(CategorySchema),
  goals: z.array(GoalSchema),
  transactions: z.array(TransactionSchema),
  goalContributions: z.array(GoalContributionSchema).optional().default([]),
  currency: z.enum(CURRENCY_CODES),
}).superRefine((data, ctx) => {
  assertUniqueIds(data.accounts, 'cuentas', ctx)
  assertUniqueIds(data.categories, 'categorías', ctx)
  assertUniqueIds(data.goals, 'metas', ctx)
  assertUniqueIds(data.transactions, 'transacciones', ctx)
  assertUniqueIds(data.goalContributions, 'aportes a metas', ctx)

  const accountIds = new Set(data.accounts.map(account => account.id))
  const categoryIds = new Set(data.categories.map(category => category.id))
  const goalIds = new Set(data.goals.map(goal => goal.id))

  const transactionsValid = data.transactions.every(tx => tx.type === 'transfer'
    ? !!tx.fromAccount && !!tx.toAccount && tx.fromAccount !== tx.toAccount
        && accountIds.has(tx.fromAccount) && accountIds.has(tx.toAccount)
    : !!tx.accountId && !!tx.categoryId && accountIds.has(tx.accountId) && categoryIds.has(tx.categoryId))
  if (!transactionsValid) {
    ctx.addIssue({ code: 'custom', message: 'El backup contiene transacciones inválidas o referencias inexistentes.' })
  }

  const contributionsValid = data.goalContributions.every(contribution =>
    goalIds.has(contribution.goalId) && accountIds.has(contribution.fromAccountId))
  if (!contributionsValid) {
    ctx.addIssue({ code: 'custom', message: 'El backup contiene aportes a metas inválidos o referencias inexistentes.' })
  }
})

const FinanceBackupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().optional(),
  data: BackupDataSchema,
})

export function parseBackup(value: string): FinanceBackup['data'] {
  let backup: unknown
  try {
    backup = JSON.parse(value)
  } catch {
    throw new Error(tt('errNotValidJson'))
  }

  const result = FinanceBackupSchema.safeParse(backup)
  if (!result.success) {
    const customIssue = result.error.issues.find(issue => issue.code === 'custom')
    if (customIssue) throw new Error(customIssue.message)

    const paths = new Set(result.error.issues.map(issue => issue.path[1]))
    if (paths.has('accounts')) throw new Error(tt('errBackupAccounts'))
    if (paths.has('categories')) throw new Error(tt('errBackupCategories'))
    if (paths.has('goals')) throw new Error(tt('errBackupGoals'))
    if (paths.has('transactions')) throw new Error(tt('errBackupTransactions'))
    if (paths.has('goalContributions')) throw new Error(tt('errBackupContributions'))
    if (paths.has('currency')) throw new Error(tt('errBackupCurrency'))
    throw new Error(tt('errNotValidBackup'))
  }

  return result.data.data
}
