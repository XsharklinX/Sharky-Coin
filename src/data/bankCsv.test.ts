import { describe, expect, it } from 'vitest'
import { analyzeBankCsv, parseBankCsv } from './bankCsv'
import type { Category, Transaction } from '@/types'

const categories: Category[] = [
  { id: 'cat_super', name: 'Supermercado', type: 'expense', color: '#fff', budget: 0, icon: 'cart' },
  { id: 'cat_salario', name: 'Salario', type: 'income', color: '#fff', budget: 0, icon: 'wallet' },
]

describe('parseBankCsv', () => {
  it('detecta columnas separadas de débito y crédito', () => {
    const rows = parseBankCsv('Fecha;Concepto;Debito;Credito\n31/05/2026;Jumbo;1250;\n30/05/2026;Nomina;;50000', [], categories)
    expect(rows).toMatchObject([{ type: 'expense', amount: 1250, categoryId: 'cat_super' }, { type: 'income', amount: 50000, categoryId: 'cat_salario' }])
  })

  it('marca duplicados por fecha, monto y nota', () => {
    const existing: Transaction[] = [{ id: 'tx', type: 'expense', date: '2026-05-31', amount: 1250, note: 'Jumbo', categoryId: 'cat_super', accountId: 'cash' }]
    expect(parseBankCsv('Fecha,Monto,Descripcion\n31/05/2026,-1250,Jumbo', existing, categories)[0].duplicate).toBe(true)
  })

  it('rechaza archivos sin columnas reconocibles', () => {
    expect(() => parseBankCsv('A,B,C\n1,2,3', [], categories)).toThrow('detectar las columnas')
  })

  it('expone perfil versionado y columnas detectadas', () => {
    const analysis = analyzeBankCsv('Fecha;Concepto;Retiro;Deposito\n31/05/2026;Jumbo;1250;', 'banreservas')
    expect(analysis.profile?.version).toBe('banreservas-cuenta-v1')
    expect(analysis.columns).toMatchObject({ date: 'Fecha', note: 'Concepto', debit: 'Retiro', credit: 'Deposito' })
  })

  it('permite mapear columnas desconocidas manualmente', () => {
    const rows = parseBankCsv('Dia,Texto,Salida,Entrada\n31/05/2026,Jumbo,1250,', [], categories, 'auto', {
      date: 'Dia',
      note: 'Texto',
      debit: 'Salida',
      credit: 'Entrada',
    })
    expect(rows[0]).toMatchObject({ date: '2026-05-31', note: 'Jumbo', type: 'expense', amount: 1250 })
  })

  it('interpreta parentesis como monto negativo en columnas firmadas', () => {
    const rows = parseBankCsv('Fecha,Monto,Descripcion\n31/05/2026,\"(1,250.00)\",Jumbo', [], categories)
    expect(rows[0]).toMatchObject({ type: 'expense', amount: 1250 })
  })
})
