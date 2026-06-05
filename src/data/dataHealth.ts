import { listRecoverySnapshots } from './recovery'
import type { FinanceState } from '@/store/finance'

export interface DataHealthStatus {
  accounts: number
  transactions: number
  categories: number
  goals: number
  recoveryPoints: number
  lastRecoveryAt?: string
  lastRecoveryReason?: string
  lastCloudBackupAt?: string
  lastSyncAt?: string
  riskLevel: 'ok' | 'warning'
  warnings: string[]
}

export function getDataHealthStatus(state: FinanceState, userId?: string): DataHealthStatus {
  const snapshots = listRecoverySnapshots()
  const warnings: string[] = []
  const latest = snapshots[0]
  const lastCloudBackupAt = userId ? localStorage.getItem(`sharky-cloud-backup-last-v1:${userId}`) ?? undefined : undefined
  const lastSyncAt = userId ? readCloudSyncAt(userId) : undefined

  if (!snapshots.length) warnings.push('No hay puntos de recuperacion locales.')
  if (state.transactions.length > 0 && !lastCloudBackupAt) warnings.push('No hay backup cloud reciente registrado.')
  if (state.accounts.length === 0) warnings.push('No hay cuentas configuradas.')
  if (state.categories.length === 0) warnings.push('No hay categorias configuradas.')

  return {
    accounts: state.accounts.length,
    transactions: state.transactions.length,
    categories: state.categories.length,
    goals: state.goals.length,
    recoveryPoints: snapshots.length,
    lastRecoveryAt: latest?.createdAt,
    lastRecoveryReason: latest?.reason,
    lastCloudBackupAt,
    lastSyncAt,
    riskLevel: warnings.length ? 'warning' : 'ok',
    warnings,
  }
}

function readCloudSyncAt(userId: string): string | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(`sharky-cloud-sync-v1:${userId}`) ?? '{}') as { lastSyncAt?: string }
    return value.lastSyncAt
  } catch {
    return undefined
  }
}
