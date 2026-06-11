import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { byCategory, dateLocale, monthlySeries, totals } from '@/data/helpers'
import { exportElementPng } from '@/data/imageExport'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { translateCategoryName, useT } from '@/i18n'
import { useFmt } from '@/hooks/useFmt'

export function MobileAnnual({ mkey }: { mkey: string }) {
  const { transactions, categories, currency } = useFinance()
  const fmtVal = useFmt()
  const t = useT()
  const lang = (useSettings(s => s.language) ?? 'es') as 'en' | 'es'
  const locale = dateLocale(lang)
  const [exporting, setExporting] = useState(false)
  const year = Number(mkey.slice(0, 4))
  const yearTx = transactions.filter(tx => tx.date.startsWith(String(year)))
  const summary = totals(yearTx)
  const months = monthlySeries(transactions, year, locale)
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

  const prevYear = year - 1
  const prevSummary = useMemo(
    () => totals(transactions.filter(tx => tx.date.startsWith(String(prevYear)))),
    [transactions, prevYear],
  )
  const compareRows: Array<{ label: string; current: number; prev: number; goodWhenUp: boolean; cls: string }> = [
    { label: t('incomes'), current: summary.income, prev: prevSummary.income, goodWhenUp: true, cls: 'income' },
    { label: t('expenses'), current: summary.expense, prev: prevSummary.expense, goodWhenUp: false, cls: 'expense' },
    { label: t('netLabel'), current: summary.net, prev: prevSummary.net, goodWhenUp: true, cls: summary.net >= 0 ? 'income' : 'expense' },
  ]
  const showCompare = prevSummary.income > 0 || prevSummary.expense > 0

  const handleExport = async () => {
    const el = document.getElementById('annual-capture')
    if (!el) return
    setExporting(true)
    try {
      await exportElementPng(el, `sharky-anual-${year}`)
      toast(t('reportExportedAsImage'), { icon: 'download', type: 'ok' })
    } catch {
      toast(t('couldNotExportPeriod'), { icon: 'alert' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mobile-annual" id="annual-capture">
      {/* Hero */}
      <section className="mobile-annual-hero">
        <span className="mobile-annual-year">{year}</span>
        <h2>{t('annualSummaryTitle')}</h2>
        <strong className={summary.net >= 0 ? 'income' : 'expense'}>{fmtVal(summary.net, currency)}</strong>
        <p>{summary.net >= 0 ? t('netSavingsOfYear') : t('deficitOfYear')}</p>
      </section>

      {/* Métricas principales */}
      <div className="mobile-annual-metrics">
        <article>
          <small>{t('incomes')}</small>
          <b className="income">{fmtVal(summary.income, currency)}</b>
        </article>
        <article>
          <small>{t('expenses')}</small>
          <b className="expense">{fmtVal(summary.expense, currency)}</b>
        </article>
        <article>
          <small>{t('savings')}</small>
          <b className={savingsRate >= 0 ? 'income' : 'expense'}>{savingsRate}%</b>
        </article>
      </div>

      {/* Highlights */}
      <div className="mobile-annual-highlights">
        <article>
          <Icon name="flame" size={18} />
          <div>
            <small>{t('highestExpenseMonthLabel')}</small>
            <strong>{topMonth.label}</strong>
          </div>
        </article>
        <article>
          <Icon name="star" size={18} />
          <div>
            <small>{t('bestSavingsMonthLabel')}</small>
            <strong>{bestSavingsMonth.label}</strong>
          </div>
        </article>
        <article>
          <Icon name="list" size={18} />
          <div>
            <small>{t('totalMovementsLabel')}</small>
            <strong>{yearTx.length}</strong>
          </div>
        </article>
      </div>

      {/* Comparativa interanual */}
      {showCompare && (
        <section className="mobile-annual-card">
          <h3>{t('compareVsYear').replace('{year}', String(prevYear))}</h3>
          <div className="man-compare-rows">
            {compareRows.map(row => {
              const delta = row.prev !== 0
                ? Math.round((row.current / row.prev - 1) * 100)
                : (row.current !== 0 ? 100 : 0)
              const isUp = delta >= 0
              const isGood = isUp === row.goodWhenUp
              return (
                <div key={row.label} className="man-compare-row">
                  <div className="man-compare-main">
                    <span className="man-compare-label">{row.label}</span>
                    <strong className={row.cls}>{fmtVal(row.current, currency)}</strong>
                  </div>
                  <div className="man-compare-side">
                    <span className={`man-compare-delta ${delta === 0 ? '' : isGood ? 'ok' : 'warn'}`}>
                      <Icon name={isUp ? 'arrowUp' : 'arrowDn'} size={11} />
                      {Math.abs(delta)}%
                    </span>
                    <small>{fmtVal(row.prev, currency)}</small>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Barras por mes */}
      <section className="mobile-annual-card">
        <h3>{t('expensesAndIncomeByMonth')}</h3>
        <div className="mobile-annual-bars">
          {months.map(m => (
            <div key={m.key} className="mobile-annual-month">
              <div className="mobile-annual-bar-group">
                <span
                  className="bar-income"
                  style={{ height: `${Math.max(3, m.income / maxBar * 80)}px` }}
                  title={t('incomeColon').replace('{amount}', fmtVal(m.income, currency))}
                />
                <span
                  className="bar-expense"
                  style={{ height: `${Math.max(3, m.expense / maxBar * 80)}px` }}
                  title={t('expenseColon').replace('{amount}', fmtVal(m.expense, currency))}
                />
              </div>
              <small>{m.label}</small>
            </div>
          ))}
        </div>
        <div className="mobile-annual-legend">
          <span><i style={{ background: '#35d0a2' }} />{t('incomes')}</span>
          <span><i style={{ background: '#ff6b8a' }} />{t('expenses')}</span>
        </div>
      </section>

      {/* Top categorías gasto */}
      {topExpenses.length > 0 && (
        <section className="mobile-annual-card">
          <h3>{t('topExpenseCategoriesTitle')}</h3>
          <div className="mobile-category-bars">
            {topExpenses.map((item, idx) => (
              <article key={item.category.id}>
                <div>
                  <span style={{ color: item.category.color }}>
                    <strong style={{ fontSize: 11, marginRight: 4, opacity: .6 }}>#{idx + 1}</strong>
                    {translateCategoryName(item.category, lang)}
                  </span>
                  <strong>{fmtVal(item.amount, currency)}</strong>
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
          <h3>{t('incomeSourcesTitle')}</h3>
          <div className="mobile-annual-income-list">
            {incomeCategories.slice(0, 4).map(item => (
              <div key={item.category.id} className="mobile-annual-income-row">
                <span style={{ color: item.category.color }}>{translateCategoryName(item.category, lang)}</span>
                <strong className="income">{fmtVal(item.amount, currency)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Exportar */}
      <button className="mobile-annual-export" disabled={exporting} onClick={handleExport}>
        <Icon name="download" size={19} />
        {exporting ? t('generatingImageEllipsis') : t('exportImageLabel')}
      </button>
    </div>
  )
}
