import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { visibleAccounts } from '@/data/helpers'
import { useFmt } from '@/hooks/useFmt'
import { useT } from '@/i18n'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { Account, IconName, ViewId } from '@/types'

export function MobileProfile({
  userName,
  goto,
}: {
  userName?: string
  goto: (view: ViewId) => void
}) {
  const { displayName, setDisplayName } = useSettings()
  const { accounts, currency } = useFinance()
  const fmtVal = useFmt()
  const t = useT()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(displayName || userName || '')

  const effectiveName = displayName || userName || ''
  const initial = effectiveName ? effectiveName.slice(0, 1).toUpperCase() : '$'

  const saveName = () => {
    const trimmed = nameInput.trim()
    setDisplayName(trimmed)
    setEditingName(false)
    if (trimmed) toast(t('nameUpdatedTo').replace('{name}', trimmed), { icon: 'check', type: 'ok' })
  }

  const activeAccounts = visibleAccounts(accounts)
  const totalBalance = activeAccounts.reduce((sum, account) => sum + account.balance, 0)
  const bankingAccounts = activeAccounts.filter(account => account.type === 'debit' || account.type === 'savings')
  const creditAccounts = activeAccounts.filter(account => account.type === 'credit')
  const debtBalance = Math.abs(creditAccounts.reduce((sum, account) => sum + Math.min(0, account.balance), 0))
  const topAccounts = [...activeAccounts].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 3)

  return (
    <div className="mpr-root">
      <div className="mpr-hero">
        <div className="mpr-avatar">{initial}</div>

        {editingName ? (
          <div className="mpr-name-editor">
            <input
              type="text"
              value={nameInput}
              placeholder={t('yourNamePlaceholder')}
              autoCapitalize="words"
              enterKeyHint="done"
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            />
            <div className="mpr-name-actions">
              <button onClick={() => setEditingName(false)}>{t('cancel')}</button>
              <button className="primary" onClick={saveName}>{t('save')}</button>
            </div>
          </div>
        ) : (
          <>
            <h2>{effectiveName || t('myAccountLabel')}</h2>
            <button
              className="mpr-edit-name-btn"
              onClick={() => {
                setNameInput(effectiveName)
                setEditingName(true)
              }}
            >
              <Icon name="edit" size={13} />
              {effectiveName ? t('editNameLabel') : t('addNameLabel')}
            </button>
          </>
        )}

        <div className="mpr-balance-badge">
          <span>{t('totalBalance')}</span>
          <strong>{fmtVal(totalBalance, currency)}</strong>
        </div>

        <div className="mpr-stats-grid">
          <div className="mpr-stat-card">
            <small>{t('accounts')}</small>
            <strong>{activeAccounts.length}</strong>
          </div>
          <div className="mpr-stat-card">
            <small>{t('bankAccountsGroupLabel')}</small>
            <strong>{bankingAccounts.length}</strong>
          </div>
          <div className="mpr-stat-card">
            <small>{t('creditCardsGroupLabel')}</small>
            <strong>{creditAccounts.length}</strong>
          </div>
        </div>
      </div>

      <div className="mpr-section">
        <div className="mpr-section-header">
          <span>{t('accounts')}</span>
          <button className="mpr-inline-link" onClick={() => goto('accounts')}>
            {t('accounts')}
            <Icon name="arrowUp" size={13} className="mpr-inline-link-chevron" />
          </button>
        </div>

        {topAccounts.length ? (
          <>
            <div className="mpr-account-list">
              {topAccounts.map(account => (
                <button key={account.id} className="mpr-account-row" onClick={() => goto('accounts')}>
                  <span className="mpr-account-icon" style={{ background: `${account.color}22`, color: account.color }}>
                    <Icon name={accountIcon(account)} size={18} />
                  </span>
                  <div className="mpr-account-info">
                    <b>{account.short || account.name}</b>
                    <small>{accountMeta(account, t)}</small>
                  </div>
                  <strong>{fmtVal(account.balance, currency)}</strong>
                </button>
              ))}
            </div>
            <div className="mpr-account-summary">
              <div>
                <small>{t('bankAccountsGroupLabel')}</small>
                <strong>{fmtVal(bankingAccounts.reduce((sum, account) => sum + account.balance, 0), currency)}</strong>
              </div>
              <div>
                <small>{t('debtsLabel')}</small>
                <strong>{fmtVal(debtBalance, currency)}</strong>
              </div>
            </div>
          </>
        ) : (
          <div className="mpr-empty">
            <p>{t('noAccountsShort')}</p>
            <button onClick={() => goto('accounts')}>{t('createAccount')}</button>
          </div>
        )}
      </div>

    </div>
  )
}

function accountIcon(account: Account): IconName {
  if (account.type === 'savings') return 'piggy'
  if (account.type === 'cash') return 'wallet'
  return 'cards'
}

function accountMeta(account: Account, t: ReturnType<typeof useT>) {
  const typeLabel = account.type === 'cash'
    ? t('cash')
    : account.type === 'debit'
      ? t('debit')
      : account.type === 'savings'
        ? t('savings')
        : t('credit')

  return account.last4 ? `${typeLabel} - ****${account.last4}` : typeLabel
}
