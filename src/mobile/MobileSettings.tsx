import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { SettingsRow, SettingsSheet, type Sheet } from './settings/shared'
import { SettingsAccount } from './settings/SettingsAccount'
import { SettingsAppearance } from './settings/SettingsAppearance'
import { SettingsCategories } from './settings/SettingsCategories'
import { SettingsData } from './settings/SettingsData'
import { SettingsSecurity } from './settings/SettingsSecurity'
import { SettingsBankNotifications } from './settings/SettingsBankNotifications'
import { SettingsLegal } from './settings/SettingsLegal'

export function MobileSettings({ mkey, onClose }: { mkey: string; onClose: () => void }) {
  const settings = useSettings()
  const t = useT()
  const [activeSheet, setActiveSheet] = useState<Sheet | null>(null)
  const [nameInput, setNameInput] = useState(settings.displayName)

  useMobileBackDismiss(true, onClose)
  useMobileBackDismiss(!!activeSheet, () => setActiveSheet(null))

  const open  = (sheet: Sheet) => { setActiveSheet(sheet); if (sheet === 'name') setNameInput(settings.displayName) }
  const close = () => setActiveSheet(null)

  const saveName = () => {
    settings.setDisplayName(nameInput.trim())
    toast('Nombre guardado', { icon: 'check', type: 'ok' })
    close()
  }

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
        <SettingsAccount />

        {/* ── Profile ── */}
        <div className="mset-section">
          <span className="mset-section-title">Perfil</span>
          <div className="mset-card">
            <SettingsRow icon="user" iconColor="#5bc0ff" label="Nombre"
              value={settings.displayName || 'Sin definir'}
              onClick={() => open('name')} />
          </div>
        </div>

        <SettingsAppearance activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsCategories activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsData mkey={mkey} activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsSecurity activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsBankNotifications activeSheet={activeSheet} onOpen={open} onClose={close} />
        <SettingsLegal activeSheet={activeSheet} onOpen={open} onClose={close} />
      </div>

      {/* ─── Sheets ─── */}

      {activeSheet === 'name' && (
        <SettingsSheet title="Nombre" onClose={close}>
          <div className="mset-sheet-body">
            <input
              className="mset-text-input" type="text"
              value={nameInput} placeholder="Ej. Juan Pérez"
              autoCapitalize="words" enterKeyHint="done"
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
