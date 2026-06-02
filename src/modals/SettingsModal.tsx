import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { BrandMark } from '@/components/ui/BrandMark'
import { toast } from '@/components/ui/Toast'
import { useSettings } from '@/store/settings'
import { useFinance } from '@/store/finance'
import { useAuth } from '@/store/auth'
import { createBackup, parseBackup } from '@/data/backup'
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
  const [tab, setTab] = useState<'appearance' | 'data' | 'account' | 'about'>('appearance')
  const [confirmReset, setConfirmReset] = useState<'demo' | 'empty' | null>(null)
  const [busyData, setBusyData] = useState<'export' | 'import' | null>(null)

  const exportBackup = async () => {
    setBusyData('export')
    try {
      const json = JSON.stringify(createBackup(finance), null, 2)
      await saveBackup(json)
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
      toast('Backup restaurado correctamente', { icon: 'check', type: 'ok' })
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Archivo inválido', { icon: 'alert' })
    } finally {
      setBusyData(null)
    }
  }

  const doReset = (mode: 'demo' | 'empty') => {
    if (mode === 'demo') finance.startDemo()
    else                 finance.startEmpty()
    toast(mode === 'demo' ? 'Datos demo cargados' : 'Datos limpiados', { icon: 'refresh' })
    setConfirmReset(null)
    onClose()
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
                  </div>
                </div>
              </SettingGroup>

              <SettingRow label="Proteger con contraseña"
                sub="Requiere login al abrir la app. Útil si compartes el dispositivo.">
                <Toggle value={s.authEnabled} onChange={v => {
                  s.setAuthEnabled(v)
                  if (!v) logout()   // al deshabilitar, cerrar sesión activa
                }} />
              </SettingRow>

              {s.authEnabled && user && (
                <SettingGroup label="Sesión activa">
                  <button className="btn-danger" onClick={() => { logout(); onClose() }}>
                    <Icon name="logout" size={15} />Cerrar sesión
                  </button>
                  <p className="setting-hint">Los datos quedan guardados en este dispositivo.</p>
                </SettingGroup>
              )}

              {!s.authEnabled && (
                <div className="setting-hint" style={{ padding: '10px 14px', background: 'var(--track)',
                  borderRadius: 10, fontSize: 12.5 }}>
                  💡 La app abre directamente sin contraseña. Activa la protección si quieres
                  añadir seguridad o prepararla para sincronización futura entre dispositivos.
                </div>
              )}

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
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>v0.4 — Finanzas personales</div>
                </div>
              </div>

              <SettingGroup label="Stack">
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                  Vite 6 + React 18 + TypeScript + Zustand<br />
                  Lucide React + jsPDF + ExcelJS<br />
                  Datos locales — sin backend, sin tracking
                </div>
              </SettingGroup>

              <SettingGroup label="Próximamente">
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                  v0.4: Control financiero y metas renovadas<br />
                  v0.5: Seguridad y sincronización multidispositivo<br />
                  v0.6: Inteligencia financiera y proyecciones<br />
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
