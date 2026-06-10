import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { ACCENT_COLORS } from '@/constants'
import { useFinance } from '@/store/finance'
import type { Account, IconName } from '@/types'

type AccountType = Account['type']

const TYPES: Array<{ id: AccountType; label: string; icon: IconName; desc: string; color: string }> = [
  { id: 'cash',    label: 'Efectivo',  icon: 'wallet', desc: 'Dinero en mano',          color: '#ffdd3d' },
  { id: 'debit',   label: 'Débito',    icon: 'cards',  desc: 'Cuenta bancaria',          color: '#35d0a2' },
  { id: 'savings', label: 'Ahorros',   icon: 'piggy',  desc: 'Fondo de emergencia',      color: '#5bc0ff' },
  { id: 'credit',  label: 'Crédito',   icon: 'cards',  desc: 'Tarjeta de crédito',       color: '#a78bfa' },
]

const COLORS = ACCENT_COLORS

export function MobileOnboarding({ onDone }: { onDone: () => void }) {
  const addAccount = useFinance(s => s.addAccount)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [type, setType]     = useState<AccountType>('cash')
  const [name, setName]     = useState('')
  const [balance, setBalance] = useState('')
  const [color, setColor]   = useState('#ffdd3d')
  const [error, setError]   = useState('')

  const selectedType = TYPES.find(t => t.id === type)!

  const goStep2 = () => {
    setName(selectedType.label)
    setColor(selectedType.color)
    setStep(2)
  }

  const goStep3 = () => {
    if (!name.trim()) { setError('Escribe un nombre para la cuenta'); return }
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
            <h2>¿Qué tipo de cuenta tienes?</h2>
            <p>Puedes agregar más después</p>
          </div>
          <div className="mob-onboard-types">
            {TYPES.map(t => (
              <button
                key={t.id}
                className={`mob-onboard-type${type === t.id ? ' on' : ''}`}
                onClick={() => setType(t.id)}
                style={{ '--type-color': t.color } as React.CSSProperties}
              >
                <span className="mob-onboard-type-icon">
                  <Icon name={t.icon} size={28} />
                </span>
                <strong>{t.label}</strong>
                <small>{t.desc}</small>
              </button>
            ))}
          </div>
          <button className="mob-onboard-next" onClick={goStep2}>
            Continuar
            <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mob-onboard-step">
          <div className="mob-onboard-header">
            <h2>Nombra tu cuenta</h2>
            <p>Ej. BHD, Caja chica, Visa Banco Popular</p>
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
              <Icon name="arrowUp" size={16} style={{ transform: 'rotate(-90deg)' }} /> Atrás
            </button>
            <button className="mob-onboard-next" onClick={goStep3}>
              Continuar
              <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mob-onboard-step">
          <div className="mob-onboard-header">
            <h2>¿Cuánto tienes ahora?</h2>
            <p>El saldo actual de "{name || selectedType.label}"</p>
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
          <p className="mob-onboard-skip-hint">Puedes dejarlo en 0 si no lo sabes ahora</p>
          <div className="mob-onboard-nav">
            <button className="mob-onboard-back" onClick={() => setStep(2)}>
              <Icon name="arrowUp" size={16} style={{ transform: 'rotate(-90deg)' }} /> Atrás
            </button>
            <button className="mob-onboard-next" onClick={finish}>
              <Icon name="check" size={16} /> Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
