import { useState, useEffect, useCallback } from 'react'
import { Icon } from './Icon'
import type { IconName } from '@/types'

interface ToastAction {
  label:   string
  onClick: () => void
}

interface ToastItem {
  id:       string
  msg:      string
  icon?:    IconName
  type?:    'ok' | 'warn'
  duration?: number
  action?:  ToastAction     // ← botón de acción (ej. "Deshacer")
}

type ToastFn = (msg: string, opts?: Omit<ToastItem, 'id' | 'msg'>) => void

let _fn: ToastFn | null = null

export const toast: ToastFn = (msg, opts) => _fn?.(msg, opts ?? {})

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems(x => x.filter(i => i.id !== id))
  }, [])

  const fire = useCallback<ToastFn>((msg, opts = {}) => {
    const id  = Math.random().toString(36).slice(2)
    const dur = opts.duration ?? (opts.action ? 5000 : 2800)
    setItems(x => [...x, { id, msg, ...opts }])
    setTimeout(() => dismiss(id), dur)
  }, [dismiss])

  useEffect(() => {
    _fn = fire
    return () => { _fn = null }
  }, [fire])

  return (
    <div className="toast-host">
      {items.map(i => (
        <div key={i.id} className={`toast${i.type ? ' ' + i.type : ''}${i.action ? ' has-action' : ''}`}>
          <Icon name={i.icon ?? 'shark'} size={16} />
          <span className="toast-msg">{i.msg}</span>
          {i.action && (
            <button
              className="toast-action"
              onClick={() => { i.action!.onClick(); dismiss(i.id) }}>
              {i.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
