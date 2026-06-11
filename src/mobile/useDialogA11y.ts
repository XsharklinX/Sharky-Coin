import { useEffect, useRef } from 'react'

/**
 * Foco inicial, cierre con Escape y restauración de foco para sheets/diálogos
 * móviles. `active` permite usarlo con sub-diálogos que se muestran/ocultan
 * dentro de un componente que ya está montado (p.ej. pickers anidados).
 */
export function useDialogA11y<T extends HTMLElement>(onClose: () => void, active = true) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const firstFocusable = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    firstFocusable?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [onClose, active])

  return ref
}
