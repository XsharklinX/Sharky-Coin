import { describe, expect, it } from 'vitest'
import { detectSpendingAnomalies, detectSubscriptions, generateFinancialIntelligence, projectCashflow } from '@/data/financeIntelligence'
import type { Category, Transaction } from '@/types'

const categories: Category[] = [
  { id: 'cat_serv', name: 'Servicios', type: 'expense', color: '#fff', budget: 0, icon: 'bolt' },
  { id: 'cat_food', name: 'Restaurantes', type: 'expense', color: '#fff', budget: 0, icon: 'food' },
  { id: 'cat_salary', name: 'Salario', type: 'income', color: '#fff', budget: 0, icon: 'wallet' },
]

const txns: Transaction[] = [
  ...['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05'].map((date, index) => ({
    id: `netflix-${index}`, type: 'expense' as const, amount: 650 + index * 5, date, note: 'Netflix mensual', categoryId: 'cat_serv', accountId: 'cash',
  })),
  { id: 'salary-1', type: 'income', amount: 50000, date: '2026-04-01', note: 'Nomina', categoryId: 'cat_salary', accountId: 'cash' },
  { id: 'salary-2', type: 'income', amount: 50000, date: '2026-05-01', note: 'Nomina', categoryId: 'cat_salary', accountId: 'cash' },
  { id: 'food-1', type: 'expense', amount: 900, date: '2026-02-10', note: 'Restaurante Local', categoryId: 'cat_food', accountId: 'cash' },
  { id: 'food-2', type: 'expense', amount: 950, date: '2026-03-10', note: 'Restaurante Local', categoryId: 'cat_food', accountId: 'cash' },
  { id: 'food-3', type: 'expense', amount: 1000, date: '2026-04-10', note: 'Restaurante Local', categoryId: 'cat_food', accountId: 'cash' },
  { id: 'food-4', type: 'expense', amount: 4200, date: '2026-05-10', note: 'Restaurante Local', categoryId: 'cat_food', accountId: 'cash' },
]

describe('finance intelligence', () => {
  it('detecta suscripciones por comercio y recurrencia mensual', () => {
    expect(detectSubscriptions(txns, '2026-05')[0]).toMatchObject({ merchant: 'netflix mensual', months: 4 })
  })

  it('proyecta flujo de caja a 30, 60 y 90 dias', () => {
    const projections = projectCashflow(txns, '2026-05', 10000)
    expect(projections.map(item => item.horizonDays)).toEqual([30, 60, 90])
    expect(projections[0].projectedBalance).toBeGreaterThan(10000)
  })

  it('detecta gastos atipicos frente al patron historico', () => {
    expect(detectSpendingAnomalies(txns, '2026-05')[0].tx.id).toBe('food-4')
  })

  it('genera acciones mensuales concretas', () => {
    const result = generateFinancialIntelligence({ txns, categories, mkey: '2026-05', currentBalance: 10000 })
    expect(result.monthlyActions.length).toBeGreaterThan(0)
    expect(result.recommendedMonthlySavings).toBeGreaterThan(0)
  })
})
