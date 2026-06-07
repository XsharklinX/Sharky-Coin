import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { APP_VERSION } from '@/data/release'
import { createBackup, parseBackup } from '@/data/backup'
import { getDataHealthStatus } from '@/data/dataHealth'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useGoogleAuth, loadGIS } from '@/lib/googleAuth'
import { isTauri, openBackup, saveBackup } from '@/hooks/useTauri'
import { checkBiometric } from '@/lib/biometric'
import type { DensityName, IconName, OverdraftPolicy, ThemeName } from '@/types'
import { useT } from '@/i18n'
import { useMobileBackDismiss } from './useMobileBackDismiss'

const ACCENTS = [
  { color: '#ffdd3d', label: 'Amarillo' },
  { color: '#35d0a2', label: 'Verde'    },
  { color: '#5bc0ff', label: 'Azul'     },
  { color: '#a78bfa', label: 'Violeta'  },
  { color: '#ff6b8a', label: 'Rosa'     },
  { color: '#f59e0b', label: 'Naranja'  },
]

const THEME_LABELS: Record<ThemeName, string>     = { dark: 'Oscuro', light: 'Claro' }
const DENSITY_LABELS: Record<DensityName, string> = { compact: 'Compacto', regular: 'Regular', comfy: 'Cómodo' }
const OVERDRAFT_LABELS: Record<OverdraftPolicy, string> = { block: 'Bloquear', warn: 'Advertir', allow: 'Permitir' }

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

type Sheet = 'theme' | 'accent' | 'density' | 'currency' | 'overdraft' | 'name' | 'reset' | 'language'

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

interface SheetProps { title: string; onClose: () => void; children: React.ReactNode }
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

type GisStatus = 'loading' | 'ready' | 'error'

function GoogleButton({ onSignIn }: { onSignIn: (credential: string) => void }) {
  const ref    = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<GisStatus>('loading')

  // Step 1: load the GIS script, initialize with the credential callback
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    loadGIS(
      () => {
        window.google!.accounts.id.initialize({
          client_id:  GOOGLE_CLIENT_ID,
          callback:   (r) => onSignIn(r.credential),
          auto_select: false,
        })
        setStatus('ready')
      },
      () => setStatus('error'),
    )
  }, [onSignIn])

  // Step 2: once status is ready AND the div is in the DOM, inject the Google button.
  // renderButton() requires a real DOM element with a numeric pixel width (not '100%').
  useEffect(() => {
    if (status !== 'ready' || !ref.current || !window.google?.accounts?.id) return
    window.google.accounts.id.renderButton(ref.current, {
      theme: 'filled_black',
      size:  'large',
      text:  'signin_with',
      shape: 'pill',
      width: 280,
    })
  }, [status])

  return (
    <div className="mset-google-btn-container">
      {/* Visible while GIS loads or if it failed */}
      {status !== 'ready' && (
        <div className={`mset-google-placeholder${status === 'error' ? ' error' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {status === 'error' ? 'Sin conexión a Google' : 'Cargando...'}
        </div>
      )}
      {/* Container where GIS injects its iframe button */}
      <div
        ref={ref}
        className="mset-google-btn-wrap"
        style={{ display: status === 'ready' ? 'flex' : 'none', justifyContent: 'center' }}
      />
    </div>
  )
}

export function MobileSettings({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const finance  = useFinance()
  const { user: gUser, signIn, signOut } = useGoogleAuth()
  const t = useT()
  const [activeSheet, setActiveSheet] = useState<Sheet | null>(null)
  const [nameInput, setNameInput] = useState(settings.displayName)
  const [pendingReset, setPendingReset] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const health = getDataHealthStatus(finance)

  useEffect(() => {
    if (isTauri()) checkBiometric().then(s => setBioAvailable(s.available))
  }, [])

  useMobileBackDismiss(true, onClose)
  useMobileBackDismiss(!!activeSheet, () => { setActiveSheet(null); setPendingReset(false) })

  const open  = (sheet: Sheet) => { setActiveSheet(sheet); if (sheet === 'name') setNameInput(settings.displayName) }
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

  const confirmReset = () => {
    finance.startEmpty()
    toast('Todos los datos eliminados', { icon: 'trash' })
    close()
    onClose()
  }

  const themePreviewBg: Record<ThemeName, string> = { dark: '#0a0e16', light: '#f4f7fb' }
  const themePreviewFg: Record<ThemeName, string> = { dark: '#e9eef7', light: '#172033' }

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

        {/* ── Google Account (only when client ID is configured) ── */}
        {GOOGLE_CLIENT_ID && (
          <div className="mset-section">
            <span className="mset-section-title">Cuenta</span>
            {gUser ? (
              <div className="mset-card">
                <div className="mset-google-profile">
                  {gUser.picture
                    ? <img className="mset-google-avatar" src={gUser.picture} alt={gUser.name} referrerPolicy="no-referrer" />
                    : <div className="mset-google-avatar initials">{gUser.name.slice(0, 1).toUpperCase()}</div>
                  }
                  <div className="mset-google-info">
                    <strong>{gUser.name}</strong>
                    <small>{gUser.email}</small>
                    <small className="mset-uid">ID: {gUser.id.slice(0, 12)}…</small>
                  </div>
                </div>
                <SettingsRow icon="logout" iconColor="#ff6b8a" label="Cerrar sesión de Google" danger
                  onClick={() => { signOut(); toast('Sesión cerrada', { icon: 'check' }) }} />
              </div>
            ) : (
              <div className="mset-card">
                <div className="mset-google-signin-wrap">
                  <p className="mset-google-desc">Inicia sesión para sincronizar tus datos en todos tus dispositivos.</p>
                  <GoogleButton onSignIn={(cred) => { signIn(cred); toast('Sesión iniciada con Google', { icon: 'check', type: 'ok' }) }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Profile ── */}
        <div className="mset-section">
          <span className="mset-section-title">Perfil</span>
          <div className="mset-card">
            <SettingsRow icon="user" iconColor="#5bc0ff" label="Nombre"
              value={settings.displayName || 'Sin definir'}
              onClick={() => open('name')} />
          </div>
        </div>

        {/* ── Finance ── */}
        <div className="mset-section">
          <span className="mset-section-title">Finanzas</span>
          <div className="mset-card">
            <SettingsRow icon="dollar" iconColor="#35d0a2" label={t('currency')}
              value={finance.currency}
              onClick={() => open('currency')} />
            <SettingsRow icon="alert" iconColor="#f59e0b" label="Sobregiro"
              value={OVERDRAFT_LABELS[settings.overdraftPolicy]}
              onClick={() => open('overdraft')} />
          </div>
        </div>

        {/* ── Appearance ── */}
        <div className="mset-section">
          <span className="mset-section-title">Apariencia</span>
          <div className="mset-card">
            <SettingsRow icon="palette" iconColor="#a78bfa" label={t('theme')}
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
            <SettingsRow icon="map" iconColor="#64d2ff" label={t('language')}
              value={settings.language === 'en' ? 'English' : 'Español'}
              onClick={() => open('language')} />
          </div>
        </div>

        {/* ── Data ── */}
        <div className="mset-section">
          <span className="mset-section-title">Datos</span>
          <div className="mset-card">
            <div className="mset-stats">
              <div><strong>{health.transactions}</strong><small>Transacciones</small></div>
              <div><strong>{health.categories}</strong><small>Categorías</small></div>
              <div><strong>{health.goals}</strong><small>{t('goals')}</small></div>
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

        {/* ── Security (Tauri only) ── */}
        {isTauri() && (
          <div className="mset-section">
            <div className="mset-section-label">Seguridad</div>
            <div className="mset-card">
              <div className="mset-row">
                <span className="mset-row-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
                  <Icon name="lock" size={18} />
                </span>
                <div className="mset-row-text">
                  <b>Requerir biometría</b>
                  <small>{bioAvailable ? 'Bloquear app al abrir' : 'No disponible en este dispositivo'}</small>
                </div>
                <label className="mset-toggle-wrap">
                  <input type="checkbox" className="mset-toggle-input"
                    checked={settings.requireBiometric}
                    disabled={!bioAvailable}
                    onChange={e => settings.setRequireBiometric(e.target.checked)} />
                  <span className="mset-toggle" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── App ── */}
        <div className="mset-section">
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
        <SettingsSheet title="Nombre" onClose={close}>
          <div className="mset-sheet-body">
            <input
              className="mset-text-input" autoFocus type="text"
              value={nameInput} placeholder="Ej. Juan Pérez"
              autoCapitalize="words" enterKeyHint="done"
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            />
            <button className="mset-sheet-confirm" onClick={saveName}>{t('save')}</button>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'theme' && (
        <SettingsSheet title="Tema" onClose={close}>
          <div className="mset-sheet-options">
            {(['dark', 'light'] as ThemeName[]).map(theme => (
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
                <small>{density === 'compact' ? 'Más contenido visible' : density === 'comfy' ? 'Más espacio entre elementos' : 'Balanceado'}</small>
                {settings.density === density && <Icon name="check" size={16} style={{ color: '#ffdd3d', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'currency' && (
        <SettingsSheet title="Moneda predeterminada" onClose={close}>
          <div className="mset-sheet-options">
            {(['DOP','USD','EUR','MXN','GBP','COP','ARS','BRL','CAD'] as const).map(code => (
              <button key={code} className={`mset-option-row${finance.currency === code ? ' on' : ''}`}
                onClick={() => { finance.setCurrency(code); close() }}>
                <strong>{code}</strong>
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
                <small>{policy === 'block' ? 'Bloquea gastos cuando el saldo es cero' : policy === 'warn' ? 'Advierte pero permite continuar' : 'Siempre permite, sin restricción'}</small>
                {settings.overdraftPolicy === policy && <Icon name="check" size={16} style={{ color: '#ffdd3d', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'language' && (
        <SettingsSheet title="Idioma" onClose={close}>
          <div className="mset-sheet-options">
            {(['es', 'en'] as const).map(lang => (
              <button key={lang} className={`mset-option-row${settings.language === lang ? ' on' : ''}`}
                onClick={() => { settings.setLanguage(lang); close() }}>
                <strong>{lang === 'en' ? '🇺🇸 English' : '🇩🇴 Español'}</strong>
                <small>{lang === 'en' ? 'Interfaz en inglés' : 'Interfaz en español'}</small>
                {settings.language === lang && <Icon name="check" size={16} style={{ color: '#ffdd3d', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'reset' && (
        <SettingsSheet title="Eliminar datos" onClose={close}>
          <div className="mset-sheet-body">
            <p className="mset-reset-warning">
              Esto eliminará permanentemente <strong>todas tus transacciones, cuentas, categorías y metas</strong>. Esta acción no se puede deshacer.
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
                  {t('cancel')}
                </button>
              </>
            )}
          </div>
        </SettingsSheet>
      )}
    </div>
  )
}
