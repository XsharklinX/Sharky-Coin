import { describe, expect, it } from 'vitest'
import { advanceRecurrenceDate, firstRecurrenceDate } from './useRecurring'
import type { Transaction } from '@/types'

describe('advanceRecurrenceDate (fechas de recurrentes)', () => {
  it('semanal: siempre +7 días', () => {
    expect(advanceRecurrenceDate('2026-07-09', 'weekly')).toBe('2026-07-16')
    expect(advanceRecurrenceDate('2026-07-28', 'weekly')).toBe('2026-08-04') // cruza mes
    expect(advanceRecurrenceDate('2026-12-29', 'weekly')).toBe('2027-01-05') // cruza año
  })

  it('mensual: mismo día del mes siguiente', () => {
    expect(advanceRecurrenceDate('2026-07-15', 'monthly')).toBe('2026-08-15')
    expect(advanceRecurrenceDate('2026-12-15', 'monthly')).toBe('2027-01-15') // cruza año
  })

  it('mensual en día 1 y día 28 (siempre existen)', () => {
    expect(advanceRecurrenceDate('2026-07-01', 'monthly')).toBe('2026-08-01')
    expect(advanceRecurrenceDate('2026-01-28', 'monthly')).toBe('2026-02-28')
  })
})

describe('firstRecurrenceDate (primera ocurrencia de una plantilla)', () => {
  const base: Transaction = {
    id: 't1', type: 'expense', amount: 100, date: '2026-07-01',
    note: 'Netflix', categoryId: 'c1', accountId: 'a1',
    recurring: 'monthly', recurringStart: '2026-07-01',
  }

  it('usa recurringNext cuando existe', () => {
    expect(firstRecurrenceDate({ ...base, recurringNext: '2026-09-01' })).toBe('2026-09-01')
  })

  it('sin recurringNext, avanza desde recurringStart', () => {
    expect(firstRecurrenceDate(base)).toBe('2026-08-01')
  })

  it('sin recurringStart, avanza desde la fecha del movimiento', () => {
    const tx = { ...base, recurringStart: undefined, date: '2026-07-10' }
    expect(firstRecurrenceDate(tx)).toBe('2026-08-10')
  })

  it('respeta la frecuencia semanal', () => {
    const tx = { ...base, recurring: 'weekly' as const, recurringStart: '2026-07-06' }
    expect(firstRecurrenceDate(tx)).toBe('2026-07-13')
  })
})
