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
    title: 'Registra gastos e ingresos',
    text:  'Toca el botón + para agregar cualquier movimiento. Categoría, cuenta, nota y fecha en segundos.',
  },
  {
    icon:  'target',
    color: '#a78bfa',
    title: 'Presupuestos y metas de ahorro',
    text:  'Pon límites de gasto por categoría y crea metas para lo que más te importa — vacaciones, emergencias, lo que sea.',
  },
  {
    icon:  'trend',
    color: '#5bc0ff',
    title: 'Analiza tu dinero',
    text:  'Informes mensuales, anuales, gráficos de gastos, calendario por día y calculadora para salir de deudas.',
  },
]

export function MobileWelcomeHub() {
  const startEmpty      = useFinance(s => s.startEmpty)
  const setDisplayName  = useSettings(s => s.setDisplayName)
  const [step, setStep] = useState(0) // 0 = welcome, 1-3 = slides, 4 = name
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(false)

  const begin = () => {
    const trimmed = name.trim()
    if (!trimmed) { setNameError(true); return }
    setDisplayName(trimmed)
    startEmpty()
  }

  /* ── Welcome ───────────────────────────────────────────── */
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
          {[1, 2, 3].map(i => (
            <span key={i} className="mwh-dot" />
          ))}
        </div>

        <div className="mobile-welcome-actions">
          <button className="mobile-welcome-primary" onClick={() => setStep(1)}>
            Conoce cómo funciona
            <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
          </button>
          <button className="mobile-welcome-ghost" onClick={() => setStep(4)}>
            Saltar tutorial
          </button>
          <p className="mobile-welcome-fine">Sin cuenta en la nube · Tus datos, 100% privados</p>
        </div>
      </div>
    )
  }

  /* ── Tutorial slides 1-3 ────────────────────────────────── */
  if (step >= 1 && step <= 3) {
    const slide = SLIDES[step - 1]
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
            {[1, 2, 3].map(i => (
              <span key={i} className={`mwh-dot${i === step ? ' on' : ''}`} />
            ))}
          </div>
          <h2>{slide.title}</h2>
          <p>{slide.text}</p>
        </div>

        <div className="mwh-slide-nav">
          <button className="mwh-nav-back" onClick={() => setStep(step - 1)}>
            <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
          </button>
          <button className="mobile-welcome-primary mwh-nav-next" onClick={() => setStep(step + 1)}>
            {step === 3 ? 'Continuar' : 'Siguiente'}
            <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>
      </div>
    )
  }

  /* ── Name input (step 4) ───────────────────────────────── */
  return (
    <div className="mobile-welcome-hub mwh-name-screen">
      <div className="mwh-name-brand">
        <BrandMark size={54} />
      </div>
      <h2>¿Cómo te llamas?</h2>
      <p className="mwh-name-hint">Tu nombre aparece en los informes y exportaciones. Puedes cambiarlo después.</p>
      <input
        className={`mwh-name-input${nameError ? ' error' : ''}`}
        type="text"
        value={name}
        placeholder="Tu nombre"
        autoCapitalize="words"
        autoCorrect="off"
        onChange={e => { setName(e.target.value); setNameError(false) }}
        onKeyDown={e => e.key === 'Enter' && begin()}
      />
      {nameError && <p className="mwh-name-error">Escribe tu nombre para continuar</p>}

      <div className="mwh-name-actions">
        <button className="mwh-nav-back" onClick={() => setStep(3)}>
          <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
        </button>
        <button className="mobile-welcome-primary mwh-nav-next" onClick={begin}>
          Comenzar <Icon name="check" size={16} />
        </button>
      </div>
    </div>
  )
}
