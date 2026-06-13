import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { dateLocale, monthLabel } from '@/data/helpers'
import { exportExcel, exportMonthlyPdf } from '@/data/professionalExport'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useT } from '@/i18n'

export function MobileReports({ onImport, mkey }: { onImport?: () => void; mkey: string }) {
  const finance = useFinance()
  const ownerName = useSettings(s => s.displayName) || '$harky'
  const t = useT()
  const lang = (useSettings(s => s.language) ?? 'es') as 'en' | 'es'
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await exportMonthlyPdf(finance, mkey, ownerName)
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

  return (
    <div className="mrep-root">

      {/* Export */}
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
