import { createBackup, parseBackup, type FinanceBackup } from './backup'
import type { FinanceState } from '@/store/finance'

export interface RecoverySnapshot {
  id: string
  createdAt: string
  reason: 'auto' | 'manual'
  backup: FinanceBackup
}

const RECOVERY_KEY = 'sharky-recovery-v1'
const MAX_SNAPSHOTS = 5

export function listRecoverySnapshots(): RecoverySnapshot[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? '[]') as RecoverySnapshot[]
    return Array.isArray(value) ? value.filter(isRecoverySnapshot).slice(0, MAX_SNAPSHOTS) : []
  } catch {
    return []
  }
}

export function createRecoverySnapshot(state: FinanceState, reason: RecoverySnapshot['reason'] = 'auto'): RecoverySnapshot {
  const backup = createBackup(state)
  const snapshots = listRecoverySnapshots()
  const currentData = JSON.stringify(backup.data)
  if (reason === 'auto' && snapshots[0] && JSON.stringify(snapshots[0].backup.data) === currentData) return snapshots[0]

  const snapshot: RecoverySnapshot = {
    id: `recovery_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: backup.exportedAt,
    reason,
    backup,
  }
  localStorage.setItem(RECOVERY_KEY, JSON.stringify([snapshot, ...snapshots].slice(0, MAX_SNAPSHOTS)))
  return snapshot
}

export function readRecoverySnapshot(id: string): FinanceBackup['data'] {
  const snapshot = listRecoverySnapshots().find(item => item.id === id)
  if (!snapshot) throw new Error('El punto de recuperación ya no existe.')
  return parseBackup(JSON.stringify(snapshot.backup))
}

function isRecoverySnapshot(value: unknown): value is RecoverySnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<RecoverySnapshot>
  return typeof snapshot.id === 'string'
    && typeof snapshot.createdAt === 'string'
    && ['auto', 'manual'].includes(snapshot.reason ?? '')
    && !!snapshot.backup
}
