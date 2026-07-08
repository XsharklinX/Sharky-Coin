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
  const currency = useFinance(s => s.currency)
  const t = useT()
  const TYPES: Array<{ id: AccountType; label: string; icon: IconName; color: string }> = [
    { id: 'cash',    label: t('cash'),    icon: 'wallet', color: '#ffdd3d' },
    { id: 'debit',   label: t('debit'),   icon: 'cards',  color: '#35d0a2' },
    { id: 'savings', label: t('savings'), icon: 'piggy',  color: '#5bc0ff' },
    { id: 'credit',  label: t('credit'),  icon: 'cards',  color: '#a78bfa' },
  ]
  const [type, setType]     = useState<AccountType>('cash')
  const [name, setName]     = useState('')
  const [balance, setBalance] = useState('')
  const [color, setColor]   = useState('#ffdd3d')

  const selectedType = TYPES.find(opt => opt.id === type)!

  const pickType = (next: AccountType) => {
    const meta = TYPES.find(opt => opt.id === next)!
    setType(next)
    setColor(meta.color)
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
      <div className="mob-onboard-step">
        <div className="mob-onboard-header">
          <h2>{t('onboardAccountTypeTitle')}</h2>
          <p>{t('onboardAccountTypeHint')}</p>
        </div>

        <div className="mob-onboard-types mob-onboard-types-compact">
          {TYPES.map(opt => (
            <button
              key={opt.id}
              className={`mob-onboard-type${type === opt.id ? ' on' : ''}`}
              onClick={() => pickType(opt.id)}
              style={{ '--type-color': opt.color } as React.CSSProperties}
            >
              <span className="mob-onboard-type-icon">
                <Icon name={opt.icon} size={22} />
              </span>
              <strong>{opt.label}</strong>
            </button>
          ))}
        </div>

        <input
          className="mob-onboard-input"
          type="text"
          value={name}
          placeholder={selectedType.label}
          autoCapitalize="words"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && finish()}
        />

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

        <label className="mob-onboard-field-label" htmlFor="onboard-balance">
          {t('onboardBalanceLabel')}
        </label>
        <div className="mob-onboard-balance-wrap">
          <span className="mob-onboard-balance-symbol">{currency}</span>
          <input
            id="onboard-balance"
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
          {onBack && (
            <button className="mob-onboard-back" onClick={onBack}>
              <Icon name="arrowUp" size={16} style={{ transform: 'rotate(-90deg)' }} /> {t('back')}
            </button>
          )}
          <button className="mob-onboard-next" onClick={finish}>
            <Icon name="check" size={16} /> {t('done')}
          </button>
        </div>
      </div>
    </div>
  )
}
