import { useSettings } from '@/store/settings'

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, duration: number, { type = 'sine' as OscillatorType, gain = 0.05, delay = 0 } = {}) {
  const audio = getCtx()
  if (!audio) return
  const osc  = audio.createOscillator()
  const amp  = audio.createGain()
  const start = audio.currentTime + delay
  osc.type = type
  osc.frequency.value = freq
  amp.gain.setValueAtTime(0, start)
  amp.gain.linearRampToValueAtTime(gain, start + 0.008)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp)
  amp.connect(audio.destination)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

function enabled() {
  return useSettings.getState().soundsEnabled
}

/** Tecla numérica del teclado de montos */
export function playKeySound() {
  if (!enabled()) return
  tone(760, 0.045, { type: 'sine', gain: 0.045 })
}

/** Operadores (+, −, ×, ÷, .) — un timbre ligeramente más cálido */
export function playOperatorSound() {
  if (!enabled()) return
  tone(540, 0.05, { type: 'triangle', gain: 0.045 })
}

/** Borrar dígito */
export function playBackspaceSound() {
  if (!enabled()) return
  tone(320, 0.05, { type: 'sine', gain: 0.04 })
}

/** Abrir el flujo de "agregar" (botón + flotante) */
export function playOpenSound() {
  if (!enabled()) return
  tone(620, 0.07, { gain: 0.05 })
  tone(880, 0.08, { gain: 0.045, delay: 0.05 })
}

/** Confirmar / guardar (movimiento, categoría, meta, deuda…) */
export function playConfirmSound() {
  if (!enabled()) return
  tone(660, 0.09, { gain: 0.06 })
  tone(990, 0.14, { gain: 0.06, delay: 0.075 })
}

/** Eliminar */
export function playDeleteSound() {
  if (!enabled()) return
  tone(420, 0.06, { gain: 0.05 })
  tone(260, 0.1, { gain: 0.045, delay: 0.05 })
}

/** Logro: meta cumplida, deuda liquidada… */
export function playAchievementSound() {
  if (!enabled()) return
  tone(523.25, 0.1,  { gain: 0.06 })
  tone(659.25, 0.1,  { gain: 0.06, delay: 0.09 })
  tone(783.99, 0.18, { gain: 0.07, delay: 0.18 })
}
