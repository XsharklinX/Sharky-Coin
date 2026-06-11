import { useState } from 'react'
import { useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { dateLocale, monthLabel } from '@/data/helpers'
import { exportExcel, exportMonthlyPdf } from '@/data/professionalExport'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useFmt } from '@/hooks/useFmt'
import { useT } from '@/i18n'
import type { Account, AccountType, ViewId } from '@/types'

function getTypeMeta(t: ReturnType<typeof useT>): Record<AccountType, { label: string; group: string; icon: Parameters<typeof Icon>[0]['name'] }> {
  return {
    cash:    { label: t('cash'),    group: t('cash'),                    icon: 'wallet' },
    debit:   { label: t('debit'),   group: t('bankAccountsGroupLabel'),  icon: 'cards'  },
    savings: { label: t('savings'), group: t('bankAccountsGroupLabel'),  icon: 'piggy'  },
    credit:  { label: t('credit'),  group: t('creditCardsGroupLabel'),   icon: 'cards'  },
  }
}

function accountKind(a: Account): 'asset' | 'debt' {
  return a.type === 'credit' || a.balance < 0 ? 'debt' : 'asset'
}

export function MobileReports({ goto, onImport, mkey }: { goto?: (v: ViewId) => void; onImport?: () => void; mkey: string }) {
  const finance = useFinance()
  const { accounts, currency } = finance
  const fmtVal = useFmt()
  const ownerName = useSettings(s => s.displayName) || '$harky'
  const t = useT()
  const lang = (useSettings(s => s.language) ?? 'es') as 'en' | 'es'
  const TYPE_META = getTypeMeta(t)
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

  const summary = useMemo(() => {
    const assets      = accounts.filter(a => accountKind(a) === 'asset').reduce((s, a) => s + Math.max(0, a.balance), 0)
    const liabilities = accounts.filter(a => accountKind(a) === 'debt').reduce((s, a) => s + Math.abs(Math.min(0, a.balance)), 0)
    return { assets, liabilities, net: assets - liabilities }
  }, [accounts])

  const groups = [t('cash'), t('bankAccountsGroupLabel'), t('creditCardsGroupLabel')].map(group => ({
    group,
    accounts: accounts.filter(a => TYPE_META[a.type].group === group),
  })).filter(g => g.accounts.length)

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="mrep-root">

      {/* Net worth hero */}
      <div className="mrep-hero">
        <span className="mrep-hero-label">{t('netWorthLabel')}</span>
        <strong className="mrep-hero-value">{fmtVal(summary.net, currency)}</strong>
        <div className="mrep-hero-bar">
          {summary.assets + summary.liabilities > 0 && (
            <div
              className="mrep-hero-bar-fill"
              style={{ width: `${Math.min(100, summary.assets / (summary.assets + summary.liabilities) * 100)}%` }}
            />
          )}
        </div>
        <div className="mrep-hero-row">
          <div className="mrep-hero-stat">
            <span className="mrep-hero-dot asset" />
            <div>
              <small>{t('assetsLabel')}</small>
              <strong>{fmtVal(summary.assets, currency)}</strong>
            </div>
          </div>
          <div className="mrep-hero-stat">
            <span className="mrep-hero-dot debt" />
            <div>
              <small>{t('liabilitiesLabel')}</small>
              <strong>{fmtVal(summary.liabilities, currency)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts breakdown */}
      {accounts.length === 0 ? (
        <div className="mrep-empty">
          <Icon name="cards" size={40} style={{ opacity: .25 }} />
          <p>{t('noAccountsAddFromProfile')}</p>
        </div>
      ) : (
        <>
          {/* Allocation bar */}
          {accounts.length > 1 && (
            <div className="mrep-allocation">
              <span className="mrep-section-title">{t('distributionLabel')}</span>
              <div className="mrep-alloc-bar">
                {accounts.map(a => (
                  <div
                    key={a.id}
                    className="mrep-alloc-segment"
                    style={{
                      flex: Math.max(0, a.balance) / Math.max(1, totalBalance),
                      background: a.color,
                    }}
                    title={t('nameColonAmount').replace('{name}', a.name).replace('{amount}', fmtVal(a.balance, currency))}
                  />
                ))}
              </div>
              <div className="mrep-alloc-legend">
                {accounts.map(a => (
                  <div key={a.id} className="mrep-legend-item">
                    <span style={{ background: a.color }} />
                    <small>{a.short || a.name}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {groups.map(({ group, accounts: accs }) => (
            <div key={group} className="mrep-group">
              <div className="mrep-group-header">
                <span>{group}</span>
                <strong>{fmtVal(accs.reduce((s, a) => s + a.balance, 0), currency)}</strong>
              </div>
              {accs.map(a => {
                const used    = a.type === 'credit' && a.limit ? Math.abs(Math.min(0, a.balance)) : null
                const utilPct = used !== null && a.limit ? Math.min(100, used / a.limit * 100) : null
                return (
                  <div key={a.id} className="mrep-account-row">
                    <span className="mrep-account-icon" style={{ background: a.color + '22', color: a.color }}>
                      <Icon name={TYPE_META[a.type].icon} size={20} />
                    </span>
                    <div className="mrep-account-info">
                      <b>{a.name}</b>
                      <small>{TYPE_META[a.type].label}{a.last4 ? ` · ·· ${a.last4}` : ''}</small>
                      {utilPct !== null && a.limit && (
                        <div className="mrep-util-wrap">
                          <div className="mrep-util-bar">
                            <div style={{
                              width: `${utilPct}%`,
                              background: utilPct >= 90 ? '#ff6b8a' : utilPct >= 70 ? '#f59e0b' : '#35d0a2',
                            }} />
                          </div>
                          <span className={utilPct >= 90 ? 'text-expense' : utilPct >= 70 ? 'text-warn' : ''}>
                            {t('pctUsedAvailable').replace('{pct}', String(Math.round(utilPct))).replace('{amount}', fmtVal(a.limit - used!, currency))}
                          </span>
                        </div>
                      )}
                    </div>
                    <strong className={accountKind(a) === 'debt' ? 'text-expense' : ''}>
                      {fmtVal(a.balance, currency)}
                    </strong>
                  </div>
                )
              })}
            </div>
          ))}
        </>
      )}
      {/* Tools */}
      {(goto || onImport) && (
        <div className="mrep-tools-wrap">
          {goto && (
            <>
              <p className="mrep-tools-heading">{t('toolsLabel')}</p>
              <div className="mrep-tools-grid">
                <button className="mrep-tool-card" onClick={() => goto('debt')}>
                  <span className="mrep-tool-card-icon" style={{ background: '#ff6b8a22', color: '#ff6b8a' }}>
                    <Icon name="dollar" size={24} />
                  </span>
                  <strong>{t('debtCalculator')}</strong>
                  <small>{t('debtToolDesc')}</small>
                  <span className="mrep-tool-card-arrow"><Icon name="arrowUp" size={14} style={{ transform: 'rotate(90deg)' }} /></span>
                </button>
                <button className="mrep-tool-card" onClick={() => goto('subscriptions')}>
                  <span className="mrep-tool-card-icon" style={{ background: '#5bc0ff22', color: '#5bc0ff' }}>
                    <Icon name="repeat" size={24} />
                  </span>
                  <strong>{t('recurringPaymentsTitle')}</strong>
                  <small>{t('recurringToolDesc')}</small>
                  <span className="mrep-tool-card-arrow"><Icon name="arrowUp" size={14} style={{ transform: 'rotate(90deg)' }} /></span>
                </button>
              </div>
            </>
          )}

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
      )}
    </div>
  )
}
