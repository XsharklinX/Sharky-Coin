import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmt, dateLocale } from '@/data/helpers'
import { guessCategoryId } from '@/data/bankCsv'
import { isTauri } from '@/hooks/useTauri'
import { useBankNotifications } from '@/hooks/useBankNotifications'
import { hasNotificationAccess, openNotificationAccessSettings } from '@/lib/bankNotifications'
import { useBankSuggestions } from '@/store/bankSuggestions'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'

export function SettingsBankNotifications({ activeSheet, onOpen, onClose }: SheetProps) {
  const suggestions = useBankSuggestions()
  const { accounts, categories, currency, addTx } = useFinance()
  const lang = (useSettings(s => s.language) ?? 'es') as 'en' | 'es'
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

  const handleAdd = (item: typeof suggestions.items[number]) => {
    const categoryId = guessCategoryId(item.note, categories, item.type)
    addTx({
      type: item.type,
      amount: item.amount,
      date: item.date,
      note: item.note,
      accountId: accounts[0]?.id,
      categoryId,
    })
    suggestions.remove(item.id)
    toast(t('movementAdded'), { icon: 'check', type: 'ok' })
  }

  const handleDiscardAll = () => {
    suggestions.clear()
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
            value={suggestions.items.length ? t('capturedCount').replace('{count}', String(suggestions.items.length)) : undefined}
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
                {suggestions.items.map(item => (
                  <div key={item.id} className="mset-row">
                    <span className="mset-row-icon" style={{
                      background: item.type === 'income' ? '#35d0a222' : '#ff6b8a22',
                      color: item.type === 'income' ? '#35d0a2' : '#ff6b8a',
                    }}>
                      <Icon name={item.type === 'income' ? 'arrowDn' : 'arrowUp'} size={16} style={{ transform: item.type === 'income' ? 'rotate(180deg)' : 'none' }} />
                    </span>
                    <div className="mset-row-text">
                      <b>{item.note}</b>
                      <small>{new Date(item.date).toLocaleDateString(dateLocale(lang))} · {fmt(item.amount, currency)}</small>
                    </div>
                    <button className="mset-suggestion-add" onClick={() => handleAdd(item)} aria-label={t('addMovement')}>
                      <Icon name="plus" size={16} />
                    </button>
                    <button className="mset-suggestion-dismiss" onClick={() => suggestions.remove(item.id)} aria-label={t('dismiss')}>
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
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
    </>
  )
}
