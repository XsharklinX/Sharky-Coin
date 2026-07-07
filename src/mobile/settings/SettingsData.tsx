import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { createBackup, parseBackup } from '@/data/backup'
import { wipeCloudData } from '@/data/cloudSync'
import { getDataHealthStatus } from '@/data/dataHealth'
import { exportExcel, exportMonthlyPdf } from '@/data/professionalExport'
import { dateLocale, monthLabel } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useAuth } from '@/store/auth'
import { clearCloudWorkspaceCache } from '@/hooks/useCloudWorkspace'
import { isTauri, openBackup, saveBackup } from '@/hooks/useTauri'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'

export function SettingsData({ mkey, activeSheet, onOpen, onClose }: SheetProps & { mkey: string }) {
  const finance = useFinance()
  const auth    = useAuth()
  const t       = useT()
  const health  = getDataHealthStatus(finance, auth.user?.id)
  const lang    = useSettings(s => s.language)
  const lastWeeklyBackupAt = useSettings(s => s.lastWeeklyBackupAt)
  const weeklyAutoBackupEnabled = useSettings(s => s.weeklyAutoBackupEnabled)
  const weeklyAutoBackupDay = useSettings(s => s.weeklyAutoBackupDay)
  const weeklyAutoBackupHour = useSettings(s => s.weeklyAutoBackupHour)
  const setWeeklyAutoBackupEnabled = useSettings(s => s.setWeeklyAutoBackupEnabled)
  const setWeeklyAutoBackupDay = useSettings(s => s.setWeeklyAutoBackupDay)
  const setWeeklyAutoBackupHour = useSettings(s => s.setWeeklyAutoBackupHour)

  const [exportingPdf,    setExportingPdf]    = useState(false)
  const [exportingExcel,  setExportingExcel]  = useState(false)
  const [pendingReset,    setPendingReset]    = useState(false)
  const [resetting,       setResetting]       = useState(false)

  const weekdayLabels = [
    t('daySunday'),
    t('dayMonday'),
    t('dayTuesday'),
    t('dayWednesday'),
    t('dayThursday'),
    t('dayFriday'),
    t('daySaturday'),
  ]

  const backupScheduleLabel = weeklyAutoBackupEnabled
    ? `${weekdayLabels[weeklyAutoBackupDay]} - ${String(weeklyAutoBackupHour).padStart(2, '0')}:00`
    : t('backupAutoDisabled')

  // Limpiar reset cuando el sheet se cierra
  useEffect(() => { if (activeSheet !== 'reset') setPendingReset(false) }, [activeSheet])

  const exportBackup = async () => {
    const json = JSON.stringify(createBackup(finance), null, 2)
    try {
      const saved = await saveBackup(json)
      if (saved && isTauri()) toast(t('backupSavedToFolder'), { icon: 'check', type: 'ok' })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      toast(error instanceof Error ? error.message : t('exportError'), { icon: 'alert' })
    }
  }

  const importBackup = async () => {
    try {
      const text = await openBackup()
      if (!text) return
      finance.restoreBackup(parseBackup(text))
      toast(t('backupRestored'), { icon: 'check', type: 'ok' })
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : t('invalidFile'), { icon: 'alert' })
    }
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await exportMonthlyPdf(finance, mkey, '')
      toast(t('pdfExportedFor').replace('{month}', monthLabel(mkey)), { icon: 'download', type: 'ok' })
    } catch {
      toast(t('pdfExportError'), { icon: 'alert' })
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      await exportExcel(finance)
      toast(t('excelExported'), { icon: 'download', type: 'ok' })
    } catch {
      toast(t('excelExportError'), { icon: 'alert' })
    } finally {
      setExportingExcel(false)
    }
  }

  const confirmReset = async () => {
    const user = auth.user
    if (user?.mode === 'cloud' && user.id) {
      setResetting(true)
      try {
        await wipeCloudData(user.id)
        clearCloudWorkspaceCache(user.id)
      } catch (error) {
        toast(error instanceof Error ? error.message : t('couldNotDeleteCloudData'), { icon: 'alert' })
        setResetting(false)
        return
      }
      setResetting(false)
    }
    finance.startEmpty()
    toast(t('allDataDeleted'), { icon: 'trash' })
    onClose()
  }

  return (
    <>
      {/* ── Sección Datos ── */}
      <div className="mset-section">
        <span className="mset-section-title">{t('dataSection')}</span>
        <div className="mset-card">
          <div className="mset-stats">
            <div><strong>{health.transactions}</strong><small>{t('transactionsLabel')}</small></div>
            <div><strong>{health.categories}</strong><small>{t('categoriesTitle')}</small></div>
            <div><strong>{health.goals}</strong><small>{t('goals')}</small></div>
          </div>
          {health.warnings.map(w => (
            <p className="mset-warning" key={w}><Icon name="alert" size={13} />{w}</p>
          ))}
        </div>
        <div className="mset-card">
          <SettingsRow icon="refresh" iconColor="#f59e0b" label={t('recalcBalancesLabel')}
            value={health.driftedAccounts > 0 ? String(health.driftedAccounts) : undefined}
            onClick={() => {
              const fixed = finance.recomputeBalances()
              toast(fixed > 0 ? t('balancesFixed').replace('{n}', String(fixed)) : t('balancesOk'),
                { icon: 'check', type: 'ok' })
            }} />
          <SettingsRow icon="download" iconColor="#35d0a2" label={t('exportData')}
            onClick={() => onOpen('export')} />
          <SettingsRow icon="upload" iconColor="#5bc0ff" label={t('restoreBackup')}
            onClick={() => void importBackup()} />
          {isTauri() && (
            <SettingsRow icon="fileJson" iconColor="#a78bfa" label={t('weeklyBackupLastLabel')}
              value={backupScheduleLabel}
              onClick={() => onOpen('backupSchedule')}
              right={(
                <span className="mset-value">
                  {lastWeeklyBackupAt
                    ? new Date(lastWeeklyBackupAt).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short', year: 'numeric' })
                    : t('weeklyBackupNever')}
                </span>
              )} />
          )}
        </div>
        <div className="mset-card">
          <SettingsRow icon="trash" iconColor="#ff6b8a" label={t('deleteAllData')}
            danger onClick={() => onOpen('reset')} />
        </div>
      </div>

      {/* ── Sheets ── */}
      {activeSheet === 'export' && (
        <SettingsSheet title={t('exportData')} onClose={onClose}>
          <div className="mset-sheet-body">
            <p className="mset-legal-intro">{t('exportDataIntro')}</p>
            <div className="mset-card" style={{ margin: 0 }}>
              <SettingsRow icon="fileJson" iconColor="#35d0a2" label={t('backupJson')}
                onClick={() => void exportBackup()} />
              <SettingsRow icon="download" iconColor="#5bc0ff"
                label={exportingExcel ? t('generatingExcel') : t('fullReportExcel')}
                onClick={() => { if (!exportingExcel) void handleExportExcel() }} />
              <SettingsRow icon="download" iconColor="#a78bfa"
                label={exportingPdf ? t('generatingPdf') : t('statementOfMonth').replace('{month}', monthLabel(mkey))}
                onClick={() => { if (!exportingPdf) void handleExportPdf() }} />
            </div>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'backupSchedule' && (
        <SettingsSheet title={t('weeklyBackupConfigTitle')} onClose={onClose}>
          <div className="mset-sheet-body">
            <div className="mset-card" style={{ margin: 0 }}>
              <div className="mset-row">
                <span className="mset-row-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
                  <Icon name="fileJson" size={18} />
                </span>
                <div className="mset-row-text">
                  <b>{t('weeklyBackupAutoLabel')}</b>
                  <small>{t('weeklyBackupAutoDesc')}</small>
                </div>
                <label className="mset-toggle-wrap">
                  <input
                    type="checkbox"
                    className="mset-toggle-input"
                    checked={weeklyAutoBackupEnabled}
                    onChange={event => setWeeklyAutoBackupEnabled(event.target.checked)}
                  />
                  <span className="mset-toggle" />
                </label>
              </div>
            </div>

            <div className="mset-card" style={{ margin: 0 }}>
              <div className="mset-field-stack">
                <span className="mset-field-label">{t('dayLabel')}</span>
                <div className="mset-chip-grid">
                  {weekdayLabels.map((label, index) => (
                    <button
                      key={label}
                      className={`mset-chip${weeklyAutoBackupDay === index ? ' on' : ''}`}
                      disabled={!weeklyAutoBackupEnabled}
                      onClick={() => setWeeklyAutoBackupDay(index)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mset-field-stack">
                <span className="mset-field-label">{t('timeLabel')}</span>
                <div className="mset-hour-grid">
                  {[0, 3, 6, 9, 12, 15, 18, 21].map(hour => (
                    <button
                      key={hour}
                      className={`mset-chip${weeklyAutoBackupHour === hour ? ' on' : ''}`}
                      disabled={!weeklyAutoBackupEnabled}
                      onClick={() => setWeeklyAutoBackupHour(hour)}
                    >
                      {String(hour).padStart(2, '0')}:00
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mset-card" style={{ margin: 0 }}>
              <div className="mset-note-block">
                <strong>{t('backupDestinationTitle')}</strong>
                <small>{t('backupDestinationAppFolder')}</small>
              </div>
            </div>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'reset' && (
        <SettingsSheet title={t('deleteDataTitle')} onClose={onClose}>
          <div className="mset-sheet-body">
            <p className="mset-reset-warning">
              {t('deleteDataWarningPrefix')}<strong>{t('deleteDataWarningBoldText')}</strong>
              {auth.user?.mode === 'cloud' ? <>{t('deleteDataWarningCloudSuffix')}<strong>{t('deleteDataWarningCloudBoldText')}</strong></> : null}
              {t('deleteDataWarningSuffix')}
            </p>
            {!pendingReset ? (
              <button className="mset-sheet-danger" onClick={() => setPendingReset(true)}>
                {t('continueBtn')}
              </button>
            ) : (
              <>
                <button className="mset-sheet-danger" disabled={resetting} onClick={() => void confirmReset()}>
                  <Icon name="trash" size={18} /> {resetting ? t('deletingEllipsis') : t('yesDeleteAll')}
                </button>
                <button className="mset-sheet-cancel" disabled={resetting} onClick={() => setPendingReset(false)}>
                  {t('cancel')}
                </button>
              </>
            )}
          </div>
        </SettingsSheet>
      )}
    </>
  )
}
