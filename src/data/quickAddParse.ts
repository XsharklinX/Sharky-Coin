/**
 * Convierte una frase en lenguaje natural — «gasté 500 en el súper ayer» — en
 * los campos de un movimiento, para poder anotarlo escribiendo en vez de tocar
 * monto, categoría y fecha por separado. Puro y testeable: solo propone, el
 * usuario revisa antes de guardar.
 */
import type { Category } from '@/types'
import { guessCategoryId } from './bankCsv'
import { localToday } from './helpers'

export interface QuickAddParsed {
  type: 'income' | 'expense'
  /** Monto detectado, o null si no había número reconocible. */
  amount: number | null
  /** Fecha YYYY-MM-DD (hoy si no se dijo otra cosa). */
  date: string
  /** Texto libre restante (el comercio/concepto), ya limpio de conectores. */
  note: string
  /** Categoría adivinada por las reglas, o undefined si ninguna encaja. */
  categoryId?: string
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Verbos/sustantivos que marcan un ingreso. Todo lo demás se asume gasto, que
// es lo que se anota el 90% de las veces.
const INCOME_WORDS = ['ingres', 'cobr', 'recib', 'gane', 'gané', 'deposit', 'salario', 'nomina', 'income', 'earned', 'received', 'salary']
const EXPENSE_WORDS = ['gast', 'pagu', 'pague', 'compr', 'spent', 'paid', 'bought']

// Conectores que sobran al quedarse con el concepto («en el súper» → «súper»).
const CONNECTORS = ['en el', 'en la', 'en los', 'en las', 'en', 'de', 'del', 'por', 'para', 'a', 'at', 'on', 'for', 'the', 'in', 'un', 'una', 'unos', 'unas', 'mi', 'el', 'la']

function parseAmount(raw: string): number {
  const normalized = raw.includes(',') && raw.includes('.')
    ? raw.replace(/,/g, '')
    : raw.replace(',', '.')
  return parseFloat(normalized)
}

/** Extrae el primer número (admite 1,000.50 / 1.000,50 / 500k). */
function extractAmount(text: string): { text: string; amount: number | null } {
  const kMatch = text.match(/(\d+(?:[.,]\d+)?)\s*k\b/i)
  if (kMatch) {
    const value = parseAmount(kMatch[1]) * 1000
    return { text: text.replace(kMatch[0], ' ').trim(), amount: value }
  }
  const match = text.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/)
  if (!match) return { text, amount: null }
  return { text: text.replace(match[0], ' ').trim(), amount: parseAmount(match[1]) }
}

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return localToday(d)
}

/** Reconoce hoy/ayer/antier y «el día N». Devuelve la fecha y el texto sin ella. */
function extractDate(text: string, today: string): { text: string; date: string } {
  if (/\b(anteayer|antier|day before yesterday)\b/.test(text)) {
    return { text: text.replace(/\b(anteayer|antier|day before yesterday)\b/, ' ').trim(), date: shift(today, -2) }
  }
  if (/\b(ayer|yesterday)\b/.test(text)) {
    return { text: text.replace(/\b(ayer|yesterday)\b/, ' ').trim(), date: shift(today, -1) }
  }
  if (/\b(hoy|today)\b/.test(text)) {
    return { text: text.replace(/\b(hoy|today)\b/, ' ').trim(), date: today }
  }
  // «el 5», «día 5» → ese día del mes en curso (si ya pasó, se deja igual;
  // corregirlo a mano es un toque y adivinar el mes anterior sorprende más).
  const dayMatch = text.match(/\b(?:el|dia|día|day)\s+(\d{1,2})\b/)
  if (dayMatch) {
    const day = Number(dayMatch[1])
    if (day >= 1 && day <= 31) {
      const [y, m] = today.split('-')
      return { text: text.replace(dayMatch[0], ' ').trim(), date: `${y}-${m}-${String(day).padStart(2, '0')}` }
    }
  }
  return { text, date: today }
}

function stripConnectors(text: string): string {
  let words = text.split(/\s+/).filter(Boolean)
  // Quita conectores solo de los extremos: «en el súper» → «súper», pero no
  // parte un concepto de varias palabras por dentro.
  const isConnector = (w: string) => CONNECTORS.includes(w)
  while (words.length && isConnector(words[0])) words = words.slice(1)
  while (words.length && isConnector(words[words.length - 1])) words = words.slice(0, -1)
  return words.join(' ')
}

export function parseQuickAdd(raw: string, categories: Category[], now = new Date()): QuickAddParsed {
  const today = localToday(now)
  let text = normalize(raw).replace(/\s+/g, ' ').trim()

  const type: 'income' | 'expense' =
    INCOME_WORDS.some(w => text.includes(w)) && !EXPENSE_WORDS.some(w => text.includes(w))
      ? 'income'
      : 'expense'

  // Quita el verbo detonante para que no ensucie el concepto.
  for (const word of [...INCOME_WORDS, ...EXPENSE_WORDS]) {
    text = text.replace(new RegExp(`\\b${word}\\w*\\b`, 'g'), ' ')
  }

  const afterAmount = extractAmount(text)
  const afterDate = extractDate(afterAmount.text, today)
  const note = stripConnectors(afterDate.text.replace(/\s+/g, ' ').trim())
  const categoryId = note ? guessCategoryId(note, categories, type, false) : undefined

  return { type, amount: afterAmount.amount, date: afterDate.date, note, categoryId }
}
