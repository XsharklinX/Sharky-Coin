import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from './backup'
import type { FinanceState } from '@/store/finance'

const cashAccount = {
  id: 'cash',
  name: 'Efectivo',
  short: 'Cash',
  type: 'cash',
  color: '#fff',
  balance: 500,
  last4: null,
} as const

const foodCategory = {
  id: 'food',
  name: 'Restaurantes',
  type: 'expense',
  color: '#f90',
  budget: 9000,
  icon: 'food',
} as const

const goal = {
  id: 'goal',
  name: 'Fondo',
  target: 10000,
  saved: 1000,
  color: '#22c55e',
  icon: 'wallet',
} as const

describe('backup JSON', () => {
  it('serializa y restaura los datos financieros', () => {
    const state = { accounts: [], categories: [], goals: [], transactions: [], currency: 'DOP' } as unknown as FinanceState
    expect(parseBackup(JSON.stringify(createBackup(state)))).toEqual({
      accounts: [],
      categories: [],
      goals: [],
      goalContributions: [],
      transactions: [],
      currency: 'DOP',
    })
  })

  it('migra backups v1 antiguos sin aportes a metas', () => {
    const legacyBackup = {
      version: 1,
      exportedAt: '2026-06-02T00:00:00.000Z',
      data: {
        accounts: [cashAccount],
        categories: [foodCategory],
        goals: [goal],
        transactions: [],
        currency: 'DOP',
      },
    }

    expect(parseBackup(JSON.stringify(legacyBackup)).goalContributions).toEqual([])
  })

  it('rechaza archivos ajenos a $harky', () => {
    expect(() => parseBackup('{"hello":"world"}')).toThrow('backup')
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

  it('rechaza aportes a metas con referencias inexistentes', () => {
    const backup = {
      version: 1,
      exportedAt: '2026-06-02T00:00:00.000Z',
      data: {
        accounts: [cashAccount],
        categories: [foodCategory],
        goals: [goal],
        goalContributions: [{
          id: 'contribution',
          goalId: 'missing-goal',
          amount: 250,
          fromAccountId: 'cash',
          date: '2026-06-02',
        }],
        transactions: [],
        currency: 'DOP',
      },
    }

    expect(() => parseBackup(JSON.stringify(backup))).toThrow('aportes a metas')
  })

  it('rechaza identificadores duplicados', () => {
    const state = { accounts: [cashAccount, cashAccount], categories: [], goals: [], transactions: [], currency: 'DOP' } as unknown as FinanceState
    expect(() => parseBackup(JSON.stringify(createBackup(state)))).toThrow('cuentas duplicadas')
  })
})
