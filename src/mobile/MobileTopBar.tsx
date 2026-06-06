import { Icon } from '@/components/ui/Icon'
import { monthLabel } from '@/data/helpers'
import { getCurrencyMeta } from '@/data/currencies'
import { useFinance } from '@/store/finance'
import { useT } from '@/i18n'
import type { MobileRoute } from './MobileBottomNav'

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
  const t = useT()

  const TITLES: Record<MobileRoute, string> = {
    home:      t('home'),
    movements: t('movements'),
    analytics: t('analytics'),
    add:       t('add'),
    reports:   t('reports'),
    profile:   t('profile'),
  }

  return (
    <header className="mobile-topbar">
      <button className="mobile-icon-btn" aria-label={t('search')} onClick={onSearch}>
        <Icon name="search" size={22} />
      </button>
      <div>
        <h1>{title ?? TITLES[route]}</h1>
        {route !== 'add' && route !== 'profile' && (
          <div className="mobile-month">
            <button aria-label="Previous month" disabled={!canGoBack} onClick={onPrevMonth}>
              <Icon name="arrowUp" size={15} style={{ transform: 'rotate(-90deg)' }} />
            </button>
            <span>{monthLabel(mkey)}</span>
            <button aria-label="Next month" disabled={!canGoForward} onClick={onNextMonth}>
              <Icon name="arrowUp" size={15} style={{ transform: 'rotate(90deg)' }} />
            </button>
          </div>
        )}
      </div>
      <div className="mobile-topbar-right">
        <button className="mobile-currency-btn" aria-label={t('currency')} onClick={onCurrency}>
          <span className="mobile-currency-flag">{meta.flag}</span>
          <span className="mobile-currency-code">{currency}</span>
        </button>
        <button className="mobile-icon-btn" aria-label={t('settings')} onClick={onSettings}>
          <Icon name="settings" size={21} />
        </button>
      </div>
    </header>
  )
}
