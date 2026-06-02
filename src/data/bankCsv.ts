import type { Category, Transaction } from '@/types'

export type BankId = 'auto' | 'popular' | 'bhd' | 'banreservas' | 'scotiabank'

export interface Columns {
  date: string
  note: string
  amount?: string
  debit?: string
  credit?: string
}
export type CsvColumnKey = keyof Columns
export type CsvColumnMap = Partial<Columns>

export interface BankProfile {
  id: Exclude<BankId, 'auto'>
  label: string
  version: string
  kind: 'account' | 'credit-card' | 'mixed'
  notes: string
  hints: Partial<Record<CsvColumnKey, string[]>>
}

export interface CsvAnalysis {
  delimiter: string
  headers: string[]
  columns: CsvColumnMap
  missing: CsvColumnKey[]
  profile?: BankProfile
  confidence: number
  rowCount: number
}

export interface ImportedRow {
  date: string
  note: string
  amount: number
  type: 'income' | 'expense'
  categoryId?: string
  duplicate: boolean
  skipped?: boolean
}

const HEADER_HINTS: Record<CsvColumnKey, string[]> = {
  date: ['fecha', 'date', 'fecha transaccion', 'fecha de transaccion', 'fecha efectiva', 'fecha movimiento'],
  note: ['descripcion', 'description', 'concepto', 'detalle', 'referencia', 'comercio', 'transaccion', 'narrativa'],
  amount: ['monto', 'amount', 'importe', 'valor', 'monto rd$', 'monto dop'],
  debit: ['debito', 'debitos', 'cargo', 'retiro', 'consumo', 'pago realizado'],
  credit: ['credito', 'creditos', 'abono', 'deposito', 'pago recibido'],
}

export const BANKS: Record<Exclude<BankId, 'auto'>, BankProfile> = {
  popular: {
    id: 'popular',
    label: 'Banco Popular',
    version: 'popular-cuenta-v1',
    kind: 'mixed',
    notes: 'Cuentas y tarjetas con columnas de debito/credito o monto firmado.',
    hints: { note: ['descripcion', 'concepto', 'referencia'], debit: ['debito', 'cargo', 'consumo'], credit: ['credito', 'abono'] },
  },
  bhd: {
    id: 'bhd',
    label: 'BHD',
    version: 'bhd-cuenta-v1',
    kind: 'mixed',
    notes: 'Estados con columna monto o cargos/abonos separados.',
    hints: { note: ['descripcion', 'detalle', 'comercio'], amount: ['monto', 'valor'], debit: ['debito', 'retiro'], credit: ['credito', 'deposito'] },
  },
  banreservas: {
    id: 'banreservas',
    label: 'Banreservas',
    version: 'banreservas-cuenta-v1',
    kind: 'account',
    notes: 'Movimientos de cuenta con retiro/deposito y fecha de transaccion.',
    hints: { note: ['concepto', 'descripcion', 'narrativa'], debit: ['retiro', 'debito'], credit: ['deposito', 'credito'] },
  },
  scotiabank: {
    id: 'scotiabank',
    label: 'Scotiabank',
    version: 'scotiabank-cuenta-v1',
    kind: 'mixed',
    notes: 'Formato Scotiabank con importe firmado o cargos/abonos separados.',
    hints: { note: ['detalle', 'descripcion', 'referencia'], amount: ['importe', 'monto'] },
  },
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

export interface CategoryRule { pattern: string; categoryId: string }
export function listCategoryRules(): CategoryRule[] {
  return Object.entries(learnedRules()).map(([pattern, categoryId]) => ({ pattern, categoryId }))
}
export function saveCategoryRule(pattern: string, categoryId: string): void {
  const normalized = clean(pattern)
  if (!normalized || !categoryId) return
  localStorage.setItem(LEARNED_RULES_KEY, JSON.stringify({ ...learnedRules(), [normalized]: categoryId }))
}
export function deleteCategoryRule(pattern: string): void {
  const rules = learnedRules()
  delete rules[clean(pattern)]
  localStorage.setItem(LEARNED_RULES_KEY, JSON.stringify(rules))
}
export function learnCategoryRule(note: string, categoryId: string): void {
  try { saveCategoryRule(note, categoryId) }
  catch { /* Storage can be unavailable in private or test contexts. */ }
}

const splitCsvLine = (line: string, delimiter: string) => {
  const cells: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index++
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      cells.push(value.trim())
      value = ''
    } else {
      value += char
    }
  }
  cells.push(value.trim())
  return cells
}

const findHeader = (headers: string[], names: string[]) => headers.find(header => names.includes(clean(header)))

const parseNumber = (value = '') => {
  const trimmed = value.trim()
  const negative = /^\(.*\)$/.test(trimmed) || /\b(?:db|crg|cargo)\b/i.test(clean(trimmed))
  const normalized = trimmed.replace(/[^\d,.-]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '')
  const parsed = Number(normalized) || 0
  return negative && parsed > 0 ? -parsed : parsed
}

const normalizeDate = (value: string) => {
  const parts = value.trim().split(/[/-]/)
  if (parts.length !== 3) return value.trim()
  if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
}

export const transactionFingerprint = (tx: Pick<Transaction, 'date' | 'amount' | 'note'>) =>
  `${tx.date}|${Math.abs(tx.amount).toFixed(2)}|${clean(tx.note)}`

function parseCsv(csv: string) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error('El archivo CSV no contiene movimientos.')
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const headers = splitCsvLine(lines[0], delimiter)
  return { lines, delimiter, headers }
}

function scoreProfile(headers: string[], profile: BankProfile) {
  return (Object.keys(HEADER_HINTS) as CsvColumnKey[]).reduce((score, key) => {
    const names = [...(profile.hints[key] ?? []), ...HEADER_HINTS[key]]
    return score + (findHeader(headers, names) ? 1 : 0)
  }, 0)
}

function resolveProfile(headers: string[], bank: BankId): BankProfile | undefined {
  if (bank !== 'auto') return BANKS[bank]
  return Object.values(BANKS).sort((a, b) => scoreProfile(headers, b) - scoreProfile(headers, a))[0]
}

function detectColumns(headers: string[], bank: BankId, overrides: CsvColumnMap = {}): CsvColumnMap {
  const profile = resolveProfile(headers, bank)
  const hints = profile?.hints ?? {}
  const lookup = (key: CsvColumnKey) => overrides[key] || findHeader(headers, [...(hints[key] ?? []), ...HEADER_HINTS[key]])
  return {
    date: lookup('date') ?? '',
    note: lookup('note') ?? '',
    amount: lookup('amount'),
    debit: lookup('debit'),
    credit: lookup('credit'),
  }
}

function missingColumns(columns: CsvColumnMap): CsvColumnKey[] {
  const missing: CsvColumnKey[] = []
  if (!columns.date) missing.push('date')
  if (!columns.note) missing.push('note')
  if (!columns.amount && !columns.debit && !columns.credit) missing.push('amount')
  return missing
}

export function analyzeBankCsv(csv: string, bank: BankId = 'auto', overrides: CsvColumnMap = {}): CsvAnalysis {
  const { lines, delimiter, headers } = parseCsv(csv)
  const profile = resolveProfile(headers, bank)
  const columns = detectColumns(headers, bank, overrides)
  const missing = missingColumns(columns)
  const detected = (['date', 'note', 'amount', 'debit', 'credit'] as CsvColumnKey[]).filter(key => columns[key]).length
  return { delimiter, headers, columns, missing, profile, confidence: Math.round((detected / 5) * 100), rowCount: lines.length - 1 }
}

export function parseBankCsv(
  csv: string,
  existing: Transaction[],
  categories: Category[],
  bank: BankId = 'auto',
  overrides: CsvColumnMap = {},
): ImportedRow[] {
  const { lines, delimiter, headers } = parseCsv(csv)
  const columns = analyzeBankCsv(csv, bank, overrides).columns
  if (!columns.date || !columns.note || (!columns.amount && !columns.debit && !columns.credit)) {
    throw new Error('No pudimos detectar las columnas de fecha, monto y descripcion.')
  }

  const known = new Set(existing.map(transactionFingerprint))
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line, delimiter)
    const read = (header?: string) => header ? values[headers.indexOf(header)] ?? '' : ''
    const debit = Math.abs(parseNumber(read(columns.debit)))
    const credit = Math.abs(parseNumber(read(columns.credit)))
    const raw = parseNumber(read(columns.amount))
    const signed = columns.amount ? raw : credit - debit
    const note = read(columns.note).trim() || 'Movimiento importado'
    const date = normalizeDate(read(columns.date))
    const type = signed >= 0 ? 'income' as const : 'expense' as const
    const amount = Math.abs(signed)
    const rule = learnedRules()[clean(note)] ?? CATEGORY_RULES.find(([pattern]) => pattern.test(note))?.[1]
    const categoryId = categories.some(category => category.id === rule && category.type === type)
      ? rule
      : categories.find(category => category.type === type)?.id
    return { date, note, type, amount, categoryId, duplicate: known.has(transactionFingerprint({ date, amount, note })) }
  }).filter(row => row.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
}
