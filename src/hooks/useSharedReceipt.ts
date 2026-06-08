import { useEffect, useState } from 'react'
import { checkSharedFile, isTauri, type SharedReceipt } from './useTauri'

/**
 * Detecta cuando el usuario compartió una foto/PDF hacia $harky desde otra app
 * (Galería, Drive, WhatsApp, etc.). Revisa al montar y cada vez que la app
 * vuelve a primer plano — el archivo compartido se consume una sola vez.
 */
export function useSharedReceipt(): [SharedReceipt | null, () => void] {
  const [receipt, setReceipt] = useState<SharedReceipt | null>(null)

  useEffect(() => {
    if (!isTauri()) return

    const check = () => { void checkSharedFile().then(found => { if (found) setReceipt(found) }) }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    check()

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])

  return [receipt, () => setReceipt(null)]
}
