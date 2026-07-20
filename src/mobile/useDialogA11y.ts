import { useEffect, useRef } from 'react'

let mobileContentLockCount = 0
let previousMobileContentOverflow = ''

function lockMobileContent() {
  const scroller = document.querySelector<HTMLElement>('.mobile-content')
  if (!scroller) return

  if (mobileContentLockCount === 0) {
    previousMobileContentOverflow = scroller.style.overflow
    scroller.classList.add('mobile-content-locked')
    scroller.style.overflow = 'hidden'
  }

  mobileContentLockCount += 1
}

function unlockMobileContent() {
  const scroller = document.querySelector<HTMLElement>('.mobile-content')
  mobileContentLockCount = Math.max(0, mobileContentLockCount - 1)

  if (!scroller || mobileContentLockCount > 0) return

  scroller.classList.remove('mobile-content-locked')
  scroller.style.overflow = previousMobileContentOverflow
  previousMobileContentOverflow = ''
}

/**
 * Initial focus, Escape close, focus restore, and background scroll lock for
 * mobile dialogs/sheets. `active` supports mounted nested dialogs.
 *
 * `autoFocus` (default true) mueve el foco al primer elemento enfocable al
 * abrir — bueno para accesibilidad, pero si ese primer elemento es un `input`
 * abre el teclado solo (molesto en hojas donde escribir es opcional, como el
 * detalle de una lista). Pasar `false` conserva Escape + bloqueo de scroll sin
 * robar el foco.
 */
export function useDialogA11y<T extends HTMLElement>(onClose: () => void, active = true, autoFocus = true) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (autoFocus) {
      const firstFocusable = ref.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      firstFocusable?.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    lockMobileContent()

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus()
      unlockMobileContent()
    }
  }, [onClose, active, autoFocus])

  return ref
}
