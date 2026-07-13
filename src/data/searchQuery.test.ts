import { describe, expect, it } from 'vitest'
import { matchSynonymCategoryIds, parseSearchQuery } from './searchQuery'
import type { Category } from '@/types'

const now = new Date(2026, 6, 12) // 12 de julio de 2026

function cat(id: string): Category {
  return { id, name: id, type: 'expense', color: '#fff', budget: 0, icon: 'cart' }
}

describe('parseSearchQuery — monto', () => {
  it('reconoce "mas de $1000"', () => {
    const result = parseSearchQuery('mas de $1000', now)
    expect(result.amountFilter).toEqual({ op: 'gt', value: 1000 })
    expect(result.freeText).toBe('')
  })

  it('reconoce "menos de 500"', () => {
    const result = parseSearchQuery('menos de 500', now)
    expect(result.amountFilter).toEqual({ op: 'lt', value: 500 })
  })

  it('reconoce "more than $1,000.50"', () => {
    const result = parseSearchQuery('more than $1,000.50', now)
    expect(result.amountFilter).toEqual({ op: 'gt', value: 1000.5 })
  })

  it('reconoce operadores simbólicos > y <', () => {
    expect(parseSearchQuery('> 200', now).amountFilter).toEqual({ op: 'gt', value: 200 })
    expect(parseSearchQuery('< 200', now).amountFilter).toEqual({ op: 'lt', value: 200 })
  })

  it('deja el resto del texto libre cuando hay más palabras', () => {
    const result = parseSearchQuery('netflix mas de 500', now)
    expect(result.amountFilter).toEqual({ op: 'gt', value: 500 })
    expect(result.freeText).toBe('netflix')
  })
})

describe('parseSearchQuery — mes', () => {
  it('reconoce un nombre de mes en español y asume el año actual', () => {
    const result = parseSearchQuery('mayo', now)
    expect(result.monthFilter).toEqual({ year: 2026, month: 5 })
  })

  it('reconoce un nombre de mes en inglés', () => {
    const result = parseSearchQuery('may', now)
    expect(result.monthFilter).toEqual({ year: 2026, month: 5 })
  })

  it('reconoce mes + año explícito', () => {
    const result = parseSearchQuery('mayo de 2025', now)
    expect(result.monthFilter).toEqual({ year: 2025, month: 5 })
  })

  it('reconoce "este mes"/"this month"', () => {
    expect(parseSearchQuery('este mes', now).monthFilter).toEqual({ year: 2026, month: 7 })
    expect(parseSearchQuery('this month', now).monthFilter).toEqual({ year: 2026, month: 7 })
  })

  it('reconoce "mes pasado" cruzando de año si aplica', () => {
    const enero = new Date(2026, 0, 15)
    expect(parseSearchQuery('mes pasado', enero).monthFilter).toEqual({ year: 2025, month: 12 })
  })

  it('combina categoría + mes: "comida en mayo"', () => {
    const result = parseSearchQuery('comida en mayo', now)
    expect(result.monthFilter).toEqual({ year: 2026, month: 5 })
    expect(result.freeText).toBe('comida en')
  })
})

describe('parseSearchQuery — sin filtros reconocidos', () => {
  it('una consulta plana no dispara ningún filtro (comportamiento previo intacto)', () => {
    const result = parseSearchQuery('netflix', now)
    expect(result.amountFilter).toBeUndefined()
    expect(result.monthFilter).toBeUndefined()
    expect(result.freeText).toBe('netflix')
  })
})

describe('matchSynonymCategoryIds', () => {
  it('matchea "comida" contra supermercado y restaurantes si existen', () => {
    const categories = [cat('cat_super'), cat('cat_rest'), cat('cat_trans')]
    expect(matchSynonymCategoryIds('comida', categories).sort()).toEqual(['cat_rest', 'cat_super'])
  })

  it('no matchea categorías que no existen en la lista', () => {
    const categories = [cat('cat_trans')]
    expect(matchSynonymCategoryIds('comida', categories)).toEqual([])
  })

  it('texto vacío no matchea nada', () => {
    expect(matchSynonymCategoryIds('', [cat('cat_super')])).toEqual([])
  })
})
