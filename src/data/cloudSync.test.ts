import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mergeTable, resolveConflict, type SyncConflict } from '@/data/cloudSync'
import { useAuth } from '@/store/auth'
import { useFinance } from '@/store/finance'
import { useCloudSync } from '@/data/cloudSync'
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
    expect(plan.conflicts).toEqual([{ table: 'accounts', localId: base.id, label: base.name, local, remote }])
    expect(plan.merged).toEqual([local])
  })
})

describe('resolveConflict', () => {
  const local: Account = { ...base, balance: 125 }
  const remote: Account = { ...base, balance: 140 }
  const conflict: SyncConflict = { table: 'accounts', localId: base.id, label: base.name, local, remote }
  const userId = 'user_test_1'
  const metadataKey = `sharky-cloud-sync-v1:${userId}`

  beforeEach(() => {
    useAuth.setState({ user: { id: userId, name: 'Test', email: 't@test.com', mode: 'cloud' } })
    useFinance.setState({ accounts: [local], categories: [], goals: [], transactions: [], goalContributions: [], currency: 'DOP' })
    useCloudSync.setState({ conflicts: [conflict], busy: false, pending: false, syncNow: async () => {} })
    localStorage.removeItem(metadataKey)
  })

  afterEach(() => {
    useAuth.setState({ user: null })
    localStorage.removeItem(metadataKey)
  })

  it('ignore: solo quita el conflicto, sin tocar datos ni baseline', async () => {
    await resolveConflict(conflict, 'ignore')
    expect(useCloudSync.getState().conflicts).toEqual([])
    expect(useFinance.getState().accounts).toEqual([local])
    expect(localStorage.getItem(metadataKey)).toBeNull()
  })

  it('local: mantiene la versión local y marca el baseline para subirla', async () => {
    await resolveConflict(conflict, 'local')
    expect(useFinance.getState().accounts).toEqual([local])
    expect(useCloudSync.getState().conflicts).toEqual([])
    const metadata = JSON.parse(localStorage.getItem(metadataKey)!)
    expect(metadata.baseline.accounts[base.id]).toBe(JSON.stringify(remote))
  })

  it('cloud: aplica la versión remota y deja el baseline al día', async () => {
    await resolveConflict(conflict, 'cloud')
    // La versión remota pasa por sanitize, que back-deriva el saldo de apertura
    // (sin movimientos en el fixture: opening = balance).
    expect(useFinance.getState().accounts).toEqual([{ ...remote, openingBalance: remote.balance }])
    expect(useCloudSync.getState().conflicts).toEqual([])
    const metadata = JSON.parse(localStorage.getItem(metadataKey)!)
    expect(metadata.baseline.accounts[base.id]).toBe(JSON.stringify(remote))
  })

  it('duplicate: conserva ambas versiones como entidades separadas', async () => {
    await resolveConflict(conflict, 'duplicate')
    const accounts = useFinance.getState().accounts
    expect(accounts).toHaveLength(2)
    expect(accounts[0]).toEqual({ ...local, openingBalance: local.balance })
    expect(accounts[1]).toMatchObject({ ...remote, id: expect.stringContaining(`${base.id}_dup_`) })
    expect(useCloudSync.getState().conflicts).toEqual([])
    const metadata = JSON.parse(localStorage.getItem(metadataKey)!)
    expect(metadata.baseline.accounts[base.id]).toBe(JSON.stringify(remote))
  })
})
