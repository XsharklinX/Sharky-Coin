import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { byCategory, dateLocale, fmt, fmtCompact, monthLabel, txForMonth } from '@/data/helpers'
import { createExecutiveSummary, exportCsv, exportExcel, exportMonthlyPdf } from '@/data/professionalExport'
import { translateCategoryName, useT } from '@/i18n'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { IconName } from '@/types'

const CATEGORY_BAR_COLORS = ['#ffdd3d', '#35d0a2', '#5bc0ff', '#a78bfa', '#ff6b8a']

export function MobileReports({ onImport, mkey }: { onImport?: () => void; mkey: string }) {
  const finance = useFinance()
  const ownerName = useSettings(s => s.displayName) || '$harky'
  const t = useT()
  const lang = (useSettings(s => s.language) ?? 'es') as 'en' | 'es'
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  const summary = useMemo(() => createExecutiveSummary(finance, mkey), [finance, mkey])
  const savingsPct = Math.max(0, Math.min(100, summary.savingsRate))
  const topCategories = useMemo(() => {
    const monthTx = txForMonth(finance.transactions, mkey)
    const rows = byCategory(monthTx, 'expense', finance.categories).slice(0, 5)
    const max = rows[0]?.amount ?? 0
    return rows.map((row, index) => ({
      ...row,
      pct: max > 0 ? Math.round((row.amount / max) * 100) : 0,
      color: CATEGORY_BAR_COLORS[index % CATEGORY_BAR_COLORS.length],
    }))
  }, [finance.transactions, finance.categories, mkey])

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await exportMonthlyPdf(finance, mkey, ownerName, lang)
      toast(t('pdfExportedFor').replace('{month}', monthLabel(mkey, dateLocale(lang))), { icon: 'download', type: 'ok' })
    } catch {
      toast(t('pdfExportError'), { icon: 'alert' })
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      await exportExcel(finance)
      toast(t('excelExported'), { icon: 'download', type: 'ok' })
    } catch {
      toast(t('excelExportError'), { icon: 'alert' })
    } finally {
      setExportingExcel(false)
    }
  }

  const handleExportCsv = async () => {
    setExportingCsv(true)
    try {
      await exportCsv(finance)
      toast(t('csvExported'), { icon: 'download', type: 'ok' })
    } catch {
      toast(t('csvExportError'), { icon: 'alert' })
    } finally {
      setExportingCsv(false)
    }
  }

  return (
    <div className="mrep-root">
      <div className="mrep-hero">
        <div className="mrep-hero-top">
          <div>
            <span className="mrep-hero-label">{t('reportSummaryTitle')}</span>
            <strong className="mrep-hero-value">{fmt(summary.net, finance.currency)}</strong>
          </div>
          <span className="mrep-hero-month">{monthLabel(mkey, dateLocale(lang))}</span>
        </div>
        <div className="mrep-hero-bar">
          {summary.income > 0 && <div className="mrep-hero-bar-fill" style={{ width: `${savingsPct}%` }} />}
        </div>
        <div className="mrep-hero-row">
          <div className="mrep-hero-stat">
            <span className="mrep-hero-dot asset" />
            <div>
              <small>{t('incomes')}</small>
              <strong>{fmt(summary.income, finance.currency)}</strong>
            </div>
          </div>
          <div className="mrep-hero-stat">
            <span className="mrep-hero-dot debt" />
            <div>
              <small>{t('expenses')}</small>
              <strong>{fmt(summary.expense, finance.currency)}</strong>
            </div>
          </div>
        </div>
        <p className="mrep-hero-headline">{summary.headline}</p>
      </div>

      {topCategories.length > 0 && (
        <div className="mrep-tools-wrap">
          <p className="mrep-tools-heading">{t('topCategoriesLabel')}</p>
          <div className="mrep-cat-list">
            {topCategories.map(row => (
              <div className="mrep-cat-row" key={row.category.id}>
                <span className="mrep-cat-icon" style={{ background: row.color + '22', color: row.color }}>
                  <Icon name={row.category.icon as IconName} size={17} />
                </span>
                <div className="mrep-cat-info">
                  <div className="mrep-cat-info-head">
                    <b>{translateCategoryName(row.category, lang)}</b>
                    <strong>{fmtCompact(row.amount, finance.currency)}</strong>
                  </div>
                  <div className="mrep-cat-track">
                    <div className="mrep-cat-fill" style={{ width: `${row.pct}%`, background: row.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mrep-tools-wrap">
        <p className="mrep-tools-heading">{t('exportData')}</p>
        <div className="mrep-export-list">
          <button className="mrep-export-row" disabled={exportingPdf} onClick={handleExportPdf}>
            <span className="mrep-export-icon" style={{ background: '#ffdd3d22', color: '#ffdd3d' }}>
              <Icon name="book" size={20} />
            </span>
            <div>
              <b>{t('monthStatementPdf')}</b>
              <small>{exportingPdf ? t('generatingPdf') : t('monthSummaryReadyToShare').replace('{month}', monthLabel(mkey, dateLocale(lang)))}</small>
            </div>
            {!exportingPdf && <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', flexShrink: 0 }} />}
          </button>
          <button className="mrep-export-row" disabled={exportingExcel} onClick={handleExportExcel}>
            <span className="mrep-export-icon" style={{ background: '#35d0a222', color: '#35d0a2' }}>
              <Icon name="trend" size={20} />
            </span>
            <div>
              <b>{t('fullReportExcelTitle')}</b>
              <small>{exportingExcel ? t('generatingExcel') : t('movementsAccountsCategories')}</small>
            </div>
            {!exportingExcel && <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', flexShrink: 0 }} />}
          </button>
          <button className="mrep-export-row" disabled={exportingCsv} onClick={handleExportCsv}>
            <span className="mrep-export-icon" style={{ background: '#5b9bff22', color: '#5b9bff' }}>
              <Icon name="fileJson" size={20} />
            </span>
            <div>
              <b>{t('fullReportCsvTitle')}</b>
              <small>{exportingCsv ? t('generatingCsv') : t('csvReportReady')}</small>
            </div>
            {!exportingCsv && <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', flexShrink: 0 }} />}
          </button>
          {onImport && (
            <button className="mrep-export-row" onClick={onImport}>
              <span className="mrep-export-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
                <Icon name="upload" size={20} />
              </span>
              <div>
                <b>{t('importBankStatement')}</b>
                <small>{t('csvOfxFromBanks')}</small>
              </div>
              <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', flexShrink: 0 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
