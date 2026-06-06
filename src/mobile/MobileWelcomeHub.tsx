import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { useFinance } from '@/store/finance'

const FEATS = [
  {
    icon: 'chart' as const,
    color: '#5bc0ff',
    title: 'Controla tus gastos',
    text: 'Registra ingresos y gastos con categorías, notas y fechas en segundos',
  },
  {
    icon: 'target' as const,
    color: '#a78bfa',
    title: 'Presupuestos por categoría',
    text: 'Establece límites mensuales y mira en tiempo real cuánto te queda',
  },
  {
    icon: 'cards' as const,
    color: '#35d0a2',
    title: 'Múltiples cuentas',
    text: 'Banco, efectivo, ahorros y metas — todo en un solo lugar',
  },
] as const

export function MobileWelcomeHub() {
  const startDemo  = useFinance(s => s.startDemo)
  const startEmpty = useFinance(s => s.startEmpty)

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

      <div className="mobile-welcome-feats">
        {FEATS.map(feat => (
          <div key={feat.title} className="mobile-welcome-feat">
            <span style={{
              color: feat.color,
              background: `color-mix(in oklab, ${feat.color} 14%, transparent)`,
            }}>
              <Icon name={feat.icon} size={22} />
            </span>
            <div>
              <strong>{feat.title}</strong>
              <small>{feat.text}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="mobile-welcome-actions">
        <button className="mobile-welcome-primary" onClick={startDemo}>
          <Icon name="chart" size={18} />
          Explorar con datos de ejemplo
        </button>
        <button className="mobile-welcome-ghost" onClick={startEmpty}>
          Empezar de cero
        </button>
        <p className="mobile-welcome-fine">
          Sin cuenta en la nube · Tus datos, 100% privados
        </p>
      </div>
    </div>
  )
}
