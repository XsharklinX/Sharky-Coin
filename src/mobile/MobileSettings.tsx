import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { APP_VERSION } from '@/data/release'
import { createBackup, parseBackup } from '@/data/backup'
import { getDataHealthStatus } from '@/data/dataHealth'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useAuth } from '@/store/auth'
import { openBackup, saveBackup } from '@/hooks/useTauri'
import type { CurrencyCode, DensityName, IconName, OverdraftPolicy, ThemeName } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'

const ACCENTS = [
  { color: '#ffdd3d', label: 'Amarillo' },
  { color: '#35d0a2', label: 'Verde' },
  { color: '#5bc0ff', label: 'Azul' },
  { color: '#a78bfa', label: 'Violeta' },
  { color: '#ff6b8a', label: 'Rosa' },
  { color: '#f59e0b', label: 'Naranja' },
]

const THEME_LABELS: Record<ThemeName, string> = {
  midnight: 'Medianoche', slate: 'Pizarra', carbon: 'Carbón', light: 'Claro',
}
const DENSITY_LABELS: Record<DensityName, string> = {
  compact: 'Compacta', regular: 'Normal', comfy: 'Cómoda',
}
const OVERDRAFT_LABELS: Record<OverdraftPolicy, string> = {
  block: 'Bloquear', warn: 'Advertir', allow: 'Permitir',
}
const CURRENCIES: Array<{ code: CurrencyCode; label: string; symbol: string }> = [
  { code: 'DOP', label: 'Peso dominicano', symbol: 'RD$' },
  { code: 'USD', label: 'Dólar estadounidense', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
]

type Sheet = 'theme' | 'accent' | 'density' | 'currency' | 'overdraft' | 'name' | 'reset'

interface SettingsRowProps {
  icon: IconName
  iconColor: string
  label: string
  value?: string
  danger?: boolean
  onClick: () => void
  right?: React.ReactNode
}
function SettingsRow({ icon, iconColor, label, value, danger, onClick, right }: SettingsRowProps) {
  return (
    <button className={`mset-row${danger ? ' danger' : ''}`} onClick={onClick}>
      <span className="mset-icon" style={{ color: iconColor, background: `color-mix(in oklab, ${iconColor} 14%, transparent)` }}>
        <Icon name={icon} size={18} />
      </span>
      <span className="mset-label">{label}</span>
      {right ?? (
        <>
          {value && <span className="mset-value">{value}</span>}
          <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: '#4a4a4a', flexShrink: 0 }} />
        </>
      )}
    </button>
  )
}

interface SheetProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}
function SettingsSheet({ title, onClose, children }: SheetProps) {
  return (
    <div className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={onClose}>
      <section onClick={e => e.stopPropagation()}>
        <header>
          <span>{title}</span>
          <button onClick={onClose}><Icon name="close" size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function MobileSettings({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const finance = useFinance()
  const { user, logout } = useAuth()
  const [activeSheet, setActiveSheet] = useState<Sheet | null>(null)
  const [nameInput, setNameInput] = useState(settings.displayName)
  const [pendingReset, setPendingReset] = useState(false)
  const health = getDataHealthStatus(finance, user?.mode === 'cloud' ? user.id : undefined)

  useMobileBackDismiss(true, onClose)
  useMobileBackDismiss(!!activeSheet, () => { setActiveSheet(null); setPendingReset(false) })

  const open = (sheet: Sheet) => { setActiveSheet(sheet); if (sheet === 'name') setNameInput(settings.displayName) }
  const close = () => { setActiveSheet(null); setPendingReset(false) }

  const saveName = () => {
    settings.setDisplayName(nameInput.trim())
    toast('Nombre guardado', { icon: 'check', type: 'ok' })
    close()
  }

  const exportBackup = async () => {
    try {
      await saveBackup(JSON.stringify(createBackup(finance), null, 2))
      toast('Backup exportado', { icon: 'download', type: 'ok' })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo exportar.', { icon: 'alert' })
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

  const confirmReset = () => {
    finance.startEmpty()
    toast('Datos eliminados', { icon: 'trash' })
    close()
    onClose()
  }

  const themePreviewBg: Record<ThemeName, string> = {
    midnight: '#0a0e16', slate: '#11161d', carbon: '#0b0c0e', light: '#f4f7fb',
  }
  const themePreviewFg: Record<ThemeName, string> = {
    midnight: '#e9eef7', slate: '#e6ecf3', carbon: '#ededee', light: '#172033',
  }

  return (
    <div className="mobile-settings-screen" role="dialog" aria-modal="true">
      <header className="mset-header">
        <button className="mset-back" onClick={onClose}>
          <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
        </button>
        <strong>Configuración</strong>
        <span />
      </header>

      <div className="mset-body">

        {/* ─── Perfil ─── */}
        <div className="mset-section">
          <span className="mset-section-title">Perfil</span>
          <div className="mset-card">
            <SettingsRow icon="user" iconColor="#5bc0ff" label="Nombre"
              value={settings.displayName || 'Sin definir'}
              onClick={() => open('name')} />
          </div>
        </div>

        {/* ─── Finanzas ─── */}
        <div className="mset-section">
          <span className="mset-section-title">Finanzas</span>
          <div className="mset-card">
            <SettingsRow icon="dollar" iconColor="#35d0a2" label="Moneda"
              value={finance.currency}
              onClick={() => open('currency')} />
            <SettingsRow icon="alert" iconColor="#f59e0b" label="Sobregiro"
              value={OVERDRAFT_LABELS[settings.overdraftPolicy]}
              onClick={() => open('overdraft')} />
          </div>
        </div>

        {/* ─── Apariencia ─── */}
        <div className="mset-section">
          <span className="mset-section-title">Apariencia</span>
          <div className="mset-card">
            <SettingsRow icon="palette" iconColor="#a78bfa" label="Tema"
              value={THEME_LABELS[settings.theme]}
              onClick={() => open('theme')} />
            <SettingsRow icon="sliders" iconColor="#ff6b8a" label="Color de acento"
              onClick={() => open('accent')}
              right={
                <>
                  <span className="mset-color-dot" style={{ background: settings.accent }} />
                  <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: '#4a4a4a', flexShrink: 0 }} />
                </>
              }
            />
            <SettingsRow icon="grid" iconColor="#f59e0b" label="Densidad"
              value={DENSITY_LABELS[settings.density]}
              onClick={() => open('density')} />
          </div>
        </div>

        {/* ─── Datos ─── */}
        <div className="mset-section">
          <span className="mset-section-title">Datos</span>
          <div className="mset-card">
            <div className="mset-stats">
              <div><strong>{health.transactions}</strong><small>Movimientos</small></div>
              <div><strong>{health.categories}</strong><small>Categorías</small></div>
              <div><strong>{health.goals}</strong><small>Metas</small></div>
            </div>
            {health.warnings.map(w => (
              <p className="mset-warning" key={w}><Icon name="alert" size={13} />{w}</p>
            ))}
          </div>
          <div className="mset-card">
            <SettingsRow icon="download" iconColor="#35d0a2" label="Exportar backup"
              onClick={() => void exportBackup()} />
            <SettingsRow icon="upload" iconColor="#5bc0ff" label="Restaurar backup"
              onClick={() => void importBackup()} />
          </div>
          <div className="mset-card">
            <SettingsRow icon="trash" iconColor="#ff6b8a" label="Eliminar todos los datos"
              danger onClick={() => open('reset')} />
          </div>
        </div>

        {/* ─── Seguridad ─── */}
        <div className="mset-section">
          <span className="mset-section-title">Seguridad</span>
          <div className="mset-card">
            <div className="mset-row">
              <span className="mset-icon" style={{ color: '#a78bfa', background: 'color-mix(in oklab, #a78bfa 14%, transparent)' }}>
                <Icon name="lock" size={18} />
              </span>
              <span className="mset-label">Requerir login al abrir</span>
              <label className="mset-toggle">
                <input type="checkbox" checked={settings.authEnabled} onChange={e => settings.setAuthEnabled(e.target.checked)} />
                <span />
              </label>
            </div>
          </div>
        </div>

        {/* ─── App ─── */}
        <div className="mset-section">
          {user && (
            <div className="mset-card" style={{ marginBottom: 10 }}>
              <SettingsRow icon="logout" iconColor="#ff6b8a" label="Cerrar sesión"
                danger onClick={() => { logout(); onClose() }} />
            </div>
          )}
          <div className="mset-card">
            <div className="mset-info-row">
              <span>$harky</span>
              <span>v{APP_VERSION}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── Sheets ─── */}

      {activeSheet === 'name' && (
        <SettingsSheet title="Tu nombre" onClose={close}>
          <div className="mset-sheet-body">
            <input
              className="mset-text-input"
              autoFocus
              type="text"
              value={nameInput}
              placeholder="Ej. María García"
              autoCapitalize="words"
              enterKeyHint="done"
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            />
            <button className="mset-sheet-confirm" onClick={saveName}>Guardar</button>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'theme' && (
        <SettingsSheet title="Tema" onClose={close}>
          <div className="mset-sheet-options">
            {(['midnight', 'slate', 'carbon', 'light'] as ThemeName[]).map(theme => (
              <button key={theme} className={`mset-theme-opt${settings.theme === theme ? ' on' : ''}`}
                onClick={() => { settings.setTheme(theme); close() }}>
                <span className="mset-theme-preview" style={{ background: themePreviewBg[theme], color: themePreviewFg[theme] }}>
                  <span />
                </span>
                <strong>{THEME_LABELS[theme]}</strong>
                {settings.theme === theme && <Icon name="check" size={14} style={{ color: '#ffdd3d', marginLeft: 'auto' }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'accent' && (
        <SettingsSheet title="Color de acento" onClose={close}>
          <div className="mset-sheet-body">
            <div className="mset-accent-grid">
              {ACCENTS.map(({ color, label }) => (
                <button key={color} className={`mset-accent-opt${settings.accent === color ? ' on' : ''}`}
                  onClick={() => { settings.setAccent(color); close() }}>
                  <span style={{ background: color }} />
                  <small>{label}</small>
                </button>
              ))}
            </div>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'density' && (
        <SettingsSheet title="Densidad de interfaz" onClose={close}>
          <div className="mset-sheet-options">
            {(['compact', 'regular', 'comfy'] as DensityName[]).map(density => (
              <button key={density} className={`mset-option-row${settings.density === density ? ' on' : ''}`}
                onClick={() => { settings.setDensity(density); close() }}>
                <strong>{DENSITY_LABELS[density]}</strong>
                <small>{density === 'compact' ? 'Más contenido visible' : density === 'comfy' ? 'Más espacio entre elementos' : 'Equilibrada'}</small>
                {settings.density === density && <Icon name="check" size={16} style={{ color: '#ffdd3d', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'currency' && (
        <SettingsSheet title="Moneda predeterminada" onClose={close}>
          <div className="mset-sheet-options">
            {CURRENCIES.map(({ code, label, symbol }) => (
              <button key={code} className={`mset-option-row${finance.currency === code ? ' on' : ''}`}
                onClick={() => { finance.setCurrency(code); close() }}>
                <strong>{symbol} — {code}</strong>
                <small>{label}</small>
                {finance.currency === code && <Icon name="check" size={16} style={{ color: '#ffdd3d', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'overdraft' && (
        <SettingsSheet title="Política de sobregiro" onClose={close}>
          <div className="mset-sheet-options">
            {(['block', 'warn', 'allow'] as OverdraftPolicy[]).map(policy => (
              <button key={policy} className={`mset-option-row${settings.overdraftPolicy === policy ? ' on' : ''}`}
                onClick={() => { settings.setOverdraftPolicy(policy); close() }}>
                <strong>{OVERDRAFT_LABELS[policy]}</strong>
                <small>{policy === 'block' ? 'No permite gastos si no hay saldo' : policy === 'warn' ? 'Advierte pero permite continuar' : 'Permite siempre sin restricción'}</small>
                {settings.overdraftPolicy === policy && <Icon name="check" size={16} style={{ color: '#ffdd3d', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'reset' && (
        <SettingsSheet title="Eliminar datos" onClose={close}>
          <div className="mset-sheet-body">
            <p className="mset-reset-warning">
              Esta acción eliminará <strong>todos tus movimientos, cuentas, categorías y metas</strong>. No se puede deshacer.
            </p>
            {!pendingReset ? (
              <button className="mset-sheet-danger" onClick={() => setPendingReset(true)}>
                Continuar
              </button>
            ) : (
              <>
                <button className="mset-sheet-danger" onClick={confirmReset}>
                  <Icon name="trash" size={18} /> Sí, eliminar todo
                </button>
                <button className="mset-sheet-cancel" onClick={() => setPendingReset(false)}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </SettingsSheet>
      )}
    </div>
  )
}
