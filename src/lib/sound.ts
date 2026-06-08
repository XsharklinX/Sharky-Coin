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

function volume(): number {
  const s = useSettings.getState()
  return s.soundsEnabled ? s.soundVolume : 0
}

function tone(freq: number, duration: number, { type = 'sine' as OscillatorType, gain = 0.05, delay = 0 } = {}) {
  const audio = getCtx()
  if (!audio) return
  const vol = volume()
  if (vol <= 0) return
  const osc  = audio.createOscillator()
  const amp  = audio.createGain()
  const start = audio.currentTime + delay
  osc.type = type
  osc.frequency.value = freq
  amp.gain.setValueAtTime(0, start)
  amp.gain.linearRampToValueAtTime(gain * vol, start + 0.008)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp)
  amp.connect(audio.destination)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

/** Tap limpio estilo teclado moderno: sine con pitch descent rápido + overtone suave. */
function tapClick(freq: number, gain = 0.35, vibrateMs = 8) {
  const audio = getCtx()
  if (!audio) return
  const vol = volume()
  if (vol <= 0) return
  if (vibrateMs > 0) navigator.vibrate?.(vibrateMs)
  const start = audio.currentTime

  // Tono principal con descenso de pitch (da sensación de "pulsación física")
  const osc = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, start)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, start + 0.07)
  amp.gain.setValueAtTime(0, start)
  amp.gain.linearRampToValueAtTime(gain * vol, start + 0.005)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.09)
  osc.connect(amp)
  amp.connect(audio.destination)
  osc.start(start)
  osc.stop(start + 0.11)

  // Overtone para dar cuerpo
  const osc2 = audio.createOscillator()
  const amp2 = audio.createGain()
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(freq * 2, start)
  amp2.gain.setValueAtTime(0, start)
  amp2.gain.linearRampToValueAtTime(gain * 0.18 * vol, start + 0.004)
  amp2.gain.exponentialRampToValueAtTime(0.0001, start + 0.05)
  osc2.connect(amp2)
  amp2.connect(audio.destination)
  osc2.start(start)
  osc2.stop(start + 0.07)
}

function enabled() {
  return useSettings.getState().soundsEnabled
}

/** Tecla numérica del teclado de montos */
export function playKeySound() {
  if (!enabled()) return
  tapClick(820, 0.35, 8)
}

/** Operadores (+, −, ×, ÷, .) — tap ligeramente más grave */
export function playOperatorSound() {
  if (!enabled()) return
  tapClick(660, 0.35, 10)
}

/** Borrar dígito — tap más agudo + vibración leve */
export function playBackspaceSound() {
  if (!enabled()) return
  tapClick(580, 0.3, 10)
}

/** Guardar / Listo — ding ascendente corto */
export function playDoneSound() {
  if (!enabled()) return
  tone(880, 0.1,  { gain: 0.32 })
  tone(1320, 0.15, { gain: 0.28, delay: 0.07 })
}

/** Abrir el flujo de "agregar" (botón + flotante) */
export function playOpenSound() {
  if (!enabled()) return
  tone(620, 0.07, { gain: 0.05 })
  tone(880, 0.08, { gain: 0.045, delay: 0.05 })
}

/** Abrir la sección de cuentas */
export function playAccountsSound() {
  if (!enabled()) return
  tone(740, 0.06, { type: 'triangle', gain: 0.045 })
  tone(1040, 0.09, { type: 'triangle', gain: 0.04, delay: 0.045 })
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
