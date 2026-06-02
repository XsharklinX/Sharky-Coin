import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from './backup'
import type { FinanceState } from '@/store/finance'

describe('backup JSON', () => {
  it('serializa y restaura los datos financieros', () => {
    const state = { accounts: [], categories: [], goals: [], transactions: [], currency: 'DOP' } as unknown as FinanceState
    expect(parseBackup(JSON.stringify(createBackup(state)))).toEqual({ accounts: [], categories: [], goals: [], goalContributions: [], transactions: [], currency: 'DOP' })
  })

  it('rechaza archivos ajenos a $harky', () => {
    expect(() => parseBackup('{"hello":"world"}')).toThrow('backup válido')
  })

  it('rechaza referencias inexistentes en transacciones', () => {
    const state = {
      accounts: [],
      categories: [],
      goals: [],
      transactions: [{ id: 'tx', type: 'expense', amount: 25, accountId: 'missing', categoryId: 'food', date: '2026-05-31', note: 'Compra' }],
      currency: 'DOP',
    } as unknown as FinanceState
    expect(() => parseBackup(JSON.stringify(createBackup(state)))).toThrow('referencias inexistentes')
  })

  it('rechaza identificadores duplicados', () => {
    const account = { id: 'cash', name: 'Efectivo', short: 'Cash', type: 'cash', color: '#fff', balance: 500, last4: null }
    const state = { accounts: [account, account], categories: [], goals: [], transactions: [], currency: 'DOP' } as unknown as FinanceState
    expect(() => parseBackup(JSON.stringify(createBackup(state)))).toThrow('cuentas duplicadas')
  })
})
