import { Icon } from '@/components/ui/Icon'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { isTauri } from '@/hooks/useTauri'
import { useT } from '@/i18n'

const isAndroidTauri = isTauri() && /android/i.test(navigator.userAgent)
import type { DensityName, OverdraftPolicy, ThemeName } from '@/types'
import { ACCENT_COLORS } from '@/constants'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'

function getAccents(t: ReturnType<typeof useT>) {
  return [
    { color: ACCENT_COLORS[0], label: t('accentYellow') },
    { color: ACCENT_COLORS[1], label: t('accentGreen')  },
    { color: ACCENT_COLORS[2], label: t('accentBlue')   },
    { color: ACCENT_COLORS[3], label: t('accentViolet') },
    { color: ACCENT_COLORS[4], label: t('accentPink')   },
    { color: ACCENT_COLORS[5], label: t('accentOrange') },
  ]
}

function getThemeLabels(t: ReturnType<typeof useT>): Record<ThemeName, string> {
  return { dark: t('themeDarkLabel'), light: t('themeLightLabel'), system: t('themeSystemLabel') }
}
function getDensityLabels(t: ReturnType<typeof useT>): Record<DensityName, string> {
  return { compact: t('densityCompact'), regular: t('densityRegular'), comfy: t('densityComfy') }
}
function getOverdraftLabels(t: ReturnType<typeof useT>): Record<OverdraftPolicy, string> {
  return { block: t('overdraftBlock'), warn: t('overdraftWarn'), allow: t('overdraftAllow') }
}

const themePreviewBg: Record<'dark' | 'light', string> = { dark: '#0a0e16', light: '#f4f7fb' }
const themePreviewFg: Record<'dark' | 'light', string> = { dark: '#e9eef7', light: '#172033' }

export function SettingsAppearance({ activeSheet, onOpen, onClose }: SheetProps) {
  const settings = useSettings()
  const finance  = useFinance()
  const resolvedTheme = useResolvedTheme()
  const t = useT()
  const ACCENTS = getAccents(t)
  const THEME_LABELS = getThemeLabels(t)
  const DENSITY_LABELS = getDensityLabels(t)
  const OVERDRAFT_LABELS = getOverdraftLabels(t)

  return (
    <>
      {/* ── Finanzas ── */}
      <div className="mset-section">
        <span className="mset-section-title">{t('financeSection')}</span>
        <div className="mset-card">
          <SettingsRow icon="dollar" iconColor="#35d0a2" label={t('currency')}
            value={finance.currency}
            onClick={() => onOpen('currency')} />
          <SettingsRow icon="alert" iconColor="#f59e0b" label={t('overdraft')}
            value={OVERDRAFT_LABELS[settings.overdraftPolicy]}
            onClick={() => onOpen('overdraft')} />
        </div>
      </div>

      {/* ── Apariencia ── */}
      <div className="mset-section">
        <span className="mset-section-title">{t('appearanceSection')}</span>
        <div className="mset-card">
          <SettingsRow icon="palette" iconColor="#a78bfa" label={t('theme')}
            value={THEME_LABELS[settings.theme]}
            onClick={() => onOpen('theme')} />
          <SettingsRow icon="sliders" iconColor="#ff6b8a" label={t('accentColor')}
            onClick={() => onOpen('accent')}
            right={
              <>
                <span className="mset-color-dot" style={{ background: settings.accent }} />
                <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: '#4a4a4a', flexShrink: 0 }} />
              </>
            }
          />
          <SettingsRow icon="grid" iconColor="#f59e0b" label={t('density')}
            value={DENSITY_LABELS[settings.density]}
            onClick={() => onOpen('density')} />
          <SettingsRow icon="map" iconColor="#64d2ff" label={t('language')}
            value={settings.language === 'en' ? 'English' : 'Español'}
            onClick={() => onOpen('language')} />
          <div className="mset-row">
            <span className="mset-row-icon" style={{ background: '#35d0a222', color: '#35d0a2' }}>
              <Icon name="bell" size={18} />
            </span>
            <div className="mset-row-text">
              <b>{t('interfaceSounds')}</b>
              <small>{t('interfaceSoundsDesc')}</small>
            </div>
            <label className="mset-toggle-wrap">
              <input type="checkbox" className="mset-toggle-input"
                checked={settings.soundsEnabled}
                onChange={e => settings.setSoundsEnabled(e.target.checked)} />
              <span className="mset-toggle" />
            </label>
          </div>
          {settings.soundsEnabled && (
            <div className="mset-row mset-row-volume">
              <span className="mset-row-icon" style={{ background: '#35d0a222', color: '#35d0a2' }}>
                <Icon name="sliders" size={18} />
              </span>
              <div className="mset-row-text">
                <b>{t('soundVolume')}</b>
                <input
                  className="mset-slider" type="range"
                  min={0} max={100} step={5}
                  value={Math.round(settings.soundVolume * 100)}
                  onChange={e => settings.setSoundVolume(Number(e.target.value) / 100)}
                  onInput={e => settings.setSoundVolume(Number((e.target as HTMLInputElement).value) / 100)}
                />
              </div>
              <span className="mset-value">{Math.round(settings.soundVolume * 100)}%</span>
            </div>
          )}
          <div className="mset-row">
            <span className="mset-row-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
              <Icon name="chart" size={18} />
            </span>
            <div className="mset-row-text">
              <b>{t('compactNumbers')}</b>
              <small>{t('compactNumbersDesc')}</small>
            </div>
            <label className="mset-toggle-wrap">
              <input type="checkbox" className="mset-toggle-input"
                checked={settings.compactNumbers}
                onChange={e => settings.setCompactNumbers(e.target.checked)} />
              <span className="mset-toggle" />
            </label>
          </div>
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
                <input type="checkbox" className="mset-toggle-input"
                  checked={settings.remindersEnabled}
                  onChange={e => settings.setRemindersEnabled(e.target.checked)} />
                <span className="mset-toggle" />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ── Sheets ── */}
      {activeSheet === 'theme' && (
        <SettingsSheet title={t('theme')} onClose={onClose}>
          <div className="mset-sheet-options">
            {(['dark', 'light', 'system'] as ThemeName[]).map(theme => {
              const previewKey = theme === 'system' ? resolvedTheme : theme
              return (
                <button key={theme} className={`mset-theme-opt${settings.theme === theme ? ' on' : ''}`}
                  onClick={() => { settings.setTheme(theme); onClose() }}>
                  <span className="mset-theme-preview" style={{ background: themePreviewBg[previewKey], color: themePreviewFg[previewKey] }}>
                    <span />
                  </span>
                  <strong>{THEME_LABELS[theme]}</strong>
                  {settings.theme === theme && <Icon name="check" size={14} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 'auto' }} />}
                </button>
              )
            })}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'accent' && (
        <SettingsSheet title={t('accentColor')} onClose={onClose}>
          <div className="mset-sheet-body">
            <div className="mset-accent-grid">
              {ACCENTS.map(({ color, label }) => (
                <button key={color} className={`mset-accent-opt${settings.accent === color ? ' on' : ''}`}
                  onClick={() => { settings.setAccent(color); onClose() }}>
                  <span style={{ background: color }} />
                  <small>{label}</small>
                </button>
              ))}
            </div>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'density' && (
        <SettingsSheet title={t('density')} onClose={onClose}>
          <div className="mset-sheet-options">
            {(['compact', 'regular', 'comfy'] as DensityName[]).map(density => (
              <button key={density} className={`mset-option-row${settings.density === density ? ' on' : ''}`}
                onClick={() => { settings.setDensity(density); onClose() }}>
                <strong>{DENSITY_LABELS[density]}</strong>
                <small>{density === 'compact' ? t('densityCompactDesc') : density === 'comfy' ? t('densityComfyDesc') : t('densityRegularDesc')}</small>
                {settings.density === density && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'currency' && (
        <SettingsSheet title={t('currencySheetTitle')} onClose={onClose}>
          <div className="mset-sheet-options">
            {(['DOP','USD','EUR','MXN','GBP','COP','ARS','BRL','CAD'] as const).map(code => (
              <button key={code} className={`mset-option-row${finance.currency === code ? ' on' : ''}`}
                onClick={() => { finance.setCurrency(code); onClose() }}>
                <strong>{code}</strong>
                {finance.currency === code && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'overdraft' && (
        <SettingsSheet title={t('overdraftSheetTitle')} onClose={onClose}>
          <div className="mset-sheet-options">
            {(['block', 'warn', 'allow'] as OverdraftPolicy[]).map(policy => (
              <button key={policy} className={`mset-option-row${settings.overdraftPolicy === policy ? ' on' : ''}`}
                onClick={() => { settings.setOverdraftPolicy(policy); onClose() }}>
                <strong>{OVERDRAFT_LABELS[policy]}</strong>
                <small>{policy === 'block' ? t('overdraftBlockDesc') : policy === 'warn' ? t('overdraftWarnDesc') : t('overdraftAllowDesc')}</small>
                {settings.overdraftPolicy === policy && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'language' && (
        <SettingsSheet title={t('language')} onClose={onClose}>
          <div className="mset-sheet-options">
            {(['es', 'en'] as const).map(lang => (
              <button key={lang} className={`mset-option-row${settings.language === lang ? ' on' : ''}`}
                onClick={() => { settings.setLanguage(lang); onClose() }}>
                <strong>{lang === 'en' ? '🇺🇸 English' : '🇩🇴 Español'}</strong>
                <small>{lang === 'en' ? t('englishInterface') : t('spanishInterface')}</small>
                {settings.language === lang && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}
    </>
  )
}
