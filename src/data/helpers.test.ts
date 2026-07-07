import { describe, it, expect } from 'vitest'
import { accountActivity, accountSavingsRate, monthlyAccountSeries, savingsBalance, visibleAccounts, transactionsForTotals } from './helpers'
import type { Account, Transaction } from '@/types'

const TXNS: Transaction[] = [
  { id: '1', type: 'income',   amount: 500, date: '2026-06-05', note: 'Salary',  accountId: 'acc1' },
  { id: '2', type: 'expense',  amount: 50,  date: '2026-06-10', note: 'Lunch',   accountId: 'acc1' },
  { id: '3', type: 'expense',  amount: 30,  date: '2026-05-20', note: 'Coffee',  accountId: 'acc1' },
  { id: '4', type: 'transfer', amount: 100, date: '2026-06-15', note: 'Move',    fromAccount: 'acc1', toAccount: 'acc2' },
  { id: '5', type: 'expense',  amount: 20,  date: '2026-06-12', note: 'Other',   accountId: 'acc2' },
]

describe('accountActivity', () => {
  it('returns transactions touching the account via accountId, fromAccount or toAccount', () => {
    expect(accountActivity(TXNS, 'acc1').map(t => t.id)).toEqual(['1', '2', '3', '4'])
    expect(accountActivity(TXNS, 'acc2').map(t => t.id)).toEqual(['4', '5'])
  })
})

describe('monthlyAccountSeries', () => {
  it('returns 6 monthly buckets ending at mkey with inflow/outflow for the account', () => {
    const series = monthlyAccountSeries(TXNS, 'acc1', '2026-06')
    expect(series).toHaveLength(6)
    expect(series[series.length - 1].key).toBe('2026-06')
    expect(series[series.length - 2].key).toBe('2026-05')

    const june = series[series.length - 1]
    expect(june.inflow).toBe(500)
    expect(june.outflow).toBe(150) // 50 expense + 100 transfer out

    const may = series[series.length - 2]
    expect(may.inflow).toBe(0)
    expect(may.outflow).toBe(30)
  })

  it('counts incoming transfers for the destination account', () => {
    const series = monthlyAccountSeries(TXNS, 'acc2', '2026-06')
    const june = series[series.length - 1]
    expect(june.inflow).toBe(100)
    expect(june.outflow).toBe(20)
  })
})

const ACCOUNTS: Account[] = [
  { id: 'acc1', name: 'Cuenta', short: 'CTA', type: 'debit', color: '#fff', balance: 1000, last4: null },
  { id: 'acc2', name: 'Ahorros', short: 'AHO', type: 'savings', color: '#0f0', balance: 500, last4: null, includeInTotal: false },
]

describe('visibleAccounts', () => {
  it('excludes accounts with includeInTotal: false', () => {
    expect(visibleAccounts(ACCOUNTS).map(a => a.id)).toEqual(['acc1'])
  })

  it('includes all accounts when none are excluded', () => {
    expect(visibleAccounts([ACCOUNTS[0]]).map(a => a.id)).toEqual(['acc1'])
  })
})

describe('savings helpers', () => {
  it('counts savings accounts even when excluded from total balance', () => {
    expect(savingsBalance(ACCOUNTS)).toBe(500)
    expect(accountSavingsRate(ACCOUNTS)).toBeCloseTo(500 / 1500 * 100)
  })
})

describe('transactionsForTotals', () => {
  it('filters out transactions belonging to excluded accounts', () => {
    const result = transactionsForTotals(TXNS, ACCOUNTS)
    expect(result.map(t => t.id)).toEqual(['1', '2', '3', '4'])
  })

  it('returns all transactions unchanged when no accounts are excluded', () => {
    const result = transactionsForTotals(TXNS, [ACCOUNTS[0]])
    expect(result).toEqual(TXNS)
  })
})
