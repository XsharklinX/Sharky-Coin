import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { projectCashflow } from '@/data/cashflowProjection'
import { accountBalanceInBase, localToday, totalBalanceInBase, visibleAccounts } from '@/data/helpers'
import { useFmt } from '@/hooks/useFmt'
import { useT, type LangKey } from '@/i18n'
import { processAvatarPhoto } from '@/lib/avatarPhoto'
import { monthsLabel, simulatePayoff, useDebt } from '@/store/debt'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { Account, IconName, ViewId } from '@/types'

// Mismo horizonte que la pestaña "Mes" de MobileCashflow — último día del mes
// actual. Se duplica aquí (en vez de importar el componente, que arrastra
// recharts) porque `projectCashflow` en sí es puro y liviano.
function endOfMonth(today: string): string {
  const d = new Date(`${today}T00:00:00`)
  d.setMonth(d.getMonth() + 1, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// El complemento exacto del menú rápido de Movimientos (☰): ese se quedó con
// las 4 acciones de uso diario (Presupuestos, Metas, Listas, Conversor). Esta
// sección se llama "Explorar" (no "Herramientas" — tener el mismo nombre en
// dos lugares con contenido distinto confundía) y usa mosaicos de color, no
// filas de texto, para no verse como una copia de ese menú.
const EXPLORE_CARDS: { view: ViewId; icon: IconName; color: string; labelKey: LangKey }[] = [
  { view: 'subscriptions', icon: 'repeat',   color: '#5bc0ff', labelKey: 'subscriptions' },
  { view: 'annual',       icon: 'chart',     color: '#a78bfa', labelKey: 'annualReport' },
  { view: 'calendar',     icon: 'calendar',  color: '#f59e0b', labelKey: 'calendarLabel' },
]

export function MobileProfile({
  userName,
  goto,
}: {
  userName?: string
  goto: (view: ViewId) => void
}) {
  const { displayName, setDisplayName, profilePhoto, setProfilePhoto } = useSettings()
  const { accounts, transactions, goals, currency } = useFinance()
  const debtStore = useDebt()
  const fmtVal = useFmt()
  const t = useT()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(displayName || userName || '')
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)

  const effectiveName = displayName || userName || ''
  const initial = effectiveName ? effectiveName.slice(0, 1).toUpperCase() : '$'

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await processAvatarPhoto(file)
      setProfilePhoto(dataUrl)
      toast(t('photoUpdatedToast'), { icon: 'check', type: 'ok' })
    } catch {
      toast(t('photoUpdateError'), { icon: 'alert' })
    }
  }

  const handleAvatarClick = () => {
    if (profilePhoto) {
      setPhotoMenuOpen(v => !v)
    } else {
      photoInputRef.current?.click()
    }
  }

  const saveName = () => {
    const trimmed = nameInput.trim()
    setDisplayName(trimmed)
    setEditingName(false)
    if (trimmed) toast(t('nameUpdatedTo').replace('{name}', trimmed), { icon: 'check', type: 'ok' })
  }

  const activeAccounts = visibleAccounts(accounts)
  const totalBalance = totalBalanceInBase(accounts, currency)
  const bankingAccounts = activeAccounts.filter(account => account.type === 'debit' || account.type === 'savings')
  const creditAccounts = activeAccounts.filter(account => account.type === 'credit')
  const debtBalance = Math.abs(creditAccounts.reduce((sum, account) => sum + Math.min(0, accountBalanceInBase(account, currency)), 0))
  const topAccounts = [...activeAccounts].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 3)

  // Deudas y Flujo de Caja eran herramientas huérfanas (solo alcanzables desde
  // el menú de Movimientos, y encima aparecían dentro de "Cuentas" por un bug
  // de ruteo). Ahora viven aquí como tarjetas con datos reales — se ve de un
  // vistazo si hay algo que atender, no hay que entrar a averiguarlo.
  const debtSummary = useMemo(() => {
    if (debtStore.debts.length === 0) return null
    const totalDebt = debtStore.debts.reduce((sum, d) => sum + d.balance, 0)
    const payoff = simulatePayoff(debtStore.debts, debtStore.extraPayment, 'avalanche')
    return { totalDebt, months: payoff.months }
  }, [debtStore.debts, debtStore.extraPayment])

  const today = localToday()
  const cashflow = useMemo(
    () => projectCashflow(transactions, accounts, goals, endOfMonth(today), today, currency),
    [transactions, accounts, goals, today, currency],
  )

  return (
    <div className="mpr-root">
      <div className="mpr-hero">
        <div className="mpr-hero-glow" aria-hidden="true" />
        <div className="mpr-avatar-wrap">
          <button
            className="mpr-avatar mpr-avatar-btn"
            onClick={handleAvatarClick}
            aria-label={profilePhoto ? t('changePhotoLabel') : t('addPhotoLabel')}
          >
            {profilePhoto ? <img src={profilePhoto} alt="" className="mpr-avatar-img" /> : initial}
          </button>
          {photoMenuOpen && (
            <>
              <button
                className="mpr-photo-menu-backdrop"
                aria-label={t('close')}
                onClick={() => setPhotoMenuOpen(false)}
              />
              <div className="mpr-photo-menu" role="menu">
                <button
                  role="menuitem"
                  onClick={() => { setPhotoMenuOpen(false); photoInputRef.current?.click() }}
                >
                  <Icon name="camera" size={14} /> {t('changePhotoLabel')}
                </button>
                <button
                  role="menuitem"
                  className="mpr-photo-menu-danger"
                  onClick={() => {
                    setPhotoMenuOpen(false)
                    setProfilePhoto(null)
                    toast(t('photoRemovedToast'), { icon: 'trash' })
                  }}
                >
                  <Icon name="trash" size={14} /> {t('removePhotoLabel')}
                </button>
              </div>
            </>
          )}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => void handlePhotoChange(e)}
        />

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
          <div className="mpr-hero-identity">
            <h2>{effectiveName || t('myAccountLabel')}</h2>
            <button
              className="mpr-edit-name-btn"
              onClick={() => {
                setNameInput(effectiveName)
                setEditingName(true)
              }}
              aria-label={effectiveName ? t('editNameLabel') : t('addNameLabel')}
            >
              <Icon name="edit" size={12} />
            </button>
          </div>
        )}
        <div className="mpr-hero-balance">
          <small>{t('totalBalance')}</small>
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

      <div className="mpr-kpi-grid">
        <button className="mpr-kpi-card" style={{ '--kpi-color': '#6366f1' } as React.CSSProperties} onClick={() => goto('debt')}>
          <span className="mpr-kpi-icon"><Icon name="dollar" size={18} /></span>
          <span className="mpr-kpi-label">{t('debtsLabel')}</span>
          <strong className="mpr-kpi-value">{debtSummary ? fmtVal(debtSummary.totalDebt, currency) : '—'}</strong>
          <small className="mpr-kpi-sub">{debtSummary ? monthsLabel(debtSummary.months, t) : t('debtQuickDesc')}</small>
        </button>
        <button className="mpr-kpi-card" style={{ '--kpi-color': '#38bdf8' } as React.CSSProperties} onClick={() => goto('cashflow')}>
          <span className="mpr-kpi-icon"><Icon name="trend" size={18} /></span>
          <span className="mpr-kpi-label">{t('cashflowTitle')}</span>
          <strong className={`mpr-kpi-value${cashflow.endBalance < 0 ? ' text-expense' : ''}`}>
            {fmtVal(cashflow.endBalance, currency)}
          </strong>
          <small className="mpr-kpi-sub">{t('cashflowEndOfMonth')}</small>
        </button>
      </div>

      <div className="mpr-card">
        <div className="mpr-card-header">
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
                <strong>{fmtVal(bankingAccounts.reduce((sum, account) => sum + accountBalanceInBase(account, currency), 0), currency)}</strong>
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

      <div className="mpr-card">
        <div className="mpr-card-header">
          <span>{t('exploreSection')}</span>
        </div>
        <div className="mpr-explore-grid">
          {EXPLORE_CARDS.map(card => (
            <button key={card.view} className="mpr-explore-tile" style={{ '--tile-color': card.color } as React.CSSProperties} onClick={() => goto(card.view)}>
              <span className="mpr-explore-icon"><Icon name={card.icon} size={20} /></span>
              <b>{t(card.labelKey)}</b>
            </button>
          ))}
        </div>
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
