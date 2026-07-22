import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './quickAddParse'
import type { Category } from '@/types'

const categories: Category[] = [
  { id: 'cat_super', name: 'Súper', type: 'expense', color: '#fff', budget: 0, icon: 'cart' },
  { id: 'cat_salary', name: 'Salario', type: 'income', color: '#fff', budget: 0, icon: 'wallet' },
]

const now = new Date('2026-07-22T12:00:00')

describe('parseQuickAdd', () => {
  it('extrae monto, tipo gasto y concepto de una frase típica', () => {
    const r = parseQuickAdd('gasté 500 en el súper ayer', categories, now)
    expect(r.type).toBe('expense')
    expect(r.amount).toBe(500)
    expect(r.date).toBe('2026-07-21')
    expect(r.note).toBe('super')
  })

  it('detecta ingreso por el verbo', () => {
    const r = parseQuickAdd('recibí 50000 de salario hoy', categories, now)
    expect(r.type).toBe('income')
    expect(r.amount).toBe(50000)
    expect(r.date).toBe('2026-07-22')
  })

  it('adivina la categoría por el concepto cuando hay regla de fábrica', () => {
    // "super" mapea a una categoría de súper/comida por las reglas integradas.
    const r = parseQuickAdd('gasté 300 en super', categories, now)
    expect(r.categoryId).toBeDefined()
  })

  it('entiende el sufijo k como miles', () => {
    expect(parseQuickAdd('pagué 1.5k de luz', categories, now).amount).toBe(1500)
  })

  it('sin fecha explícita usa hoy', () => {
    expect(parseQuickAdd('café 120', categories, now).date).toBe('2026-07-22')
  })

  it('«el 5» apunta a ese día del mes en curso', () => {
    expect(parseQuickAdd('renta 8000 el 5', categories, now).date).toBe('2026-07-05')
  })

  it('sin número deja el monto en null', () => {
    expect(parseQuickAdd('café en la esquina', categories, now).amount).toBeNull()
  })

  it('formato 1,000.50 se lee como mil con centavos', () => {
    expect(parseQuickAdd('gasté 1,000.50 en algo', categories, now).amount).toBe(1000.5)
  })
})
