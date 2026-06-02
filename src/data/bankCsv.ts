import type { Category, Transaction } from '@/types'

export type BankId = 'auto' | 'popular' | 'bhd' | 'banreservas' | 'scotiabank'

interface Columns {
  date: string
  note: string
  amount?: string
  debit?: string
  credit?: string
}

export interface ImportedRow {
  date: string
  note: string
  amount: number
  type: 'income' | 'expense'
  categoryId?: string
  duplicate: boolean
}

const HEADER_HINTS = {
  date: ['fecha', 'date', 'fecha transaccion', 'fecha de transaccion'],
  note: ['descripcion', 'description', 'concepto', 'detalle', 'referencia'],
  amount: ['monto', 'amount', 'importe', 'valor'],
  debit: ['debito', 'debitos', 'cargo', 'retiro'],
  credit: ['credito', 'creditos', 'abono', 'deposito'],
}

export const BANKS: Record<Exclude<BankId, 'auto'>, { label: string; hints: Partial<Record<keyof Columns, string[]>> }> = {
  popular: { label: 'Banco Popular', hints: { note: ['descripcion', 'concepto'], debit: ['debito'], credit: ['credito'] } },
  bhd: { label: 'BHD', hints: { note: ['descripcion', 'detalle'], amount: ['monto'] } },
  banreservas: { label: 'Banreservas', hints: { note: ['concepto', 'descripcion'], debit: ['retiro'], credit: ['deposito'] } },
  scotiabank: { label: 'Scotiabank', hints: { note: ['detalle', 'descripcion'], amount: ['importe'] } },
}

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/supermercado|jumbo|nacional|bravo|sirena|pricesmart/i, 'cat_super'],
  [/uber|combustible|gasolina|peaje|parqueo/i, 'cat_trans'],
  [/edesur|internet|claro|netflix|spotify|caasd/i, 'cat_serv'],
  [/restaurante|cafe|delivery|pedidosya|victorina/i, 'cat_rest'],
  [/farmacia|clinica|gimnasio|laboratorio/i, 'cat_salud'],
  [/nomina|salario|sueldo/i, 'cat_salario'],
]
const LEARNED_RULES_KEY = 'sharky-bank-rules-v1'

const clean = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
function learnedRules(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LEARNED_RULES_KEY) ?? '{}') as Record<string, string> }
  catch { return {} }
}
export function learnCategoryRule(note: string, categoryId: string): void {
  try { localStorage.setItem(LEARNED_RULES_KEY, JSON.stringify({ ...learnedRules(), [clean(note)]: categoryId })) }
  catch { /* Storage can be unavailable in private or test contexts. */ }
}
const splitCsvLine = (line: string, delimiter: string) => {
  const cells: string[] = []; let value = '', quoted = false
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index++ } else quoted = !quoted
    } else if (char === delimiter && !quoted) { cells.push(value.trim()); value = '' } else value += char
  }
  cells.push(value.trim())
  return cells
}

const findHeader = (headers: string[], names: string[]) => headers.find(header => names.includes(clean(header)))
const parseNumber = (value = '') => {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '')
  return Number(normalized) || 0
}
const normalizeDate = (value: string) => {
  const parts = value.trim().split(/[/-]/)
  if (parts.length !== 3) return value.trim()
  if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
}
export const transactionFingerprint = (tx: Pick<Transaction, 'date' | 'amount' | 'note'>) => `${tx.date}|${tx.amount.toFixed(2)}|${clean(tx.note)}`

export function parseBankCsv(csv: string, existing: Transaction[], categories: Category[], bank: BankId = 'auto'): ImportedRow[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error('El archivo CSV no contiene movimientos.')
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const headers = splitCsvLine(lines[0], delimiter)
  const hints = bank === 'auto' ? {} : BANKS[bank].hints
  const lookup = (key: keyof Columns) => findHeader(headers, [...(hints[key] ?? []), ...HEADER_HINTS[key]])
  const columns: Columns = { date: lookup('date') ?? '', note: lookup('note') ?? '', amount: lookup('amount'), debit: lookup('debit'), credit: lookup('credit') }
  if (!columns.date || !columns.note || (!columns.amount && !columns.debit && !columns.credit)) throw new Error('No pudimos detectar las columnas de fecha, monto y descripción.')
  const known = new Set(existing.map(transactionFingerprint))
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line, delimiter), read = (header?: string) => header ? values[headers.indexOf(header)] ?? '' : ''
    const debit = parseNumber(read(columns.debit)), credit = parseNumber(read(columns.credit)), raw = parseNumber(read(columns.amount))
    const signed = columns.amount ? raw : credit - debit
    const note = read(columns.note).trim() || 'Movimiento importado', date = normalizeDate(read(columns.date))
    const type = signed >= 0 ? 'income' as const : 'expense' as const, amount = Math.abs(signed)
    const rule = learnedRules()[clean(note)] ?? CATEGORY_RULES.find(([pattern]) => pattern.test(note))?.[1]
    const categoryId = categories.some(category => category.id === rule && category.type === type) ? rule : categories.find(category => category.type === type)?.id
    return { date, note, type, amount, categoryId, duplicate: known.has(transactionFingerprint({ date, amount, note })) }
  }).filter(row => row.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
}
