import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { dateLocale, fmt } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import type { Account, Category, CurrencyCode, Transaction } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)

function nextLabel(tx: Transaction, locale: string): string {
  const next = tx.recurringNext ?? tx.date
  return new Date(`${next}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

function freqLabel(tx: Transaction) {
  return tx.recurring === 'weekly' ? '/semana' : '/mes'
}

function monthlyEquivalent(tx: Transaction): number {
  return tx.recurring === 'weekly' ? tx.amount * 4.33 : tx.amount
}

type SheetMode = { tx: Transaction; confirm: boolean } | null

export function MobileSubscriptions() {
  const { transactions, categories, accounts, currency, updateTx, deleteTx } = useFinance()
  const lang = useSettings(s => s.language)
  const locale = dateLocale(lang)
  const [sheet, setSheet] = useState<SheetMode>(null)

  useMobileBackDismiss(!!sheet, () => setSheet(null))

  // Only recurring templates (not the generated instances — those have no recurring field)
  const recurring = transactions.filter(tx => tx.recurring)
  const monthly   = recurring.filter(tx => tx.recurring === 'monthly')
  const weekly    = recurring.filter(tx => tx.recurring === 'weekly')

  const totalMonthly = recurring.reduce((s, tx) => s + monthlyEquivalent(tx), 0)

  const handleEnd = (tx: Transaction) => {
    updateTx(tx.id, { recurringEnd: today() })
    toast(`"${tx.note}" detenido`, { icon: 'check', type: 'ok' })
    setSheet(null)
  }

  const handleDelete = (tx: Transaction) => {
    deleteTx(tx.id)
    toast(`"${tx.note}" eliminado`, { icon: 'trash', type: 'ok' })
    setSheet(null)
  }

  if (recurring.length === 0) {
    return (
      <div className="msub-root">
        <div className="msub-empty">
          <Icon name="repeat" size={40} style={{ opacity: .2 }} />
          <p>Sin pagos recurrentes</p>
          <small>Agrega un gasto o ingreso recurrente desde la pantalla de creación.</small>
        </div>
      </div>
    )
  }

  return (
    <div className="msub-root">
      {/* Hero stat */}
      <div className="msub-hero">
        <div className="msub-hero-label">Recurrente mensual</div>
        <div className="msub-hero-amount">{fmt(totalMonthly, currency)}</div>
        <div className="msub-hero-count">{recurring.length} pago{recurring.length !== 1 ? 's' : ''} recurrente{recurring.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Monthly group */}
      {monthly.length > 0 && (
        <Section title="Mensual" txs={monthly} categories={categories} accounts={accounts}
          currency={currency} locale={locale} onOpen={tx => setSheet({ tx, confirm: false })} />
      )}

      {weekly.length > 0 && (
        <Section title="Semanal" txs={weekly} categories={categories} accounts={accounts}
          currency={currency} locale={locale} onOpen={tx => setSheet({ tx, confirm: false })} />
      )}

      {/* Action sheet */}
      {sheet && (
        <div className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={sheet.tx.note} onClick={() => setSheet(null)}>
          <section className="msub-sheet" onClick={e => e.stopPropagation()}>
            <header>
              <span>{sheet.tx.note}</span>
              <button aria-label="Cerrar" onClick={() => setSheet(null)}><Icon name="close" size={18} /></button>
            </header>
            <div className="msub-sheet-body">
              <div className="msub-sheet-amount">
                {fmt(sheet.tx.amount, currency)}
                <span>{freqLabel(sheet.tx)}</span>
              </div>
              <div className="msub-sheet-meta">
                Próximo: <strong>{nextLabel(sheet.tx, locale)}</strong>
              </div>

              {!sheet.confirm ? (
                <>
                  <button className="msub-action-btn warn" onClick={() => handleEnd(sheet.tx)}>
                    <Icon name="close" size={16} /> Detener futuras ocurrencias
                  </button>
                  <button className="msub-action-btn danger"
                    onClick={() => setSheet(s => s ? { ...s, confirm: true } : s)}>
                    <Icon name="trash" size={16} /> Eliminar plantilla
                  </button>
                </>
              ) : (
                <div className="msub-confirm">
                  <p>¿Eliminar "{sheet.tx.note}"? Los movimientos pasados se conservan. Los futuros no se generarán.</p>
                  <div className="msub-confirm-row">
                    <button onClick={() => setSheet(s => s ? { ...s, confirm: false } : s)}>Cancelar</button>
                    <button className="danger" onClick={() => handleDelete(sheet.tx)}>Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function Section({ title, txs, categories, accounts, currency, locale, onOpen }: {
  title: string
  txs: Transaction[]
  categories: Category[]
  accounts: Account[]
  currency: CurrencyCode
  locale: string
  onOpen: (tx: Transaction) => void
}) {
  const sectionTotal = txs.reduce((s, tx) => s + tx.amount, 0)

  return (
    <div className="msub-section">
      <div className="msub-section-header">
        <span>{title}</span>
        <span>{fmt(sectionTotal, currency)}</span>
      </div>
      {txs.map(tx => {
        const cat  = categories.find(c => c.id === tx.categoryId)
        const acct = accounts.find(a => a.id === tx.accountId)
        const isPast = (tx.recurringNext ?? tx.date) < today()
        return (
          <button key={tx.id} className="msub-row" onClick={() => onOpen(tx)}>
            <span className="msub-cat-icon" style={{ background: (cat?.color ?? '#888') + '22', color: cat?.color ?? '#888' }}>
              <Icon name={cat?.icon ?? 'repeat'} size={20} />
            </span>
            <div className="msub-row-info">
              <b>{tx.note || cat?.name || '—'}</b>
              <small>
                Próx: {nextLabel(tx, locale)}
                {isPast && <span className="msub-overdue"> · vencido</span>}
                {acct && <> · <span style={{ color: acct.color }}>●</span> {acct.short}</>}
              </small>
            </div>
            <div className="msub-row-right">
              <strong className={tx.type === 'expense' ? 'text-expense' : 'text-income'}>
                {tx.type === 'expense' ? '−' : '+'}{fmt(tx.amount, currency)}
              </strong>
            </div>
          </button>
        )
      })}
    </div>
  )
}
