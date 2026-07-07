/**
 * Heurísticas para reconocer y leer avisos de movimientos bancarios entre
 * todas las notificaciones del teléfono, sin depender de un paquete exacto
 * por banco (los nombres de paquete varían y cambian con el tiempo).
 */

/** Fragmentos típicos de nombres de paquete de apps bancarias/financieras. */
const BANK_PACKAGE_HINTS = [
  'bhd', 'banreservas', 'reservas', 'popular', 'scotiabank', 'scotia',
  'promerica', 'apap', 'vimenca', 'santacruz', 'caribe', 'citibank',
  'bancamovil', 'bankingapp', 'mibanco', 'bancodigital',
]

const AMOUNT_RE = /(?:RD\$|US\$|U\$D|DOP|USD)\s?([\d.,]+\d)/i
const TX_KEYWORD_RE = /transacci[oó]n|compra|retiro|dep[oó]sito|transferencia|pago|abono|cargo|consumo|tarjeta.*termina|saldo disponible|movimiento/i
const INCOME_KEYWORD_RE = /dep[oó]sito (recibido|acreditado)|abono (recibido|acreditado)|transferencia recibida|recibiste|acreditad[oa]|cr[eé]dito a su cuenta|ingreso/i
const MERCHANT_RE = /\ben\s+([A-ZÁÉÍÓÚÑ0-9][\w .,'&-]{2,40})/

/**
 * True si una notificación parece corresponder a un movimiento bancario:
 * viene de una app que reconocemos como financiera, o su contenido tiene
 * forma de aviso de transacción (monto en moneda + palabra clave).
 */
export function isBankNotification(pkg: string, title: string, text: string): boolean {
  const p = pkg.toLowerCase()
  if (BANK_PACKAGE_HINTS.some(hint => p.includes(hint))) return true
  const content = `${title} ${text}`
  return AMOUNT_RE.test(content) && TX_KEYWORD_RE.test(content)
}

export interface ParsedBankNotification {
  amount: number
  type: 'income' | 'expense'
  note: string
}

/** Extrae monto, tipo y comercio/descripción del texto de un aviso bancario. */
export function parseBankNotification(title: string, text: string): ParsedBankNotification | null {
  const content = `${title} ${text}`.trim()
  const amountMatch = content.match(AMOUNT_RE)
  if (!amountMatch) return null

  const amount = Number(amountMatch[1].replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null

  const type: ParsedBankNotification['type'] = INCOME_KEYWORD_RE.test(content) ? 'income' : 'expense'

  const merchantMatch = content.match(MERCHANT_RE)
  const note = merchantMatch ? merchantMatch[1].trim().replace(/[.,]+$/, '') : (title.trim() || 'Movimiento bancario')

  return { amount, type, note }
}
