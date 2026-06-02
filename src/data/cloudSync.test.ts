import { describe, expect, it } from 'vitest'
import { mergeTable } from '@/data/cloudSync'
import type { Account } from '@/types'

const base: Account = {
  id: 'acc_1',
  name: 'Efectivo',
  short: 'Cash',
  type: 'cash',
  color: '#3b82f6',
  balance: 100,
  last4: null,
}

const baseline = { [base.id]: JSON.stringify(base) }

function row(account: Account, deletedAt: string | null = null): Record<string, unknown> {
  return { ...account, local_id: account.id, deleted_at: deletedAt }
}

function fromRow(value: Record<string, unknown>): Account {
  const account = { ...value }
  delete account.local_id
  delete account.deleted_at
  return account as unknown as Account
}

describe('cloud sync merge', () => {
  it('sube un cambio que solo existe localmente', () => {
    const changed = { ...base, balance: 125 }
    const plan = mergeTable('accounts', [changed], [row(base)], fromRow, baseline)
    expect(plan.push).toEqual([changed])
    expect(plan.conflicts).toEqual([])
  })

  it('descarga un cambio que solo existe remotamente', () => {
    const changed = { ...base, balance: 140 }
    const plan = mergeTable('accounts', [base], [row(changed)], fromRow, baseline)
    expect(plan.merged).toEqual([changed])
    expect(plan.push).toEqual([])
  })

  it('crea un tombstone remoto cuando se elimina localmente', () => {
    const plan = mergeTable('accounts', [], [row(base)], fromRow, baseline)
    expect(plan.removeRemote).toEqual([base.id])
    expect(plan.merged).toEqual([])
  })

  it('no sobrescribe cambios concurrentes', () => {
    const local = { ...base, balance: 125 }
    const remote = { ...base, balance: 140 }
    const plan = mergeTable('accounts', [local], [row(remote)], fromRow, baseline)
    expect(plan.push).toEqual([])
    expect(plan.conflicts).toEqual([{ table: 'accounts', localId: base.id, label: base.name }])
    expect(plan.merged).toEqual([local])
  })
})
