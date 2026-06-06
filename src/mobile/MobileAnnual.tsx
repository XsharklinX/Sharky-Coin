import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { byCategory, fmtCompact, monthlySeries, totals } from '@/data/helpers'
import { exportElementPng } from '@/data/imageExport'
import { useFinance } from '@/store/finance'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function MobileAnnual({ mkey }: { mkey: string }) {
  const { transactions, categories, currency } = useFinance()
  const [exporting, setExporting] = useState(false)
  const year = Number(mkey.slice(0, 4))
  const yearTx = transactions.filter(tx => tx.date.startsWith(String(year)))
  const summary = totals(yearTx)
  const months = monthlySeries(transactions, year)
  const expenses = byCategory(yearTx, 'expense', categories)
  const incomeCategories = byCategory(yearTx, 'income', categories)
  const topMonth = months.reduce((best, m) => m.expense > best.expense ? m : best, months[0] ?? { label: '—', expense: 0 })
  const bestSavingsMonth = months.reduce((best, m) => m.net > best.net ? m : best, months[0] ?? { label: '—', net: 0 })
  const savingsRate = summary.income > 0 ? Math.round(summary.net / summary.income * 100) : 0
  const maxExpense = Math.max(1, ...months.map(m => m.expense))
  const maxIncome = Math.max(1, ...months.map(m => m.income))
  const maxBar = Math.max(maxExpense, maxIncome)
  const topExpenses = expenses.slice(0, 6)
  const totalExpense = Math.max(1, summary.expense)

  const handleExport = async () => {
    const el = document.getElementById('annual-capture')
    if (!el) return
    setExporting(true)
    try {
      await exportElementPng(el, `sharky-anual-${year}`)
      toast('Reporte exportado como imagen', { icon: 'download', type: 'ok' })
    } catch {
      toast('No se pudo exportar.', { icon: 'alert' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mobile-annual" id="annual-capture">
      {/* Hero */}
      <section className="mobile-annual-hero">
        <span className="mobile-annual-year">{year}</span>
        <h2>Resumen anual</h2>
        <strong className={summary.net >= 0 ? 'income' : 'expense'}>{fmtCompact(summary.net, currency)}</strong>
        <p>{summary.net >= 0 ? 'Ahorro neto del año' : 'Déficit del año'}</p>
      </section>

      {/* Métricas principales */}
      <div className="mobile-annual-metrics">
        <article>
          <small>Ingresos</small>
          <b className="income">{fmtCompact(summary.income, currency)}</b>
        </article>
        <article>
          <small>Gastos</small>
          <b className="expense">{fmtCompact(summary.expense, currency)}</b>
        </article>
        <article>
          <small>Ahorro</small>
          <b className={savingsRate >= 0 ? 'income' : 'expense'}>{savingsRate}%</b>
        </article>
      </div>

      {/* Highlights */}
      <div className="mobile-annual-highlights">
        <article>
          <Icon name="flame" size={18} />
          <div>
            <small>Mes de mayor gasto</small>
            <strong>{topMonth.label}</strong>
          </div>
        </article>
        <article>
          <Icon name="star" size={18} />
          <div>
            <small>Mejor mes de ahorro</small>
            <strong>{bestSavingsMonth.label}</strong>
          </div>
        </article>
        <article>
          <Icon name="list" size={18} />
          <div>
            <small>Movimientos totales</small>
            <strong>{yearTx.length}</strong>
          </div>
        </article>
      </div>

      {/* Barras por mes */}
      <section className="mobile-annual-card">
        <h3>Gastos e ingresos por mes</h3>
        <div className="mobile-annual-bars">
          {months.map(m => (
            <div key={m.key} className="mobile-annual-month">
              <div className="mobile-annual-bar-group">
                <span
                  className="bar-income"
                  style={{ height: `${Math.max(3, m.income / maxBar * 80)}px` }}
                  title={`Ingresos: ${fmtCompact(m.income, currency)}`}
                />
                <span
                  className="bar-expense"
                  style={{ height: `${Math.max(3, m.expense / maxBar * 80)}px` }}
                  title={`Gastos: ${fmtCompact(m.expense, currency)}`}
                />
              </div>
              <small>{MONTH_LABELS[Number(m.key.slice(5, 7)) - 1]}</small>
            </div>
          ))}
        </div>
        <div className="mobile-annual-legend">
          <span><i style={{ background: '#35d0a2' }} />Ingresos</span>
          <span><i style={{ background: '#ff6b8a' }} />Gastos</span>
        </div>
      </section>

      {/* Top categorías gasto */}
      {topExpenses.length > 0 && (
        <section className="mobile-annual-card">
          <h3>Top categorías de gasto</h3>
          <div className="mobile-category-bars">
            {topExpenses.map((item, idx) => (
              <article key={item.category.id}>
                <div>
                  <span style={{ color: item.category.color }}>
                    <strong style={{ fontSize: 11, marginRight: 4, opacity: .6 }}>#{idx + 1}</strong>
                    {item.category.name}
                  </span>
                  <strong>{fmtCompact(item.amount, currency)}</strong>
                </div>
                <div className="mobile-progress-track">
                  <span style={{ width: `${Math.min(100, item.amount / totalExpense * 100)}%`, background: item.category.color }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Top fuentes de ingreso */}
      {incomeCategories.length > 0 && (
        <section className="mobile-annual-card">
          <h3>Fuentes de ingreso</h3>
          <div className="mobile-annual-income-list">
            {incomeCategories.slice(0, 4).map(item => (
              <div key={item.category.id} className="mobile-annual-income-row">
                <span style={{ color: item.category.color }}>{item.category.name}</span>
                <strong className="income">{fmtCompact(item.amount, currency)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Exportar */}
      <button className="mobile-annual-export" disabled={exporting} onClick={handleExport}>
        <Icon name="download" size={19} />
        {exporting ? 'Generando imagen…' : 'Exportar imagen'}
      </button>
    </div>
  )
}
