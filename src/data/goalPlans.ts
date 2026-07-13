import { localToday } from './helpers'
import type { RecurrenceFrequency } from '@/types'

/**
 * Matemática pura de los planes de ahorro de Metas (fijo y reto incremental)
 * y de la calculadora inversa. Sin dependencias de UI, para poder testearla.
 */

export interface RampPlan {
  /** Número de aportes hasta alcanzar (o superar) la meta. */
  periods: number
  /** Total acumulado tras esos aportes. */
  total: number
  /** Primeros 3 montos, para vista previa (50 → 75 → 100 → …). */
  first: [number, number, number]
}

const MAX_PERIODS = 520 // 10 años semanales — corta series que nunca llegan

/**
 * Reto incremental: aportes que crecen `increment` cada vez, empezando en
 * `firstAmount`, hasta cubrir `target`. Si `target <= 0` devuelve solo la
 * secuencia inicial (sin meta que alcanzar).
 */
export function rampPlan(firstAmount: number, increment: number, target: number): RampPlan | null {
  if (firstAmount <= 0) return null
  const first: [number, number, number] = [
    firstAmount,
    firstAmount + increment,
    firstAmount + 2 * increment,
  ]
  let periods = 0
  let total = 0
  while ((target <= 0 || total < target) && periods < MAX_PERIODS) {
    total += firstAmount + periods * increment
    periods += 1
    if (target <= 0 && periods >= 3) break
  }
  return { periods, total, first }
}

/** Próxima fecha (YYYY-MM-DD) que cae en `weekday` (0=Dom … 6=Sáb), nunca hoy. */
export function nextWeekdayDate(fromISO: string, weekday: number): string {
  const d = new Date(`${fromISO}T00:00:00`)
  const diff = ((weekday - d.getDay() + 7) % 7) || 7
  d.setDate(d.getDate() + diff)
  return localToday(d)
}

/** Aportes (semanales o mensuales) que caben entre `fromISO` y `deadlineISO`, ambos exclusive-hoy/inclusive-fecha. */
export function periodsUntil(fromISO: string, deadlineISO: string, frequency: RecurrenceFrequency): number {
  const from = new Date(`${fromISO}T00:00:00`).getTime()
  const to = new Date(`${deadlineISO}T00:00:00`).getTime()
  if (to <= from) return 0
  const days = Math.floor((to - from) / 86400000)
  return frequency === 'weekly' ? Math.floor(days / 7) : Math.floor(days / 30)
}

/**
 * Calculadora inversa: cuánto aportar por período para llegar a `target`
 * partiendo de `saved`, antes de `deadlineISO`. `null` si ya se alcanzó la
 * meta o si no cabe ni un aporte antes de la fecha.
 */
export function requiredContribution(
  target: number,
  saved: number,
  deadlineISO: string,
  frequency: RecurrenceFrequency,
  fromISO: string,
): { amount: number; periods: number } | null {
  const remaining = target - saved
  if (remaining <= 0) return null
  const periods = periodsUntil(fromISO, deadlineISO, frequency)
  if (periods <= 0) return null
  // Redondeo hacia arriba al entero: mejor sobrar un poco que quedarse corto.
  return { amount: Math.ceil(remaining / periods), periods }
}
