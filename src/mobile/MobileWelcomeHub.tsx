import { useState } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'

// ── Mini-mockup illustrations ─────────────────────────────

function IllustrationRegister() {
  return (
    <div className="mwh-illus">
      <div className="mwh-illus-header">
        <span className="mwh-illus-badge expense">Gasto</span>
        <span className="mwh-illus-badge income">Ingreso</span>
      </div>
      <div className="mwh-illus-amount" style={{ color: '#ff6b8a' }}>
        <span>RD$</span>
        <strong>1,250<span className="mwh-illus-cursor" /></strong>
      </div>
      <div className="mwh-illus-cats">
        {([
          { label: 'Supermercado', color: '#2dd4bf', on: true  },
          { label: 'Restaurantes', color: '#f59e0b', on: false },
          { label: 'Transporte',   color: '#38bdf8', on: false },
        ] as const).map(c => (
          <span key={c.label} className={`mwh-illus-cat${c.on ? ' on' : ''}`}
            style={{ '--cc': c.color } as React.CSSProperties}>
            {c.label}
          </span>
        ))}
      </div>
      <div className="mwh-illus-keypad">
        {['1','2','3','4','5','6','7','8','9','.','.0'].map(k => (
          <span key={k} className="mwh-illus-key">{k}</span>
        ))}
        <span className="mwh-illus-key done"><Icon name="check" size={14} /></span>
      </div>
    </div>
  )
}

function IllustrationAccounts() {
  const accs = [
    { name: 'BHD Cuenta',  type: 'Débito',  amount: '45,200',  color: '#35d0a2', pos: true  },
    { name: 'Efectivo',    type: 'Efectivo', amount: '3,800',   color: '#f59e0b', pos: true  },
    { name: 'Visa Gold',   type: 'Crédito',  amount: '−12,500', color: '#a78bfa', pos: false },
  ]
  return (
    <div className="mwh-illus">
      <div className="mwh-illus-balance-head">
        <span>Balance total</span>
        <strong style={{ color: '#35d0a2' }}>RD$ 36,500</strong>
      </div>
      <div className="mwh-illus-acc-list">
        {accs.map(acc => (
          <div key={acc.name} className="mwh-illus-acc-row" style={{ '--cc': acc.color } as React.CSSProperties}>
            <span className="mwh-illus-acc-dot" />
            <div className="mwh-illus-acc-info">
              <b>{acc.name}</b>
              <small>{acc.type}</small>
            </div>
            <strong className={acc.pos ? 'pos' : 'neg'}>RD$ {acc.amount}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function IllustrationBudgets() {
  const items = [
    { name: 'Supermercado', pct: 68, color: '#35d0a2', used: '6,800',  of: '10,000' },
    { name: 'Restaurantes', pct: 92, color: '#f59e0b', used: '4,600',  of: '5,000'  },
    { name: 'Transporte',   pct: 45, color: '#5bc0ff', used: '2,250',  of: '5,000'  },
  ]
  return (
    <div className="mwh-illus">
      {items.map(b => (
        <div key={b.name} className="mwh-illus-budget">
          <div className="mwh-illus-budget-head">
            <span>{b.name}</span>
            <span style={{ color: b.pct >= 90 ? '#ff6b8a' : '#a7a7a7', fontWeight: 700 }}>{b.pct}%</span>
          </div>
          <div className="mwh-illus-track">
            <div className="mwh-illus-fill" style={{ width: `${b.pct}%`, background: b.pct >= 90 ? '#ff6b8a' : b.color }} />
          </div>
          <div className="mwh-illus-budget-sub">RD$ {b.used} <span>/ {b.of}</span></div>
        </div>
      ))}
      <div className="mwh-illus-goal">
        <span className="mwh-illus-goal-icon"><Icon name="target" size={16} /></span>
        <div>
          <b>Fondo emergencia</b>
          <div className="mwh-illus-track" style={{ marginTop: 4 }}>
            <div className="mwh-illus-fill" style={{ width: '54%', background: '#a78bfa' }} />
          </div>
        </div>
        <span style={{ color: '#a78bfa', fontWeight: 800, fontSize: 12 }}>54%</span>
      </div>
    </div>
  )
}

function IllustrationAnalytics() {
  const heights = [55, 72, 40, 88, 62, 95, 48]
  const labels  = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  return (
    <div className="mwh-illus">
      <div className="mwh-illus-chart">
        {heights.map((h, i) => (
          <div key={i} className="mwh-illus-bar-col">
            <div className="mwh-illus-bar" style={{ height: `${h}%` }} />
            <span>{labels[i]}</span>
          </div>
        ))}
      </div>
      <div className="mwh-illus-stats">
        <div className="mwh-illus-stat">
          <small>Ingresos</small>
          <strong style={{ color: '#35d0a2' }}>RD$ 65,000</strong>
        </div>
        <div className="mwh-illus-stat">
          <small>Gastos</small>
          <strong style={{ color: '#ff6b8a' }}>RD$ 41,200</strong>
        </div>
        <div className="mwh-illus-stat">
          <small>Tasa ahorro</small>
          <strong style={{ color: '#ffdd3d' }}>36.6%</strong>
        </div>
      </div>
    </div>
  )
}

// ── Slides data ───────────────────────────────────────────

const SLIDES = [
  {
    color: '#35d0a2',
    title: 'Registra en segundos',
    text:  'Toca el botón + para agregar un gasto o ingreso. Elige la categoría, la cuenta y escribe una nota — todo en menos de 10 segundos.',
    Illustration: IllustrationRegister,
  },
  {
    color: '#5bc0ff',
    title: 'Todas tus cuentas en un lugar',
    text:  'Agrega tu banco, efectivo, ahorros o tarjeta de crédito. $harky actualiza el balance de cada cuenta automáticamente.',
    Illustration: IllustrationAccounts,
  },
  {
    color: '#a78bfa',
    title: 'Presupuestos y metas de ahorro',
    text:  'Pon un límite mensual por categoría y crea metas de ahorro para lo que más importa: vacaciones, emergencias, lo que sea.',
    Illustration: IllustrationBudgets,
  },
  {
    color: '#ffdd3d',
    title: 'Analiza, exporta y respalda',
    text:  'Informes mensuales y anuales, gráficos, calendario por día y calculadora de deudas. Exporta en PDF o Excel, y haz backup para no perder nada.',
    Illustration: IllustrationAnalytics,
  },
] as const

const TOTAL = SLIDES.length
const NAME_STEP = TOTAL + 1

// ── Main component ────────────────────────────────────────

export function MobileWelcomeHub() {
  const startEmpty        = useFinance(s => s.startEmpty)
  const { setDisplayName, markOnboardingSeen, displayName } = useSettings()
  const isExistingUser    = !!localStorage.getItem('sharky-finance-v2')

  const [step, setStep]   = useState(0)
  const [name, setName]   = useState(displayName || '')
  const [nameError, setNameError] = useState(false)

  const finish = () => {
    const trimmed = name.trim()
    // For new users the name is required
    if (!isExistingUser && !trimmed) { setNameError(true); return }
    if (trimmed) setDisplayName(trimmed)
    if (!isExistingUser) startEmpty()
    markOnboardingSeen()
  }

  const skipAll = () => {
    if (!isExistingUser) startEmpty()
    markOnboardingSeen()
  }

  const nextStep = () => setStep(s => Math.min(s + 1, NAME_STEP))
  const prevStep = () => setStep(s => Math.max(s - 1, 0))

  /* ── Welcome ─────────────────────────────────────────── */
  if (step === 0) {
    return (
      <div className="mobile-welcome-hub">
        <div className="mobile-welcome-top">
          <div className="mobile-welcome-glow" />
          <div className="mobile-welcome-brand">
            <BrandMark size={72} />
            <h1><span className="mobile-welcome-dollar">$</span>harky</h1>
          </div>
          <p className="mobile-welcome-tagline">Tus finanzas, claras<br />como el agua</p>
        </div>

        <div className="mwh-dots">
          {SLIDES.map((_, i) => <span key={i} className="mwh-dot" />)}
        </div>

        <div className="mobile-welcome-actions">
          <button className="mobile-welcome-primary" onClick={() => setStep(1)}>
            Cómo funciona
            <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
          </button>
          <button className="mobile-welcome-ghost" onClick={skipAll}>
            {isExistingUser ? 'Entendido, ya sé usarla' : 'Saltar tutorial'}
          </button>
          <p className="mobile-welcome-fine">Sin cuenta en la nube · Tus datos, 100% privados</p>
        </div>
      </div>
    )
  }

  /* ── Tutorial slides ─────────────────────────────────── */
  if (step >= 1 && step <= TOTAL) {
    const { color, title, text, Illustration } = SLIDES[step - 1]
    const isLast = step === TOTAL
    return (
      <div className="mobile-welcome-hub mwh-slide-screen">
        <div className="mwh-slide-visual" style={{ '--slide-color': color } as React.CSSProperties}>
          <div className="mwh-slide-glow" />
          <Illustration />
        </div>

        <div className="mwh-slide-body">
          <div className="mwh-dots">
            {SLIDES.map((_, i) => (
              <span key={i} className={`mwh-dot${i + 1 === step ? ' on' : ''}`} />
            ))}
          </div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>

        <div className="mwh-slide-nav">
          <button className="mwh-nav-back" onClick={prevStep} aria-label="Anterior">
            <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
          </button>
          <button className="mobile-welcome-primary mwh-nav-next" onClick={nextStep}>
            {isLast ? 'Continuar' : 'Siguiente'}
            <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>
      </div>
    )
  }

  /* ── Name step (step = NAME_STEP) ────────────────────── */
  return (
    <div className="mobile-welcome-hub mwh-name-screen">
      <div className="mwh-name-brand">
        <BrandMark size={54} />
      </div>
      <h2>¿Cómo te llamas?</h2>
      <p className="mwh-name-hint">
        Tu nombre aparece en tu perfil y en los informes exportados.
        {isExistingUser && ' Puedes dejarlo como está.'}
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
        <button className="mwh-nav-back" onClick={prevStep} aria-label="Atrás">
          <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
        </button>
        <button className="mobile-welcome-primary mwh-nav-next" onClick={finish}>
          {isExistingUser ? 'Guardar y entrar' : 'Comenzar'}
          <Icon name="check" size={16} />
        </button>
      </div>
    </div>
  )
}
