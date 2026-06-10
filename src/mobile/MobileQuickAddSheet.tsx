import { useCallback, useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmt, fmtCompact } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useT } from '@/i18n'
import { playBackspaceSound, playDoneSound, playKeySound, playOperatorSound } from '@/lib/sound'
import type { IconName } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'

type QuickAddMode = 'expense' | 'income'

const today = () => new Date().toISOString().slice(0, 10)
const keypad = [
  '7', '8', '9', '÷',
  '4', '5', '6', '×',
  '1', '2', '3', '−',
  '0', '.', '+',
] as const
const OPERATORS = ['+', '−', '×', '÷'] as const
type Operator = (typeof OPERATORS)[number]

const ACCT_ICONS: Record<string, IconName> = {
  cash: 'wallet', debit: 'cards', savings: 'piggy', credit: 'cards',
}

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

// Evaluates a left-to-right expression with standard ×/÷ precedence over +/−.
function evaluateExpression(expr: string): number {
  const raw = expr.match(/[+−×÷]|[\d.]+/g)
  if (!raw?.length) return 0
  const tokens = (OPERATORS as readonly string[]).includes(raw[raw.length - 1]) ? raw.slice(0, -1) : raw
  if (!tokens.length) return 0

  const terms: number[] = []
  const signs: ('+' | '−')[] = []
  let acc = Number(tokens[0]) || 0
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as Operator
    const val = Number(tokens[i + 1]) || 0
    if (op === '×') acc *= val
    else if (op === '÷') acc = val !== 0 ? acc / val : acc
    else {
      terms.push(acc)
      signs.push(op)
      acc = val
    }
  }
  terms.push(acc)

  return terms.reduce((sum, term, idx) => idx === 0 ? term : sum + (signs[idx - 1] === '−' ? -term : term), 0)
}

/**
 * Mini ventana de captura rápida para los accesos directos del ícono
 * (mantener presionado — ver res/xml/shortcuts.xml). Permite registrar un
 * gasto o ingreso sin entrar al flujo completo de la app.
 */
export function MobileQuickAddSheet({
  mode,
  onClose,
  onSaved,
  onOpenFull,
}: {
  mode: QuickAddMode
  onClose: () => void
  onSaved: () => void
  onOpenFull: () => void
}) {
  const t = useT()
  const { accounts, categories, currency, addTx } = useFinance()
  const [amountText, setAmountText] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(() => accounts.length === 1 ? accounts[0].id : null)
  const [accountPicker, setAccountPicker] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [triedSave, setTriedSave] = useState(false)
  const [shaking, setShaking] = useState(false)

  useMobileBackDismiss(true, onClose)
  useMobileBackDismiss(accountPicker, () => setAccountPicker(false))

  const amount = evaluateExpression(amountText)
  const hasOperator = OPERATORS.some(op => amountText.includes(op))
  const visibleCategories = useMemo(
    () => categories.filter(c => c.type === mode).slice(0, 24),
    [categories, mode],
  )
  const activeCategory = visibleCategories.find(c => c.id === categoryId) ?? null
  const activeAccountId = accountId && accounts.some(a => a.id === accountId) ? accountId : null
  const activeAccount = activeAccountId ? accounts.find(a => a.id === activeAccountId) : null
  const canSave = amount > 0 && !!activeCategory && !!activeAccountId

  const pressKey = useCallback((key: (typeof keypad)[number] | 'back') => {
    setFormError(null)
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
  }, [])

  const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 420)
  }

  const save = () => {
    if (!canSave) {
      const msg = amount <= 0
        ? t('amountError')
        : !activeCategory
          ? t('categoryError')
          : t('accountError')
      setFormError(msg)
      setTriedSave(true)
      triggerShake()
      return
    }
    try {
      addTx({
        type: mode,
        amount,
        date: today(),
        note: activeCategory!.name,
        categoryId: activeCategory!.id,
        accountId: activeAccountId!,
      })
      navigator.vibrate?.(18)
      playDoneSound()
      toast(t('movementSaved'), { icon: 'check', type: 'ok' })
      onSaved()
    } catch (error) {
      toast(error instanceof Error ? error.message : t('couldNotSave'), { icon: 'alert' })
    }
  }

  const amountColor = mode === 'income' ? '#35d0a2' : '#f65574'
  const currencyPrefix = currency === 'DOP' ? 'RD$' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency

  return (
    <div className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="mobile-quickadd-sheet" onClick={e => e.stopPropagation()}>
        <header className="mobile-quickadd-header">
          <span>{mode === 'expense' ? t('quickAddExpense') : t('quickAddIncome')}</span>
          <button onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="mobile-create-section-header">
          <span>{t('category')}</span>
        </div>
        {visibleCategories.length ? (
          <div className={`mobile-category-grid mobile-quickadd-categories${triedSave && !activeCategory ? ' field-error' : ''}`}>
            {visibleCategories.map(category => {
              const selected = activeCategory?.id === category.id
              return (
                <button key={category.id} className={selected ? 'on' : ''} aria-pressed={selected}
                  onClick={() => { setCategoryId(category.id); setTriedSave(false) }}>
                  <span style={{ color: category.color, background: `color-mix(in oklab, ${category.color} 22%, transparent)` }}>
                    <Icon name={category.icon} size={20} />
                  </span>
                  <small>{category.name}</small>
                </button>
              )
            })}
          </div>
        ) : (
          <button className="mobile-empty-action" onClick={onOpenFull}>
            {t('createCategoryToContinue')}
          </button>
        )}

        <div className={`mobile-create-amount-row${shaking ? ' shake' : ''}`}>
          <span className="mobile-create-amount-label">
            {mode === 'expense' ? t('expense') : t('income')}
          </span>
          <span className="mobile-create-amount-stack">
            {hasOperator && (
              <small className="mobile-create-amount-expr">{currencyPrefix} {amountText}</small>
            )}
            <strong className="mobile-create-amount-value" style={{ color: amountText ? amountColor : '#3a3a3a' }}>
              {amountText
                ? (amountText.endsWith('.')
                    ? `${currencyPrefix} ${amount.toLocaleString('en-US')}.`
                    : fmt(amount, currency, { decimals: amountText.includes('.') ? 2 : 0 }))
                : `${currencyPrefix} 0`}
            </strong>
          </span>
        </div>
        {formError && (
          <div className="mobile-create-error">
            <Icon name="alert" size={13} />
            {formError}
          </div>
        )}

        <div className="mobile-create-quick-row">
          <button
            className={`mobile-quick-icon-btn${!activeAccount ? ' unset' : ''}${triedSave && !activeAccountId ? ' field-error' : ''}`}
            onClick={() => setAccountPicker(true)}
            aria-label={t('account')}
          >
            <Icon name={activeAccount ? ACCT_ICONS[activeAccount.type] : 'cards'} size={17} style={{ color: activeAccount?.color ?? 'var(--m-muted)' }} />
          </button>
          <span className="mobile-quickadd-account-name">{activeAccount?.name ?? t('selectAccount')}</span>
          <button className="mobile-quickadd-more" onClick={onOpenFull}>{t('moreOptions')}</button>
        </div>

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
            <button className="mobile-back-button" onClick={() => pressKey('back')} aria-label={t('delete')}>
              <Icon name="close" size={18} />
            </button>
            <button className="mobile-done-button" onClick={save} aria-label={t('save')}>
              <Icon name="check" size={20} />
            </button>
          </div>
        </div>
      </section>

      {accountPicker && (
        <div className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={e => { e.stopPropagation(); setAccountPicker(false) }}>
          <section onClick={e => e.stopPropagation()}>
            <header>
              <span>{t('selectAccount')}</span>
              <button onClick={() => setAccountPicker(false)}><Icon name="close" size={18} /></button>
            </header>
            {accounts.length === 0 ? (
              <div className="mobile-picker-list" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                {t('noAccountsYet')}
              </div>
            ) : (
              <div className="mobile-picker-list">
                {accounts.map(account => (
                  <button key={account.id}
                    className={`mobile-picker-row${account.id === activeAccountId ? ' active' : ''}`}
                    onClick={() => { setAccountId(account.id); setAccountPicker(false); setTriedSave(false) }}>
                    <span style={{ color: account.color }}>
                      <Icon name={ACCT_ICONS[account.type] ?? 'wallet'} size={22} />
                    </span>
                    <b>{account.name}</b>
                    <small>{fmtCompact(account.balance, currency)}</small>
                    {account.id === activeAccountId && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 4 }} />}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
