import { useEffect, useState } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { CURRENCIES } from '@/data/currencies'
import { checkBiometric } from '@/lib/biometric'
import { isTauri } from '@/hooks/useTauri'
import { useT, translateCategoryName } from '@/i18n'
import { MobileOnboarding } from './MobileOnboarding'
import type { CurrencyCode } from '@/types'

// ── Mini-mockup illustrations ─────────────────────────────

function IllustrationRegister() {
  const t = useT()
  const lang = useSettings(s => s.language)
  return (
    <div className="mwh-illus">
      <div className="mwh-illus-header">
        <span className="mwh-illus-badge expense">{t('expense')}</span>
        <span className="mwh-illus-badge income">{t('income')}</span>
      </div>
      <div className="mwh-illus-amount" style={{ color: '#ff6b8a' }}>
        <span>RD$</span>
        <strong>1,250<span className="mwh-illus-cursor" /></strong>
      </div>
      <div className="mwh-illus-cats">
        {([
          { id: 'cat_super', label: 'Supermercado', color: '#2dd4bf', on: true  },
          { id: 'cat_rest',  label: 'Restaurantes', color: '#f59e0b', on: false },
          { id: 'cat_trans', label: 'Transporte',   color: '#38bdf8', on: false },
        ] as const).map(c => (
          <span key={c.id} className={`mwh-illus-cat${c.on ? ' on' : ''}`}
            style={{ '--cc': c.color } as React.CSSProperties}>
            {translateCategoryName({ id: c.id, name: c.label }, lang)}
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
  const t = useT()
  const accs = [
    { name: t('bhdAccountName'), type: t('debit'), amount: '45,200',  color: '#35d0a2', pos: true  },
    { name: t('cash'),           type: t('cash'),  amount: '3,800',   color: '#f59e0b', pos: true  },
    { name: 'Visa Gold',         type: t('credit'), amount: '−12,500', color: '#a78bfa', pos: false },
  ]
  return (
    <div className="mwh-illus">
      <div className="mwh-illus-balance-head">
        <span>{t('totalBalance')}</span>
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
  const t = useT()
  const lang = useSettings(s => s.language)
  const items = [
    { id: 'cat_super', name: 'Supermercado', pct: 68, color: '#35d0a2', used: '6,800',  of: '10,000' },
    { id: 'cat_rest',  name: 'Restaurantes', pct: 92, color: '#f59e0b', used: '4,600',  of: '5,000'  },
    { id: 'cat_trans', name: 'Transporte',   pct: 45, color: '#5bc0ff', used: '2,250',  of: '5,000'  },
  ] as const
  return (
    <div className="mwh-illus">
      {items.map(b => (
        <div key={b.id} className="mwh-illus-budget">
          <div className="mwh-illus-budget-head">
            <span>{translateCategoryName({ id: b.id, name: b.name }, lang)}</span>
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
          <b>{t('emergencyFund')}</b>
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
  const t = useT()
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
          <small>{t('incomes')}</small>
          <strong style={{ color: '#35d0a2' }}>RD$ 65,000</strong>
        </div>
        <div className="mwh-illus-stat">
          <small>{t('expenses')}</small>
          <strong style={{ color: '#ff6b8a' }}>RD$ 41,200</strong>
        </div>
        <div className="mwh-illus-stat">
          <small>{t('savingsRate')}</small>
          <strong style={{ color: '#ffdd3d' }}>36.6%</strong>
        </div>
      </div>
    </div>
  )
}

// ── Slides data ───────────────────────────────────────────

function getSlides(t: ReturnType<typeof useT>) {
  return [
    {
      color: '#35d0a2',
      title: t('slide1Title'),
      text:  t('slide1Text'),
      Illustration: IllustrationRegister,
    },
    {
      color: '#5bc0ff',
      title: t('slide2Title'),
      text:  t('slide2Text'),
      Illustration: IllustrationAccounts,
    },
    {
      color: '#a78bfa',
      title: t('slide3Title'),
      text:  t('slide3Text'),
      Illustration: IllustrationBudgets,
    },
    {
      color: '#ffdd3d',
      title: t('slide4Title'),
      text:  t('slide4Text'),
      Illustration: IllustrationAnalytics,
    },
  ] as const
}

const TOTAL = 4
const NAME_STEP = TOTAL + 1
const CURRENCY_STEP = NAME_STEP + 1
const ACCOUNT_STEP = CURRENCY_STEP + 1
const SECURITY_STEP = ACCOUNT_STEP + 1

// ── Main component ────────────────────────────────────────

export function MobileWelcomeHub() {
  const startEmpty        = useFinance(s => s.startEmpty)
  const setCurrency       = useFinance(s => s.setCurrency)
  const { setDisplayName, markOnboardingSeen, displayName, setAppPin, setRequireBiometric } = useSettings()
  const isExistingUser    = !!localStorage.getItem('sharky-finance-v2')

  const [step, setStep]   = useState(0)
  const [name, setName]   = useState(displayName || '')
  const [nameError, setNameError] = useState(false)
  const [currency, setCurrencyChoice] = useState<CurrencyCode>('DOP')
  const t = useT()
  const SLIDES = getSlides(t)

  const [securityStep, setSecurityStep] = useState<'ask' | 'pin-enter' | 'pin-confirm' | 'biometric'>('ask')
  const [pinValue, setPinValue] = useState('')
  const [pinDraft, setPinDraft] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinShake, setPinShake] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)

  useEffect(() => {
    if (isTauri()) checkBiometric().then(s => setBioAvailable(s.available))
  }, [])

  const finish = () => {
    const trimmed = name.trim()
    // For existing users the name is optional
    if (trimmed) setDisplayName(trimmed)
    markOnboardingSeen()
  }

  const goToCurrency = () => {
    const trimmed = name.trim()
    if (!trimmed) { setNameError(true); return }
    setDisplayName(trimmed)
    startEmpty()
    nextStep()
  }

  const finishNewUser = () => {
    markOnboardingSeen()
  }

  const skipAll = () => {
    if (!isExistingUser) startEmpty()
    markOnboardingSeen()
  }

  const nextStep = () => setStep(s => Math.min(s + 1, SECURITY_STEP))
  const prevStep = () => setStep(s => Math.max(s - 1, 0))

  // ── PIN setup (security step) ─────────────────────────
  const pressPinDigit = (digit: string) => {
    if (pinError) setPinError('')
    setPinValue(v => {
      if (v.length >= 4) return v
      const next = v + digit
      if (next.length === 4) setTimeout(() => handlePinComplete(next), 100)
      return next
    })
  }
  const backspacePin = () => { if (pinError) setPinError(''); setPinValue(v => v.slice(0, -1)) }

  const triggerPinShake = (message: string) => {
    setPinError(message)
    setPinShake(true)
    navigator.vibrate?.([20, 40, 20])
    setTimeout(() => setPinShake(false), 380)
  }

  function handlePinComplete(value: string) {
    if (securityStep === 'pin-enter') {
      setPinDraft(value)
      setPinValue('')
      setSecurityStep('pin-confirm')
    } else if (securityStep === 'pin-confirm') {
      if (value === pinDraft) {
        setAppPin(value)
        setPinValue('')
        if (bioAvailable) setSecurityStep('biometric')
        else finishNewUser()
      } else {
        setPinValue('')
        setPinDraft('')
        setSecurityStep('pin-enter')
        triggerPinShake(t('pinMismatch'))
      }
    }
  }

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
          <p className="mobile-welcome-tagline">{t('welcomeTaglineLine1')}<br />{t('welcomeTaglineLine2')}</p>
        </div>

        <div className="mwh-dots">
          {SLIDES.map((_, i) => <span key={i} className="mwh-dot" />)}
        </div>

        <div className="mobile-welcome-actions">
          <button className="mobile-welcome-primary" onClick={() => setStep(1)}>
            {t('howItWorks')}
            <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
          </button>
          <button className="mobile-welcome-ghost" onClick={skipAll}>
            {isExistingUser ? t('gotItKnowHow') : t('skipTutorial')}
          </button>
          <p className="mobile-welcome-fine">{t('noCloudPrivacy')}</p>
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
          <button className="mwh-nav-back" onClick={prevStep} aria-label={t('previous')}>
            <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
          </button>
          <button className="mobile-welcome-primary mwh-nav-next" onClick={nextStep}>
            {isLast ? t('continueBtn') : t('next')}
            <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>
      </div>
    )
  }

  /* ── Name step (step = NAME_STEP) ────────────────────── */
  if (step === NAME_STEP) {
    const onContinue = isExistingUser ? finish : goToCurrency
    return (
      <div className="mobile-welcome-hub mwh-name-screen">
        <div className="mwh-name-brand">
          <BrandMark size={54} />
        </div>
        <h2>{t('whatsYourName')}</h2>
        <p className="mwh-name-hint">
          {t('nameHint')}
          {isExistingUser && t('nameHintExisting')}
        </p>
        <input
          className={`mwh-name-input${nameError ? ' error' : ''}`}
          type="text"
          value={name}
          placeholder={t('yourNamePlaceholder')}
          autoCapitalize="words"
          autoCorrect="off"
          onChange={e => { setName(e.target.value); setNameError(false) }}
          onKeyDown={e => e.key === 'Enter' && onContinue()}
        />
        {nameError && <p className="mwh-name-error">{t('nameRequiredError')}</p>}

        <div className="mwh-name-actions">
          <button className="mwh-nav-back" onClick={prevStep} aria-label={t('back')}>
            <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
          </button>
          <button className="mobile-welcome-primary mwh-nav-next" onClick={onContinue}>
            {isExistingUser ? t('saveAndEnter') : t('continueBtn')}
            <Icon name="arrowUp" size={16} style={{ transform: isExistingUser ? undefined : 'rotate(90deg)' }} />
          </button>
        </div>
      </div>
    )
  }

  /* ── Currency step (new users only) ──────────────────── */
  if (step === CURRENCY_STEP) {
    return (
      <div className="mobile-welcome-hub mwh-name-screen">
        <div className="mwh-name-brand">
          <BrandMark size={54} />
        </div>
        <h2>{t('whatCurrency')}</h2>
        <p className="mwh-name-hint">{t('changeCurrencyLaterHint')}</p>
        <div className="mwh-currency-grid">
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              className={`mwh-currency-item${currency === c.code ? ' on' : ''}`}
              onClick={() => setCurrencyChoice(c.code)}
            >
              <span className="mwh-currency-flag">{c.flag}</span>
              <strong>{c.code}</strong>
              <small>{c.name}</small>
            </button>
          ))}
        </div>
        <div className="mwh-name-actions">
          <button className="mwh-nav-back" onClick={prevStep} aria-label={t('back')}>
            <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
          </button>
          <button className="mobile-welcome-primary mwh-nav-next" onClick={() => { setCurrency(currency); nextStep() }}>
            {t('continueBtn')}
            <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>
      </div>
    )
  }

  /* ── Account step (new users only) ───────────────────── */
  if (step === ACCOUNT_STEP) {
    return <MobileOnboarding onBack={prevStep} onDone={nextStep} />
  }

  /* ── Security step (new users only) ──────────────────── */
  return (
    <div className="mobile-welcome-hub mwh-name-screen">
      <div className="mwh-name-brand">
        <BrandMark size={54} />
      </div>

      {securityStep === 'ask' && (
        <>
          <h2>{t('protectYourApp')}</h2>
          <p className="mwh-name-hint">
            {t('pinHint')}
          </p>
          <div className="mwh-security-actions">
            <button className="mobile-welcome-primary" onClick={() => setSecurityStep('pin-enter')}>
              <Icon name="key" size={16} /> {t('setupPin')}
            </button>
            <button className="mobile-welcome-ghost" onClick={finishNewUser}>
              {t('notNow')}
            </button>
          </div>
        </>
      )}

      {(securityStep === 'pin-enter' || securityStep === 'pin-confirm') && (
        <>
          <h2>{securityStep === 'pin-enter' ? t('createYourPin') : t('confirmYourPin')}</h2>
          <p className="mwh-name-hint" style={pinError ? { color: '#ff6b8a' } : undefined}>
            {pinError || (securityStep === 'pin-enter'
              ? t('choosePinHint')
              : t('confirmPinHint'))}
          </p>
          <div className="mpin-dots" style={{ justifyContent: 'center', margin: '4px 0 18px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`mpin-dot${i < pinValue.length ? ' on' : ''}${pinShake ? ' err' : ''}`} />
            ))}
          </div>
          <div className="mpin-keypad">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button key={d} onClick={() => pressPinDigit(d)}>{d}</button>
            ))}
            <span />
            <button onClick={() => pressPinDigit('0')}>0</button>
            <button aria-label={t('delete')} onClick={backspacePin}><Icon name="close" size={18} /></button>
          </div>
          <div className="mwh-name-actions">
            <button className="mwh-nav-back" onClick={() => { setPinValue(''); setPinDraft(''); setPinError(''); setSecurityStep('ask') }} aria-label={t('back')}>
              <Icon name="arrowUp" size={20} style={{ transform: 'rotate(-90deg)' }} />
            </button>
            <button className="mobile-welcome-ghost mwh-nav-next" onClick={finishNewUser}>
              {t('skip')}
            </button>
          </div>
        </>
      )}

      {securityStep === 'biometric' && (
        <>
          <h2>{t('biometricUnlock')}</h2>
          <p className="mwh-name-hint">{t('biometricHint')}</p>
          <div className="mwh-security-toggle-row">
            <span>{t('enableBiometric')}</span>
            <label className="mset-toggle-wrap">
              <input type="checkbox" className="mset-toggle-input"
                onChange={e => setRequireBiometric(e.target.checked)} />
              <span className="mset-toggle" />
            </label>
          </div>
          <div className="mwh-name-actions">
            <button className="mobile-welcome-primary mwh-nav-next" onClick={finishNewUser}>
              {t('continueBtn')}
              <Icon name="check" size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
