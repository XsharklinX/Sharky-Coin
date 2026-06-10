import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useSettings } from '@/store/settings'
import { isTauri } from '@/hooks/useTauri'
import { checkBiometric } from '@/lib/biometric'
import { PatternPad } from '../PatternPad'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'

type LockStep =
  | 'menu'
  | 'verify-pin' | 'verify-pattern'
  | 'choose'
  | 'pin-enter' | 'pin-confirm'
  | 'pattern-enter' | 'pattern-confirm'

export function SettingsSecurity({ activeSheet, onOpen, onClose }: SheetProps) {
  const settings = useSettings()
  const [bioAvailable, setBioAvailable] = useState(false)
  const hasLock = !!(settings.appPin || settings.appPattern)

  const [lockStep, setLockStep] = useState<LockStep>('menu')
  const [afterVerify, setAfterVerify] = useState<'choose' | 'remove'>('choose')
  const [pinValue, setPinValue] = useState('')
  const [pinDraft, setPinDraft] = useState('')
  const [patternDraft, setPatternDraft] = useState<string | null>(null)
  const [lockError, setLockError] = useState('')
  const [shake, setShake] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isTauri()) checkBiometric().then(s => setBioAvailable(s.available))
  }, [])

  useEffect(() => {
    if (activeSheet !== 'pin') resetLockFlow()
  }, [activeSheet])

  function resetLockFlow() {
    setLockStep(hasLock ? 'menu' : 'choose')
    setAfterVerify('choose')
    setPinValue('')
    setPinDraft('')
    setPatternDraft(null)
    setLockError('')
    setShake(false)
    setSuccess(false)
  }

  function openLockSheet() {
    resetLockFlow()
    onOpen('pin')
  }

  function triggerShake(message: string) {
    setLockError(message)
    setShake(true)
    navigator.vibrate?.([20, 40, 20])
    setTimeout(() => setShake(false), 380)
  }

  function removeLock() {
    settings.setAppPin(null)
    settings.setAppPattern(null)
    toast('Bloqueo de la app desactivado', { icon: 'trash' })
    setTimeout(onClose, 200)
  }

  // ── PIN: usado para verificar el PIN actual y para crear uno nuevo ──
  const pressPinDigit = (digit: string) => {
    if (lockError) setLockError('')
    setPinValue(v => {
      if (v.length >= 4) return v
      const next = v + digit
      if (next.length === 4) setTimeout(() => handlePinComplete(next), 100)
      return next
    })
  }
  const backspacePin = () => { if (lockError) setLockError(''); setPinValue(v => v.slice(0, -1)) }

  function handlePinComplete(value: string) {
    if (lockStep === 'verify-pin') {
      if (value === settings.appPin) {
        setPinValue('')
        if (afterVerify === 'remove') removeLock()
        else setLockStep('choose')
      } else {
        setPinValue('')
        triggerShake('PIN incorrecto')
      }
    } else if (lockStep === 'pin-enter') {
      setPinDraft(value)
      setPinValue('')
      setLockStep('pin-confirm')
    } else if (lockStep === 'pin-confirm') {
      if (value === pinDraft) {
        settings.setAppPin(value)
        toast('PIN configurado', { icon: 'check', type: 'ok' })
        setTimeout(onClose, 250)
      } else {
        setPinValue('')
        setPinDraft('')
        setLockStep('pin-enter')
        triggerShake('Los PIN no coinciden, intenta de nuevo')
      }
    }
  }

  // ── Patrón: usado para verificar el patrón actual y para crear uno nuevo ──
  function handlePatternComplete(value: string | null) {
    if (lockStep === 'verify-pattern') {
      if (value && value === settings.appPattern) {
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          if (afterVerify === 'remove') removeLock()
          else setLockStep('choose')
        }, 180)
      } else {
        triggerShake('Patrón incorrecto')
      }
    } else if (lockStep === 'pattern-enter') {
      if (!value) { triggerShake('Dibuja un patrón de al menos 4 puntos'); return }
      setPatternDraft(value)
      setSuccess(true)
      setTimeout(() => { setSuccess(false); setLockStep('pattern-confirm') }, 180)
    } else if (lockStep === 'pattern-confirm') {
      if (value && value === patternDraft) {
        settings.setAppPattern(value)
        toast('Patrón configurado', { icon: 'check', type: 'ok' })
        setTimeout(onClose, 250)
      } else {
        setPatternDraft(null)
        setLockStep('pattern-enter')
        triggerShake(value ? 'Los patrones no coinciden, intenta de nuevo' : 'Dibuja un patrón de al menos 4 puntos')
      }
    }
  }

  const lockValue = settings.appPattern ? 'Patrón' : settings.appPin ? 'PIN' : 'Desactivado'

  const stepCopy: Partial<Record<LockStep, string>> = {
    'verify-pin':      'Ingresa tu PIN actual para continuar.',
    'verify-pattern':  'Dibuja tu patrón actual para continuar.',
    'pin-enter':       'Crea un PIN de 4 dígitos para bloquear la app.',
    'pin-confirm':     'Confirma tu nuevo PIN.',
    'pattern-enter':   'Dibuja un nuevo patrón (mínimo 4 puntos).',
    'pattern-confirm': 'Dibuja el patrón nuevamente para confirmar.',
  }

  const renderPinPad = () => (
    <>
      <div className="mpin-dots" style={{ justifyContent: 'center', margin: '4px 0 18px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className={`mpin-dot${i < pinValue.length ? ' on' : ''}${shake ? ' err' : ''}`} />
        ))}
      </div>
      <div className="mpin-keypad">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button key={d} onClick={() => pressPinDigit(d)}>{d}</button>
        ))}
        <span />
        <button onClick={() => pressPinDigit('0')}>0</button>
        <button aria-label="Borrar" onClick={backspacePin}><Icon name="close" size={18} /></button>
      </div>
    </>
  )

  return (
    <>
      <div className="mset-section">
        <div className="mset-section-label">Seguridad</div>
        <div className="mset-card">
          {isTauri() && (
            <div className="mset-row">
              <span className="mset-row-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
                <Icon name="lock" size={18} />
              </span>
              <div className="mset-row-text">
                <b>Requerir biometría</b>
                <small>
                  {!bioAvailable ? 'No disponible en este dispositivo'
                    : !hasLock ? 'Configura un PIN o patrón para activarla'
                    : 'Huella o rostro al abrir la app'}
                </small>
              </div>
              <label className="mset-toggle-wrap">
                <input type="checkbox" className="mset-toggle-input"
                  checked={settings.requireBiometric}
                  disabled={!bioAvailable || !hasLock}
                  onChange={e => settings.setRequireBiometric(e.target.checked)} />
                <span className="mset-toggle" />
              </label>
            </div>
          )}
          <SettingsRow icon="key" iconColor="#ffdd3d" label="Bloqueo de la app"
            value={lockValue}
            onClick={openLockSheet} />
        </div>
      </div>

      {activeSheet === 'pin' && (
        <SettingsSheet title="Bloqueo de la app" onClose={onClose}>
          <div className="mset-sheet-body">
            {lockStep === 'menu' && (
              <>
                <p className="mset-legal-intro">
                  Tu app está protegida con {settings.appPattern ? 'un patrón' : 'un PIN de 4 dígitos'}.
                  Puedes cambiarlo o quitarlo.
                </p>
                <button className="mset-sheet-confirm"
                  onClick={() => { setAfterVerify('choose'); setLockStep(settings.appPin ? 'verify-pin' : 'verify-pattern') }}>
                  Cambiar método de bloqueo
                </button>
                <button className="mset-sheet-danger"
                  onClick={() => { setAfterVerify('remove'); setLockStep(settings.appPin ? 'verify-pin' : 'verify-pattern') }}>
                  <Icon name="trash" size={16} /> Desactivar bloqueo
                </button>
              </>
            )}

            {lockStep === 'choose' && (
              <>
                <p className="mset-legal-intro">Elige cómo quieres bloquear la app.</p>
                <button className="mset-sheet-confirm" onClick={() => setLockStep('pin-enter')}>
                  <Icon name="key" size={16} /> PIN de 4 dígitos
                </button>
                <button className="mset-sheet-confirm" onClick={() => setLockStep('pattern-enter')}>
                  <Icon name="grid" size={16} /> Patrón
                </button>
              </>
            )}

            {(lockStep === 'verify-pin' || lockStep === 'pin-enter' || lockStep === 'pin-confirm') && (
              <>
                <p className="mset-legal-intro">{stepCopy[lockStep]}</p>
                <p style={{ color: lockError ? '#ff6b8a' : 'var(--m-muted)', fontSize: 13, minHeight: 18, textAlign: 'center' }}>
                  {lockError || ' '}
                </p>
                {renderPinPad()}
              </>
            )}

            {(lockStep === 'verify-pattern' || lockStep === 'pattern-enter' || lockStep === 'pattern-confirm') && (
              <>
                <p className="mset-legal-intro">{stepCopy[lockStep]}</p>
                <p style={{ color: lockError ? '#ff6b8a' : 'var(--m-muted)', fontSize: 13, minHeight: 18, textAlign: 'center' }}>
                  {lockError || ' '}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px' }}>
                  <PatternPad onComplete={handlePatternComplete} shake={shake} success={success} />
                </div>
              </>
            )}
          </div>
        </SettingsSheet>
      )}
    </>
  )
}
