import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useMobileBackDismiss } from './useMobileBackDismiss'

export function MobileTextSheet({
  title,
  value,
  placeholder,
  maxLength,
  onDone,
  onClose,
}: {
  title: string
  value: string
  placeholder?: string
  maxLength?: number
  onDone: (value: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  useMobileBackDismiss(true, onClose)

  const confirm = () => { onDone(text.trim()); onClose() }

  return (
    <div className="mtxt-overlay" onClick={onClose}>
      <div className="mtxt-bar" onClick={e => e.stopPropagation()}>
        <span className="mtxt-label">{title}</span>
        <div className="mtxt-row">
          <input
            ref={inputRef}
            className="mtxt-input"
            type="text"
            value={text}
            placeholder={placeholder}
            maxLength={maxLength}
            autoCapitalize="words"
            autoCorrect="off"
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirm() }}
          />
          <button className="mtxt-done" onClick={confirm}>
            <Icon name="check" size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
