import type { CurrencyCode } from '@/types'
import { CURRENCIES as DISPLAY_CURRENCIES } from './currencies'
import { CURRENCIES as FORMAT_CURRENCIES } from './seed'

const CODES: CurrencyCode[] = ['DOP', 'USD', 'EUR', 'MXN', 'GBP', 'COP', 'ARS', 'BRL', 'CAD']
const CACHE_KEY = 'sharky-fx-rates-v1'
const TTL_MS = 12 * 60 * 60 * 1000 // refrescar cada 12h

type UsdRates = Partial<Record<CurrencyCode, number>>

interface RatesCache {
  fetchedAt: number
  rates: UsdRates
}

function readCache(): RatesCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as RatesCache) : null
  } catch {
    return null
  }
}

function writeCache(rates: UsdRates) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), rates }))
  } catch {
    // localStorage no disponible (modo privado, cuota llena, etc.) — seguimos sin cache
  }
}

async function fetchLiveRates(): Promise<UsdRates | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) return null
    const data = await res.json() as { result?: string; rates?: Record<string, number> }
    if (data.result !== 'success' || !data.rates) return null
    const out: UsdRates = {}
    for (const code of CODES) {
      const rate = data.rates[code]
      if (typeof rate === 'number') out[code] = rate
    }
    return out
  } catch {
    return null
  }
}

/**
 * Las tasas se guardan como "1 USD = X moneda". `seed.ts` formatea relativo a
 * DOP (rate = X moneda / X DOP), `currencies.ts` relativo a USD — se derivan
 * ambas de la misma respuesta para que no queden desincronizadas.
 */
function applyRates(rates: UsdRates): boolean {
  const dopPerUsd = rates.DOP
  if (!dopPerUsd) return false

  let changed = false
  for (const meta of DISPLAY_CURRENCIES) {
    const r = rates[meta.code]
    if (r && meta.rateToUSD !== r) {
      meta.rateToUSD = r
      changed = true
    }
  }
  for (const code of Object.keys(FORMAT_CURRENCIES) as CurrencyCode[]) {
    const r = rates[code]
    if (!r) continue
    const rate = r / dopPerUsd
    if (FORMAT_CURRENCIES[code].rate !== rate) {
      FORMAT_CURRENCIES[code].rate = rate
      changed = true
    }
  }
  return changed
}

/** Aplica tasas en cache (si hay) y, si están vencidas o no existen, busca tasas frescas. */
export async function syncExchangeRates(): Promise<boolean> {
  const cached = readCache()
  let changed = cached ? applyRates(cached.rates) : false

  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return changed

  const fresh = await fetchLiveRates()
  if (!fresh) return changed

  writeCache(fresh)
  return applyRates(fresh) || changed
}
