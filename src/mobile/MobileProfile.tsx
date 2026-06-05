import { Icon } from '@/components/ui/Icon'
import type { ViewId } from '@/types'

export function MobileProfile({
  userName,
  onSettings,
  goto,
}: {
  userName?: string
  onSettings: () => void
  goto: (view: ViewId) => void
}) {
  return (
    <div className="mobile-profile">
      <section className="mobile-profile-card">
        <span className="mobile-profile-avatar">{(userName ?? '$harky').slice(0, 1).toUpperCase()}</span>
        <h2>{userName ?? 'Mi cuenta'}</h2>
        <p>Plan personal</p>
      </section>
      <section className="mobile-section-card mobile-internal-sections">
        <header>
          <div>
            <h2>Herramientas</h2>
            <p>Configuración y datos</p>
          </div>
        </header>
        <button onClick={onSettings}><Icon name="settings" size={20} />Configuración</button>
        <button onClick={() => goto('annual')}><Icon name="shark" size={20} />Reporte anual</button>
        <button onClick={() => goto('calendar')}><Icon name="calendar" size={20} />Calendario</button>
        <button onClick={onSettings}><Icon name="fileJson" size={20} />Backup</button>
      </section>
    </div>
  )
}
