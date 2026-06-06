import { Icon } from '@/components/ui/Icon'
import { monthLabel } from '@/data/helpers'
import { getCurrencyMeta } from '@/data/currencies'
import { useFinance } from '@/store/finance'
import type { MobileRoute } from './MobileBottomNav'

const TITLES: Record<MobileRoute, string> = {
  home:      'Inicio',
  movements: 'Movimientos',
  analytics: 'Gráficos',
  add:       'Agregar',
  reports:   'Informes',
  profile:   'Perfil',
}

export function MobileTopBar({
  route,
  mkey,
  title,
  canGoBack,
  canGoForward,
  onPrevMonth,
  onNextMonth,
  onSearch,
  onSettings,
  onCurrency,
}: {
  route:        MobileRoute
  mkey:         string
  title?:       string
  canGoBack:    boolean
  canGoForward: boolean
  onPrevMonth:  () => void
  onNextMonth:  () => void
  onSearch:     () => void
  onSettings:   () => void
  onCurrency:   () => void
}) {
  const { currency } = useFinance()
  const meta = getCurrencyMeta(currency)

  return (
    <header className="mobile-topbar">
      <button className="mobile-icon-btn" aria-label="Buscar" onClick={onSearch}>
        <Icon name="search" size={22} />
      </button>
      <div>
        <h1>{title ?? TITLES[route]}</h1>
        {route !== 'add' && route !== 'profile' && (
          <div className="mobile-month">
            <button aria-label="Mes anterior" disabled={!canGoBack} onClick={onPrevMonth}>
              <Icon name="arrowUp" size={15} style={{ transform: 'rotate(-90deg)' }} />
            </button>
            <span>{monthLabel(mkey)}</span>
            <button aria-label="Mes siguiente" disabled={!canGoForward} onClick={onNextMonth}>
              <Icon name="arrowUp" size={15} style={{ transform: 'rotate(90deg)' }} />
            </button>
          </div>
        )}
      </div>
      <div className="mobile-topbar-right">
        <button className="mobile-currency-btn" aria-label="Cambiar moneda" onClick={onCurrency}>
          <span className="mobile-currency-flag">{meta.flag}</span>
          <span className="mobile-currency-code">{currency}</span>
        </button>
        <button className="mobile-icon-btn" aria-label="Configuración" onClick={onSettings}>
          <Icon name="settings" size={21} />
        </button>
      </div>
    </header>
  )
}
