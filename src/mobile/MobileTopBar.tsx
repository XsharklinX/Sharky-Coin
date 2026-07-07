import { Icon } from '@/components/ui/Icon'
import { getCurrencyMeta } from '@/data/currencies'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import { MobileSyncBadge } from './MobileSyncBadge'
import { MobileMonthStrip } from './MobileMonthStrip'
import type { MobileRoute } from './MobileBottomNav'
import type { ViewId } from '@/types'

export function MobileTopBar({
  route,
  view,
  mkey,
  monthKeys,
  title,
  onBack,
  onMenu,
  onSelectMonth,
  onSettings,
  onCurrency,
  onCalendar,
  onSearch,
}: {
  route:        MobileRoute
  view:         ViewId
  mkey:         string
  monthKeys:    string[]
  title?:       string
  onBack?:      () => void
  onMenu?:      () => void
  onSelectMonth: (key: string) => void
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
    home:     t('movementsLabel'),
    analysis: t('analysisTab'),
    add:      t('add'),
    reports:  t('reports'),
    profile:  t('profile'),
  }

  const showMonth = route === 'home'
    || (route === 'analysis' && view === 'stats')
    || (route === 'reports' && (view === 'reports' || view === 'annual' || view === 'calendar'))
    || (route === 'profile' && view === 'budgets')
  const compactHeader = route === 'add'

  return (
    <header className="mobile-topbar">
      <div className={`mobile-topbar-row${route === 'home' && onMenu && !onBack ? ' mobile-topbar-row-home' : ''}`}>
        <div className="mobile-topbar-title-wrap">
          {onBack ? (
            <button className="mobile-icon-btn mobile-topbar-back" aria-label={t('back')} onClick={onBack}>
              <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          ) : route === 'home' && onMenu ? (
            <button className="mobile-icon-btn mobile-topbar-menu" aria-label={t('toolsLabel')} onClick={onMenu}>
              <Icon name="list" size={22} />
            </button>
          ) : null}
          <h1 className={route === 'home' && onMenu && !onBack ? 'mobile-topbar-home-title' : undefined}>
            {title ?? TITLES[route]}
          </h1>
        </div>
        <div className="mobile-topbar-right">
          {!compactHeader && (
            <>
              <MobileSyncBadge />
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
            </>
          )}
        </div>
      </div>

      {showMonth && (
        <MobileMonthStrip keys={monthKeys} active={mkey} locale={locale} onSelect={onSelectMonth} />
      )}
    </header>
  )
}
