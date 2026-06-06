import { useEffect, useState } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'

export function MobileSplash({ onGone }: { onGone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 200)
    const t2 = setTimeout(() => setPhase('out'),  1400)
    const t3 = setTimeout(() => onGone(),          1900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onGone])

  return (
    <div className={`splash-screen${phase === 'out' ? ' splash-out' : ''}`} aria-hidden="true">
      <div className={`splash-logo${phase !== 'in' ? ' splash-logo-in' : ''}`}>
        <BrandMark size={88} />
      </div>
      <div className={`splash-text${phase !== 'in' ? ' splash-text-in' : ''}`}>
        <h1><span className="splash-dollar">$</span>harky</h1>
        <p>Tus finanzas, sin drama</p>
      </div>
      <div className="splash-bar">
        <span className={phase !== 'in' ? 'splash-bar-fill' : ''} />
      </div>
    </div>
  )
}
