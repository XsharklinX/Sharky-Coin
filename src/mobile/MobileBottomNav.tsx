import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'

export type MobileRoute = 'home' | 'analytics' | 'add' | 'reports' | 'profile'

type NavItem = { route: Exclude<MobileRoute, 'add'>; icon: Parameters<typeof Icon>[0]['name'] }

const ITEMS: NavItem[] = [
  { route: 'home',      icon: 'grid'  },
  { route: 'analytics', icon: 'chart' },
  { route: 'reports',   icon: 'list'  },
  { route: 'profile',   icon: 'settings' },
]

export function MobileBottomNav({ route, onRoute }: {
  route: MobileRoute
  onRoute: (route: MobileRoute) => void
}) {
  const t = useT()
  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      {ITEMS.slice(0, 2).map(item => (
        <button key={item.route} className={route === item.route ? 'on' : ''}
          aria-current={route === item.route ? 'page' : undefined}
          onClick={() => onRoute(item.route)}>
          <Icon name={item.icon} size={21} />
          <span>{t(item.route as Parameters<typeof t>[0])}</span>
        </button>
      ))}
      <button className="mobile-add-fab" aria-label={t('add')} onClick={() => onRoute('add')}>
        <Icon name="plus" size={28} stroke={2.6} />
      </button>
      {ITEMS.slice(2).map(item => (
        <button key={item.route} className={route === item.route ? 'on' : ''}
          aria-current={route === item.route ? 'page' : undefined}
          onClick={() => onRoute(item.route)}>
          <Icon name={item.icon} size={21} />
          <span>{t(item.route as Parameters<typeof t>[0])}</span>
        </button>
      ))}
    </nav>
  )
}
