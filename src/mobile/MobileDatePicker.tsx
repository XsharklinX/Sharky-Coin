import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useMobileBackDismiss } from './useMobileBackDismiss'

const DAYS  = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m, day: d }
}

export function MobileDatePicker({
  value,
  onChange,
  onClose,
}: {
  value: string       // YYYY-MM-DD
  onChange: (v: string) => void
  onClose: () => void
}) {
  const parsed = parseDate(value)
  const [viewYear, setViewYear]   = useState(parsed.year)
  const [viewMonth, setViewMonth] = useState(parsed.month)

  useMobileBackDismiss(true, onClose)

  const today = new Date()
  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay()
  // Monday-first: 0=Mon…6=Sun
  const offset = (firstDay + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  const selectDay = (d: number) => {
    const iso = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    onChange(iso)
    onClose()
  }

  const isSelected = (d: number) =>
    d === parsed.day && viewMonth === parsed.month && viewYear === parsed.year

  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() + 1 && viewYear === today.getFullYear()

  // Build grid cells
  const cells: Array<number | null> = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="mdp-sheet" onClick={e => e.stopPropagation()}>

        {/* Nav */}
        <div className="mdp-nav">
          <button onClick={prevMonth}>
            <Icon name="arrowUp" size={18} style={{ transform: 'rotate(-90deg)' }} />
          </button>
          <strong>{MONTHS[viewMonth - 1]} {viewYear}</strong>
          <button onClick={nextMonth}>
            <Icon name="arrowUp" size={18} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>

        {/* Day headers */}
        <div className="mdp-days-header">
          {DAYS.map(d => <span key={d}>{d}</span>)}
        </div>

        {/* Grid */}
        <div className="mdp-grid">
          {cells.map((day, i) => (
            <button
              key={i}
              className={`mdp-cell${day === null ? ' empty' : ''}${day && isSelected(day) ? ' selected' : ''}${day && isToday(day) && !isSelected(day) ? ' today' : ''}`}
              disabled={day === null}
              onClick={() => day && selectDay(day)}
            >
              {day ?? ''}
            </button>
          ))}
        </div>

        {/* Quick actions */}
        <div className="mdp-quick">
          <button onClick={() => {
            const t = new Date()
            const iso = t.toISOString().slice(0, 10)
            onChange(iso)
            onClose()
          }}>Hoy</button>
          <button onClick={() => {
            const t = new Date()
            t.setDate(t.getDate() - 1)
            const iso = t.toISOString().slice(0, 10)
            onChange(iso)
            onClose()
          }}>Ayer</button>
          <button onClick={onClose}>Cancelar</button>
        </div>

      </section>
    </div>
  )
}
