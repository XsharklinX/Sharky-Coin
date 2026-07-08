import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { SettingsSheet, type Sheet } from './settings/shared'
import { SettingsAccount } from './settings/SettingsAccount'
import { SettingsAppearance } from './settings/SettingsAppearance'
import { SettingsCategories } from './settings/SettingsCategories'
import { SettingsData } from './settings/SettingsData'
import { SettingsSecurity } from './settings/SettingsSecurity'
import { SettingsBankNotifications } from './settings/SettingsBankNotifications'
import { SettingsLegal } from './settings/SettingsLegal'
import { SettingsSyncConflicts } from './settings/SettingsSyncConflicts'

export function MobileSettings({
  mkey,
  onClose,
  initialSheet,
}: {
  mkey: string
  onClose: () => void
  initialSheet?: Sheet | null
}) {
  const settings = useSettings()
  const { currency } = useFinance()
  const t = useT()
  const [activeSheet, setActiveSheet] = useState<Sheet | null>(null)
  const [nameInput, setNameInput] = useState(settings.displayName)

  useEffect(() => {
    if (initialSheet) setActiveSheet(initialSheet)
  }, [initialSheet])

  useMobileBackDismiss(true, onClose)
  useMobileBackDismiss(!!activeSheet, () => setActiveSheet(null))

  const open = (sheet: Sheet) => {
    setActiveSheet(sheet)
    if (sheet === 'name') setNameInput(settings.displayName)
  }
  const close = () => setActiveSheet(null)

  const saveName = () => {
    settings.setDisplayName(nameInput.trim())
    toast(t('nameSaved'), { icon: 'check', type: 'ok' })
    close()
  }

  const profileName = settings.displayName || t('myAccountLabel')
  const themeModeLabel = settings.theme === 'amoled'
    ? 'AMOLED'
    : settings.theme === 'dark'
      ? 'Dark'
      : settings.theme === 'light'
        ? 'Light'
        : 'Auto'
  const themeLabel = `${t('theme')} - ${themeModeLabel}`
  const languageLabel = settings.language === 'en' ? 'English' : 'Espanol'

  return (
    <div className="mobile-settings-screen" role="dialog" aria-modal="true">
      <header className="mset-header">
        <button className="mset-back" onClick={onClose}>
          <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
        </button>
        <strong>{t('settings')}</strong>
        <span />
      </header>

      <div className="mset-body">
        <button className="mset-summary" onClick={() => open('name')} aria-label={t('editNameLabel')}>
          <div className="mset-summary-avatar">{(settings.displayName || '$').slice(0, 1).toUpperCase()}</div>
          <div className="mset-summary-body">
            <strong>{profileName}</strong>
            <span>{t('settingsQuickDesc')}</span>
            <div className="mset-summary-pills">
              <span className="mset-summary-pill">{themeLabel}</span>
              <span className="mset-summary-pill">{`Moneda - ${currency}`}</span>
              <span className="mset-summary-pill">{languageLabel}</span>
            </div>
          </div>
          <Icon name="edit" size={15} className="mset-summary-edit" />
        </button>

        <SettingsAccount onOpen={open} />

        <SettingsAppearance activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsCategories activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsData mkey={mkey} activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsSecurity activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsBankNotifications activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsLegal activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsSyncConflicts activeSheet={activeSheet} onOpen={open} onClose={close} />
      </div>

      {activeSheet === 'name' && (
        <SettingsSheet title={t('name')} onClose={close}>
          <div className="mset-sheet-body">
            <input
              className="mset-text-input"
              type="text"
              value={nameInput}
              placeholder={t('egName')}
              autoCapitalize="words"
              enterKeyHint="done"
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            />
            <button className="mset-sheet-confirm" onClick={saveName}>{t('save')}</button>
          </div>
        </SettingsSheet>
      )}
    </div>
  )
}
