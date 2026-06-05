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
import type { DensityName, OverdraftPolicy, ThemeName } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'

type SettingsTab = 'appearance' | 'data' | 'account'

const TABS: Array<{ id: SettingsTab; label: string; icon: Parameters<typeof Icon>[0]['name'] }> = [
  { id: 'appearance', label: 'Visual', icon: 'sliders' },
  { id: 'data', label: 'Datos', icon: 'fileJson' },
  { id: 'account', label: 'Cuenta', icon: 'wallet' },
]

const ACCENTS = ['#ffdd3d', '#35d0a2', '#5bc0ff', '#a78bfa', '#ff6b8a']

export function MobileSettings({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const finance = useFinance()
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<SettingsTab>('appearance')
  const health = getDataHealthStatus(finance, user?.mode === 'cloud' ? user.id : undefined)

  useMobileBackDismiss(true, onClose)

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

  return (
    <div className="mobile-settings-screen" role="dialog" aria-modal="true">
      <header>
        <button onClick={onClose}>Cerrar</button>
        <strong>Configuración</strong>
        <span />
      </header>

      <nav className="mobile-settings-tabs" aria-label="Secciones de configuración">
        {TABS.map(item => (
          <button key={item.id} className={tab === item.id ? 'on' : ''} onClick={() => setTab(item.id)}>
            <Icon name={item.icon} size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      <main className="mobile-settings-body">
        {tab === 'appearance' && (
          <>
            <section className="mobile-settings-card">
              <h2>Tema</h2>
              <div className="mobile-choice-grid">
                {(['midnight', 'slate', 'carbon', 'light'] as ThemeName[]).map(theme => (
                  <button key={theme} className={settings.theme === theme ? 'on' : ''} onClick={() => settings.setTheme(theme)}>
                    <span>{theme === 'light' ? 'Claro' : theme === 'carbon' ? 'Carbón' : theme === 'slate' ? 'Pizarra' : 'Oscuro'}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="mobile-settings-card">
              <h2>Color principal</h2>
              <div className="mobile-color-grid">
                {ACCENTS.map(color => (
                  <button key={color} className={settings.accent === color ? 'on' : ''} style={{ background: color }} onClick={() => settings.setAccent(color)} />
                ))}
              </div>
            </section>

            <section className="mobile-settings-card">
              <h2>Densidad</h2>
              <div className="mobile-choice-grid">
                {(['compact', 'regular', 'comfy'] as DensityName[]).map(density => (
                  <button key={density} className={settings.density === density ? 'on' : ''} onClick={() => settings.setDensity(density)}>
                    <span>{density === 'compact' ? 'Compacta' : density === 'comfy' ? 'Cómoda' : 'Normal'}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'data' && (
          <>
            <section className="mobile-settings-card">
              <h2>Estado de datos</h2>
              <div className="mobile-health-grid">
                <article><small>Movimientos</small><strong>{health.transactions}</strong></article>
                <article><small>Categorías</small><strong>{health.categories}</strong></article>
                <article><small>Metas</small><strong>{health.goals}</strong></article>
              </div>
              {health.warnings.map(warning => <p className="mobile-settings-warning" key={warning}>{warning}</p>)}
            </section>

            <section className="mobile-settings-card mobile-settings-actions">
              <button onClick={() => void exportBackup()}><Icon name="download" size={19} />Exportar backup</button>
              <button onClick={() => void importBackup()}><Icon name="upload" size={19} />Restaurar backup</button>
              <button onClick={() => { finance.startDemo(); toast('Datos demo cargados', { icon: 'refresh' }) }}><Icon name="refresh" size={19} />Cargar demo</button>
              <button className="danger" onClick={() => { finance.startEmpty(); toast('Datos limpiados', { icon: 'trash' }) }}><Icon name="trash" size={19} />Limpiar datos</button>
            </section>
          </>
        )}

        {tab === 'account' && (
          <>
            <section className="mobile-settings-card">
              <h2>{user?.name ?? 'Mi cuenta'}</h2>
              <p>{user ? user.email : 'Sesión local sin cuenta obligatoria.'}</p>
            </section>
            <section className="mobile-settings-card">
              <h2>Seguridad</h2>
              <label className="mobile-settings-row">
                <span>Requerir login al abrir</span>
                <input type="checkbox" checked={settings.authEnabled} onChange={event => settings.setAuthEnabled(event.target.checked)} />
              </label>
              <label className="mobile-settings-row">
                <span>Sobregiro</span>
                <select value={settings.overdraftPolicy} onChange={event => settings.setOverdraftPolicy(event.target.value as OverdraftPolicy)}>
                  <option value="block">Bloquear</option>
                  <option value="warn">Advertir</option>
                  <option value="allow">Permitir</option>
                </select>
              </label>
            </section>
            <section className="mobile-settings-card mobile-settings-actions">
              {user && <button onClick={() => { logout(); onClose() }}><Icon name="logout" size={19} />Cerrar sesión</button>}
              <p className="mobile-muted">Versión {APP_VERSION}</p>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
