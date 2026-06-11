import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { createBackup, parseBackup } from '@/data/backup'
import { wipeCloudData } from '@/data/cloudSync'
import { getDataHealthStatus } from '@/data/dataHealth'
import { exportExcel, exportMonthlyPdf } from '@/data/professionalExport'
import { monthLabel } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useAuth } from '@/store/auth'
import { clearCloudWorkspaceCache } from '@/hooks/useCloudWorkspace'
import { openBackup, saveBackup } from '@/hooks/useTauri'
import { useStorageQuota } from '@/hooks/useStorageQuota'
import { useT } from '@/i18n'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'

export function SettingsData({ mkey, activeSheet, onOpen, onClose }: SheetProps & { mkey: string }) {
  const finance = useFinance()
  const auth    = useAuth()
  const t       = useT()
  const health  = getDataHealthStatus(finance, auth.user?.id)
  const storageQuota = useStorageQuota()

  const [exportingPdf,    setExportingPdf]    = useState(false)
  const [exportingExcel,  setExportingExcel]  = useState(false)
  const [pendingReset,    setPendingReset]    = useState(false)
  const [resetting,       setResetting]       = useState(false)

  // Limpiar reset cuando el sheet se cierra
  useEffect(() => { if (activeSheet !== 'reset') setPendingReset(false) }, [activeSheet])

  const exportBackup = async () => {
    const json = JSON.stringify(createBackup(finance), null, 2)
    try {
      await saveBackup(json)
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
          {storageQuota && (
            <div className="mset-storage-bar">
              <div className="mset-storage-bar-head">
                <span>{t('storageLabel')}</span>
                <span style={{ color: storageQuota.level === 'ok' ? 'var(--m-muted)' : storageQuota.level === 'warning' ? '#f59e0b' : '#ff6b8a' }}>
                  {storageQuota.usedMB} MB / {storageQuota.quotaMB} MB ({Math.round(storageQuota.pct * 100)}%)
                </span>
              </div>
              <div className="mset-storage-track">
                <div className="mset-storage-fill" style={{
                  width: `${Math.min(100, storageQuota.pct * 100)}%`,
                  background: storageQuota.level === 'ok' ? 'var(--m-primary)' : storageQuota.level === 'warning' ? '#f59e0b' : '#ff6b8a',
                }} />
              </div>
              {storageQuota.level !== 'ok' && (
                <p className="mset-warning" style={{ color: storageQuota.level === 'critical' ? '#ff6b8a' : '#f59e0b' }}>
                  <Icon name="alert" size={13} />
                  {storageQuota.level === 'critical'
                    ? t('storageCriticalWarning')
                    : t('storageWarning70')}
                </p>
              )}
            </div>
          )}
          {health.warnings.map(w => (
            <p className="mset-warning" key={w}><Icon name="alert" size={13} />{w}</p>
          ))}
        </div>
        <div className="mset-card">
          <SettingsRow icon="download" iconColor="#35d0a2" label={t('exportData')}
            onClick={() => onOpen('export')} />
          <SettingsRow icon="upload" iconColor="#5bc0ff" label={t('restoreBackup')}
            onClick={() => void importBackup()} />
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
