import { Icon } from '@/components/ui/Icon'
import { BrandMark } from '@/components/ui/BrandMark'
import { useFinance } from '@/store/finance'

export function Welcome() {
  const startDemo  = useFinance(s => s.startDemo)
  const startEmpty = useFinance(s => s.startEmpty)

  return (
    <div className="welcome-overlay">
      <div className="welcome">
        <span className="welcome-mark">
          <BrandMark size={58} />
        </span>
        <h1><span style={{ color: 'var(--accent)' }}>$</span>harky</h1>
        <p>
          Tu dinero, claro como el agua. Registra ingresos y gastos,
          controla presupuestos y visualiza tus finanzas en gráficas.
        </p>
        <div className="welcome-actions">
          <button className="btn-primary lg" onClick={startDemo}>
            <Icon name="chart" size={17} />Explorar con datos de ejemplo
          </button>
          <button className="btn-ghost lg" onClick={startEmpty}>
            Empezar de cero
          </button>
        </div>
        <div className="welcome-feats">
          <span><Icon name="chart"  size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} /> Gráficas semanales, mensuales y anuales</span>
          <span><Icon name="target" size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} /> Presupuestos que se reinician cada mes</span>
          <span><Icon name="cards"  size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} /> Cuentas, metas de ahorro y transferencias</span>
          <span><Icon name="trend"  size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} /> Multi-moneda: DOP, USD y EUR</span>
        </div>
      </div>
    </div>
  )
}
