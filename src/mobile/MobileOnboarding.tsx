import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { ACCENT_COLORS } from '@/constants'
import { useFinance } from '@/store/finance'
import { useT } from '@/i18n'
import type { Account, IconName } from '@/types'

type AccountType = Account['type']

const COLORS = ACCENT_COLORS

export function MobileOnboarding({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const addAccount = useFinance(s => s.addAccount)
  const t = useT()
  const TYPES: Array<{ id: AccountType; label: string; icon: IconName; desc: string; color: string }> = [
    { id: 'cash',    label: t('cash'),    icon: 'wallet', desc: t('accountTypeCashDesc'),    color: '#ffdd3d' },
    { id: 'debit',   label: t('debit'),   icon: 'cards',  desc: t('accountTypeDebitDesc'),   color: '#35d0a2' },
    { id: 'savings', label: t('savings'), icon: 'piggy',  desc: t('accountTypeSavingsDesc'), color: '#5bc0ff' },
    { id: 'credit',  label: t('credit'),  icon: 'cards',  desc: t('accountTypeCreditDesc'),  color: '#a78bfa' },
  ]
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [type, setType]     = useState<AccountType>('cash')
  const [name, setName]     = useState('')
  const [balance, setBalance] = useState('')
  const [color, setColor]   = useState('#ffdd3d')
  const [error, setError]   = useState('')

  const selectedType = TYPES.find(opt => opt.id === type)!

  const goStep2 = () => {
    setName(selectedType.label)
    setColor(selectedType.color)
    setStep(2)
  }

  const goStep3 = () => {
    if (!name.trim()) { setError(t('onboardNameError')); return }
    setError('')
    setStep(3)
  }

  const finish = () => {
    addAccount({
      type,
      name:    name.trim() || selectedType.label,
      short:   name.trim().slice(0, 4).toUpperCase() || selectedType.label.slice(0, 4).toUpperCase(),
      color,
      balance: Number(balance) || 0,
      last4:   '',
    })
    onDone()
  }

  return (
    <div className="mob-onboard">
      {/* Progress dots */}
      <div className="mob-onboard-dots">
        {[1, 2, 3].map(n => (
          <span key={n} className={`mob-onboard-dot${step >= n ? ' on' : ''}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="mob-onboard-step">
          <div className="mob-onboard-header">
            <h2>{t('onboardAccountTypeTitle')}</h2>
            <p>{t('onboardAccountTypeHint')}</p>
          </div>
          <div className="mob-onboard-types">
            {TYPES.map(opt => (
              <button
                key={opt.id}
                className={`mob-onboard-type${type === opt.id ? ' on' : ''}`}
                onClick={() => setType(opt.id)}
                style={{ '--type-color': opt.color } as React.CSSProperties}
              >
                <span className="mob-onboard-type-icon">
                  <Icon name={opt.icon} size={28} />
                </span>
                <strong>{opt.label}</strong>
                <small>{opt.desc}</small>
              </button>
            ))}
          </div>
          <div className="mob-onboard-nav">
            {onBack && (
              <button className="mob-onboard-back" onClick={onBack}>
                <Icon name="arrowUp" size={16} style={{ transform: 'rotate(-90deg)' }} /> {t('back')}
              </button>
            )}
            <button className="mob-onboard-next" onClick={goStep2}>
              {t('continueBtn')}
              <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mob-onboard-step">
          <div className="mob-onboard-header">
            <h2>{t('onboardNameAccountTitle')}</h2>
            <p>{t('onboardNameAccountHint')}</p>
          </div>
          <input
            className="mob-onboard-input"
            type="text"
            value={name}
            placeholder={selectedType.label}
            autoCapitalize="words"
            onChange={e => { setName(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && goStep3()}
          />
          {error && <p className="mob-onboard-error">{error}</p>}
          <div className="mob-onboard-colors">
            {COLORS.map(c => (
              <button
                key={c}
                className={`mob-onboard-color${color === c ? ' on' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className="mob-onboard-nav">
            <button className="mob-onboard-back" onClick={() => setStep(1)}>
              <Icon name="arrowUp" size={16} style={{ transform: 'rotate(-90deg)' }} /> {t('back')}
            </button>
            <button className="mob-onboard-next" onClick={goStep3}>
              {t('continueBtn')}
              <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mob-onboard-step">
          <div className="mob-onboard-header">
            <h2>{t('onboardBalanceTitle')}</h2>
            <p>{t('onboardBalanceHint').replace('{name}', name || selectedType.label)}</p>
          </div>
          <div className="mob-onboard-balance-wrap">
            <span className="mob-onboard-balance-symbol">RD$</span>
            <input
              className="mob-onboard-balance-input"
              type="number"
              inputMode="decimal"
              value={balance}
              placeholder="0"
              onChange={e => setBalance(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && finish()}
            />
          </div>
          <p className="mob-onboard-skip-hint">{t('onboardBalanceSkipHint')}</p>
          <div className="mob-onboard-nav">
            <button className="mob-onboard-back" onClick={() => setStep(2)}>
              <Icon name="arrowUp" size={16} style={{ transform: 'rotate(-90deg)' }} /> {t('back')}
            </button>
            <button className="mob-onboard-next" onClick={finish}>
              <Icon name="check" size={16} /> {t('done')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
