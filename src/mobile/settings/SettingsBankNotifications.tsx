import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { isTauri } from '@/hooks/useTauri'
import { useBankNotifications } from '@/hooks/useBankNotifications'
import { hasNotificationAccess, openNotificationAccessSettings } from '@/lib/bankNotifications'
import { useNotificationInbox } from '@/store/notificationInbox'
import { useT } from '@/i18n'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'

export function SettingsBankNotifications({ activeSheet, onOpen, onClose }: SheetProps) {
  const inbox = useNotificationInbox()
  const t = useT()
  const [granted, setGranted] = useState<boolean | null>(null)

  useBankNotifications()

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    hasNotificationAccess().then(value => { if (!cancelled) setGranted(value) })
    return () => { cancelled = true }
  }, [activeSheet])

  const handleOpenSettings = async () => {
    await openNotificationAccessSettings()
  }

  const handleClear = () => {
    inbox.clear()
    toast(t('capturesCleared'), { icon: 'trash' })
  }

  if (!isTauri()) return null

  const accessLabel = granted == null ? t('checking') : granted ? t('accessGranted') : t('accessNotGranted')

  return (
    <>
      <div className="mset-section">
        <div className="mset-section-label">{t('bankNotificationsSection')}</div>
        <div className="mset-card">
          <SettingsRow icon="bell" iconColor="#5bc0ff" label={t('transactionDetection')}
            value={t('capturedCount').replace('{count}', String(inbox.items.length))}
            onClick={() => onOpen('bankNotifications')} />
        </div>
      </div>

      {activeSheet === 'bankNotifications' && (
        <SettingsSheet title={t('bankNotificationsSection')} onClose={onClose}>
          <div className="mset-sheet-body">
            <p className="mset-legal-intro">
              {t('bankNotificationsIntro')}
            </p>

            <div className="mset-row">
              <span className="mset-row-icon" style={{ background: '#5bc0ff22', color: '#5bc0ff' }}>
                <Icon name="shield" size={18} />
              </span>
              <div className="mset-row-text">
                <b>{t('notificationAccess')}</b>
                <small>{accessLabel}</small>
              </div>
            </div>
            <button className="mset-sheet-confirm" onClick={handleOpenSettings}>
              {t('openNotificationSettings')}
            </button>

            <div className="mset-row">
              <span className="mset-row-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
                <Icon name="bell" size={18} />
              </span>
              <div className="mset-row-text">
                <b>{t('captureNotificationsTest')}</b>
                <small>{t('captureNotificationsDesc')}</small>
              </div>
              <label className="mset-toggle-wrap">
                <input type="checkbox" className="mset-toggle-input"
                  checked={inbox.enabled}
                  onChange={e => inbox.setEnabled(e.target.checked)} />
                <span className="mset-toggle" />
              </label>
            </div>

            <p className="mset-section-label" style={{ marginTop: 16 }}>
              {t('capturedHeader').replace('{count}', String(inbox.items.length))}
            </p>
            {inbox.items.length === 0 ? (
              <p className="mset-legal-intro">{t('noCapturedYet')}</p>
            ) : (
              <div className="mset-card">
                {inbox.items.map(item => (
                  <div key={item.id} className="mset-row" style={{ alignItems: 'flex-start' }}>
                    <div className="mset-row-text">
                      <b>{item.title || t('noTitle')}</b>
                      <small style={{ whiteSpace: 'pre-wrap' }}>{item.text || t('noText')}</small>
                      <small>{item.package} · {new Date(item.postTime).toLocaleString()}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inbox.items.length > 0 && (
              <button className="mset-sheet-danger" onClick={handleClear}>
                <Icon name="trash" size={16} /> {t('clearCaptures')}
              </button>
            )}
          </div>
        </SettingsSheet>
      )}
    </>
  )
}
