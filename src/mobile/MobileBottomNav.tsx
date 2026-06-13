import { useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'
import { playOpenSound } from '@/lib/sound'

export type MobileRoute = 'home' | 'analysis' | 'add' | 'accounts' | 'profile'
export type QuickAddMode = 'expense' | 'income'

type NavItem = { route: Exclude<MobileRoute, 'add'>; icon: Parameters<typeof Icon>[0]['name']; labelKey: 'home' | 'analysisTab' | 'accounts' | 'profile' }

const ITEMS: NavItem[] = [
  { route: 'home',     icon: 'grid',  labelKey: 'home' },
  { route: 'analysis', icon: 'chart', labelKey: 'analysisTab' },
  { route: 'accounts', icon: 'cards', labelKey: 'accounts' },
  { route: 'profile',  icon: 'settings', labelKey: 'profile' },
]

const LONG_PRESS_MS = 420

export function MobileBottomNav({ route, onRoute, onQuickAdd }: {
  route: MobileRoute
  onRoute: (route: MobileRoute) => void
  onQuickAdd?: (mode: QuickAddMode) => void
}) {
  const t = useT()
  const [quickMenu, setQuickMenu] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }
  const startPress = () => {
    longPressed.current = false
    cancelPress()
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      navigator.vibrate?.(20)
      setQuickMenu(true)
    }, LONG_PRESS_MS)
  }
  const endPress = () => {
    cancelPress()
    if (!longPressed.current) {
      playOpenSound()
      onRoute('add')
    }
  }

  const pickQuick = (mode: QuickAddMode) => {
    setQuickMenu(false)
    playOpenSound()
    onQuickAdd?.(mode)
  }

  return (
    <nav className="mobile-bottom-nav" aria-label={t('mainNavigation')}>
      {ITEMS.slice(0, 2).map(item => (
        <button key={item.route} className={route === item.route ? 'on' : ''}
          aria-current={route === item.route ? 'page' : undefined}
          onClick={() => onRoute(item.route)}>
          <Icon name={item.icon} size={21} />
          <span>{t(item.labelKey)}</span>
        </button>
      ))}

      <div className="mobile-add-fab-wrap">
        {quickMenu && (
          <>
            <div className="mobile-fab-menu-backdrop" onClick={() => setQuickMenu(false)} />
            <div className="mobile-fab-menu" role="menu">
              <button role="menuitem" className="expense" onClick={() => pickQuick('expense')}>
                <Icon name="arrowUp" size={15} style={{ transform: 'rotate(45deg)' }} /> {t('expense')}
              </button>
              <button role="menuitem" className="income" onClick={() => pickQuick('income')}>
                <Icon name="arrowUp" size={15} style={{ transform: 'rotate(-135deg)' }} /> {t('income')}
              </button>
            </div>
          </>
        )}
        <button className="mobile-add-fab" aria-label={t('add')}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={cancelPress}
          onContextMenu={e => e.preventDefault()}>
          <Icon name="plus" size={28} stroke={2.6} />
        </button>
      </div>

      {ITEMS.slice(2).map(item => (
        <button key={item.route} className={route === item.route ? 'on' : ''}
          aria-current={route === item.route ? 'page' : undefined}
          onClick={() => onRoute(item.route)}>
          <Icon name={item.icon} size={21} />
          <span>{t(item.labelKey)}</span>
        </button>
      ))}
    </nav>
  )
}
