import { useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { accountSavingsRate, byCategory, fmt, fmtCompact, monthlySeries, totals, transactionsForTotals } from '@/data/helpers'
import { exportElementPng } from '@/data/imageExport'
import { useFinance } from '@/store/finance'
import type { ViewProps } from '@/types'
import { BusyButton, Card } from './shared'

export function Annual({ txns, mkey }: ViewProps) {
  const { accounts, categories, currency } = useFinance()
  const capture = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const year = Number(mkey.slice(0, 4))
  const visTx = transactionsForTotals(txns, accounts)
  const yearTx = visTx.filter(tx => tx.date.startsWith(String(year)))
  const summary = totals(yearTx), months = monthlySeries(visTx, year)
  const expenses = byCategory(yearTx, 'expense', categories)
  const topMonth = months.reduce((best, month) => month.expense > best.expense ? month : best, months[0])
  const savingsRate = accountSavingsRate(accounts)

  return <div className="view">
    <div className="view-actions"><BusyButton className="btn-primary" busy={exporting} busyLabel="Generando imagen…" onClick={async () => { if (!capture.current) return; setExporting(true); try { await exportElementPng(capture.current, `sharky-reporte-anual-${year}`); toast('Reporte anual exportado', { icon: 'download', type: 'ok' }) } catch { toast('No se pudo exportar el reporte anual.', { icon: 'alert' }) } finally { setExporting(false) } }}><Icon name="download" size={15} /> Exportar imagen</BusyButton></div>
    <div className="wrapped" ref={capture}>
      <header className="wrapped-hero"><span>Reporte financiero anual</span><h2>Balance anual {year}</h2><p>Balance, comportamiento de gasto y evolución de tus finanzas durante el año.</p></header>
      <div className="wrapped-grid">
        <article><small>Ingresos del año</small><strong>{fmtCompact(summary.income, currency)}</strong></article>
        <article><small>Gastos del año</small><strong>{fmtCompact(summary.expense, currency)}</strong></article>
        <article><small>Tasa de ahorro</small><strong>{savingsRate.toFixed(1)}%</strong></article>
        <article><small>Mes de mayor gasto</small><strong>{topMonth?.label ?? '—'}</strong><em>{fmtCompact(topMonth?.expense ?? 0, currency)}</em></article>
      </div>
      <Card title="Ritmo del año" sub="Ingresos, gastos y ahorro por mes">
        <div className="rechart"><ResponsiveContainer><AreaChart data={months}><defs><linearGradient id="annualIncome" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#2ecc8f" stopOpacity={.5} /><stop offset="95%" stopColor="#2ecc8f" stopOpacity={0} /></linearGradient><linearGradient id="annualExpense" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#f65574" stopOpacity={.45} /><stop offset="95%" stopColor="#f65574" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" stroke="var(--text-dim)" /><YAxis stroke="var(--text-dim)" tickFormatter={value => fmtCompact(Number(value), currency)} /><Tooltip formatter={value => fmt(Number(value), currency)} /><Area type="monotone" dataKey="income" name="Ingresos" stroke="#2ecc8f" fill="url(#annualIncome)" /><Area type="monotone" dataKey="expense" name="Gastos" stroke="#f65574" fill="url(#annualExpense)" /><Area type="monotone" dataKey="net" name="Ahorro" stroke="#3b82f6" fill="transparent" /></AreaChart></ResponsiveContainer></div>
      </Card>
      <section className="wrapped-top"><h3>Top 5 categorías</h3>{expenses.slice(0, 5).map((item, index) => <div key={item.category.id}><b>#{index + 1}</b><span>{item.category.name}</span><strong>{fmtCompact(item.amount, currency)}</strong></div>)}</section>
    </div>
  </div>
}
