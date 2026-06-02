import { useEffect } from 'react'
import { createRecoverySnapshot } from '@/data/recovery'
import { useFinance } from '@/store/finance'

const DEBOUNCE_MS = 1_200

export function useAutoBackup() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const snapshot = () => createRecoverySnapshot(useFinance.getState())

    snapshot()
    const unsubscribe = useFinance.subscribe(() => {
      clearTimeout(timer)
      timer = setTimeout(snapshot, DEBOUNCE_MS)
    })

    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [])
}
