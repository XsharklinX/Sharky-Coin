import { useMemo, useState } from 'react'
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Icon } from '@/components/ui/Icon'
import { projectCashflow } from '@/data/cashflowProjection'
import { dateLocale, fmtCompact, localToday } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useFmt } from '@/hooks/useFmt'
import { useT } from '@/i18n'

type Horizon = 'month' | '30d' | '60d'

function horizonDate(horizon: Horizon, today: string): string {
  const d = new Date(`${today}T00:00:00`)
  if (horizon === 'month') {
    d.setMonth(d.getMonth() + 1, 0) // último día del mes actual
  } else {
    d.setDate(d.getDate() + (horizon === '30d' ? 30 : 60))
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Calendario de flujo de caja: proyección del saldo total día a día usando
 * recurrencias, suscripciones y aportes automáticos a metas.
 * Responde "¿me alcanza hasta fin de mes?".
 */
export function MobileCashflow() {
  const t = useT()
  const fmtVal = useFmt()
  const lang = useSettings(s => s.language)
  const { transactions, accounts, goals, currency } = useFinance()
  const [horizon, setHorizon] = useState<Horizon>('month')

  const today = localToday()
  const projection = useMemo(
    () => projectCashflow(transactions, accounts, goals, horizonDate(horizon, today), today, currency),
    [transactions, accounts, goals, horizon, today, currency],
  )

  const locale = dateLocale(lang)
  const dayLabel = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })

  const delta = projection.endBalance - projection.startBalance
  const goesNegative = projection.minBalance < 0
  const chartData = projection.series.map(point => ({
    date: point.date,
    balance: Math.round(point.balance * 100) / 100,
    label: new Date(`${point.date}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
  }))

  return (
    <div className="mcash-root">
      <div className="mobile-tab-segment">
        <div className="mobile-segment mobile-segment-3" role="tablist" aria-label={t('cashflowTitle')}>
          <button className={horizon === 'month' ? 'on' : ''} role="tab" aria-selected={horizon === 'month'} onClick={() => setHorizon('month')}>
            {t('cashflowHorizonMonth')}
          </button>
          <button className={horizon === '30d' ? 'on' : ''} role="tab" aria-selected={horizon === '30d'} onClick={() => setHorizon('30d')}>
            {t('cashflowHorizon30')}
          </button>
          <button className={horizon === '60d' ? 'on' : ''} role="tab" aria-selected={horizon === '60d'} onClick={() => setHorizon('60d')}>
            {t('cashflowHorizon60')}
          </button>
        </div>
      </div>

      <div className="mcash-hero">
        <small>{horizon === 'month' ? t('cashflowEndOfMonth') : t('cashflowProjectedBalance')}</small>
        <strong className={projection.endBalance < 0 ? 'text-expense' : ''}>
          {fmtVal(projection.endBalance, currency)}
        </strong>
        <span className={`mcash-delta ${delta < 0 ? 'down' : 'up'}`}>
          {delta >= 0 ? '+' : ''}{fmtCompact(delta, currency)} · {t('cashflowVsToday')}
        </span>
      </div>

      {goesNegative && (
        <div className="mcash-warning" role="alert">
          <Icon name="alert" size={16} />
          <span>
            {t('cashflowNegativeWarning')
              .replace('{date}', dayLabel(projection.minDate))
              .replace('{amount}', fmtCompact(projection.minBalance, currency))}
          </span>
        </div>
      )}

      <div className="mcash-chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="mcash-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis hide domain={['auto', 'auto']} />
            {goesNegative && <ReferenceLine y={0} stroke="#ff6b8a" strokeDasharray="4 4" strokeOpacity={0.7} />}
            <Tooltip
              formatter={value => [fmtCompact(Number(value ?? 0), currency), '']}
              labelFormatter={label => label}
              separator=""
              contentStyle={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, fontSize: 12, color: 'var(--text)',
              }}
            />
            <Area type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2} fill="url(#mcash-grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mcash-summary-row">
        <div className="mcash-summary-item">
          <small>{t('cashflowToday')}</small>
          <b>{fmtCompact(projection.startBalance, currency)}</b>
        </div>
        <div className="mcash-summary-item">
          <small>{t('cashflowLowestPoint')}</small>
          <b className={projection.minBalance < 0 ? 'text-expense' : ''}>
            {fmtCompact(projection.minBalance, currency)}
          </b>
          <span>{dayLabel(projection.minDate)}</span>
        </div>
      </div>

      {projection.days.length === 0 ? (
        <div className="mcash-empty">
          <Icon name="calendar" size={40} style={{ opacity: .18 }} />
          <p>{t('cashflowNoEvents')}</p>
          <small>{t('cashflowNoEventsHint')}</small>
        </div>
      ) : (
        <div className="mcash-days">
          {projection.days.map(day => (
            <article key={day.date} className="mcash-day">
              <header>
                <span className="mcash-day-date">{dayLabel(day.date)}</span>
                <span className={`mcash-day-balance${day.balance < 0 ? ' text-expense' : ''}`}>
                  {fmtCompact(day.balance, currency)}
                </span>
              </header>
              <div className="mcash-events">
                {day.events.map((event, index) => (
                  <div key={`${event.sourceId}:${index}`} className="mcash-event">
                    <span className={`mcash-event-icon mcash-event-${event.kind}`}>
                      <Icon name={event.kind === 'income' ? 'arrowUp' : event.kind === 'goal' ? 'target' : 'repeat'} size={14} />
                    </span>
                    <span className="mcash-event-note">
                      {event.kind === 'goal' ? `${t('cashflowGoalPrefix')} ${event.note}` : event.note}
                    </span>
                    <b className={event.amount < 0 ? 'text-expense' : 'mcash-event-income'}>
                      {event.amount >= 0 ? '+' : ''}{fmtCompact(event.amount, currency)}
                    </b>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mcash-note">
        <Icon name="info" size={12} /> {t('cashflowNote')}
      </p>
    </div>
  )
}
