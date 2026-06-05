import { Suspense } from 'react'
import type { ComponentType } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { ViewErrorBoundary } from '@/components/ui/ErrorBoundary'
import { monthLabel } from '@/data/helpers'
import { useSettings } from '@/store/settings'
import type { AuthUser } from '@/store/auth'
import type { CurrencyCode, IconName, ViewId, ViewProps } from '@/types'

type NavItem = { id: ViewId; label: string; icon: IconName }

export function DesktopShell({
  settings,
  user,
  nav,
  navGroups,
  view,
  setView,
  viewComponent: ViewComponent,
  viewProps,
  currency,
  setCurrency,
  mkey,
  keys,
  mIdx,
  setMkey,
  onSearch,
  onSettings,
  onCreate,
}: {
  settings: ReturnType<typeof useSettings.getState>
  user: AuthUser | null
  nav: NavItem[]
  navGroups: Array<{ label: string; items: NavItem[] }>
  view: ViewId
  setView: (view: ViewId) => void
  viewComponent: ComponentType<ViewProps>
  viewProps: ViewProps
  currency: CurrencyCode
  setCurrency: (currency: CurrencyCode) => void
  mkey: string
  keys: string[]
  mIdx: number
  setMkey: (mkey: string) => void
  onSearch: () => void
  onSettings: () => void
  onCreate: () => void
}) {
  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <BrandMark size={38} />
          </span>
          {settings.showSidebarLabels && (
            <span className="brand-name">
              <span style={{ color: 'var(--accent)' }}>$</span>harky
            </span>
          )}
        </div>

        <nav className="sidebar-nav">
          {navGroups.map(group => (
            <section className="nav-section" key={group.label}>
              {settings.showSidebarLabels && <p>{group.label}</p>}
              {group.items.map(item => (
                <button key={item.id}
                  className={`nav-item${view === item.id ? ' on' : ''}`}
                  onClick={() => setView(item.id)} title={`${item.label} (${nav.indexOf(item) + 1})`}>
                  <Icon name={item.icon} size={18} />
                  {settings.showSidebarLabels && <span>{item.label}</span>}
                </button>
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip" onClick={onSettings}
            role="button" tabIndex={0} title="Configuración"
            style={{ cursor: 'pointer' }}>
            <span className="avatar">
              {user ? user.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() : '⚙'}
            </span>
            {settings.showSidebarLabels && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name ?? 'Mi cuenta'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Plan Personal</div>
              </div>
            )}
            {settings.showSidebarLabels && (
              <Icon name="settings" size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            )}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{nav.find(item => item.id === view)?.label}</h1>
            <p>Hola {user?.name.split(/\s+/)[0] ?? 'bienvenido'}, este es tu resumen financiero.</p>
          </div>
          <div className="topbar-right">
            <button className="search-trigger" onClick={onSearch}
              title="Búsqueda global (Ctrl+K)">
              <Icon name="search" size={15} style={{ color: 'var(--text-dim)' }} />
              <span>Buscar...</span>
              <kbd>⌘K</kbd>
            </button>

            <select aria-label="Tema visual" className="select" value={settings.theme}
              onChange={event => settings.setTheme(event.target.value as typeof settings.theme)}
              style={{ fontSize: 12, padding: '6px 10px' }}>
              <option value="midnight">Oscuro</option>
              <option value="slate">Pizarra</option>
              <option value="carbon">Carbón</option>
              <option value="light">Claro</option>
            </select>

            <select className="select" value={currency} aria-label="Moneda"
              onChange={event => setCurrency(event.target.value as CurrencyCode)}
              style={{ fontSize: 12, padding: '6px 10px' }}>
              <option value="DOP">RD$ DOP</option>
              <option value="USD">US$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>

            <div className="month-nav">
              <button aria-label="Mes anterior" disabled={mIdx <= 0}
                onClick={() => mIdx > 0 && setMkey(keys[mIdx - 1])}>
                <Icon name="arrowUp" size={15} style={{ transform: 'rotate(-90deg)' }} />
              </button>
              <span>
                <Icon name="calendar" size={14} style={{ color: 'var(--text-dim)' }} />
                {monthLabel(mkey)}
              </span>
              <button aria-label="Mes siguiente" disabled={mIdx >= keys.length - 1}
                onClick={() => mIdx < keys.length - 1 && setMkey(keys[mIdx + 1])}>
                <Icon name="arrowUp" size={15} style={{ transform: 'rotate(90deg)' }} />
              </button>
            </div>

            <button className="btn-primary top-create-btn" onClick={onCreate}>
              <Icon name="plus" size={15} stroke={2.4} />Crear
            </button>
          </div>
        </header>

        <div className="scroll">
          <Suspense fallback={<div className="card card-copy">Cargando...</div>}>
            <ViewErrorBoundary resetKey={view}>
              <ViewComponent {...viewProps} />
            </ViewErrorBoundary>
          </Suspense>
        </div>
      </main>
    </>
  )
}
