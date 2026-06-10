import { useEffect, useRef } from 'react'
import { isTauri } from '@/hooks/useTauri'
import { log } from '@/lib/logger'

// Global stack for Tauri back button handlers
const tauriDismissStack: (() => void)[] = []
let unlistenTauriBack: { unregister(): Promise<void> } | null = null
let isRegistering = false

async function updateTauriBackButtonListener() {
  if (tauriDismissStack.length > 0) {
    if (!unlistenTauriBack && !isRegistering) {
      isRegistering = true
      try {
        const { onBackButtonPress } = await import('@tauri-apps/api/app')
        unlistenTauriBack = await onBackButtonPress(() => {
          // Executing back button handler pops and runs the top overlay dismiss action
          const handler = tauriDismissStack.pop()
          if (handler) handler()
          void updateTauriBackButtonListener()
        })
      } catch (err) {
        log.error('Error listening to Tauri back button', err)
      } finally {
        isRegistering = false
      }
    }
  } else {
    if (unlistenTauriBack) {
      const listener = unlistenTauriBack
      unlistenTauriBack = null
      try {
        await listener.unregister()
      } catch (err) {
        log.error('Error unregistering Tauri back button listener', err)
      }
    }
  }
}

export function useMobileBackDismiss(active: boolean, onDismiss: () => void) {
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (!active) return

    if (isTauri()) {
      const handler = () => dismissRef.current()
      tauriDismissStack.push(handler)
      void updateTauriBackButtonListener()

      return () => {
        const idx = tauriDismissStack.indexOf(handler)
        if (idx !== -1) {
          tauriDismissStack.splice(idx, 1)
        }
        void updateTauriBackButtonListener()
      }
    } else {
      // Browser PWA fallback using history state
      window.history.pushState({ sharkyOverlay: true }, '')
      const onPopState = () => dismissRef.current()
      window.addEventListener('popstate', onPopState)
      return () => {
        window.removeEventListener('popstate', onPopState)
      }
    }
  }, [active])
}
