import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { CURRENCIES, convertCurrency, getCurrencyMeta } from '@/data/currencies'
import { getRatesFetchedAt, syncExchangeRates } from '@/data/exchangeRates'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { dateLocale } from '@/data/helpers'
import { useT } from '@/i18n'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { useDialogA11y } from './useDialogA11y'
import type { CurrencyCode } from '@/types'

function fmtResult(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  })
}

/**
 * Calculadora de conversión de divisas con tasas en vivo.
 * Convierte entre las 9 monedas de la app usando el mismo motor de tasas
 * (open.er-api.com, cache 12h) que alimenta el resto de la aplicación.
 */
export function MobileCurrencyConverter({ onClose }: { onClose: () => void }) {
  const t = useT()
  const lang = useSettings(s => s.language)
  const appCurrency = useFinance(s => s.currency)
  useMobileBackDismiss(true, onClose)
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose)

  const [amountRaw, setAmountRaw] = useState('100')
  const [from, setFrom] = useState<CurrencyCode>(appCurrency)
  const [to, setTo] = useState<CurrencyCode>(appCurrency === 'USD' ? 'DOP' : 'USD')
  const [picker, setPicker] = useState<'from' | 'to' | null>(null)
  // Bump para re-renderizar cuando llegan tasas frescas (mutan CURRENCIES in place)
  const [, setRatesVersion] = useState(0)

  useEffect(() => {
    let alive = true
    void syncExchangeRates().then(changed => {
      if (alive && changed) setRatesVersion(v => v + 1)
    })
    return () => { alive = false }
  }, [])

  const amount = useMemo(() => {
    const parsed = Number(amountRaw.replace(',', '.'))
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN
  }, [amountRaw])

  const result = Number.isFinite(amount) ? convertCurrency(amount, from, to) : NaN
  const unitRate = convertCurrency(1, from, to)
  const fromMeta = getCurrencyMeta(from)
  const toMeta = getCurrencyMeta(to)
  const fetchedAt = getRatesFetchedAt()

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const pick = (code: CurrencyCode) => {
    if (picker === 'from') {
      if (code === to) setTo(from)
      setFrom(code)
    } else if (picker === 'to') {
      if (code === from) setFrom(to)
      setTo(code)
    }
    setPicker(null)
  }

  return (
    <div ref={dialogRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={t('converterTitle')} onClick={onClose}>
      <section className="mcur-sheet mconv-sheet" onClick={e => e.stopPropagation()}>
        <header>
          <span>{t('converterTitle')}</span>
          <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        {picker ? (
          <>
            <p className="mcur-subtitle">{picker === 'from' ? t('converterFrom') : t('converterTo')}</p>
            <div className="mcur-list">
              {CURRENCIES.map(c => {
                const selected = c.code === (picker === 'from' ? from : to)
                return (
                  <button key={c.code} className={`mcur-row${selected ? ' on' : ''}`} onClick={() => pick(c.code)}>
                    <span className="mcur-flag">{c.flag}</span>
                    <div className="mcur-info">
                      <strong>{c.code}</strong>
                      <small>{c.name}</small>
                    </div>
                    <div className="mcur-right">
                      {selected && <Icon name="check" size={16} style={{ color: 'var(--accent)' }} />}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="mcur-note">
              <button className="mconv-picker-back" onClick={() => setPicker(null)}>
                <Icon name="arrowUp" size={12} style={{ transform: 'rotate(-90deg)' }} /> {t('back')}
              </button>
            </p>
          </>
        ) : (
          <>
            <div className="mconv-body">
              <div className="mconv-field">
                <label htmlFor="mconv-amount">{t('converterAmount')}</label>
                <div className="mconv-amount-row">
                  <button className="mconv-currency-btn" onClick={() => setPicker('from')} aria-label={t('converterFrom')}>
                    <span className="mconv-flag">{fromMeta.flag}</span>
                    <strong>{from}</strong>
                    <Icon name="arrowDn" size={12} />
                  </button>
                  <input
                    id="mconv-amount"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amountRaw}
                    onChange={e => {
                      const next = e.target.value
                      if (/^[0-9]*[.,]?[0-9]*$/.test(next)) setAmountRaw(next)
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <button className="mconv-swap" onClick={swap} aria-label={t('converterSwap')}>
                <Icon name="refresh" size={18} />
              </button>

              <div className="mconv-field">
                <label>{t('converterTo')}</label>
                <div className="mconv-amount-row">
                  <button className="mconv-currency-btn" onClick={() => setPicker('to')} aria-label={t('converterTo')}>
                    <span className="mconv-flag">{toMeta.flag}</span>
                    <strong>{to}</strong>
                    <Icon name="arrowDn" size={12} />
                  </button>
                  <output className="mconv-result" htmlFor="mconv-amount">
                    <span className="mconv-result-symbol">{toMeta.symbol}</span>
                    {fmtResult(result)}
                  </output>
                </div>
              </div>

              <div className="mconv-rate-line">
                1 {from} = {toMeta.symbol}{fmtResult(unitRate)} {to}
              </div>
            </div>

            <p className="mcur-note">
              <Icon name="info" size={12} />
              {fetchedAt
                ? t('converterUpdated').replace('{date}', new Date(fetchedAt).toLocaleString(dateLocale(lang), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))
                : t('approxRatesNote')}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
