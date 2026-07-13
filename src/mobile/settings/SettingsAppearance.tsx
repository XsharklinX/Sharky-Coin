import { useMemo, useState } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { ACCENT_COLORS } from '@/constants'
import { CURRENCIES } from '@/data/currencies'
import { currentRate } from '@/data/fxAlerts'
import { byCategory, currentMonthKey, fmt, fmtCompact, totalBalanceInBase, txForMonth } from '@/data/helpers'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { isTauri } from '@/hooks/useTauri'
import { useT } from '@/i18n'
import { requestPinHomeWidget } from '@/lib/homeWidget'
import { playSoundPreview } from '@/lib/sound'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { CurrencyCode, DensityName, OverdraftPolicy, ThemeName } from '@/types'
import { MobileAmountSheet } from '../MobileAmountSheet'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'

const isAndroidTauri = isTauri() && /android/i.test(navigator.userAgent)

function getAccents(t: ReturnType<typeof useT>) {
  return [
    { color: ACCENT_COLORS[0], label: t('accentYellow') },
    { color: ACCENT_COLORS[1], label: t('accentGreen') },
    { color: ACCENT_COLORS[2], label: t('accentBlue') },
    { color: ACCENT_COLORS[3], label: t('accentViolet') },
    { color: ACCENT_COLORS[4], label: t('accentPink') },
    { color: ACCENT_COLORS[5], label: t('accentOrange') },
  ]
}

function getThemeLabels(t: ReturnType<typeof useT>): Record<ThemeName, string> {
  return {
    dark: t('themeDarkLabel'),
    light: t('themeLightLabel'),
    amoled: t('themeAmoledLabel'),
    system: t('themeSystemLabel'),
  }
}

function getDensityLabels(t: ReturnType<typeof useT>): Record<DensityName, string> {
  return {
    compact: t('densityCompact'),
    regular: t('densityRegular'),
    comfy: t('densityComfy'),
  }
}

function getOverdraftLabels(t: ReturnType<typeof useT>): Record<OverdraftPolicy, string> {
  return {
    block: t('overdraftBlock'),
    warn: t('overdraftWarn'),
    allow: t('overdraftAllow'),
  }
}

const themePreviewBg: Record<'dark' | 'light' | 'amoled', string> = {
  dark: '#0a0e16',
  light: '#f4f7fb',
  amoled: '#000000',
}

const themePreviewFg: Record<'dark' | 'light' | 'amoled', string> = {
  dark: '#e9eef7',
  light: '#172033',
  amoled: '#e9eef7',
}

export function SettingsAppearance({ activeSheet, onOpen, onClose }: SheetProps) {
  const settings = useSettings()
  const finance = useFinance()
  const resolvedTheme = useResolvedTheme()
  const t = useT()

  const accents = getAccents(t)
  const themeLabels = getThemeLabels(t)
  const densityLabels = getDensityLabels(t)
  const overdraftLabels = getOverdraftLabels(t)
  const languageValue = settings.language === 'en' ? 'English' : 'Español'

  const soundLabels = {
    silent: t('soundProfileSilent'),
    soft: t('soundProfileSoft'),
    full: t('soundProfileFull'),
  } as const

  const [fxThresholdSheet, setFxThresholdSheet] = useState(false)
  const fxWatchedCurrency = settings.fxAlertCurrency as CurrencyCode
  const fxAlertSummary = settings.fxAlertEnabled
    ? `${fxWatchedCurrency} ${settings.fxAlertDirection === 'above' ? '≥' : '≤'} ${fmt(settings.fxAlertThreshold, finance.currency)}`
    : t('fxAlertOffLabel')
  const fxCurrentRate = currentRate(fxWatchedCurrency, finance.currency)

  const sensitivityLabels: Record<'strict' | 'balanced' | 'relaxed', string> = {
    strict: t('anomalySensitivityStrict'),
    balanced: t('anomalySensitivityBalanced'),
    relaxed: t('anomalySensitivityRelaxed'),
  }
  const anomalyAlertSummary = settings.anomalyAlertsEnabled
    ? sensitivityLabels[settings.anomalySensitivity]
    : t('anomalyAlertOffLabel')

  // Datos reales para que las vistas previas de widgets se vean como el
  // widget final en lugar de texto instructivo (bug visual anterior).
  const widgetPreviewBalance = useMemo(
    () => totalBalanceInBase(finance.accounts, finance.currency),
    [finance.accounts, finance.currency],
  )
  const widgetPreviewBudget = useMemo(() => {
    const mkey = currentMonthKey()
    const monthTx = txForMonth(finance.transactions, mkey)
    const rows = byCategory(monthTx, 'expense', finance.categories)
      .map(row => {
        const category = finance.categories.find(c => c.id === row.category.id)
        return category && category.budget > 0
          ? { name: category.name, pct: Math.min(100, Math.round((row.amount / category.budget) * 100)) }
          : null
      })
      .filter((row): row is { name: string; pct: number } => !!row)
      .sort((a, b) => b.pct - a.pct)
    return rows[0] ?? null
  }, [finance.transactions, finance.categories])

  return (
    <>
      <div className="mset-section">
        <span className="mset-section-title">{t('financeSection')}</span>
        <div className="mset-card">
          <SettingsRow
            icon="dollar"
            iconColor="#35d0a2"
            label={t('currency')}
            value={finance.currency}
            onClick={() => onOpen('currency')}
          />
          <SettingsRow
            icon="alert"
            iconColor="#f59e0b"
            label={t('overdraft')}
            value={overdraftLabels[settings.overdraftPolicy]}
            onClick={() => onOpen('overdraft')}
          />
          <SettingsRow
            icon="trend"
            iconColor="#5b9bff"
            label={t('fxAlertLabel')}
            value={fxAlertSummary}
            onClick={() => onOpen('fxAlert')}
          />
          <SettingsRow
            icon="alert"
            iconColor="#ff6b8a"
            label={t('anomalyAlertLabel')}
            value={anomalyAlertSummary}
            onClick={() => onOpen('anomalyAlert')}
          />
        </div>
      </div>

      <div className="mset-section">
        <span className="mset-section-title">{t('appearanceSection')}</span>
        <div className="mset-card">
          <SettingsRow
            icon="palette"
            iconColor="#a78bfa"
            label={t('theme')}
            value={themeLabels[settings.theme]}
            onClick={() => onOpen('theme')}
          />
          <SettingsRow
            icon="sliders"
            iconColor="#ff6b8a"
            label={t('accentColor')}
            onClick={() => onOpen('accent')}
            right={
              <>
                <span className="mset-color-dot" style={{ background: settings.accent }} />
                <Icon name="arrowUp" size={13} className="mset-chevron" />
              </>
            }
          />
          <SettingsRow
            icon="grid"
            iconColor="#f59e0b"
            label={t('density')}
            value={densityLabels[settings.density]}
            onClick={() => onOpen('density')}
          />
          <SettingsRow
            icon="map"
            iconColor="#64d2ff"
            label={t('language')}
            value={languageValue}
            onClick={() => onOpen('language')}
          />

          <div className="mset-row">
            <span className="mset-row-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
              <Icon name="chart" size={18} />
            </span>
            <div className="mset-row-text">
              <b>{t('compactNumbers')}</b>
              <small>{t('compactNumbersDesc')}</small>
            </div>
            <label className="mset-toggle-wrap">
              <input
                type="checkbox"
                className="mset-toggle-input"
                checked={settings.compactNumbers}
                onChange={e => settings.setCompactNumbers(e.target.checked)}
              />
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

        </div>
      </div>

      <div className="mset-section">
        <span className="mset-section-title">{t('soundHapticsSection')}</span>
        <div className="mset-card">
          <SettingsRow
            icon="bell"
            iconColor="#35d0a2"
            label={t('soundProfile')}
            value={soundLabels[settings.soundProfile]}
            onClick={() => onOpen('soundProfile')}
          />
          {settings.soundProfile !== 'silent' && (
            <div className="mset-row mset-row-volume">
              <span className="mset-row-icon" style={{ background: '#35d0a222', color: '#35d0a2' }}>
                <Icon name="sliders" size={18} />
              </span>
              <div className="mset-row-text">
                <b>{t('soundVolume')}</b>
                <input
                  className="mset-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(settings.soundVolume * 100)}
                  onChange={e => settings.setSoundVolume(Number(e.target.value) / 100)}
                  onInput={e => settings.setSoundVolume(Number((e.target as HTMLInputElement).value) / 100)}
                />
              </div>
              <button className="mset-sound-test" type="button" onClick={playSoundPreview}>
                {t('testSound')}
              </button>
            </div>
          )}
        </div>
      </div>

      {isAndroidTauri && (
        <div className="mset-section">
          <span className="mset-section-title">{t('widgetsSection')}</span>
          <div className="mset-card">
            <div className="mset-widget-panel">
              <div className="mset-widget-panel-head">
                <span>{t('widgetsPreviewTitle')}</span>
                <small>2x2 / 4x2 / 4x3</small>
              </div>
              <div className="mset-widget-preview-row">
                <div className="mset-widget-preview size-2x2">
                  <div className="mset-widget-preview-head">
                    <BrandMark size={15} />
                    <span>$harky</span>
                  </div>
                  <div>
                    <strong>{fmtCompact(widgetPreviewBalance, finance.currency)}</strong>
                    <span>{t('totalBalance')}</span>
                  </div>
                </div>
                <div className="mset-widget-preview size-4x2">
                  <div className="mset-widget-preview-head">
                    <BrandMark size={15} />
                    <span>{t('budgetStatus')}</span>
                  </div>
                  {widgetPreviewBudget ? (
                    <div className="mset-widget-preview-budget">
                      <div className="mset-widget-preview-budget-row">
                        <b>{widgetPreviewBudget.name}</b>
                        <strong>{widgetPreviewBudget.pct}%</strong>
                      </div>
                      <div className="mset-widget-preview-track">
                        <div style={{ width: `${widgetPreviewBudget.pct}%` }} />
                      </div>
                    </div>
                  ) : (
                    <span>{t('addBudgetsHomeWidget')}</span>
                  )}
                </div>
              </div>
              <div className="mset-widget-grid">
                <button
                  className="mset-widget-card balance"
                  onClick={async () => {
                    const result = await requestPinHomeWidget('balance')
                    if (result === 'requested') toast(t('homeWidgetRequested'), { icon: 'grid', type: 'ok' })
                    else if (result === 'unsupported') toast(t('homeWidgetUnsupported'), { icon: 'alert', type: 'warn' })
                  }}
                >
                  <span><Icon name="wallet" size={22} /></span>
                  <b>{t('widgetBalanceTitle')}</b>
                  <small>{t('widgetBalanceSizes')}</small>
                </button>
                <button
                  className="mset-widget-card budgets"
                  onClick={async () => {
                    const result = await requestPinHomeWidget('budgets')
                    if (result === 'requested') toast(t('homeWidgetRequested'), { icon: 'grid', type: 'ok' })
                    else if (result === 'unsupported') toast(t('homeWidgetUnsupported'), { icon: 'alert', type: 'warn' })
                  }}
                >
                  <span><Icon name="chart" size={22} /></span>
                  <b>{t('widgetBudgetsTitle')}</b>
                  <small>{t('widgetBudgetsSizes')}</small>
                </button>
                <button
                  className="mset-widget-card converter"
                  onClick={async () => {
                    const result = await requestPinHomeWidget('converter')
                    if (result === 'requested') toast(t('homeWidgetRequested'), { icon: 'grid', type: 'ok' })
                    else if (result === 'unsupported') toast(t('homeWidgetUnsupported'), { icon: 'alert', type: 'warn' })
                  }}
                >
                  <span><Icon name="refresh" size={22} /></span>
                  <b>{t('widgetConverterTitle')}</b>
                  <small>{t('widgetConverterSizes')}</small>
                </button>
                <button
                  className="mset-widget-card quickadd"
                  onClick={async () => {
                    const result = await requestPinHomeWidget('quickadd')
                    if (result === 'requested') toast(t('homeWidgetRequested'), { icon: 'grid', type: 'ok' })
                    else if (result === 'unsupported') toast(t('homeWidgetUnsupported'), { icon: 'alert', type: 'warn' })
                  }}
                >
                  <span><Icon name="plus" size={22} /></span>
                  <b>{t('widgetQuickAddTitle')}</b>
                  <small>{t('widgetQuickAddSizes')}</small>
                </button>
              </div>
              <button className="mset-widget-accounts" onClick={() => onOpen('widgetAccounts')}>
                <span><Icon name="cards" size={18} /></span>
                <div>
                  <b>{t('widgetAccountsLabel')}</b>
                  <small>{t('widgetAccountsDesc')}</small>
                </div>
                <Icon name="arrowUp" size={13} className="mset-chevron" />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSheet === 'theme' && (
        <SettingsSheet title={t('theme')} onClose={onClose}>
          <div className="mset-sheet-options">
            {(['dark', 'light', 'amoled', 'system'] as ThemeName[]).map(theme => {
              const previewKey = theme === 'system' ? resolvedTheme : theme
              return (
                <button
                  key={theme}
                  className={`mset-theme-opt${settings.theme === theme ? ' on' : ''}`}
                  onClick={() => {
                    settings.setTheme(theme)
                    onClose()
                  }}
                >
                  <span className="mset-theme-preview" style={{ background: themePreviewBg[previewKey], color: themePreviewFg[previewKey] }}>
                    <span />
                  </span>
                  <strong>{themeLabels[theme]}</strong>
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
              {accents.map(({ color, label }) => (
                <button
                  key={color}
                  className={`mset-accent-opt${settings.accent === color ? ' on' : ''}`}
                  onClick={() => {
                    settings.setAccent(color)
                    onClose()
                  }}
                >
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
              <button
                key={density}
                className={`mset-option-row${settings.density === density ? ' on' : ''}`}
                onClick={() => {
                  settings.setDensity(density)
                  onClose()
                }}
              >
                <strong>{densityLabels[density]}</strong>
                <small>{density === 'compact' ? t('densityCompactDesc') : density === 'comfy' ? t('densityComfyDesc') : t('densityRegularDesc')}</small>
                {settings.density === density && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'soundProfile' && (
        <SettingsSheet title={t('soundProfile')} onClose={onClose}>
          <div className="mset-sheet-options">
            {(['silent', 'soft', 'full'] as const).map(profile => (
              <button
                key={profile}
                className={`mset-option-row${settings.soundProfile === profile ? ' on' : ''}`}
                onClick={() => {
                  settings.setSoundProfile(profile)
                  if (profile !== 'silent') setTimeout(playSoundPreview, 40)
                  onClose()
                }}
              >
                <strong>{soundLabels[profile]}</strong>
                <small>
                  {profile === 'silent'
                    ? t('soundProfileSilentDesc')
                    : profile === 'soft'
                      ? t('soundProfileSoftDesc')
                      : t('soundProfileFullDesc')}
                </small>
                {settings.soundProfile === profile && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'currency' && (
        <SettingsSheet title={t('currencySheetTitle')} onClose={onClose}>
          <div className="mset-sheet-options">
            {(['DOP', 'USD', 'EUR', 'MXN', 'GBP', 'COP', 'ARS', 'BRL', 'CAD'] as const).map(code => (
              <button
                key={code}
                className={`mset-option-row${finance.currency === code ? ' on' : ''}`}
                onClick={() => {
                  finance.setCurrency(code)
                  onClose()
                }}
              >
                <strong>{code}</strong>
                {finance.currency === code && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'fxAlert' && (
        <SettingsSheet title={t('fxAlertLabel')} onClose={onClose}>
          <div className="mset-field-stack">
            <span className="mset-field-label">{t('fxAlertCurrentRateLabel')}</span>
            <p className="mset-note-block">
              {t('fxAlertCurrentRateText')
                .replace('{currency}', fxWatchedCurrency)
                .replace('{rate}', fmt(fxCurrentRate, finance.currency))}
            </p>
          </div>
          <div className="mpr-form-section mpr-toggle-row" style={{ padding: '14px 16px' }}>
            <div className="mpr-toggle-row-text">
              <span className="mpr-toggle-row-label">{t('fxAlertEnableLabel')}</span>
              <small className="mpr-toggle-row-desc">{t('fxAlertEnableDesc')}</small>
            </div>
            <label className="mset-toggle-wrap">
              <input
                type="checkbox"
                className="mset-toggle-input"
                checked={settings.fxAlertEnabled}
                onChange={e => settings.setFxAlertEnabled(e.target.checked)}
              />
              <span className="mset-toggle" />
            </label>
          </div>
          <div className="mset-field-stack">
            <span className="mset-field-label">{t('fxAlertWatchLabel')}</span>
            <div className="mset-chip-grid">
              {(['USD', 'EUR', 'MXN', 'GBP', 'COP', 'ARS', 'BRL', 'CAD'] as const).map(code => (
                <button
                  key={code}
                  className={`mset-chip${settings.fxAlertCurrency === code ? ' on' : ''}`}
                  disabled={!settings.fxAlertEnabled}
                  onClick={() => settings.setFxAlertCurrency(code)}
                >
                  {CURRENCIES.find(c => c.code === code)?.flag} {code}
                </button>
              ))}
            </div>
          </div>
          <div className="mset-field-stack">
            <span className="mset-field-label">{t('fxAlertDirectionLabel')}</span>
            <div className="mset-chip-grid">
              <button
                className={`mset-chip${settings.fxAlertDirection === 'above' ? ' on' : ''}`}
                disabled={!settings.fxAlertEnabled}
                onClick={() => settings.setFxAlertDirection('above')}
              >
                {t('fxAlertAboveLabel')}
              </button>
              <button
                className={`mset-chip${settings.fxAlertDirection === 'below' ? ' on' : ''}`}
                disabled={!settings.fxAlertEnabled}
                onClick={() => settings.setFxAlertDirection('below')}
              >
                {t('fxAlertBelowLabel')}
              </button>
            </div>
          </div>
          <div className="mset-field-stack">
            <span className="mset-field-label">{t('fxAlertThresholdLabel')}</span>
            <button
              className="mset-row"
              disabled={!settings.fxAlertEnabled}
              onClick={() => setFxThresholdSheet(true)}
            >
              <span className="mset-label">{fmt(settings.fxAlertThreshold, finance.currency)}</span>
              <Icon name="edit" size={16} style={{ opacity: .5 }} />
            </button>
            <p className="mset-note-block">
              {t('fxAlertHint')
                .replace('{currency}', fxWatchedCurrency)
                .replace('{direction}', settings.fxAlertDirection === 'above' ? t('fxAlertAboveLabel').toLowerCase() : t('fxAlertBelowLabel').toLowerCase())}
            </p>
          </div>
        </SettingsSheet>
      )}

      {fxThresholdSheet && (
        <MobileAmountSheet
          title={t('fxAlertThresholdLabel')}
          value={settings.fxAlertThreshold}
          currency={finance.currency}
          onDone={v => { settings.setFxAlertThreshold(v); setFxThresholdSheet(false) }}
          onClose={() => setFxThresholdSheet(false)}
        />
      )}

      {activeSheet === 'anomalyAlert' && (
        <SettingsSheet title={t('anomalyAlertLabel')} onClose={onClose}>
          <div className="mpr-form-section mpr-toggle-row" style={{ padding: '14px 16px' }}>
            <div className="mpr-toggle-row-text">
              <span className="mpr-toggle-row-label">{t('anomalyAlertEnableLabel')}</span>
              <small className="mpr-toggle-row-desc">{t('anomalyAlertEnableDesc')}</small>
            </div>
            <label className="mset-toggle-wrap">
              <input
                type="checkbox"
                className="mset-toggle-input"
                checked={settings.anomalyAlertsEnabled}
                onChange={e => settings.setAnomalyAlertsEnabled(e.target.checked)}
              />
              <span className="mset-toggle" />
            </label>
          </div>
          <div className="mset-field-stack">
            <span className="mset-field-label">{t('anomalySensitivityLabel')}</span>
            <div className="mset-chip-grid">
              {(['relaxed', 'balanced', 'strict'] as const).map(level => (
                <button
                  key={level}
                  className={`mset-chip${settings.anomalySensitivity === level ? ' on' : ''}`}
                  disabled={!settings.anomalyAlertsEnabled}
                  onClick={() => settings.setAnomalySensitivity(level)}
                >
                  {sensitivityLabels[level]}
                </button>
              ))}
            </div>
            <p className="mset-note-block">{t('anomalySensitivityHint')}</p>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'overdraft' && (
        <SettingsSheet title={t('overdraftSheetTitle')} onClose={onClose}>
          <div className="mset-sheet-options">
            {(['block', 'warn', 'allow'] as OverdraftPolicy[]).map(policy => (
              <button
                key={policy}
                className={`mset-option-row${settings.overdraftPolicy === policy ? ' on' : ''}`}
                onClick={() => {
                  settings.setOverdraftPolicy(policy)
                  onClose()
                }}
              >
                <strong>{overdraftLabels[policy]}</strong>
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
              <button
                key={lang}
                className={`mset-option-row${settings.language === lang ? ' on' : ''}`}
                onClick={() => {
                  settings.setLanguage(lang)
                  onClose()
                }}
              >
                <strong>{lang === 'en' ? 'English' : 'Español'}</strong>
                <small>{lang === 'en' ? t('englishInterface') : t('spanishInterface')}</small>
                {settings.language === lang && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'widgetAccounts' && (
        <SettingsSheet title={t('widgetAccountsSheetTitle')} onClose={onClose}>
          <div className="mset-sheet-options">
            {finance.accounts.map(account => {
              const selected = settings.widgetAccountIds.includes(account.id)
              const atCap = settings.widgetAccountIds.length >= 3
              return (
                <button
                  key={account.id}
                  className={`mset-option-row${selected ? ' on' : ''}`}
                  disabled={!selected && atCap}
                  onClick={() => settings.setWidgetAccountIds(
                    selected
                      ? settings.widgetAccountIds.filter(id => id !== account.id)
                      : [...settings.widgetAccountIds, account.id],
                  )}
                >
                  <strong>{account.short || account.name}</strong>
                  {selected && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 'auto', flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
        </SettingsSheet>
      )}
    </>
  )
}
