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
    lockMobileContent()

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus()
      unlockMobileContent()
    }
  }, [onClose, active])

  return ref
}
