import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useFmt } from '@/hooks/useFmt'
import { useT } from '@/i18n'
import type { ViewId } from '@/types'

export function MobileProfile({
  userName,
  onSettings,
  goto,
}: {
  userName?: string
  onSettings: () => void
  goto: (view: ViewId) => void
}) {
  const { displayName, setDisplayName } = useSettings()
  const { accounts, currency } = useFinance()
  const fmtVal = useFmt()
  const t = useT()

  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState(displayName || userName || '')

  const effectiveName = displayName || userName || ''
  const initial       = effectiveName ? effectiveName.slice(0, 1).toUpperCase() : '$'

  const saveName = () => {
    const trimmed = nameInput.trim()
    setDisplayName(trimmed)
    setEditingName(false)
    if (trimmed) toast(t('nameUpdatedTo').replace('{name}', trimmed), { icon: 'check', type: 'ok' })
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="mpr-root">

      {/* ── Avatar / Name ── */}
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
            <button className="mpr-edit-name-btn" onClick={() => { setNameInput(effectiveName); setEditingName(true) }}>
              <Icon name="edit" size={13} />
              {effectiveName ? t('editNameLabel') : t('addNameLabel')}
            </button>
          </>
        )}

        <div className="mpr-balance-badge">
          <span>{t('totalBalance')}</span>
          <strong>{fmtVal(totalBalance, currency)}</strong>
        </div>
      </div>

      {/* ── Herramientas ── */}
      <div className="mpr-section">
        <div className="mpr-section-header"><span>{t('toolsLabel')}</span></div>
        <div className="mpr-quick-grid">
          <button className="mpr-quick-card" onClick={onSettings}>
            <span className="mpr-quick-icon" style={{ background: '#ffdd3d22', color: '#ffdd3d' }}>
              <Icon name="settings" size={22} />
            </span>
            <strong>{t('settings')}</strong>
            <small>{t('settingsQuickDesc')}</small>
          </button>
          <button className="mpr-quick-card" onClick={() => goto('subscriptions')}>
            <span className="mpr-quick-icon" style={{ background: '#5bc0ff22', color: '#5bc0ff' }}>
              <Icon name="repeat" size={22} />
            </span>
            <strong>{t('subscriptions')}</strong>
            <small>{t('subscriptionsQuickDesc')}</small>
          </button>
          <button className="mpr-quick-card" onClick={() => goto('goals')}>
            <span className="mpr-quick-icon" style={{ background: '#35d0a222', color: '#35d0a2' }}>
              <Icon name="target" size={22} />
            </span>
            <strong>{t('goals')}</strong>
            <small>{t('goalsQuickDesc')}</small>
          </button>
          <button className="mpr-quick-card" onClick={() => goto('annual')}>
            <span className="mpr-quick-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
              <Icon name="chart" size={22} />
            </span>
            <strong>{t('annualReport')}</strong>
            <small>{t('annualQuickDesc')}</small>
          </button>
          <button className="mpr-quick-card" onClick={() => goto('calendar')}>
            <span className="mpr-quick-icon" style={{ background: '#f59e0b22', color: '#f59e0b' }}>
              <Icon name="calendar" size={22} />
            </span>
            <strong>{t('calendarLabel')}</strong>
            <small>{t('calendarQuickDesc')}</small>
          </button>
          <button className="mpr-quick-card" onClick={() => goto('debt')}>
            <span className="mpr-quick-icon" style={{ background: '#ff6b8a22', color: '#ff6b8a' }}>
              <Icon name="dollar" size={22} />
            </span>
            <strong>{t('debtsLabel')}</strong>
            <small>{t('debtQuickDesc')}</small>
          </button>
        </div>
      </div>
    </div>
  )
}
