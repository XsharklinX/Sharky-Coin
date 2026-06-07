import { Icon } from '@/components/ui/Icon'
import { getCurrencyMeta } from '@/data/currencies'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
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
  const lang = useSettings(s => s.language)
  const locale = lang === 'es' ? 'es-DO' : 'en-US'
  const t = useT()

  const TITLES: Record<MobileRoute, string> = {
    home:      t('home'),
    analytics: t('analytics'),
    add:       t('add'),
    reports:   t('reports'),
    profile:   t('profile'),
  }

  const showMonth = route !== 'add' && route !== 'profile'
  const compactMonthLabel = (() => {
    const [y, m] = mkey.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  })()

  return (
    <header className="mobile-topbar">
      <button className="mobile-icon-btn" aria-label={t('menu')} onClick={onSearch}>
        <Icon name="menu" size={22} />
      </button>

      <div className="mobile-topbar-mid">
        <h1>{title ?? TITLES[route]}</h1>
        {showMonth && (
          <div className="mobile-month">
            <button aria-label="Mes anterior" disabled={!canGoBack} onClick={onPrevMonth}>
              <Icon name="arrowUp" size={13} style={{ transform: 'rotate(-90deg)' }} />
            </button>
            <span>{compactMonthLabel}</span>
            <button aria-label="Mes siguiente" disabled={!canGoForward} onClick={onNextMonth}>
              <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)' }} />
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
