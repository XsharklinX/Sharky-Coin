import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { dateLocale, fmt, monthLabel } from '@/data/helpers'
import { createExecutiveSummary, exportCsv, exportExcel, exportMonthlyPdf } from '@/data/professionalExport'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'
import type { ViewId } from '@/types'

export function MobileReports({ onImport, mkey, goto }: { onImport?: () => void; mkey: string; goto: (view: ViewId) => void }) {
  const finance = useFinance()
  const ownerName = useSettings(s => s.displayName) || '$harky'
  const t = useT()
  const lang = (useSettings(s => s.language) ?? 'es') as 'en' | 'es'
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  const summary = useMemo(() => createExecutiveSummary(finance, mkey), [finance, mkey])
  const savingsPct = Math.max(0, Math.min(100, summary.savingsRate))
  const accountSnapshot = useMemo(() => {
    const visibleAccounts = finance.accounts.filter(account => account.includeInTotal !== false)
    const assets = visibleAccounts.reduce((sum, account) => sum + Math.max(0, account.balance), 0)
    const liabilities = visibleAccounts.reduce((sum, account) => sum + Math.abs(Math.min(0, account.balance)), 0)
    return {
      count: visibleAccounts.length,
      assets,
      liabilities,
      net: assets - liabilities,
    }
  }, [finance.accounts])

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
        <span className="mrep-hero-label">{t('reportSummaryTitle')}</span>
        <strong className="mrep-hero-value">{fmt(summary.net, finance.currency)}</strong>
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
        {summary.topCategory && (
          <div className="mrep-hero-row">
            <div className="mrep-hero-stat">
              <div>
                <small>{t('topCategoryLabel')}</small>
                <strong>{summary.topCategory} - {fmt(summary.topCategoryAmount, finance.currency)}</strong>
              </div>
            </div>
            <div className="mrep-hero-stat">
              <div>
                <small>{t('periodMonth')}</small>
                <strong>{monthLabel(mkey, dateLocale(lang))}</strong>
              </div>
            </div>
          </div>
        )}
        <p className="mrep-hero-headline">{summary.headline}</p>
      </div>

      <div className="mrep-tools-wrap">
        <p className="mrep-tools-heading">{t('accounts')}</p>
        <div className="mrep-nav-list">
          <button className="mrep-nav-row" onClick={() => goto('accounts')}>
            <span className="mrep-export-icon" style={{ background: '#5bc0ff22', color: '#5bc0ff' }}>
              <Icon name="cards" size={20} />
            </span>
            <div>
              <b>{t('netWorthLabel')}</b>
              <small>{accountSnapshot.count} {t('accounts').toLowerCase()}</small>
            </div>
            <strong className="mrep-nav-value">{fmt(accountSnapshot.net, finance.currency)}</strong>
          </button>
          <button className="mrep-nav-row" onClick={() => goto('accounts')}>
            <span className="mrep-export-icon" style={{ background: '#35d0a222', color: '#35d0a2' }}>
              <Icon name="wallet" size={20} />
            </span>
            <div>
              <b>{t('assetsLabel')}</b>
              <small>{t('bankAccountsGroupLabel')}</small>
            </div>
            <strong className="mrep-nav-value">{fmt(accountSnapshot.assets, finance.currency)}</strong>
          </button>
          <button className="mrep-nav-row" onClick={() => goto('debt')}>
            <span className="mrep-export-icon" style={{ background: '#ff6b8a22', color: '#ff6b8a' }}>
              <Icon name="dollar" size={20} />
            </span>
            <div>
              <b>{t('liabilitiesLabel')}</b>
              <small>{t('debtQuickDesc')}</small>
            </div>
            <strong className={`mrep-nav-value${accountSnapshot.liabilities > 0 ? ' text-expense' : ''}`}>{fmt(accountSnapshot.liabilities, finance.currency)}</strong>
          </button>
        </div>
      </div>

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
