import { describe, expect, it } from 'vitest'
import { applyImportedBalances, assertAvailableBalance, canDeleteAccount, canDeleteCategory } from './finance'
import type { Account, Transaction } from '@/types'

const accounts: Account[] = [
  { id: 'cash', name: 'Efectivo', short: 'Cash', type: 'cash', color: '#fff', balance: 500, last4: null },
  { id: 'credit', name: 'Tarjeta', short: 'Crédito', type: 'credit', color: '#fff', balance: -100, last4: '1234', limit: 1000 },
]

describe('assertAvailableBalance', () => {
  it('permite usar saldo disponible', () => {
    expect(() => assertAvailableBalance(accounts, 'cash', 500)).not.toThrow()
  })

  it('rechaza montos que exceden el saldo de una cuenta normal', () => {
    expect(() => assertAvailableBalance(accounts, 'cash', 501)).toThrow('Saldo insuficiente')
  })

  it('permite movimientos desde cuentas de crédito', () => {
    expect(() => assertAvailableBalance(accounts, 'credit', 800)).not.toThrow()
  })

  it('rechaza cuentas inexistentes y montos inválidos', () => {
    expect(() => assertAvailableBalance(accounts, 'missing', 10)).toThrow('no existe')
    expect(() => assertAvailableBalance(accounts, 'cash', 0)).toThrow('mayor que cero')
  })
})

describe('canDeleteAccount', () => {
  it('bloquea cuentas referenciadas por movimientos', () => {
    const transactions: Transaction[] = [{ id: 'tx', type: 'expense', amount: 25, accountId: 'cash', date: '2026-05-31', note: 'Compra' }]
    expect(canDeleteAccount('cash', transactions)).toBe(false)
  })

  it('permite borrar cuentas sin movimientos', () => {
    expect(canDeleteAccount('cash', [])).toBe(true)
  })
})

describe('canDeleteCategory', () => {
  it('bloquea categorías referenciadas por movimientos', () => {
    const transactions: Transaction[] = [{ id: 'tx', type: 'expense', amount: 25, accountId: 'cash', categoryId: 'food', date: '2026-05-31', note: 'Compra' }]
    expect(canDeleteCategory('food', transactions)).toBe(false)
  })

  it('permite borrar categorías sin movimientos', () => {
    expect(canDeleteCategory('food', [])).toBe(true)
  })
})

describe('importTxs', () => {
  it('no aplica filas parciales cuando la política de sobregiro bloquea el lote', () => {
    const rows: Transaction[] = [
      { id: 'valid', type: 'expense', amount: 100, accountId: 'cash', date: '2026-05-31', note: 'Compra válida' },
      { id: 'invalid', type: 'expense', amount: 600, accountId: 'cash', date: '2026-05-31', note: 'Compra inválida' },
    ]
    expect(() => applyImportedBalances(accounts, rows, 'block')).toThrow('Saldo insuficiente')
    expect(accounts.find(account => account.id === 'cash')?.balance).toBe(500)
  })
})
