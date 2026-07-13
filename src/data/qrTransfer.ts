/**
 * Protocolo de transferencia de backup por códigos QR animados: sin red, sin
 * nube — el teléfono viejo muestra una secuencia de QR en pantalla y el
 * teléfono nuevo los escanea con la cámara hasta reunir todas las partes.
 * Mismo formato de backup que ya usa `data/backup.ts` (createBackup/parseBackup),
 * solo se parte el JSON en fragmentos que caben en un QR escaneable de forma
 * confiable con la cámara de un teléfono.
 */

/** Prefijo que identifica un frame de $harky (para ignorar QR ajenos al escanear). */
const PROTOCOL_PREFIX = 'SHKYQR1'
const SEPARATOR = '|'

export interface QrFrame {
  transferId: string
  index: number
  total: number
  chunk: string
}

/** Parte un texto en `total` fragmentos de máx. `chunkSize` caracteres cada uno. */
export function chunkPayload(payload: string, chunkSize: number): string[] {
  if (chunkSize <= 0) throw new Error('chunkSize debe ser mayor a 0')
  const chunks: string[] = []
  for (let i = 0; i < payload.length; i += chunkSize) {
    chunks.push(payload.slice(i, i + chunkSize))
  }
  return chunks.length ? chunks : ['']
}

/** Codifica un fragmento como el texto que va dentro del QR. */
export function encodeFrame(transferId: string, index: number, total: number, chunk: string): string {
  return [PROTOCOL_PREFIX, transferId, String(index), String(total), chunk].join(SEPARATOR)
}

/** Decodifica el texto leído de un QR escaneado. `null` si no es un frame válido de $harky. */
export function decodeFrame(raw: string): QrFrame | null {
  if (!raw.startsWith(PROTOCOL_PREFIX + SEPARATOR)) return null
  const rest = raw.slice(PROTOCOL_PREFIX.length + 1)
  const firstSep = rest.indexOf(SEPARATOR)
  if (firstSep === -1) return null
  const transferId = rest.slice(0, firstSep)
  const afterId = rest.slice(firstSep + 1)
  const secondSep = afterId.indexOf(SEPARATOR)
  if (secondSep === -1) return null
  const index = Number(afterId.slice(0, secondSep))
  const afterIndex = afterId.slice(secondSep + 1)
  const thirdSep = afterIndex.indexOf(SEPARATOR)
  if (thirdSep === -1) return null
  const total = Number(afterIndex.slice(0, thirdSep))
  const chunk = afterIndex.slice(thirdSep + 1)

  if (!transferId || !Number.isInteger(index) || !Number.isInteger(total) || index < 0 || total <= 0 || index >= total) {
    return null
  }
  return { transferId, index, total, chunk }
}

/** Genera todos los frames (texto listo para pasar al generador de QR) de un backup. */
export function buildTransferFrames(payload: string, chunkSize: number, transferId: string): string[] {
  const chunks = chunkPayload(payload, chunkSize)
  return chunks.map((chunk, index) => encodeFrame(transferId, index, chunks.length, chunk))
}

/** Estado acumulado de una recepción en curso: frames recibidos por índice. */
export class QrTransferReceiver {
  private transferId: string | null = null
  private total = 0
  private parts = new Map<number, string>()

  /** Procesa un frame escaneado. Devuelve true si aportó un frame nuevo. */
  addFrame(raw: string): boolean {
    const frame = decodeFrame(raw)
    if (!frame) return false
    if (this.transferId === null) {
      this.transferId = frame.transferId
      this.total = frame.total
    } else if (frame.transferId !== this.transferId) {
      // Frame de otra transferencia (ej. el usuario reinició del lado emisor) — reinicia.
      this.transferId = frame.transferId
      this.total = frame.total
      this.parts.clear()
    }
    if (this.parts.has(frame.index)) return false
    this.parts.set(frame.index, frame.chunk)
    return true
  }

  get receivedCount(): number {
    return this.parts.size
  }

  get totalCount(): number {
    return this.total
  }

  get isComplete(): boolean {
    return this.total > 0 && this.parts.size === this.total
  }

  /** Payload reconstruido si ya se recibieron todas las partes, si no `null`. */
  assemble(): string | null {
    if (!this.isComplete) return null
    let out = ''
    for (let i = 0; i < this.total; i++) {
      const part = this.parts.get(i)
      if (part === undefined) return null
      out += part
    }
    return out
  }
}
