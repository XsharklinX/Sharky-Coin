/**
 * Lógica pura para ingerir un movimiento detectado en un aviso bancario:
 * deduplicar (llegan 2-3 notificaciones del mismo consumo) y resolver a qué
 * cuenta pertenece. Sin React ni stores — testeable en aislamiento.
 */
import type { Account } from '@/types'

/** Ventana en la que dos avisos con la misma firma se consideran EL MISMO
 *  movimiento. Los correos duplicados llegan en segundos/1-2 min; dos consumos
 *  distintos del mismo monto suelen estar más separados. */
export const DEDUP_WINDOW_MS = 4 * 60_000

export interface ProcessedMovement {
  key: string
  postTime: number
}

/**
 * Firma de identidad de un movimiento para deduplicar: tipo + monto + tarjeta.
 * Si no hay tarjeta, cae al paquete de la app (dos correos del mismo banco).
 * Incluir la tarjeta evita fusionar dos recargas iguales en tarjetas distintas,
 * pero permite unir el mismo consumo reenviado a varias bandejas de correo.
 */
export function movementDedupKey(
  type: 'income' | 'expense',
  amount: number,
  cardLast4: string | undefined,
  pkg: string,
): string {
  return `${type}:${Math.round(amount)}:${cardLast4 ?? pkg}`
}

/** true si ya se procesó un movimiento con la misma firma dentro de la ventana. */
export function isDuplicateMovement(
  processed: ProcessedMovement[],
  key: string,
  postTime: number,
  windowMs: number = DEDUP_WINDOW_MS,
): boolean {
  return processed.some(p => p.key === key && Math.abs(p.postTime - postTime) < windowMs)
}

/**
 * A qué cuenta pertenece un movimiento detectado. Los últimos 4 dígitos mandan
 * (señal más fiable y la que pidió el usuario); si no resuelven, se usa el mapeo
 * por app bancaria que el usuario confirmó antes. `undefined` si no se puede
 * decidir sin ambigüedad — ahí conviene preguntar en vez de adivinar.
 */
export function resolveDetectedAccount(
  accounts: Account[],
  packageAccountMap: Record<string, string>,
  cardLast4: string | undefined,
  pkg: string,
): Account | undefined {
  if (cardLast4) {
    const byCard = accounts.filter(a => a.last4 === cardLast4)
    if (byCard.length === 1) return byCard[0]
  }
  const mappedId = packageAccountMap[pkg]
  if (!mappedId) return undefined
  return accounts.find(a => a.id === mappedId)
}
