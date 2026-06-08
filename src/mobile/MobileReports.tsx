import { useState } from 'react'
import { useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmtCompact, monthLabel } from '@/data/helpers'
import { exportExcel, exportMonthlyPdf } from '@/data/professionalExport'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { Account, AccountType, ViewId } from '@/types'

const TYPE_META: Record<AccountType, { label: string; group: string; icon: Parameters<typeof Icon>[0]['name'] }> = {
  cash:    { label: 'Efectivo', group: 'Efectivo',           icon: 'wallet' },
  debit:   { label: 'Débito',  group: 'Cuentas bancarias',   icon: 'cards'  },
  savings: { label: 'Ahorros', group: 'Cuentas bancarias',   icon: 'piggy'  },
  credit:  { label: 'Crédito', group: 'Tarjetas de crédito', icon: 'cards'  },
}

function accountKind(a: Account): 'asset' | 'debt' {
  return a.type === 'credit' || a.balance < 0 ? 'debt' : 'asset'
}

export function MobileReports({ goto, onImport, mkey }: { goto?: (v: ViewId) => void; onImport?: () => void; mkey: string }) {
  const finance = useFinance()
  const { accounts, currency } = finance
  const ownerName = useSettings(s => s.displayName) || '$harky'
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await exportMonthlyPdf(finance, mkey, ownerName)
      toast(`Estado de ${monthLabel(mkey)} exportado en PDF`, { icon: 'download', type: 'ok' })
    } catch {
      toast('No se pudo generar el PDF.', { icon: 'alert' })
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      await exportExcel(finance)
      toast('Reporte completo exportado en Excel', { icon: 'download', type: 'ok' })
    } catch {
      toast('No se pudo generar el Excel.', { icon: 'alert' })
    } finally {
      setExportingExcel(false)
    }
  }

  const summary = useMemo(() => {
    const assets      = accounts.filter(a => accountKind(a) === 'asset').reduce((s, a) => s + Math.max(0, a.balance), 0)
    const liabilities = accounts.filter(a => accountKind(a) === 'debt').reduce((s, a) => s + Math.abs(Math.min(0, a.balance)), 0)
    return { assets, liabilities, net: assets - liabilities }
  }, [accounts])

  const groups = ['Efectivo', 'Cuentas bancarias', 'Tarjetas de crédito'].map(group => ({
    group,
    accounts: accounts.filter(a => TYPE_META[a.type].group === group),
  })).filter(g => g.accounts.length)

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="mrep-root">

      {/* Net worth hero */}
      <div className="mrep-hero">
        <span className="mrep-hero-label">Patrimonio neto</span>
        <strong className="mrep-hero-value">{fmtCompact(summary.net, currency)}</strong>
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
              <small>Activos</small>
              <strong>{fmtCompact(summary.assets, currency)}</strong>
            </div>
          </div>
          <div className="mrep-hero-stat">
            <span className="mrep-hero-dot debt" />
            <div>
              <small>Pasivos</small>
              <strong>{fmtCompact(summary.liabilities, currency)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts breakdown */}
      {accounts.length === 0 ? (
        <div className="mrep-empty">
          <Icon name="cards" size={40} style={{ opacity: .25 }} />
          <p>Sin cuentas aún. Agrégalas desde tu Perfil.</p>
        </div>
      ) : (
        <>
          {/* Allocation bar */}
          {accounts.length > 1 && (
            <div className="mrep-allocation">
              <span className="mrep-section-title">Distribución</span>
              <div className="mrep-alloc-bar">
                {accounts.map(a => (
                  <div
                    key={a.id}
                    className="mrep-alloc-segment"
                    style={{
                      flex: Math.max(0, a.balance) / Math.max(1, totalBalance),
                      background: a.color,
                    }}
                    title={`${a.name}: ${fmtCompact(a.balance, currency)}`}
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
                <strong>{fmtCompact(accs.reduce((s, a) => s + a.balance, 0), currency)}</strong>
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
                            {Math.round(utilPct)}% usado · {fmtCompact(a.limit - used!, currency)} disponible
                          </span>
                        </div>
                      )}
                    </div>
                    <strong className={accountKind(a) === 'debt' ? 'text-expense' : ''}>
                      {fmtCompact(a.balance, currency)}
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
        <div className="mrep-tools">
          <span className="mrep-section-title">Herramientas</span>
          {goto && (
            <button className="mrep-tool-row" onClick={() => goto('debt')}>
              <span className="mrep-tool-icon" style={{ background: '#ff6b8a22', color: '#ff6b8a' }}>
                <Icon name="dollar" size={20} />
              </span>
              <div>
                <b>Calculadora de deudas</b>
                <small>Snowball · Avalanche · Plan de pago</small>
              </div>
              <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', marginLeft: 'auto', flexShrink: 0 }} />
            </button>
          )}
          {goto && (
            <button className="mrep-tool-row" onClick={() => goto('subscriptions')}>
              <span className="mrep-tool-icon" style={{ background: '#5bc0ff22', color: '#5bc0ff' }}>
                <Icon name="repeat" size={20} />
              </span>
              <div>
                <b>Suscripciones</b>
                <small>Gastos recurrentes</small>
              </div>
              <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', marginLeft: 'auto', flexShrink: 0 }} />
            </button>
          )}
          <button className="mrep-tool-row" disabled={exportingPdf} onClick={handleExportPdf}>
            <span className="mrep-tool-icon" style={{ background: '#ffdd3d22', color: '#ffdd3d' }}>
              <Icon name="download" size={20} />
            </span>
            <div>
              <b>Estado del mes (PDF)</b>
              <small>{exportingPdf ? 'Generando…' : `Resumen de ${monthLabel(mkey)} listo para compartir`}</small>
            </div>
            <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', marginLeft: 'auto', flexShrink: 0 }} />
          </button>
          <button className="mrep-tool-row" disabled={exportingExcel} onClick={handleExportExcel}>
            <span className="mrep-tool-icon" style={{ background: '#35d0a222', color: '#35d0a2' }}>
              <Icon name="download" size={20} />
            </span>
            <div>
              <b>Reporte completo (Excel)</b>
              <small>{exportingExcel ? 'Generando…' : 'Movimientos, cuentas y categorías por hoja'}</small>
            </div>
            <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', marginLeft: 'auto', flexShrink: 0 }} />
          </button>
          {onImport && (
            <button className="mrep-tool-row" onClick={onImport}>
              <span className="mrep-tool-icon" style={{ background: '#35d0a222', color: '#35d0a2' }}>
                <Icon name="upload" size={20} />
              </span>
              <div>
                <b>Importar extracto</b>
                <small>CSV · OFX desde bancos dominicanos</small>
              </div>
              <Icon name="arrowUp" size={13} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', marginLeft: 'auto', flexShrink: 0 }} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
