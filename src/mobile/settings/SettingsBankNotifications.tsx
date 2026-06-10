import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { isTauri } from '@/hooks/useTauri'
import { useBankNotifications } from '@/hooks/useBankNotifications'
import { hasNotificationAccess, openNotificationAccessSettings } from '@/lib/bankNotifications'
import { useNotificationInbox } from '@/store/notificationInbox'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'

export function SettingsBankNotifications({ activeSheet, onOpen, onClose }: SheetProps) {
  const inbox = useNotificationInbox()
  const [granted, setGranted] = useState<boolean | null>(null)

  useBankNotifications()

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    hasNotificationAccess().then(value => { if (!cancelled) setGranted(value) })
    return () => { cancelled = true }
  }, [activeSheet])

  const handleOpenSettings = async () => {
    await openNotificationAccessSettings()
  }

  const handleClear = () => {
    inbox.clear()
    toast('Capturas eliminadas', { icon: 'trash' })
  }

  if (!isTauri()) return null

  const accessLabel = granted == null ? 'Verificando…' : granted ? 'Concedido' : 'No concedido'

  return (
    <>
      <div className="mset-section">
        <div className="mset-section-label">Notificaciones bancarias</div>
        <div className="mset-card">
          <SettingsRow icon="bell" iconColor="#5bc0ff" label="Detección de transacciones"
            value={`${inbox.items.length} capturadas`}
            onClick={() => onOpen('bankNotifications')} />
        </div>
      </div>

      {activeSheet === 'bankNotifications' && (
        <SettingsSheet title="Notificaciones bancarias" onClose={onClose}>
          <div className="mset-sheet-body">
            <p className="mset-legal-intro">
              $harky puede leer el título y el texto de las notificaciones de tu teléfono
              (incluyendo SMS y avisos de tus apps bancarias) para detectar transacciones
              automáticamente. Todo el procesamiento ocurre en tu dispositivo, nada se envía
              a ningún servidor. Es opcional y puedes desactivarlo cuando quieras.
            </p>

            <div className="mset-row">
              <span className="mset-row-icon" style={{ background: '#5bc0ff22', color: '#5bc0ff' }}>
                <Icon name="shield" size={18} />
              </span>
              <div className="mset-row-text">
                <b>Acceso a notificaciones</b>
                <small>{accessLabel}</small>
              </div>
            </div>
            <button className="mset-sheet-confirm" onClick={handleOpenSettings}>
              Abrir ajustes de notificaciones
            </button>

            <div className="mset-row">
              <span className="mset-row-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
                <Icon name="bell" size={18} />
              </span>
              <div className="mset-row-text">
                <b>Capturar notificaciones (modo prueba)</b>
                <small>Guarda en este dispositivo las notificaciones recibidas para revisarlas</small>
              </div>
              <label className="mset-toggle-wrap">
                <input type="checkbox" className="mset-toggle-input"
                  checked={inbox.enabled}
                  onChange={e => inbox.setEnabled(e.target.checked)} />
                <span className="mset-toggle" />
              </label>
            </div>

            <p className="mset-section-label" style={{ marginTop: 16 }}>
              Capturadas ({inbox.items.length})
            </p>
            {inbox.items.length === 0 ? (
              <p className="mset-legal-intro">Aún no se ha capturado ninguna notificación.</p>
            ) : (
              <div className="mset-card">
                {inbox.items.map(item => (
                  <div key={item.id} className="mset-row" style={{ alignItems: 'flex-start' }}>
                    <div className="mset-row-text">
                      <b>{item.title || '(sin título)'}</b>
                      <small style={{ whiteSpace: 'pre-wrap' }}>{item.text || '(sin texto)'}</small>
                      <small>{item.package} · {new Date(item.postTime).toLocaleString()}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inbox.items.length > 0 && (
              <button className="mset-sheet-danger" onClick={handleClear}>
                <Icon name="trash" size={16} /> Limpiar capturas
              </button>
            )}
          </div>
        </SettingsSheet>
      )}
    </>
  )
}
