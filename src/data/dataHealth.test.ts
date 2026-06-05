import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRecoverySnapshot } from './recovery'
import { getDataHealthStatus } from './dataHealth'
import type { FinanceState } from '@/store/finance'

function installMemoryStorage() {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  })
}

const state = {
  accounts: [{ id: 'cash', name: 'Efectivo', short: 'Cash', type: 'cash', color: '#fff', balance: 500, last4: null }],
  categories: [{ id: 'food', name: 'Comida', type: 'expense', color: '#fff', budget: 100, icon: 'food' }],
  goals: [],
  goalContributions: [],
  transactions: [{ id: 'tx', type: 'expense', amount: 25, accountId: 'cash', categoryId: 'food', date: '2026-06-04', note: 'Cena' }],
  currency: 'DOP',
} as unknown as FinanceState

describe('data health status', () => {
  beforeEach(installMemoryStorage)

  it('advierte cuando faltan backups cloud en datos con movimientos', () => {
    createRecoverySnapshot(state, 'manual')
    const health = getDataHealthStatus(state, 'user-1')

    expect(health.recoveryPoints).toBe(1)
    expect(health.riskLevel).toBe('warning')
    expect(health.warnings).toContain('No hay backup cloud reciente registrado.')
  })

  it('lee fechas de backup cloud y sync cuando existen', () => {
    localStorage.setItem('sharky-cloud-backup-last-v1:user-1', '2026-06-04T01:00:00.000Z')
    localStorage.setItem('sharky-cloud-sync-v1:user-1', JSON.stringify({ lastSyncAt: '2026-06-04T02:00:00.000Z' }))
    createRecoverySnapshot(state, 'manual')

    const health = getDataHealthStatus(state, 'user-1')
    expect(health.lastCloudBackupAt).toBe('2026-06-04T01:00:00.000Z')
    expect(health.lastSyncAt).toBe('2026-06-04T02:00:00.000Z')
  })
})
