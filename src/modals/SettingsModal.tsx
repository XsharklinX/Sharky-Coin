import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { BrandMark } from '@/components/ui/BrandMark'
import { toast } from '@/components/ui/Toast'
import { useSettings } from '@/store/settings'
import { useFinance } from '@/store/finance'
import { useAuth } from '@/store/auth'
import { createBackup, parseBackup } from '@/data/backup'
import { listAuditEvents, recordAuditEvent } from '@/data/audit'
import { createRecoverySnapshot, listRecoverySnapshots, readRecoverySnapshot } from '@/data/recovery'
import { useCloudSync } from '@/data/cloudSync'
import { useCloudBackup } from '@/data/cloudBackup'
import { usesNativeCredentialStorage } from '@/lib/secureAuthStorage'
import { deleteCategoryRule, listCategoryRules, saveCategoryRule } from '@/data/bankCsv'
import { saveBackup, openBackup, isTauri } from '@/hooks/useTauri'
import type { ThemeName, DensityName, CurrencyCode, OverdraftPolicy } from '@/types'

const ACCENTS = [
  { color: '#3b82f6', label: 'Azul' },
  { color: '#6366f1', label: 'Índigo' },
  { color: '#8b5cf6', label: 'Violeta' },
  { color: '#06b6d4', label: 'Cyan' },
  { color: '#10b981', label: 'Verde' },
  { color: '#f59e0b', label: 'Ámbar' },
]

const FONTS = ['Plus Jakarta Sans', 'Manrope', 'Space Grotesk', 'Inter']

interface Props { onClose: () => void }

export function SettingsModal({ onClose }: Props) {
  const s        = useSettings()
  const finance  = useFinance()
  const { user, logout } = useAuth()
  const cloudSync = useCloudSync()
  const cloudBackup = useCloudBackup()
  const [backupPassphrase, setBackupPassphrase] = useState('')
  const [tab, setTab] = useState<'appearance' | 'data' | 'account' | 'about'>('appearance')
  const [confirmReset, setConfirmReset] = useState<'demo' | 'empty' | null>(null)
  const [busyData, setBusyData] = useState<'export' | 'import' | null>(null)
  const [snapshots, setSnapshots] = useState(listRecoverySnapshots)
  const [auditEvents, setAuditEvents] = useState(listAuditEvents)
  const [categoryRules, setCategoryRules] = useState(listCategoryRules)
  const [rulePattern, setRulePattern] = useState('')
  const [ruleCategoryId, setRuleCategoryId] = useState('')

  const refreshRecovery = () => setSnapshots(listRecoverySnapshots())
  const refreshAudit = () => setAuditEvents(listAuditEvents())

  const exportBackup = async () => {
    setBusyData('export')
    try {
      const json = JSON.stringify(createBackup(finance), null, 2)
      await saveBackup(json)
      recordAuditEvent('backup', 'Backup JSON exportado')
      refreshAudit()
      toast('Backup exportado', { icon: 'download', type: 'ok' })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo exportar el backup.', { icon: 'alert' })
    } finally {
      setBusyData(null)
    }
  }

  const importBackup = async () => {
    setBusyData('import')
    try {
      const text = await openBackup()
      if (!text) return
      const data = parseBackup(text)
      finance.restoreBackup(data)
      recordAuditEvent('backup', 'Backup JSON restaurado')
      refreshAudit()
      toast('Backup restaurado correctamente', { icon: 'check', type: 'ok' })
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Archivo inválido', { icon: 'alert' })
    } finally {
      setBusyData(null)
    }
  }

  const saveRecoveryPoint = () => {
    createRecoverySnapshot(useFinance.getState(), 'manual')
    recordAuditEvent('recovery', 'Punto de recuperación creado')
    refreshRecovery()
    refreshAudit()
    toast('Punto de recuperación creado', { icon: 'check', type: 'ok' })
  }

  const restoreRecoveryPoint = (id: string) => {
    if (!window.confirm('Este punto de recuperación reemplazará los datos actuales. ¿Deseas continuar?')) return
    try {
      finance.restoreBackup(readRecoverySnapshot(id))
      recordAuditEvent('recovery', 'Punto de recuperación restaurado')
      refreshAudit()
      toast('Datos recuperados correctamente', { icon: 'refresh', type: 'ok' })
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo restaurar el punto de recuperación.', { icon: 'alert' })
    }
  }

  const doReset = (mode: 'demo' | 'empty') => {
    if (mode === 'demo') finance.startDemo()
    else                 finance.startEmpty()
    toast(mode === 'demo' ? 'Datos demo cargados' : 'Datos limpiados', { icon: 'refresh' })
    setConfirmReset(null)
    onClose()
  }

  const syncNow = async () => {
    try {
      await cloudSync.syncNow()
      refreshAudit()
      const conflictCount = useCloudSync.getState().conflicts.length
      toast(conflictCount ? 'Sincronización completada con conflictos pendientes' : 'Datos sincronizados', {
        icon: conflictCount ? 'alert' : 'check',
        type: conflictCount ? undefined : 'ok',
      })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo sincronizar.', { icon: 'alert' })
    }
  }

  const unlockCloudBackups = () => {
    try {
      cloudBackup.unlock(backupPassphrase)
      setBackupPassphrase('')
      void cloudBackup.refresh()
      toast('Backups cloud desbloqueados durante esta sesión', { icon: 'check', type: 'ok' })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo desbloquear.', { icon: 'alert' })
    }
  }

  const createCloudBackup = async () => {
    try {
      await cloudBackup.createNow()
      refreshAudit()
      toast('Backup cloud cifrado creado', { icon: 'check', type: 'ok' })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo crear el backup cloud.', { icon: 'alert' })
    }
  }

  const restoreCloudBackup = async (path: string) => {
    if (!window.confirm('Este backup cloud reemplazará los datos actuales. ¿Deseas continuar?')) return
    try {
      await cloudBackup.restore(path)
      refreshAudit()
      toast('Backup cloud restaurado', { icon: 'refresh', type: 'ok' })
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo restaurar el backup cloud.', { icon: 'alert' })
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="modal settings-modal" role="dialog" aria-modal="true"
        aria-labelledby="settings-title" onMouseDown={e => e.stopPropagation()}>

        <header className="modal-head">
          <h2 id="settings-title">Configuración</h2>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>

        {/* tabs */}
        <div className="settings-tabs">
          {([
            ['appearance', 'sliders',  'Apariencia'],
            ['data',       'fileJson', 'Datos'],
            ['account',    'wallet',   'Cuenta'],
            ['about',      'info',     'Acerca de'],
          ] as const).map(([id, icon, label]) => (
            <button key={id} className={`settings-tab${tab === id ? ' on' : ''}`}
              onClick={() => setTab(id)}>
              <Icon name={icon} size={15} />{label}
            </button>
          ))}
        </div>

        <div className="settings-body">

          {/* ── Apariencia ─────────────────────────── */}
          {tab === 'appearance' && (
            <>
              <SettingGroup label="Tema">
                <div className="theme-grid">
                  {(['midnight', 'slate', 'carbon', 'light'] as ThemeName[]).map(t => (
                    <button key={t} className={`theme-chip${s.theme === t ? ' on' : ''}`}
                      onClick={() => s.setTheme(t)} data-theme={t}>
                      <span className="theme-preview" />
                      <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                    </button>
                  ))}
                </div>
              </SettingGroup>

              <SettingGroup label="Color de acento">
                <div className="accent-row">
                  {ACCENTS.map(a => (
                    <button key={a.color} className={`accent-swatch${s.accent === a.color ? ' on' : ''}`}
                      style={{ background: a.color }} aria-label={a.label}
                      onClick={() => s.setAccent(a.color)} />
                  ))}
                </div>
              </SettingGroup>

              <SettingGroup label="Densidad">
                <div className="seg">
                  {(['compact', 'regular', 'comfy'] as DensityName[]).map(d => (
                    <button key={d} className={s.density === d ? 'on' : ''}
                      onClick={() => s.setDensity(d)}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </SettingGroup>

              <SettingGroup label="Tipografía">
                <select className="select" value={s.font} onChange={e => s.setFont(e.target.value)}
                  style={{ fontFamily: s.font }}>
                  {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </SettingGroup>

              <SettingRow label="Etiquetas en el menú lateral"
                sub="Muestra el texto junto a los íconos">
                <Toggle value={s.showSidebarLabels} onChange={s.setShowSidebarLabels} />
              </SettingRow>
            </>
          )}

          {/* ── Datos ──────────────────────────────── */}
          {tab === 'data' && (
            <>
              <SettingGroup label="Moneda predeterminada">
                <select className="select" value={finance.currency}
                  onChange={e => finance.setCurrency(e.target.value as CurrencyCode)}>
                  <option value="DOP">RD$ — Peso dominicano</option>
                  <option value="USD">US$ — Dólar estadounidense</option>
                  <option value="EUR">€ — Euro</option>
                </select>
              </SettingGroup>

              <SettingGroup label="Política de sobregiro">
                <select className="select" value={s.overdraftPolicy}
                  onChange={e => s.setOverdraftPolicy(e.target.value as OverdraftPolicy)}>
                  <option value="block">Bloquear gastos sin saldo</option>
                  <option value="warn">Permitir con advertencia</option>
                  <option value="allow">Permitir sin advertencia</option>
                </select>
                <p className="setting-hint">
                  Aplica a gastos manuales en cuentas de débito, ahorro y efectivo. Las tarjetas de crédito usan su límite.
                </p>
              </SettingGroup>

              <SettingGroup label="Alertas de presupuesto">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[50, 80, 100].map(threshold => (
                    <label className="recurring-toggle" key={threshold}>
                      <input type="checkbox" checked={s.budgetAlertThresholds.includes(threshold)}
                        onChange={event => s.setBudgetAlertThresholds(event.target.checked
                          ? [...s.budgetAlertThresholds, threshold].sort((a, b) => a - b)
                          : s.budgetAlertThresholds.filter(value => value !== threshold))} />
                      <span>{threshold}%</span>
                    </label>
                  ))}
                </div>
                <p className="setting-hint">Elige cuándo recibir avisos antes de exceder el límite mensual.</p>
              </SettingGroup>

              <SettingGroup label="Reglas de categorización bancaria">
                <div className="field-row">
                  <input className="select" value={rulePattern} onChange={event => setRulePattern(event.target.value)}
                    placeholder="Descripción del banco" />
                  <select className="select" value={ruleCategoryId} onChange={event => setRuleCategoryId(event.target.value)}>
                    <option value="">Categoría...</option>
                    {finance.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <button className="btn-primary" onClick={() => {
                    saveCategoryRule(rulePattern, ruleCategoryId)
                    setCategoryRules(listCategoryRules()); setRulePattern(''); setRuleCategoryId('')
                  }}>Agregar</button>
                </div>
                {categoryRules.length > 0 && <div className="recovery-list">
                  {categoryRules.map(rule => <div className="recovery-item" key={rule.pattern}>
                    <div><b>{rule.pattern}</b><span>{finance.categories.find(category => category.id === rule.categoryId)?.name ?? 'Categoría eliminada'}</span></div>
                    <button className="btn-ghost" onClick={() => { deleteCategoryRule(rule.pattern); setCategoryRules(listCategoryRules()) }}>Eliminar</button>
                  </div>)}
                </div>}
                <p className="setting-hint">Las reglas aprendidas se aplican automáticamente durante la vista previa CSV.</p>
              </SettingGroup>

              <SettingGroup label="Backup">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn-ghost" disabled={busyData !== null} aria-busy={busyData === 'export'} onClick={exportBackup}>
                    {busyData === 'export' ? <span className="spinner" /> : <Icon name="download" size={15} />}
                    {busyData === 'export' ? 'Guardando…' : isTauri() ? 'Guardar backup…' : 'Exportar JSON'}
                  </button>
                  <button className="btn-ghost" disabled={busyData !== null} aria-busy={busyData === 'import'} onClick={importBackup}>
                    {busyData === 'import' ? <span className="spinner" /> : <Icon name="upload" size={15} />}
                    {busyData === 'import' ? 'Leyendo…' : isTauri() ? 'Abrir backup…' : 'Importar JSON'}
                  </button>
                </div>
                <p className="setting-hint">
                  El backup incluye todas tus cuentas, transacciones, categorías y metas.
                </p>
              </SettingGroup>

              <SettingGroup label="Recuperación automática">
                <div className="recovery-head">
                  <p className="setting-hint">Se conservan hasta cinco snapshots locales recientes cuando cambian tus datos.</p>
                  <button className="btn-ghost" onClick={saveRecoveryPoint}>
                    <Icon name="refresh" size={15} />Crear punto
                  </button>
                </div>
                {snapshots.length > 0 ? (
                  <div className="recovery-list">
                    {snapshots.map(snapshot => (
                      <div className="recovery-item" key={snapshot.id}>
                        <div>
                          <b>{formatLocalDate(snapshot.createdAt)}</b>
                          <span>{snapshot.reason === 'manual' ? 'Creado manualmente' : 'Snapshot automático'}</span>
                        </div>
                        <button className="btn-ghost" onClick={() => restoreRecoveryPoint(snapshot.id)}>Restaurar</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="setting-hint">Todavía no hay puntos de recuperación.</p>}
                <p className="setting-hint">Estos snapshots permanecen en este dispositivo. No sustituyen un backup exportado.</p>
              </SettingGroup>

              {user?.mode === 'cloud' && <SettingGroup label="Backups cloud cifrados">
                {!cloudBackup.unlocked ? <>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input className="select" type="password" value={backupPassphrase}
                      onChange={event => setBackupPassphrase(event.target.value)}
                      placeholder="Frase secreta para cifrado" autoComplete="new-password" />
                    <button className="btn-primary" onClick={unlockCloudBackups}>Desbloquear</button>
                  </div>
                  <p className="setting-hint">Usa una frase distinta a tu contraseña. No se envía a Supabase ni se guarda en disco.</p>
                </> : <>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn-primary" disabled={cloudBackup.busy} onClick={() => void createCloudBackup()}>
                      <Icon name="upload" size={15} />Crear backup ahora
                    </button>
                    <button className="btn-ghost" disabled={cloudBackup.busy} onClick={() => void cloudBackup.refresh()}>
                      <Icon name="refresh" size={15} />Actualizar lista
                    </button>
                    <button className="btn-ghost" onClick={cloudBackup.lock}>Bloquear</button>
                  </div>
                  <p className="setting-hint">Mientras esté desbloqueado, se crea una versión automática después de sincronizar como máximo cada diez minutos.</p>
                  {cloudBackup.versions.length > 0 && <div className="recovery-list">
                    {cloudBackup.versions.map(version => <div className="recovery-item" key={version.path}>
                      <div><b>{formatLocalDate(version.createdAt)}</b><span>Backup cloud cifrado</span></div>
                      <button className="btn-ghost" onClick={() => void restoreCloudBackup(version.path)}>Restaurar</button>
                    </div>)}
                  </div>}
                </>}
                {cloudBackup.error && <p className="auth-error">{cloudBackup.error}</p>}
              </SettingGroup>}

              <SettingGroup label="Reiniciar datos">
                {!confirmReset ? (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn-ghost" onClick={() => setConfirmReset('demo')}>
                      <Icon name="refresh" size={15} />Cargar datos demo
                    </button>
                    <button className="btn-danger" onClick={() => setConfirmReset('empty')}>
                      <Icon name="trash" size={15} />Borrar todo
                    </button>
                  </div>
                ) : (
                  <div className="confirm-reset">
                    <p>
                      {confirmReset === 'demo'
                        ? '¿Reemplazar todos los datos con el demo?'
                        : '¿Borrar todos los datos? Esta acción no se puede deshacer.'}
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn-ghost" onClick={() => setConfirmReset(null)}>Cancelar</button>
                      <button className={confirmReset === 'empty' ? 'btn-danger' : 'btn-primary'}
                        onClick={() => doReset(confirmReset)}>
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}
              </SettingGroup>
            </>
          )}

          {/* ── Cuenta ─────────────────────────────── */}
          {tab === 'account' && (
            <>
              <SettingGroup label="Sesión activa">
                <div className="account-info">
                  <span className="avatar" style={{ width: 44, height: 44, fontSize: 16, borderRadius: 13 }}>
                    {user?.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div>
                    <div style={{ fontWeight: 650, color: 'var(--text)' }}>{user?.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{user?.email}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--accent)', marginTop: 3 }}>
                      {user?.mode === 'cloud' ? 'Cuenta cloud sincronizable' : user ? 'Cuenta local de este equipo' : 'Sin sesión activa'}
                    </div>
                  </div>
                </div>
              </SettingGroup>

              <SettingRow label="Requerir inicio de sesión"
                sub="Solicita una cuenta cloud o local al abrir la app.">
                <Toggle value={s.authEnabled} onChange={v => {
                  s.setAuthEnabled(v)
                  if (!v) void logout()
                }} />
              </SettingRow>

              {s.authEnabled && user && (
                <SettingGroup label="Sesión activa">
                  <button className="btn-danger" onClick={() => { void logout(); onClose() }}>
                    <Icon name="logout" size={15} />Cerrar sesión
                  </button>
                  {user.mode === 'cloud' && <button className="btn-ghost" style={{ marginLeft: 8 }}
                    onClick={() => { void logout('global'); onClose() }}>
                    <Icon name="logout" size={15} />Cerrar en todos los dispositivos
                  </button>}
                  <p className="setting-hint">Los datos locales permanecen disponibles en este dispositivo.</p>
                </SettingGroup>
              )}

              {user?.mode === 'cloud' && (
                <SettingGroup label="Sincronización cloud">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn-primary" disabled={cloudSync.busy} onClick={() => void syncNow()}>
                      {cloudSync.busy ? <span className="spinner" /> : <Icon name="refresh" size={15} />}
                      {cloudSync.busy ? 'Sincronizando…' : 'Sincronizar ahora'}
                    </button>
                    <span className="setting-hint">
                      {cloudSync.pending
                        ? 'Hay cambios pendientes de sincronizar.'
                        : cloudSync.lastSyncAt
                          ? `Última sincronización: ${formatLocalDate(cloudSync.lastSyncAt)}`
                          : 'Todavía no has sincronizado este equipo.'}
                    </span>
                  </div>
                  {cloudSync.error && <p className="auth-error">{cloudSync.error}</p>}
                  {cloudSync.conflicts.length > 0 && <div className="sync-conflicts">
                    <b>Conflictos pendientes</b>
                    <p className="setting-hint">Se conservaron tus datos locales. Revisa estos elementos antes de sincronizar otra vez.</p>
                    {cloudSync.conflicts.map(conflict => <span key={`${conflict.table}:${conflict.localId}`}>
                      {conflict.table}: {conflict.label}
                    </span>)}
                  </div>}
                  <p className="setting-hint">Cada cuenta cloud mantiene un cache local separado en este dispositivo.</p>
                  <p className="setting-hint">{usesNativeCredentialStorage
                    ? 'La sesión cloud se guarda en el Administrador de credenciales de Windows.'
                    : 'La sesión cloud se guarda en el almacenamiento seguro disponible del navegador.'}</p>
                </SettingGroup>
              )}

              {!s.authEnabled && (
                <div className="setting-hint" style={{ padding: '10px 14px', background: 'var(--track)',
                  borderRadius: 10, fontSize: 12.5 }}>
                  La app abre directamente sin contraseña. Activa el inicio de sesión para usar
                  una cuenta cloud sincronizable o una cuenta local protegida.
                </div>
              )}

              <SettingGroup label="Actividad reciente">
                {auditEvents.length > 0 ? (
                  <div className="audit-list">
                    {auditEvents.slice(0, 8).map(event => (
                      <div className="audit-item" key={event.id}>
                        <i />
                        <div>
                          <b>{event.label}</b>
                          <span>{formatLocalDate(event.createdAt)}{event.detail ? ` · ${event.detail}` : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="setting-hint">Todavía no hay eventos registrados.</p>}
              </SettingGroup>

              <SettingGroup label="Atajos de teclado">
                <div className="shortcuts-list">
                  {[
                    ['N',        'Nueva transacción'],
                    ['1 – 7',    'Navegar a vista'],
                    ['Ctrl + K', 'Búsqueda global'],
                    ['Esc',      'Cerrar modal'],
                  ].map(([key, label]) => (
                    <div key={key} className="shortcut-row">
                      <kbd>{key}</kbd>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </SettingGroup>
            </>
          )}

          {/* ── Acerca de ──────────────────────────── */}
          {tab === 'about' && (
            <>
              <div className="about-hero">
                <span className="brand-mark" style={{ width: 52, height: 52, borderRadius: 15, fontSize: 22 }}>
                  <BrandMark size={48} />
                </span>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    <span style={{ color: 'var(--accent)' }}>$</span>harky
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>v0.5 — Finanzas personales</div>
                </div>
              </div>

              <SettingGroup label="Stack">
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                  Vite 6 + React 18 + TypeScript + Zustand<br />
                  Lucide React + jsPDF + ExcelJS<br />
                  Supabase Auth + Postgres con RLS<br />
                  Datos locales primero — sin tracking
                </div>
              </SettingGroup>

              <SettingGroup label="Próximamente">
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                  v0.5: Estabilidad visual y base de sincronización<br />
                  v0.6: Inteligencia financiera y proyecciones<br />
                  v0.7: Integraciones bancarias dominicanas<br />
                  v1.0: App instalable, accesibilidad AA y pruebas E2E
                </div>
              </SettingGroup>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers de layout ────────────────────────────────────
function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="setting-group">
      <div className="setting-group-label">{label}</div>
      {children}
    </div>
  )
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 550, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch" aria-checked={value}
      className="toggle-btn" data-on={value ? '1' : '0'}
      onClick={() => onChange(!value)}>
      <i />
    </button>
  )
}

function formatLocalDate(value: string): string {
  return new Date(value).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })
}
