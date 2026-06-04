import { useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Bars, Donut, Progress } from '@/components/ui/charts'
import {
  byCategory, currentMonthKey, fmtCompact,
  monthKeys, monthlySeries, totals, txForMonth,
} from '@/data/helpers'
import { generateFinancialIntelligence } from '@/data/financeIntelligence'
import { advanceRecurrenceDate } from '@/hooks/useRecurring'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { toast } from '@/components/ui/Toast'
import type { CategoryTotal, Totals, ViewProps } from '@/types'
import { Card, CatBadge, Empty, Legend, StatTile, TxRow } from './shared'

const ROADMAP = [
  {
    version: 'v0.3',
    name: 'Release estable local',
    status: 'Completado',
    features: ['Integridad de datos', 'Backups validados', 'Pruebas E2E', 'Instalador y portable'],
  },
  {
    version: 'v0.4',
    name: 'Control inteligente',
    status: 'Completado',
    features: ['Sobregiro por cuenta', 'Gastos recurrentes', 'Alertas configurables', 'Reglas CSV'],
  },
  {
    version: 'v0.5',
    name: 'Sincronización',
    status: 'Completado',
    features: ['Backend seguro', 'Sesiones multidispositivo', 'Backups automáticos', 'Recuperación de cuenta'],
  },
  {
    version: 'v0.6',
    name: 'Inteligencia financiera',
    status: 'Completado',
    features: ['Flujo 30/60/90', 'Suscripciones', 'Gastos atípicos', 'Acciones mensuales'],
  },
  {
    version: 'v0.7',
    name: 'Integraciones bancarias',
    status: 'Completado',
    features: ['Perfiles CSV RD', 'Mapeo manual', 'Bandeja previa', 'Conciliación'],
  },
  {
    version: 'v1.0',
    name: 'Lanzamiento',
    status: 'Completado',
    features: ['App instalable', 'Onboarding pulido', 'Pruebas E2E', 'Accesibilidad base'],
  },
  {
    version: 'v1.1',
    name: 'UX profesional',
    status: 'Completado',
    features: ['ModalShell', 'Foco y Esc', 'Settings renovado', 'Base accesible'],
  },
  {
    version: 'v1.2',
    name: 'CSV bancario',
    status: 'Completado',
    features: ['Tarjetas RD', 'Conciliacion flexible', 'Perfiles por banco', 'Preview mejorado'],
  },
  {
    version: 'v1.3',
    name: 'Decision financiera',
    status: 'Completado',
    features: ['Sensibilidad de atipicos', 'Recurrencias sugeridas', 'Resumen ejecutivo', 'Exports con marca'],
  },
  {
    version: 'v1.4',
    name: 'Distribucion y operacion',
    status: 'Actual',
    features: ['Chunks bajo demanda', 'Changelog interno', 'Canal estable/beta', 'Diagnosticos locales'],
  },
]

function computeInsight(params: {
  t: Totals
  prev: Totals
  expenses: CategoryTotal[]
  totalBudget: number
  isCurrent: boolean
  dayNow: number
  daysInMonth: number
}): string | null {
  const { t, prev, expenses, totalBudget, isCurrent, dayNow, daysInMonth } = params
  const candidates: string[] = []

  if (t.income > 0) {
    const rate = Math.round((t.net / t.income) * 100)
    if (rate >= 25) candidates.push(`Tasa de ahorro del ${rate}%. Vas por encima del objetivo recomendado.`)
    else if (rate < 0) candidates.push('Estás gastando más de lo que ingresas este mes.')
    else if (rate >= 10) candidates.push(`Ahorras el ${rate}% de tus ingresos. Mantén ese ritmo.`)
  }

  if (isCurrent && totalBudget > 0 && t.expense > 0 && dayNow > 3) {
    const budgetPct = (t.expense / totalBudget) * 100
    const timePct = (dayNow / daysInMonth) * 100
    const diff = budgetPct - timePct
    if (diff > 12) candidates.push(`Ritmo acelerado: ${budgetPct.toFixed(0)}% del presupuesto usado al día ${dayNow}.`)
    else if (diff < -15) candidates.push(`Ritmo saludable: ${budgetPct.toFixed(0)}% del presupuesto usado al día ${dayNow}.`)
  }

  if (expenses.length > 0 && t.expense > 0) {
    const top = expenses[0]
    const pct = Math.round((top.amount / t.expense) * 100)
    if (pct > 32) candidates.push(`${top.category.name} representa el ${pct}% de tus gastos este mes.`)
  }

  if (prev.expense > 100 && t.expense > 0) {
    const change = Math.round(((t.expense - prev.expense) / prev.expense) * 100)
    if (change > 20) candidates.push(`Gastas ${change}% más que el mes pasado. Revisa tus hábitos.`)
    else if (change < -15) candidates.push(`Gastas ${Math.abs(change)}% menos que el mes pasado.`)
  }

  if (prev.income > 0 && t.income > prev.income) {
    const change = Math.round(((t.income - prev.income) / prev.income) * 100)
    if (change > 10) candidates.push(`Ingresos ${change}% por encima del mes pasado.`)
  }

  return candidates.length ? candidates[new Date().getDate() % candidates.length] : null
}

export function Dashboard({ txns, mkey, goto, onEditTx }: ViewProps) {
  const { accounts, categories, currency, addTx } = useFinance()
  const anomalySensitivity = useSettings(state => state.anomalySensitivity)
  const monthTx = txForMonth(txns, mkey)
  const t = totals(monthTx)
  const keys = monthKeys(txns)
  const idx = keys.indexOf(mkey)
  const prev = totals(idx > 0 ? txForMonth(txns, keys[idx - 1]) : [])
  const netWorth = accounts.reduce((sum, account) => sum + account.balance, 0)
  const expenses = byCategory(monthTx, 'expense', categories)
  const budgetCats = categories.filter(category => category.type === 'expense')
  const totalBudget = budgetCats.reduce((sum, category) => sum + category.budget, 0)
  const chart = expenses.map(item => ({ label: item.category.name, value: item.amount, color: item.category.color }))
  const year = Number(mkey.slice(0, 4))
  const curMonthNum = Number(mkey.slice(5, 7))

  const intelligence = useMemo(() => generateFinancialIntelligence({
    txns,
    categories,
    mkey,
    currentBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
    anomalySensitivity,
  }), [txns, categories, mkey, accounts, anomalySensitivity])

  const scheduleSubscription = (item: typeof intelligence.subscriptions[number]) => {
    const accountId = item.accountId ?? accounts[0]?.id
    const categoryId = item.categoryId ?? categories.find(category => category.type === 'expense')?.id
    if (!accountId || !categoryId) {
      toast('Necesitas una cuenta y una categoria de gasto para programar esta recurrencia.', { icon: 'alert' })
      return
    }
    addTx({
      type: 'expense',
      amount: Math.round(item.amount),
      date: item.lastDate || `${mkey}-01`,
      note: item.merchant,
      accountId,
      categoryId,
      recurring: 'monthly',
      recurringStart: item.lastDate || `${mkey}-01`,
      recurringNext: advanceRecurrenceDate(item.lastDate || `${mkey}-01`, 'monthly'),
    })
    toast('Suscripcion convertida en recurrencia mensual', { icon: 'repeat', type: 'ok' })
  }

  const monthly = monthlySeries(txns, year).slice(Math.max(0, curMonthNum - 6), curMonthNum)

  const netWorthTimeline = useMemo(() => {
    const currentNetWorth = accounts.reduce((sum, account) => sum + account.balance, 0)
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(year, curMonthNum - 1 - (11 - index), 1)
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const after = txns.filter(tx => tx.date.slice(0, 7) > month && tx.type !== 'transfer')
      const delta = totals(after)
      return currentNetWorth - (delta.income - delta.expense)
    })
  }, [txns, accounts, year, curMonthNum])

  const spentByCat: Record<string, number> = {}
  monthTx.forEach(tx => {
    if (tx.type === 'expense' && tx.categoryId) spentByCat[tx.categoryId] = (spentByCat[tx.categoryId] ?? 0) + tx.amount
  })
  const exceeded = budgetCats.filter(category => category.budget > 0 && (spentByCat[category.id] ?? 0) > category.budget)
  const nearLimit = budgetCats.filter(category =>
    category.budget > 0 && !exceeded.some(item => item.id === category.id) &&
    (spentByCat[category.id] ?? 0) >= category.budget * 0.8
  )

  const isCurrent = mkey === currentMonthKey()
  const [yy, mm] = mkey.split('-').map(Number)
  const daysInMonth = new Date(yy, mm, 0).getDate()
  const dayNow = isCurrent ? new Date().getDate() : daysInMonth
  const insight = computeInsight({ t, prev, expenses, totalBudget, isCurrent, dayNow, daysInMonth })

  const recurringFixed = useMemo(() => {
    const seen = new Set<string>()
    const result = []
    for (const tx of txns) {
      if (!tx.recurring) continue
      const key = `${tx.note}|${tx.categoryId}|${tx.accountId}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(tx)
      }
    }
    return result.slice(0, 6)
  }, [txns])

  const thisMonthKeys = new Set(monthTx.map(tx => `${tx.note}|${tx.categoryId}|${tx.accountId}`))
  const change = (cur: number, old: number) =>
    old ? `${cur >= old ? '+' : ''}${Math.round((cur - old) / old * 100)}% vs mes anterior` : undefined

  return (
    <div className="view">
      {exceeded.length > 0 && (
        <div className="budget-alert exceeded">
          <Icon name="bolt" size={15} style={{ flexShrink: 0 }} />
          <span>
            {exceeded.length === 1
              ? `${exceeded[0].name} superó el presupuesto. Llevas ${fmtCompact(spentByCat[exceeded[0].id] ?? 0, currency)} de ${fmtCompact(exceeded[0].budget, currency)}.`
              : `${exceeded.length} categorías superaron el presupuesto este mes.`}
          </span>
          <button onClick={() => goto('budgets')}>Ver</button>
        </div>
      )}
      {exceeded.length === 0 && nearLimit.length > 0 && (
        <div className="budget-alert warning">
          <Icon name="bell" size={15} style={{ flexShrink: 0 }} />
          <span>
            {nearLimit[0].name} lleva el {Math.round(((spentByCat[nearLimit[0].id] ?? 0) / nearLimit[0].budget) * 100)}% del presupuesto
            {nearLimit.length > 1 ? ` y ${nearLimit.length - 1} más` : ''}.
          </span>
          <button onClick={() => goto('budgets')}>Ver</button>
        </div>
      )}

      <div className="grid-4">
        <StatTile label="Patrimonio neto" amount={netWorth} icon="wallet" accent="var(--accent)" sparkline={netWorthTimeline} />
        <StatTile label="Ingresos del mes" amount={t.income} icon="arrowUp" accent="var(--income)" footer={change(t.income, prev.income)} />
        <StatTile label="Gastos del mes" amount={t.expense} icon="arrowDn" accent="var(--expense)" footer={change(t.expense, prev.expense)} />
        <StatTile label="Ahorro del mes" amount={t.net} icon="trend" accent="var(--accent2)" footer={t.income ? `${Math.round(t.net / t.income * 100)}% de los ingresos` : undefined} />
      </div>

      {insight && <div className="insight-bar">{insight}</div>}

      <Card title="Inteligencia financiera" sub="Proyecciones, patrones y acciones sugeridas" style={{ marginTop: 16 }}>
        <div className="intelligence-grid">
          <section>
            <h4>Flujo proyectado</h4>
            {intelligence.projections.map(item => (
              <div className="intel-row" key={item.horizonDays}>
                <span>{item.horizonDays} días</span>
                <b className={item.projectedNet >= 0 ? 'income' : 'expense'}>{fmtCompact(item.projectedNet, currency)}</b>
                <em>{fmtCompact(item.projectedBalance, currency)} balance</em>
              </div>
            ))}
          </section>
          <section>
            <h4>Suscripciones</h4>
            {intelligence.subscriptions.length
              ? intelligence.subscriptions.slice(0, 3).map(item => (
                <button className="intel-row action" key={`${item.merchant}-${item.lastDate}`} onClick={() => scheduleSubscription(item)}>
                  <span>{item.merchant}</span>
                  <b>{fmtCompact(item.amount, currency)}</b>
                  <em>{item.confidence}% confianza · programar</em>
                </button>
              ))
              : <p>No detectamos suscripciones nuevas.</p>}
          </section>
          <section>
            <h4>Atípicos</h4>
            {intelligence.anomalies.length
              ? intelligence.anomalies.slice(0, 3).map(item => (
                <button className="intel-row action" key={item.tx.id} onClick={() => onEditTx(item.tx)}>
                  <span>{item.tx.note}</span>
                  <b className="expense">{fmtCompact(item.tx.amount, currency)}</b>
                  <em>{item.multiplier.toFixed(1)}x habitual</em>
                </button>
              ))
              : <p>Sin gastos fuera de patrón este mes.</p>}
          </section>
          <section>
            <h4>Acciones del mes</h4>
            <ul className="intel-actions">
              {intelligence.monthlyActions.map(action => <li key={action}>{action}</li>)}
            </ul>
          </section>
        </div>
        {intelligence.trends.length > 0 && (
          <div className="trend-strip">
            {intelligence.trends.slice(0, 5).map(item => (
              <span key={`${item.kind}-${item.label}`}>{item.label} <b>{fmtCompact(item.amount, currency)}</b></span>
            ))}
          </div>
        )}
      </Card>

      <div className="grid-2-1 dashboard-section">
        <Card title="Gasto por categoría" sub="Distribución mensual">
          {chart.length
            ? <div className="chart-split">
                <Donut data={chart} centerTop="Gastado" centerBottom={fmtCompact(t.expense, currency)} />
                <div>{chart.slice(0, 6).map(item => (
                  <div className="legend-row" key={item.label}>
                    <Legend color={item.color} label={item.label} />
                    <b>{fmtCompact(item.value, currency)}</b>
                  </div>
                ))}</div>
              </div>
            : <Empty text="Sin gastos este mes" />}
        </Card>

        <Card
          title="Presupuesto del mes"
          sub={totalBudget ? `${Math.round(t.expense / totalBudget * 100)}% utilizado` : 'Sin presupuesto'}
          action={<button className="btn-ghost" onClick={() => goto('budgets')}>Ver todo</button>}
        >
          <Progress value={t.expense} max={totalBudget} />
          <p className="card-copy">{fmtCompact(t.expense, currency)} gastados de {fmtCompact(totalBudget, currency)}</p>
        </Card>
      </div>

      <div className="grid-2-1 dashboard-section">
        <Card title="Ingresos vs gastos" sub="Últimos 6 meses · % vs mes anterior en gastos">
          <Bars series={monthly} showComparison />
          <div className="legend-list">
            <Legend color="var(--income)" label="Ingresos" />
            <Legend color="var(--expense)" label="Gastos" />
          </div>
        </Card>

        <Card title="Movimientos recientes" action={<button className="btn-ghost" onClick={() => goto('transactions')}>Ver todo</button>}>
          {monthTx.length
            ? monthTx.slice(0, 6).map(tx => <TxRow key={tx.id} tx={tx} onClick={() => onEditTx(tx)} />)
            : <Empty text="Sin movimientos este mes" />}
        </Card>
      </div>

      {recurringFixed.length > 0 && (
        <Card
          title="Gastos fijos mensuales"
          sub={`${recurringFixed.filter(tx => thisMonthKeys.has(`${tx.note}|${tx.categoryId}|${tx.accountId}`)).length} de ${recurringFixed.length} generados este mes`}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recurringFixed.map(tx => {
              const cat = categories.find(category => category.id === tx.categoryId)
              const done = thisMonthKeys.has(`${tx.note}|${tx.categoryId}|${tx.accountId}`)
              return (
                <div className="recurring-row" key={tx.id}>
                  <CatBadge category={cat} size={30} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.note}</span>
                  <span className={`recurring-status ${done ? 'done' : 'pending'}`} title={done ? 'Generado este mes' : 'Pendiente este mes'}>{done ? '✓' : '○'}</span>
                  <span style={{ fontSize: 13, fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{fmtCompact(tx.amount, currency)}</span>
                </div>
              )
            })}
            <div className="recurring-total">
              <span style={{ color: 'var(--text-dim)' }}>Total mensual estimado</span>
              <span style={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{fmtCompact(recurringFixed.reduce((sum, tx) => sum + tx.amount, 0), currency)}</span>
            </div>
          </div>
        </Card>
      )}

      <Card title="Roadmap de producto" sub="Versiones de $harky" style={{ marginTop: 16 }}>
        <div className="version-roadmap">
          {ROADMAP.map(release => (
            <article className="version-card" key={release.version}>
              <div className="version-head">
                <strong>{release.version}</strong>
                <span>{release.status}</span>
              </div>
              <h4>{release.name}</h4>
              <ul>{release.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
            </article>
          ))}
        </div>
        <div className="roadmap-foot">
          <Icon name="check" size={15} />
          v1.4 prepara la app para releases mas livianos, diagnosticables y mantenibles.
        </div>
      </Card>
    </div>
  )
}
