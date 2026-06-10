import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { CatBadge } from '@/views/shared'
import { dateLocale, fmt, getAccount, getCategory } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { Account, AccountType, Transaction } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'

const MAX_RESULTS = 8

const ACCOUNT_TYPE_ICON: Record<AccountType, 'wallet' | 'cards'> = {
  cash:    'wallet',
  debit:   'cards',
  savings: 'cards',
  credit:  'cards',
}

function txDateLabel(date: string, locale: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

function signedAmount(tx: Transaction, currency: Parameters<typeof fmt>[1]): string {
  if (tx.type === 'income') return `+${fmt(tx.amount, currency)}`
  if (tx.type === 'expense') return `-${fmt(tx.amount, currency)}`
  return fmt(tx.amount, currency)
}

function accountLabel(account: Account | undefined, fallback: string): string {
  return account?.name ?? fallback
}

export function MobileGlobalSearch({
  onClose,
  onEditTx,
  onGotoAccounts,
  onGotoCategories,
  onGotoGoals,
}: {
  onClose: () => void
  onEditTx: (tx: Transaction) => void
  onGotoAccounts: () => void
  onGotoCategories: () => void
  onGotoGoals: () => void
}) {
  const { accounts, categories, goals, transactions, currency } = useFinance()
  const lang = useSettings(s => s.language)
  const locale = dateLocale(lang)
  const [query, setQuery] = useState('')

  useMobileBackDismiss(true, onClose)

  const q = query.trim().toLowerCase()

  const matchedAccounts = useMemo(() => {
    if (!q) return []
    return accounts.filter(a => a.name.toLowerCase().includes(q) || a.short.toLowerCase().includes(q)).slice(0, MAX_RESULTS)
  }, [accounts, q])

  const matchedCategories = useMemo(() => {
    if (!q) return []
    return categories.filter(c => c.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS)
  }, [categories, q])

  const matchedGoals = useMemo(() => {
    if (!q) return []
    return goals.filter(g => g.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS)
  }, [goals, q])

  const matchedTx = useMemo(() => {
    if (!q) return []
    return transactions
      .filter(tx => {
        const category = getCategory(tx.categoryId, categories)
        const account = getAccount(tx.accountId, accounts)
        const from = getAccount(tx.fromAccount, accounts)
        const to = getAccount(tx.toAccount, accounts)
        const haystack = [tx.note, category?.name, account?.name, from?.name, to?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_RESULTS)
  }, [transactions, categories, accounts, q])

  const hasResults = matchedAccounts.length > 0 || matchedCategories.length > 0
    || matchedGoals.length > 0 || matchedTx.length > 0

  return (
    <div className="mobile-search-overlay" role="dialog" aria-modal="true" aria-label="Búsqueda global">
      <div className="mobile-search-head">
        <button onClick={onClose}>Cancelar</button>
        <strong>Buscar</strong>
        <span />
      </div>
      <label className="mobile-search-input">
        <Icon name="search" size={18} />
        <input
          autoFocus
          value={query}
          placeholder="Movimientos, cuentas, categorías, metas"
          onChange={event => setQuery(event.target.value)}
        />
      </label>

      {!q && (
        <div className="mobile-empty-list">
          <Icon name="search" size={40} style={{ opacity: .25 }} />
          <strong>Busca en toda la app</strong>
          <span>Encuentra movimientos, cuentas, categorías y metas.</span>
        </div>
      )}

      {q && !hasResults && (
        <div className="mobile-empty-list">
          <Icon name="search" size={40} style={{ opacity: .25 }} />
          <strong>Sin resultados</strong>
          <span>Prueba con otro término de búsqueda.</span>
        </div>
      )}

      {matchedAccounts.length > 0 && (
        <div className="mset-section">
          <span className="mset-section-title">Cuentas</span>
          <div className="mset-card">
            {matchedAccounts.map(account => (
              <button key={account.id} className="mset-row" onClick={() => { onGotoAccounts(); onClose() }}>
                <span className="mset-icon" style={{ color: account.color, background: `color-mix(in oklab, ${account.color} 14%, transparent)` }}>
                  <Icon name={ACCOUNT_TYPE_ICON[account.type]} size={18} />
                </span>
                <span className="mset-label">{account.name}</span>
                <span className="mset-value">{fmt(account.balance, currency)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedCategories.length > 0 && (
        <div className="mset-section">
          <span className="mset-section-title">Categorías</span>
          <div className="mset-card">
            {matchedCategories.map(category => (
              <button key={category.id} className="mset-row" onClick={() => { onGotoCategories(); onClose() }}>
                <CatBadge category={category} size={32} />
                <span className="mset-label">{category.name}</span>
                <span className="mset-value">{category.type === 'income' ? 'Ingreso' : 'Gasto'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedGoals.length > 0 && (
        <div className="mset-section">
          <span className="mset-section-title">Metas</span>
          <div className="mset-card">
            {matchedGoals.map(goal => (
              <button key={goal.id} className="mset-row" onClick={() => { onGotoGoals(); onClose() }}>
                <span className="mset-icon" style={{ color: goal.color, background: `color-mix(in oklab, ${goal.color} 14%, transparent)` }}>
                  <Icon name={goal.icon} size={18} />
                </span>
                <span className="mset-label">{goal.name}</span>
                <span className="mset-value">{fmt(goal.saved, currency)} / {fmt(goal.target, currency)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedTx.length > 0 && (
        <div className="mset-section">
          <span className="mset-section-title">Movimientos</span>
          <div className="mobile-list-card">
            {matchedTx.map(tx => {
              const category = getCategory(tx.categoryId, categories)
              const account = getAccount(tx.accountId, accounts)
              return (
                <button key={tx.id} className="mobile-tx-row" onClick={() => { onEditTx(tx); onClose() }}>
                  {tx.type === 'transfer'
                    ? <span className="mobile-transfer-icon"><Icon name="repeat" size={24} /></span>
                    : <CatBadge category={category} size={40} />}
                  <span>
                    <b>{tx.type === 'transfer' ? 'Transferencia' : tx.note}</b>
                    <small>{tx.type === 'transfer'
                      ? `${accountLabel(getAccount(tx.fromAccount, accounts), 'Origen')} → ${accountLabel(getAccount(tx.toAccount, accounts), 'Destino')}`
                      : `${category?.name ?? 'Sin categoría'} · ${account?.name ?? 'Sin cuenta'} · ${txDateLabel(tx.date, locale)}`}</small>
                  </span>
                  <strong className={tx.type === 'income' ? 'income' : tx.type === 'transfer' ? 'transfer' : ''}>
                    {signedAmount(tx, currency)}
                  </strong>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
