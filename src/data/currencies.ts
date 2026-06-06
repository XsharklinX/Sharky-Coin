import type { CurrencyCode } from '@/types'

export interface CurrencyMeta {
  code: CurrencyCode
  name: string
  symbol: string
  flag: string
  /** Rate: 1 USD = X of this currency */
  rateToUSD: number
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: 'DOP', name: 'Peso Dominicano', symbol: 'RD$', flag: '🇩🇴', rateToUSD: 58.5 },
  { code: 'USD', name: 'Dólar Americano', symbol: '$',   flag: '🇺🇸', rateToUSD: 1 },
  { code: 'EUR', name: 'Euro',            symbol: '€',   flag: '🇪🇺', rateToUSD: 0.92 },
  { code: 'MXN', name: 'Peso Mexicano',   symbol: 'MX$', flag: '🇲🇽', rateToUSD: 17.1 },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£',   flag: '🇬🇧', rateToUSD: 0.79 },
  { code: 'COP', name: 'Peso Colombiano', symbol: 'COP', flag: '🇨🇴', rateToUSD: 3950 },
  { code: 'ARS', name: 'Peso Argentino',  symbol: 'AR$', flag: '🇦🇷', rateToUSD: 900 },
  { code: 'BRL', name: 'Real Brasileño',  symbol: 'R$',  flag: '🇧🇷', rateToUSD: 5.0 },
  { code: 'CAD', name: 'Dólar Canadiense',symbol: 'CA$', flag: '🇨🇦', rateToUSD: 1.36 },
]

export function getCurrencyMeta(code: CurrencyCode): CurrencyMeta {
  return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0]!
}

/** Convert 1 unit of `from` into `to` */
export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  const fromMeta = getCurrencyMeta(from)
  const toMeta   = getCurrencyMeta(to)
  const usd = amount / fromMeta.rateToUSD
  return usd * toMeta.rateToUSD
}

export function fmtConversion(amount: number, from: CurrencyCode, to: CurrencyCode): string {
  const result = convertCurrency(amount, from, to)
  const meta = getCurrencyMeta(to)
  if (result >= 1_000_000) return `${meta.symbol}${(result / 1_000_000).toFixed(1)}M`
  if (result >= 1_000)     return `${meta.symbol}${(result / 1_000).toFixed(1)}k`
  return `${meta.symbol}${result.toFixed(2)}`
}
