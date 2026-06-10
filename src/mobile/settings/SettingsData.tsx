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
      toast(error instanceof Error ? error.message : 'Error al exportar.', { icon: 'alert' })
    }
  }

  const importBackup = async () => {
    try {
      const text = await openBackup()
      if (!text) return
      finance.restoreBackup(parseBackup(text))
      toast('Backup restaurado', { icon: 'check', type: 'ok' })
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Archivo inválido.', { icon: 'alert' })
    }
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await exportMonthlyPdf(finance, mkey, '')
      toast(`Estado de ${monthLabel(mkey)} exportado en PDF`, { icon: 'download', type: 'ok' })
    } catch {
      toast('No se pudo generar el PDF.', { icon: 'alert' })
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      await exportExcel(finance)
      toast('Reporte completo exportado en Excel', { icon: 'download', type: 'ok' })
    } catch {
      toast('No se pudo generar el Excel.', { icon: 'alert' })
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
        toast(error instanceof Error ? error.message : 'No se pudieron borrar los datos en la nube.', { icon: 'alert' })
        setResetting(false)
        return
      }
      setResetting(false)
    }
    finance.startEmpty()
    toast('Todos los datos eliminados', { icon: 'trash' })
    onClose()
  }

  return (
    <>
      {/* ── Sección Datos ── */}
      <div className="mset-section">
        <span className="mset-section-title">Datos</span>
        <div className="mset-card">
          <div className="mset-stats">
            <div><strong>{health.transactions}</strong><small>Transacciones</small></div>
            <div><strong>{health.categories}</strong><small>Categorías</small></div>
            <div><strong>{health.goals}</strong><small>{t('goals')}</small></div>
          </div>
          {storageQuota && (
            <div className="mset-storage-bar">
              <div className="mset-storage-bar-head">
                <span>Almacenamiento</span>
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
                    ? 'Almacenamiento casi lleno — exporta un backup ahora para no perder datos.'
                    : 'Almacenamiento al 70% — considera exportar un backup.'}
                </p>
              )}
            </div>
          )}
          {health.warnings.map(w => (
            <p className="mset-warning" key={w}><Icon name="alert" size={13} />{w}</p>
          ))}
        </div>
        <div className="mset-card">
          <SettingsRow icon="download" iconColor="#35d0a2" label="Exportar Datos"
            onClick={() => onOpen('export')} />
          <SettingsRow icon="upload" iconColor="#5bc0ff" label="Restaurar backup"
            onClick={() => void importBackup()} />
        </div>
        <div className="mset-card">
          <SettingsRow icon="trash" iconColor="#ff6b8a" label="Eliminar todos los datos"
            danger onClick={() => onOpen('reset')} />
        </div>
      </div>

      {/* ── Sheets ── */}
      {activeSheet === 'export' && (
        <SettingsSheet title="Exportar Datos" onClose={onClose}>
          <div className="mset-sheet-body">
            <p className="mset-legal-intro">Elige el formato en el que quieres exportar tu información financiera.</p>
            <div className="mset-card" style={{ margin: 0 }}>
              <SettingsRow icon="fileJson" iconColor="#35d0a2" label="Backup (JSON)"
                onClick={() => void exportBackup()} />
              <SettingsRow icon="download" iconColor="#5bc0ff"
                label={exportingExcel ? 'Generando Excel…' : 'Reporte completo (Excel)'}
                onClick={() => { if (!exportingExcel) void handleExportExcel() }} />
              <SettingsRow icon="download" iconColor="#a78bfa"
                label={exportingPdf ? 'Generando PDF…' : `Estado de ${monthLabel(mkey)} (PDF)`}
                onClick={() => { if (!exportingPdf) void handleExportPdf() }} />
            </div>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'reset' && (
        <SettingsSheet title="Eliminar datos" onClose={onClose}>
          <div className="mset-sheet-body">
            <p className="mset-reset-warning">
              Esto eliminará permanentemente <strong>todas tus transacciones, cuentas, categorías y metas</strong>
              {auth.user?.mode === 'cloud' ? <>, incluyendo <strong>tu copia en la nube</strong></> : null}. Esta acción no se puede deshacer.
            </p>
            {!pendingReset ? (
              <button className="mset-sheet-danger" onClick={() => setPendingReset(true)}>
                Continuar
              </button>
            ) : (
              <>
                <button className="mset-sheet-danger" disabled={resetting} onClick={() => void confirmReset()}>
                  <Icon name="trash" size={18} /> {resetting ? 'Eliminando…' : 'Sí, eliminar todo'}
                </button>
                <button className="mset-sheet-cancel" disabled={resetting} onClick={() => setPendingReset(false)}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </SettingsSheet>
      )}
    </>
  )
}
