import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmt, dateLocale } from '@/data/helpers'
import { isTauri } from '@/hooks/useTauri'
import { hasNotificationAccess, openNotificationAccessSettings } from '@/lib/bankNotifications'
import { useBankSuggestions } from '@/store/bankSuggestions'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'
import { ACCT_ICONS, useBankSuggestionActions } from './bankSuggestionActions'

const isAndroidTauri = isTauri() && /android/i.test(navigator.userAgent)

export function SettingsBankNotifications({ activeSheet, onOpen, onClose, grouped }: SheetProps & { grouped?: boolean }) {
  const suggestions = useBankSuggestions()
  const { currency } = useFinance()
  const lang = (useSettings(s => s.language) ?? 'es') as 'en' | 'es'
  const settings = useSettings()
  const t = useT()
  const [granted, setGranted] = useState<boolean | null>(null)
  const { handleAdd, openPicker, resolveFor, pickerNode } = useBankSuggestionActions()

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    hasNotificationAccess().then(value => { if (!cancelled) setGranted(value) })
    return () => { cancelled = true }
  }, [activeSheet])

  const handleOpenSettings = async () => {
    await openNotificationAccessSettings()
  }

  const handleDiscardAll = () => {
    suggestions.clear()
    toast(t('capturesCleared'), { icon: 'trash' })
  }

  if (!isTauri()) return null

  const accessLabel = granted == null ? t('checking') : granted ? t('accessGranted') : t('accessNotGranted')

  const card = (
    <div className="mset-card">
      {isAndroidTauri && (
        <div className="mset-row">
          <span className="mset-row-icon" style={{ background: '#ff6b8a22', color: '#ff6b8a' }}>
            <Icon name="bell" size={18} />
          </span>
          <div className="mset-row-text">
            <b>{t('backgroundReminders')}</b>
            <small>{t('backgroundRemindersDesc')}</small>
          </div>
          <label className="mset-toggle-wrap">
            <input
              type="checkbox"
              className="mset-toggle-input"
              checked={settings.remindersEnabled}
              onChange={e => settings.setRemindersEnabled(e.target.checked)}
            />
            <span className="mset-toggle" />
          </label>
        </div>
      )}
      {isAndroidTauri && (
        <div className="mset-row">
          <span className="mset-row-icon" style={{ background: '#5b9bff22', color: '#5b9bff' }}>
            <Icon name="plus" size={18} />
          </span>
          <div className="mset-row-text">
            <b>{t('quickAddNotifLabel')}</b>
            <small>{t('quickAddNotifDesc')}</small>
          </div>
          <label className="mset-toggle-wrap">
            <input
              type="checkbox"
              className="mset-toggle-input"
              checked={settings.quickAddNotification}
              onChange={e => settings.setQuickAddNotification(e.target.checked)}
            />
            <span className="mset-toggle" />
          </label>
        </div>
      )}
      <SettingsRow icon="shield" iconColor="#5bc0ff" label={t('transactionDetection')}
        sublabel={t('transactionDetectionSub')}
        value={suggestions.items.length ? t('capturedCount').replace('{count}', String(suggestions.items.length)) : undefined}
        onClick={() => onOpen('bankNotifications')} />
    </div>
  )

  return (
    <>
      {grouped ? card : (
        <div className="mset-section">
          <div className="mset-section-label">{t('notificationsSection')}</div>
          {card}
        </div>
      )}

      {activeSheet === 'bankNotifications' && (
        <SettingsSheet title={t('transactionDetection')} onClose={onClose}>
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
                <b>{t('autoDetectTransactions')}</b>
                <small>{t('autoDetectTransactionsDesc')}</small>
              </div>
              <label className="mset-toggle-wrap">
                <input type="checkbox" className="mset-toggle-input"
                  checked={suggestions.enabled}
                  onChange={e => suggestions.setEnabled(e.target.checked)} />
                <span className="mset-toggle" />
              </label>
            </div>

            <p className="mset-section-label" style={{ marginTop: 16 }}>
              {t('suggestedMovements').replace('{count}', String(suggestions.items.length))}
            </p>
            {suggestions.items.length === 0 ? (
              <p className="mset-legal-intro">{t('noSuggestionsYet')}</p>
            ) : (
              <div className="mset-card">
                {suggestions.items.map(item => {
                  const resolvedAccount = resolveFor(item)
                  return (
                    <div key={item.id} className="mset-row">
                      <span className="mset-row-icon" style={{
                        background: item.type === 'income' ? '#35d0a222' : '#ff6b8a22',
                        color: item.type === 'income' ? '#35d0a2' : '#ff6b8a',
                      }}>
                        <Icon name={item.type === 'income' ? 'arrowDn' : 'arrowUp'} size={16} style={{ transform: item.type === 'income' ? 'rotate(180deg)' : 'none' }} />
                      </span>
                      <div className="mset-row-text">
                        <b>{item.note}</b>
                        <small>{new Date(item.date).toLocaleDateString(dateLocale(lang))} · {fmt(item.amount, item.currency ?? currency)}</small>
                        <button className="mset-suggestion-account" onClick={() => openPicker(item)}>
                          <Icon name={resolvedAccount ? ACCT_ICONS[resolvedAccount.type] : 'alert'} size={11} />
                          {resolvedAccount ? resolvedAccount.name : t('chooseAccountLabel')}
                        </button>
                      </div>
                      <button className="mset-suggestion-add" onClick={() => handleAdd(item)} aria-label={t('addMovement')}>
                        <Icon name="plus" size={16} />
                      </button>
                      <button className="mset-suggestion-dismiss" onClick={() => suggestions.remove(item.id)} aria-label={t('dismiss')}>
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {suggestions.items.length > 0 && (
              <button className="mset-sheet-danger" onClick={handleDiscardAll}>
                <Icon name="trash" size={16} /> {t('clearCaptures')}
              </button>
            )}
          </div>
        </SettingsSheet>
      )}

      {pickerNode}
    </>
  )
}
