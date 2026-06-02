import { useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Bars, Donut, Progress } from '@/components/ui/charts'
import {
  byCategory, currentMonthKey, fmtCompact,
  monthKeys, monthlySeries, totals, txForMonth,
} from '@/data/helpers'
import { generateFinancialIntelligence } from '@/data/financeIntelligence'
import { useFinance } from '@/store/finance'
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
    features: ['Sobregiro por cuenta', 'Gastos recurrentes editables', 'Alertas configurables', 'Reglas CSV avanzadas'],
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
    features: ['Flujo 30/60/90', 'Suscripciones', 'Gastos atipicos', 'Acciones mensuales'],
  },
  {
    version: 'v0.7',
    name: 'Integraciones bancarias',
    status: 'Completado',
    features: ['Perfiles CSV RD', 'Mapeo manual', 'Bandeja previa', 'Conciliacion'],
  },
  {
    version: 'v1.0',
    name: 'Lanzamiento',
    status: 'Objetivo',
    features: ['App instalable', 'Onboarding pulido', 'Pruebas E2E', 'Accesibilidad AA'],
  },
]

// ── Insight engine ────────────────────────────────────────
function computeInsight(params: {
  t:           Totals
  prev:        Totals
  expenses:    CategoryTotal[]
  totalBudget: number
  isCurrent:   boolean
  dayNow:      number
  daysInMonth: number
}): string | null {
  const { t, prev, expenses, totalBudget, isCurrent, dayNow, daysInMonth } = params
  const candidates: string[] = []

  // 1. Tasa de ahorro
  if (t.income > 0) {
    const rate = Math.round((t.net / t.income) * 100)
    if (rate >= 25)      candidates.push(`🎯 Tasa de ahorro del ${rate}% — vas excelente.`)
    else if (rate < 0)   candidates.push(`⚠ Estás gastando más de lo que ingresas este mes.`)
    else if (rate >= 10) candidates.push(`💰 Ahorras el ${rate}% de tus ingresos — sigue así.`)
  }

  // 2. Ritmo vs tiempo del mes
  if (isCurrent && totalBudget > 0 && t.expense > 0 && dayNow > 3) {
    const bPct = (t.expense / totalBudget) * 100
    const tPct = (dayNow / daysInMonth) * 100
    const diff = bPct - tPct
    if (diff > 12)  candidates.push(`⚡ Ritmo acelerado: ${bPct.toFixed(0)}% del presupuesto al día ${dayNow} de ${daysInMonth}.`)
    else if (diff < -15) candidates.push(`💡 Ritmo saludable: solo ${bPct.toFixed(0)}% del presupuesto al día ${dayNow}.`)
  }

  // 3. Categoría dominante
  if (expenses.length > 0 && t.expense > 0) {
    const top = expenses[0]
    const pct = Math.round((top.amount / t.expense) * 100)
    if (pct > 32) candidates.push(`📦 ${top.category.name} representa el ${pct}% de tus gastos este mes.`)
  }

  // 4. Cambio vs mes anterior (gastos)
  if (prev.expense > 100 && t.expense > 0) {
    const chg = Math.round(((t.expense - prev.expense) / prev.expense) * 100)
    if (chg > 20)       candidates.push(`📈 Gastas ${chg}% más que el mes pasado — revisa tus hábitos.`)
    else if (chg < -15) candidates.push(`📉 Gastas ${Math.abs(chg)}% menos que el mes pasado. ¡Bien!`)
  }

  // 5. Progreso de ingresos vs mes anterior
  if (prev.income > 0 && t.income > prev.income) {
    const chg = Math.round(((t.income - prev.income) / prev.income) * 100)
    if (chg > 10) candidates.push(`🚀 Ingresos ${chg}% por encima del mes pasado.`)
  }

  if (candidates.length === 0) return null
  // Rotar por día del mes para que cambie diariamente
  return candidates[new Date().getDate() % candidates.length]
}

// ── Dashboard ─────────────────────────────────────────────
export function Dashboard({ txns, mkey, goto, onEditTx }: ViewProps) {
  const { accounts, categories, currency } = useFinance()
  const monthTx    = txForMonth(txns, mkey)
  const t          = totals(monthTx)
  const keys       = monthKeys(txns)
  const idx        = keys.indexOf(mkey)
  const prev       = totals(idx > 0 ? txForMonth(txns, keys[idx - 1]) : [])
  const netWorth   = accounts.reduce((s, a) => s + a.balance, 0)
  const expenses   = byCategory(monthTx, 'expense', categories)
  const budgetCats = categories.filter(c => c.type === 'expense')
  const totalBudget = budgetCats.reduce((s, c) => s + c.budget, 0)
  const chart      = expenses.map(x => ({ label: x.category.name, value: x.amount, color: x.category.color }))
  const intelligence = useMemo(() => generateFinancialIntelligence({
    txns,
    categories,
    mkey,
    currentBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
  }), [txns, categories, mkey, accounts])

  // últimos 6 meses para las barras
  const year = Number(mkey.slice(0, 4))
  const curMonthNum = Number(mkey.slice(5, 7))
  const monthly = monthlySeries(txns, year)
    .slice(Math.max(0, curMonthNum - 6), curMonthNum)

  // ── Net worth timeline (12 meses) ───────────────────────
  const netWorthTimeline = useMemo(() => {
    const curNW = accounts.reduce((s, a) => s + a.balance, 0)
    return Array.from({ length: 12 }, (_, i) => {
      const d  = new Date(year, curMonthNum - 1 - (11 - i), 1)
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      // Patrimonio en ese punto = actual - efecto de transacciones después de ese mes
      const after = txns.filter(tx => tx.date.slice(0, 7) > mk && tx.type !== 'transfer')
      const delta = totals(after)
      return curNW - (delta.income - delta.expense)
    })
  }, [txns, accounts, year, curMonthNum])

  // ── Alertas de presupuesto ──────────────────────────────
  const spentByCat: Record<string, number> = {}
  monthTx.forEach(tx => {
    if (tx.type === 'expense' && tx.categoryId)
      spentByCat[tx.categoryId] = (spentByCat[tx.categoryId] ?? 0) + tx.amount
  })
  const exceeded  = budgetCats.filter(c => c.budget > 0 && (spentByCat[c.id] ?? 0) > c.budget)
  const nearLimit = budgetCats.filter(c =>
    c.budget > 0 && !exceeded.find(e => e.id === c.id) &&
    (spentByCat[c.id] ?? 0) >= c.budget * 0.8
  )

  // ── Insight ─────────────────────────────────────────────
  const isCurrent = mkey === currentMonthKey()
  const [yy, mm]  = mkey.split('-').map(Number)
  const daysInMonth = new Date(yy, mm, 0).getDate()
  const dayNow      = isCurrent ? new Date().getDate() : daysInMonth

  const insight = computeInsight({ t, prev, expenses, totalBudget, isCurrent, dayNow, daysInMonth })

  // ── Gastos fijos recurrentes ────────────────────────────
  const recurringFixed = useMemo(() => {
    const seen = new Set<string>()
    const result = []
    for (const tx of txns) {
      if (!tx.recurring) continue
      const key = `${tx.note}|${tx.categoryId}|${tx.accountId}`
      if (!seen.has(key)) { seen.add(key); result.push(tx) }
    }
    return result.slice(0, 6)
  }, [txns])

  const thisMonthKeys = new Set(
    monthTx.map(tx => `${tx.note}|${tx.categoryId}|${tx.accountId}`)
  )

  const change = (cur: number, old: number) =>
    old ? `${cur >= old ? '+' : ''}${Math.round((cur - old) / old * 100)}% vs mes anterior` : undefined

  return (
    <div className="view">

      {/* ── Alertas de presupuesto ── */}
      {exceeded.length > 0 && (
        <div className="budget-alert exceeded">
          <Icon name="bolt" size={15} style={{ flexShrink: 0 }} />
          <span>
            {exceeded.length === 1
              ? `${exceeded[0].name} superó el presupuesto — llevas ${fmtCompact(spentByCat[exceeded[0].id] ?? 0, currency)} de ${fmtCompact(exceeded[0].budget, currency)}`
              : `${exceeded.length} categorías superaron el presupuesto este mes`}
          </span>
          <button onClick={() => goto('budgets')}>Ver →</button>
        </div>
      )}
      {exceeded.length === 0 && nearLimit.length > 0 && (
        <div className="budget-alert warning">
          <Icon name="bell" size={15} style={{ flexShrink: 0 }} />
          <span>
            {nearLimit[0].name} lleva el{' '}
            {Math.round(((spentByCat[nearLimit[0].id] ?? 0) / nearLimit[0].budget) * 100)}% del presupuesto
            {nearLimit.length > 1 ? ` y ${nearLimit.length - 1} más` : ''}
          </span>
          <button onClick={() => goto('budgets')}>Ver →</button>
        </div>
      )}

      {/* ── KPI tiles ── */}
      <div className="grid-4">
        {/* Patrimonio con sparkline de tendencia */}
        <StatTile
          label="Patrimonio neto" amount={netWorth}
          icon="wallet" accent="var(--accent)"
          sparkline={netWorthTimeline}
        />
        <StatTile label="Ingresos del mes" amount={t.income}
          icon="arrowUp" accent="var(--income)"
          footer={change(t.income, prev.income)} />
        <StatTile label="Gastos del mes"   amount={t.expense}
          icon="arrowDn" accent="var(--expense)"
          footer={change(t.expense, prev.expense)} />
        <StatTile label="Ahorro del mes"   amount={t.net}
          icon="trend" accent="var(--accent2)"
          footer={t.income ? `${Math.round(t.net / t.income * 100)}% de los ingresos` : undefined} />
      </div>

      {/* ── Insight contextual ── */}
      {insight && <div className="insight-bar">{insight}</div>}

      <Card title="Inteligencia financiera" sub="Proyecciones, patrones y acciones sugeridas" style={{ marginTop: 16 }}>
        <div className="intelligence-grid">
          <section>
            <h4>Flujo proyectado</h4>
            {intelligence.projections.map(item => (
              <div className="intel-row" key={item.horizonDays}>
                <span>{item.horizonDays} dias</span>
                <b className={item.projectedNet >= 0 ? 'income' : 'expense'}>{fmtCompact(item.projectedNet, currency)}</b>
                <em>{fmtCompact(item.projectedBalance, currency)} balance</em>
              </div>
            ))}
          </section>
          <section>
            <h4>Suscripciones</h4>
            {intelligence.subscriptions.length
              ? intelligence.subscriptions.slice(0, 3).map(item => (
                <div className="intel-row" key={`${item.merchant}-${item.lastDate}`}>
                  <span>{item.merchant}</span>
                  <b>{fmtCompact(item.amount, currency)}</b>
                  <em>{item.confidence}% confianza</em>
                </div>
              ))
              : <p>No detectamos suscripciones nuevas.</p>}
          </section>
          <section>
            <h4>Atipicos</h4>
            {intelligence.anomalies.length
              ? intelligence.anomalies.slice(0, 3).map(item => (
                <button className="intel-row action" key={item.tx.id} onClick={() => onEditTx(item.tx)}>
                  <span>{item.tx.note}</span>
                  <b className="expense">{fmtCompact(item.tx.amount, currency)}</b>
                  <em>{item.multiplier.toFixed(1)}x habitual</em>
                </button>
              ))
              : <p>Sin gastos fuera de patron este mes.</p>}
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
              <span key={`${item.kind}-${item.label}`}>
                {item.label} <b>{fmtCompact(item.amount, currency)}</b>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* ── Dona + Presupuesto ── */}
      <div className="grid-2-1 dashboard-section">
        <Card title="Gasto por categoría" sub="Distribución mensual">
          {chart.length
            ? <div className="chart-split">
                <Donut data={chart} centerTop="Gastado" centerBottom={fmtCompact(t.expense, currency)} />
                <div>{chart.slice(0, 6).map(x => (
                  <div className="legend-row" key={x.label}>
                    <Legend color={x.color} label={x.label} />
                    <b>{fmtCompact(x.value, currency)}</b>
                  </div>
                ))}</div>
              </div>
            : <Empty text="Sin gastos este mes" />}
        </Card>

        <Card title="Presupuesto del mes"
          sub={totalBudget ? `${Math.round(t.expense / totalBudget * 100)}% utilizado` : 'Sin presupuesto'}
          action={<button className="btn-ghost" onClick={() => goto('budgets')}>Ver todo</button>}>
          <Progress value={t.expense} max={totalBudget} />
          <p className="card-copy">
            {fmtCompact(t.expense, currency)} gastados de {fmtCompact(totalBudget, currency)}
          </p>
        </Card>
      </div>

      {/* ── Barras con comparativa + Recientes ── */}
      <div className="grid-2-1 dashboard-section">
        <Card title="Ingresos vs gastos" sub="Últimos 6 meses — % vs mes anterior en gastos">
          <Bars series={monthly} showComparison />
          <div className="legend-list">
            <Legend color="var(--income)"  label="Ingresos" />
            <Legend color="var(--expense)" label="Gastos" />
          </div>
        </Card>

        <Card title="Movimientos recientes"
          action={<button className="btn-ghost" onClick={() => goto('transactions')}>Ver todo</button>}>
          {monthTx.length
            ? monthTx.slice(0, 6).map(tx => <TxRow key={tx.id} tx={tx} onClick={() => onEditTx(tx)} />)
            : <Empty text="Sin movimientos este mes" />}
        </Card>
      </div>

      {/* ── Gastos fijos recurrentes ── */}
      {recurringFixed.length > 0 && (
        <Card title="Gastos fijos mensuales"
          sub={`${recurringFixed.filter(tx => thisMonthKeys.has(`${tx.note}|${tx.categoryId}|${tx.accountId}`)).length} de ${recurringFixed.length} generados este mes`}
          style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recurringFixed.map(tx => {
              const cat    = categories.find(c => c.id === tx.categoryId)
              const done   = thisMonthKeys.has(`${tx.note}|${tx.categoryId}|${tx.accountId}`)
              return (
                <div className="recurring-row" key={tx.id}>
                  <CatBadge category={cat} size={30} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.note}
                  </span>
                  <span className={`recurring-status ${done ? 'done' : 'pending'}`}
                    title={done ? 'Generado este mes' : 'Pendiente este mes'}>
                    {done ? '✓' : '○'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 650,
                    fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                    {fmtCompact(tx.amount, currency)}
                  </span>
                </div>
              )
            })}
            <div className="recurring-total">
              <span style={{ color: 'var(--text-dim)' }}>Total mensual estimado</span>
              <span style={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                {fmtCompact(recurringFixed.reduce((s, tx) => s + tx.amount, 0), currency)}
              </span>
            </div>
          </div>
        </Card>
      )}

      <Card title="Roadmap de producto" sub="Próximas versiones de $harky" style={{ marginTop: 16 }}>
        <div className="version-roadmap">
          {ROADMAP.map(release => (
            <article className="version-card" key={release.version}>
              <div className="version-head">
                <strong>{release.version}</strong>
                <span>{release.status}</span>
              </div>
              <h4>{release.name}</h4>
              <ul>
                {release.features.map(feature => <li key={feature}>{feature}</li>)}
              </ul>
            </article>
          ))}
        </div>
        <div className="roadmap-foot">
          <Icon name="trend" size={15} />
          Próximo foco recomendado: proyección de flujo de caja, detección de suscripciones y gastos atípicos.
        </div>
      </Card>
    </div>
  )
}
