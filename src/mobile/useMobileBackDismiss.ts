import { useEffect, useRef } from 'react'

export function useMobileBackDismiss(active: boolean, onDismiss: () => void) {
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (!active) return
    window.history.pushState({ sharkyOverlay: true }, '')
    const onPopState = () => dismissRef.current()
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [active])
}
