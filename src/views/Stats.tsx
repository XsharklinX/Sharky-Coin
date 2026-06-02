import { useMemo, useRef, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { byCategory, fmt, fmtCompact, monthLabel, monthlySeries, totals } from '@/data/helpers'
import { exportElementPng } from '@/data/imageExport'
import { useFinance } from '@/store/finance'
import type { ViewProps } from '@/types'
import { BusyButton, Card, MiniStat } from './shared'

export function Stats({ txns, mkey }: ViewProps) {
  const { accounts, categories, currency } = useFinance()
  const capture = useRef<HTMLDivElement>(null)
  const [year, setYear] = useState(Number(mkey.slice(0, 4)))
  const [exporting, setExporting] = useState(false)
  const yearTx = txns.filter(tx => tx.date.startsWith(String(year))), summary = totals(yearTx)
  const months = monthlySeries(txns, year)
  const previous = monthlySeries(txns, year - 1)
  const comparison = months.map((month, index) => ({ label: month.label, actual: month.expense, anterior: previous[index].expense }))
  const categoryData = byCategory(yearTx, 'expense', categories).map(item => ({ name: item.category.name, size: item.amount, fill: item.category.color }))
  const currentNetWorth = accounts.reduce((sum, account) => sum + account.balance, 0)
  let running = currentNetWorth - months.reduce((sum, month) => sum + month.net, 0)
  const netWorth = months.map(month => ({ label: month.label, value: running += month.net }))

  // ── Desglose por etiqueta ────────────────────────────────
  const tagBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    yearTx.forEach(tx => {
      if (tx.type !== 'expense' || !tx.tags?.length) return
      tx.tags.forEach(tag => { map[tag] = (map[tag] ?? 0) + tx.amount })
    })
    return Object.entries(map).map(([tag, amount]) => ({ tag, amount })).sort((a, b) => b.amount - a.amount)
  }, [yearTx])

  const txWithTags   = yearTx.filter(tx => tx.tags?.length).length
  const txWithoutTag = yearTx.filter(tx => tx.type === 'expense' && (!tx.tags || tx.tags.length === 0)).length

  return <div className="view">
    <div className="toolbar"><select aria-label="Año estadístico" className="select" value={year} onChange={event => setYear(Number(event.target.value))}>{[year, year - 1].map(value => <option key={value}>{value}</option>)}</select><BusyButton className="btn-ghost" busy={exporting} busyLabel="Generando PNG…" onClick={async () => { if (!capture.current) return; setExporting(true); try { await exportElementPng(capture.current, `sharky-estadisticas-${year}`); toast('Gráfica exportada', { icon: 'download', type: 'ok' }) } catch { toast('No se pudo exportar la gráfica.', { icon: 'alert' }) } finally { setExporting(false) } }}><Icon name="download" size={14} /> Exportar PNG</BusyButton></div>
    <div ref={capture}>
      <div className="grid-4" style={{ marginBottom: 16 }}><MiniStat label="Ingresos" amount={summary.income} color="var(--income)" /><MiniStat label="Gastos" amount={summary.expense} color="var(--expense)" /><MiniStat label="Ahorro" amount={summary.net} color="var(--accent)" /><MiniStat label="Categoría top" value={categoryData[0]?.name ?? '—'} color="var(--accent2)" /></div>
      <div className="grid-1-1">
        <Card title="Patrimonio neto histórico" sub={`${year} · estimado al cierre de cada mes`}><ChartFrame><LineChart data={netWorth}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" /><YAxis tickFormatter={value => fmtCompact(Number(value), currency)} /><Tooltip formatter={value => fmt(Number(value), currency)} /><Line type="monotone" dataKey="value" name="Patrimonio" stroke="#3b82f6" strokeWidth={3} dot={false} /></LineChart></ChartFrame></Card>
        <Card title="Categorías principales" sub={monthLabel(`${year}-01`).replace(/enero de /, '')}>
          <CategoryBreakdown data={categoryData} currency={currency} />
        </Card>
      </div>
      <div className="grid-1-1 dashboard-section">
        <Card title="Ingresos, gastos y ahorro" sub="Área apilada mensual"><ChartFrame><AreaChart data={months}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" /><YAxis tickFormatter={value => fmtCompact(Number(value), currency)} /><Tooltip formatter={value => fmt(Number(value), currency)} /><Legend /><Area stackId="flow" type="monotone" dataKey="income" name="Ingresos" stroke="#2ecc8f" fill="#2ecc8f" fillOpacity={.35} /><Area stackId="flow" type="monotone" dataKey="expense" name="Gastos" stroke="#f65574" fill="#f65574" fillOpacity={.35} /><Area type="monotone" dataKey="net" name="Ahorro" stroke="#3b82f6" fill="#3b82f6" fillOpacity={.12} /></AreaChart></ChartFrame></Card>
        <Card title="Comparativa interanual" sub={`${year - 1} vs ${year}`}><ChartFrame><BarChart data={comparison}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" /><YAxis tickFormatter={value => fmtCompact(Number(value), currency)} /><Tooltip formatter={value => fmt(Number(value), currency)} /><Legend /><Bar dataKey="anterior" name={String(year - 1)} fill="#8a96ac" radius={[4, 4, 0, 0]} /><Bar dataKey="actual" name={String(year)} fill="#f65574" radius={[4, 4, 0, 0]} /></BarChart></ChartFrame></Card>
      </div>
    </div>

    {/* ── Desglose por etiqueta ── */}
    {tagBreakdown.length > 0 && (
      <Card title="Gastos por etiqueta" sub={`${year} · ${txWithTags} movimientos etiquetados · ${txWithoutTag} sin etiqueta`}
        style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tagBreakdown.map(({ tag, amount }) => {
            const pct = summary.expense > 0 ? Math.round((amount / summary.expense) * 100) : 0
            return (
              <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tag-chip" style={{ flexShrink: 0, cursor: 'default' }}>#{tag}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 6, background: 'var(--track)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)',
                      borderRadius: 999, transition: 'width .5s ease' }} />
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', width: 28, textAlign: 'right' }}>{pct}%</span>
                <span style={{ fontSize: 13, fontWeight: 650, fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text)', minWidth: 80, textAlign: 'right' }}>
                  {fmtCompact(amount, currency)}
                </span>
              </div>
            )
          })}
        </div>
      </Card>
    )}
  </div>
}

function ChartFrame({ children }: { children: React.ReactElement }) {
  return <div className="rechart"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
}

function CategoryBreakdown({ data, currency }: {
  data: { name: string; size: number; fill: string }[]
  currency: ReturnType<typeof useFinance.getState>['currency']
}) {
  const total = data.reduce((sum, item) => sum + item.size, 0)
  if (!data.length) return <div className="stats-empty">Todavía no hay gastos registrados para este año.</div>

  return (
    <div className="stats-categories">
      {data.slice(0, 6).map(item => {
        const percentage = total ? Math.round(item.size / total * 100) : 0
        return (
          <div className="stats-category-row" key={item.name}>
            <i style={{ background: item.fill }} />
            <div>
              <span><b>{item.name}</b><em>{percentage}%</em></span>
              <div className="stats-category-track"><div style={{ background: item.fill, width: `${percentage}%` }} /></div>
            </div>
            <strong>{fmtCompact(item.size, currency)}</strong>
          </div>
        )
      })}
    </div>
  )
}
