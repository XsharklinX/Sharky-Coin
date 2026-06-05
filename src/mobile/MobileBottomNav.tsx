import { Icon } from '@/components/ui/Icon'

export type MobileRoute = 'home' | 'movements' | 'analytics' | 'add' | 'reports' | 'profile'

const ITEMS: Array<{ route: Exclude<MobileRoute, 'add' | 'movements'>; label: string; icon: Parameters<typeof Icon>[0]['name'] }> = [
  { route: 'home', label: 'Inicio', icon: 'grid' },
  { route: 'analytics', label: 'Gráficos', icon: 'chart' },
  { route: 'reports', label: 'Informes', icon: 'list' },
  { route: 'profile', label: 'Perfil', icon: 'settings' },
]

export function MobileBottomNav({ route, onRoute }: {
  route: MobileRoute
  onRoute: (route: MobileRoute) => void
}) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegación móvil">
      {ITEMS.slice(0, 2).map(item => (
        <button key={item.route} className={route === item.route ? 'on' : ''}
          aria-current={route === item.route ? 'page' : undefined}
          onClick={() => onRoute(item.route)}>
          <Icon name={item.icon} size={21} />
          <span>{item.label}</span>
        </button>
      ))}
      <button className="mobile-add-fab" aria-label="Agregar" onClick={() => onRoute('add')}>
        <Icon name="plus" size={28} stroke={2.6} />
      </button>
      {ITEMS.slice(2).map(item => (
        <button key={item.route} className={route === item.route ? 'on' : ''}
          aria-current={route === item.route ? 'page' : undefined}
          onClick={() => onRoute(item.route)}>
          <Icon name={item.icon} size={21} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
