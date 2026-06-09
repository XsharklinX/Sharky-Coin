import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { fmt } from '@/data/helpers'
import { playBackspaceSound, playDoneSound, playKeySound, playOperatorSound } from '@/lib/sound'
import { useMobileBackDismiss } from './useMobileBackDismiss'

const keypad = [
  '7', '8', '9', '÷',
  '4', '5', '6', '×',
  '1', '2', '3', '−',
  '0', '.', '+',
] as const

const OPERATORS = ['+', '−', '×', '÷'] as const

function cleanAmount(value: string): string {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '')
  const [integer = '', ...rest] = normalized.split('.')
  const decimal = rest.join('').slice(0, 2)
  const safeInteger = integer.replace(/^0+(?=\d)/, '')
  return rest.length ? `${safeInteger || '0'}.${decimal}` : safeInteger
}

function lastOperatorIndex(expr: string): number {
  return Math.max(...OPERATORS.map(op => expr.lastIndexOf(op)))
}

function lastSegment(expr: string): string {
  const cut = lastOperatorIndex(expr)
  return cut === -1 ? expr : expr.slice(cut + 1)
}

function evaluateExpression(expr: string): number {
  const raw = expr.match(/[+−×÷]|[\d.]+/g)
  if (!raw?.length) return 0
  const tokens = (OPERATORS as readonly string[]).includes(raw[raw.length - 1]) ? raw.slice(0, -1) : raw
  if (!tokens.length) return 0
  const terms: number[] = []
  const signs: ('+' | '−')[] = []
  let acc = Number(tokens[0]) || 0
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as (typeof OPERATORS)[number]
    const val = Number(tokens[i + 1]) || 0
    if (op === '×') acc *= val
    else if (op === '÷') acc = val !== 0 ? acc / val : acc
    else { terms.push(acc); signs.push(op); acc = val }
  }
  terms.push(acc)
  return terms.reduce((sum, term, idx) => idx === 0 ? term : sum + (signs[idx - 1] === '−' ? -term : term), 0)
}

export function MobileAmountSheet({
  title,
  value,
  currency,
  unit,
  onDone,
  onClose,
}: {
  title: string
  value: number
  currency?: string
  unit?: string
  onDone: (value: number) => void
  onClose: () => void
}) {
  const [amountText, setAmountText] = useState(value > 0 ? String(value) : '')

  const amount = amountText ? evaluateExpression(amountText) : 0
  const hasOperator = (OPERATORS as readonly string[]).some(op => amountText.slice(1).includes(op))
  const isPercent = unit === '%'
  const currencyPrefix = currency === 'DOP' ? 'RD$' : (currency ?? '')

  useMobileBackDismiss(true, onClose)

  const pressKey = (key: typeof keypad[number] | 'back') => {
    if (key === 'back') { playBackspaceSound(); setAmountText(v => v.slice(0, -1)); return }
    if ((OPERATORS as readonly string[]).includes(key)) {
      playOperatorSound()
      setAmountText(v => (!v || (OPERATORS as readonly string[]).includes(v.slice(-1)) ? v : v + key))
      return
    }
    if (key === '.') {
      playOperatorSound()
      setAmountText(v => {
        const segment = lastSegment(v)
        if (segment.includes('.')) return v
        return v + (segment ? '.' : '0.')
      })
      return
    }
    playKeySound()
    setAmountText(v => {
      const cut = lastOperatorIndex(v)
      const head = cut === -1 ? '' : v.slice(0, cut + 1)
      const segment = cut === -1 ? v : v.slice(cut + 1)
      if (/^0\.0*$/.test(segment) && key !== '0') return head + key
      return head + cleanAmount(segment + key)
    })
  }

  const done = () => {
    playDoneSound()
    onDone(amount)
  }

  return (
    <div className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="mamt-sheet" onClick={e => e.stopPropagation()}>
        <header>
          <span>{title}</span>
          <button onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="mamt-amount-display">
          {hasOperator && <small className="mamt-expr">{currencyPrefix} {amountText}</small>}
          <strong style={{ color: amount > 0 ? 'var(--income, #35d0a2)' : 'var(--m-text)' }}>
            {isPercent
              ? (amountText ? `${amount}%` : '0%')
              : (amountText
                  ? (amountText.endsWith('.')
                      ? `${currencyPrefix} ${amount.toLocaleString('en-US')}.`
                      : fmt(amount, currency as import('@/types').CurrencyCode, { decimals: amountText.includes('.') ? 2 : 0 }))
                  : `${currencyPrefix} 0`)}
          </strong>
        </div>

        <div className="mamt-keypad">
          <div className="mobile-keypad-row">
            <div className="mobile-keypad-compact">
              {keypad.map(key => (
                <button
                  key={key}
                  className={[
                    (OPERATORS as readonly string[]).includes(key) ? 'op' : '',
                    key === '0' ? 'wide' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => pressKey(key)}>
                  {key}
                </button>
              ))}
            </div>
            <div className="mobile-keypad-actions">
              <button className="mobile-back-button" onClick={() => pressKey('back')} aria-label="Borrar">
                <Icon name="close" size={18} />
              </button>
              <button className="mobile-done-button" onClick={done} aria-label="Listo">
                <Icon name="check" size={20} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
