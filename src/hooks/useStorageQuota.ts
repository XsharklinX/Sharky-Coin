import { useEffect, useState } from 'react'

export interface StorageQuota {
  usedMB: number
  quotaMB: number
  pct: number
  level: 'ok' | 'warning' | 'critical'
}

export function useStorageQuota(): StorageQuota | null {
  const [quota, setQuota] = useState<StorageQuota | null>(null)

  useEffect(() => {
    if (!navigator.storage?.estimate) return
    navigator.storage.estimate().then(est => {
      const used  = est.usage  ?? 0
      const total = est.quota  ?? 0
      if (!total) return
      const pct    = used / total
      const usedMB = used  / 1_048_576
      const quotaMB = total / 1_048_576
      setQuota({
        usedMB: Math.round(usedMB * 10) / 10,
        quotaMB: Math.round(quotaMB),
        pct,
        level: pct >= 0.9 ? 'critical' : pct >= 0.7 ? 'warning' : 'ok',
      })
    }).catch(() => {})
  }, [])

  return quota
}
