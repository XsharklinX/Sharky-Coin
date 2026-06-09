import { useState } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { IconName } from '@/types'

const SLIDES: Array<{ icon: IconName; color: string; title: string; text: string }> = [
  {
    icon:  'chart',
    color: '#35d0a2',
    title: 'Registra en segundos',
    text:  'Toca el botón + para agregar un gasto o ingreso. Elige la categoría, la cuenta y escribe una nota — todo en menos de 10 segundos.',
  },
  {
    icon:  'cards',
    color: '#5bc0ff',
    title: 'Todas tus cuentas en un lugar',
    text:  'Agrega tu cuenta bancaria, efectivo, ahorros o tarjeta de crédito. $harky lleva el balance de cada una automáticamente al registrar movimientos.',
  },
  {
    icon:  'target',
    color: '#a78bfa',
    title: 'Presupuestos y metas de ahorro',
    text:  'Pon un límite mensual por categoría (Comida, Transporte, etc.) y crea metas de ahorro para lo que más te importa: un viaje, un fondo de emergencia, lo que sea.',
  },
  {
    icon:  'trend',
    color: '#ffdd3d',
    title: 'Analiza, exporta y respalda',
    text:  'Informes mensuales y anuales, gráficos de gastos, calendario por día y calculadora de deudas. Exporta en PDF o Excel, y haz backup para no perder nada.',
  },
]

const TOTAL_SLIDES = SLIDES.length

export function MobileWelcomeHub() {
  const startEmpty         = useFinance(s => s.startEmpty)
  const { setDisplayName, markOnboardingSeen, displayName } = useSettings()
  // True when user already has finance data (existing user who just updated the app)
  const isExistingUser     = !!localStorage.getItem('sharky-finance-v2')

  const [step, setStep]    = useState(0) // 0 = welcome, 1..N = slides, N+1 = name (new users only)
  const [name, setName]    = useState(displayName || '')
  const [nameError, setNameError] = useState(false)

  const LAST_SLIDE = TOTAL_SLIDES  // step number of the last slide
  const NAME_STEP  = TOTAL_SLIDES + 1

  const finish = () => {
    const trimmed = name.trim()
    if (!isExistingUser && !trimmed) { setNameError(true); return }
    if (trimmed) setDisplayName(trimmed)
    if (!isExistingUser) startEmpty()
    markOnboardingSeen()
  }

  const nextStep = () => {
    if (step < LAST_SLIDE) { setStep(step + 1); return }
    // After last slide
    if (isExistingUser) { finish(); return }  // existing user: just close
    setStep(NAME_STEP)                        // new user: go to name step
  }

  const prevStep = () => setStep(Math.max(0, step - 1))

  /* ── Welcome screen ─────────────────────────────────────── */
  if (step === 0) {
    return (
      <div className="mobile-welcome-hub">
        <div className="mobile-welcome-top">
          <div className="mobile-welcome-glow" />
          <div className="mobile-welcome-brand">
            <BrandMark size={72} />
            <h1><span className="mobile-welcome-dollar">$</span>harky</h1>
          </div>
          <p className="mobile-welcome-tagline">
            Tus finanzas, claras<br />como el agua
          </p>
        </div>

        <div className="mwh-dots">
          {SLIDES.map((_, i) => (
            <span key={i} className="mwh-dot" />
          ))}
        </div>

        <div className="mobile-welcome-actions">
          <button className="mobile-welcome-primary" onClick={() => setStep(1)}>
            Cómo funciona
            <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
          </button>
          <button className="mobile-welcome-ghost" onClick={finish}>
            {isExistingUser ? 'Entendido, continuar' : 'Saltar tutorial'}
          </button>
          <p className="mobile-welcome-fine">Sin cuenta en la nube · Tus datos, 100% privados</p>
        </div>
      </div>
    )
  }

  /* ── Tutorial slides ────────────────────────────────────── */
  if (step >= 1 && step <= LAST_SLIDE) {
    const slide = SLIDES[step - 1]
    const isLast = step === LAST_SLIDE
    return (
      <div className="mobile-welcome-hub mwh-slide-screen">
        <div className="mwh-slide-visual" style={{ '--slide-color': slide.color } as React.CSSProperties}>
          <div className="mwh-slide-glow" />
          <div className="mwh-slide-icon-wrap">
            <Icon name={slide.icon} size={56} />
          </div>
        </div>

        <div className="mwh-slide-body">
          <div className="mwh-dots">
            {SLIDES.map((_, i) => (
              <span key={i} className={`mwh-dot${i + 1 === step ? ' on' : ''}`} />
            ))}
          </div>
          <h2>{slide.title}</h2>
          <p>{slide.text}</p>
        </div>

        <div className="mwh-slide-nav">
          <button className="mwh-nav-back" onClick={prevStep} aria-label="Anterior">
            <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
          </button>
          <button className="mobile-welcome-primary mwh-nav-next" onClick={nextStep}>
            {isLast
              ? (isExistingUser ? 'Entendido' : 'Continuar')
              : 'Siguiente'}
            <Icon name="arrowUp" size={16} style={{ transform: isLast && isExistingUser ? 'none' : 'rotate(90deg)' }} />
          </button>
        </div>
      </div>
    )
  }

  /* ── Name step (new users only) ─────────────────────────── */
  return (
    <div className="mobile-welcome-hub mwh-name-screen">
      <div className="mwh-name-brand">
        <BrandMark size={54} />
      </div>
      <h2>¿Cómo te llamas?</h2>
      <p className="mwh-name-hint">
        Tu nombre aparece en los informes exportados y en tu perfil. Puedes cambiarlo después desde Perfil.
      </p>
      <input
        className={`mwh-name-input${nameError ? ' error' : ''}`}
        type="text"
        value={name}
        placeholder="Tu nombre"
        autoCapitalize="words"
        autoCorrect="off"
        onChange={e => { setName(e.target.value); setNameError(false) }}
        onKeyDown={e => e.key === 'Enter' && finish()}
      />
      {nameError && <p className="mwh-name-error">Escribe tu nombre para continuar</p>}

      <div className="mwh-name-actions">
        <button className="mwh-nav-back" onClick={() => setStep(LAST_SLIDE)} aria-label="Atrás">
          <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
        </button>
        <button className="mobile-welcome-primary mwh-nav-next" onClick={finish}>
          Comenzar <Icon name="check" size={16} />
        </button>
      </div>
    </div>
  )
}
