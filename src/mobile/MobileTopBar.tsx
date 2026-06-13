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
  onSettings,
  onCurrency,
  onCalendar,
  onSearch,
}: {
  route:        MobileRoute
  mkey:         string
  title?:       string
  canGoBack:    boolean
  canGoForward: boolean
  onPrevMonth:  () => void
  onNextMonth:  () => void
  onSettings:   () => void
  onCurrency:   () => void
  onCalendar?:  () => void
  onSearch:     () => void
}) {
  const { currency } = useFinance()
  const meta = getCurrencyMeta(currency)
  const lang = useSettings(s => s.language)
  const locale = lang === 'es' ? 'es-DO' : 'en-US'
  const t = useT()

  const TITLES: Record<MobileRoute, string> = {
    home:     t('home'),
    analysis: t('analysisTab'),
    add:      t('add'),
    accounts: t('accounts'),
    profile:  t('profile'),
  }

  const showMonth = route === 'home' || route === 'analysis'
  const monthLabel = (() => {
    const [y, m] = mkey.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  })()

  return (
    <header className="mobile-topbar">
      <div className="mobile-topbar-row">
        <h1>{title ?? TITLES[route]}</h1>
        <div className="mobile-topbar-right">
          <button className="mobile-currency-btn" aria-label={t('currency')} onClick={onCurrency}>
            <span className="mobile-currency-flag">{meta.flag}</span>
            <span className="mobile-currency-code">{currency}</span>
          </button>
          {onCalendar && (
            <button className="mobile-icon-btn" aria-label={t('calendarLabel')} onClick={onCalendar}>
              <Icon name="calendar" size={21} />
            </button>
          )}
          <button className="mobile-icon-btn" aria-label={t('search')} onClick={onSearch}>
            <Icon name="search" size={21} />
          </button>
          <button className="mobile-icon-btn" aria-label={t('settings')} onClick={onSettings}>
            <Icon name="settings" size={21} />
          </button>
        </div>
      </div>

      {showMonth && (
        <div className="mobile-month">
          <button aria-label={t('prevMonth')} disabled={!canGoBack} onClick={onPrevMonth}>
            <Icon name="arrowUp" size={14} style={{ transform: 'rotate(-90deg)' }} />
          </button>
          <span className="mobile-month-label">
            <Icon name="calendar" size={14} />
            {monthLabel}
          </span>
          <button aria-label={t('nextMonth')} disabled={!canGoForward} onClick={onNextMonth}>
            <Icon name="arrowUp" size={14} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>
      )}
    </header>
  )
}
