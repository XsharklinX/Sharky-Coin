import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmt } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import type { Account, Category, CurrencyCode, Transaction } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)

function nextLabel(tx: Transaction): string {
  const next = tx.recurringNext ?? tx.date
  return new Date(`${next}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function freqLabel(tx: Transaction) {
  return tx.recurring === 'weekly' ? '/week' : '/month'
}

function monthlyEquivalent(tx: Transaction): number {
  return tx.recurring === 'weekly' ? tx.amount * 4.33 : tx.amount
}

type SheetMode = { tx: Transaction; confirm: boolean } | null

export function MobileSubscriptions() {
  const { transactions, categories, accounts, currency, updateTx, deleteTx } = useFinance()
  const [sheet, setSheet] = useState<SheetMode>(null)

  useMobileBackDismiss(!!sheet, () => setSheet(null))

  // Only recurring templates (not the generated instances — those have no recurring field)
  const recurring = transactions.filter(tx => tx.recurring)
  const monthly   = recurring.filter(tx => tx.recurring === 'monthly')
  const weekly    = recurring.filter(tx => tx.recurring === 'weekly')

  const totalMonthly = recurring.reduce((s, tx) => s + monthlyEquivalent(tx), 0)

  const handleEnd = (tx: Transaction) => {
    updateTx(tx.id, { recurringEnd: today() })
    toast(`"${tx.note}" stopped`, { icon: 'check', type: 'ok' })
    setSheet(null)
  }

  const handleDelete = (tx: Transaction) => {
    deleteTx(tx.id)
    toast(`"${tx.note}" deleted`, { icon: 'trash', type: 'ok' })
    setSheet(null)
  }

  if (recurring.length === 0) {
    return (
      <div className="msub-root">
        <div className="msub-empty">
          <Icon name="repeat" size={40} style={{ opacity: .2 }} />
          <p>No recurring transactions</p>
          <small>Add a recurring expense or income from the create screen.</small>
        </div>
      </div>
    )
  }

  return (
    <div className="msub-root">
      {/* Hero stat */}
      <div className="msub-hero">
        <div className="msub-hero-label">Monthly recurring</div>
        <div className="msub-hero-amount">{fmt(totalMonthly, currency)}</div>
        <div className="msub-hero-count">{recurring.length} subscription{recurring.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Monthly group */}
      {monthly.length > 0 && (
        <Section title="Monthly" txs={monthly} categories={categories} accounts={accounts}
          currency={currency} onOpen={tx => setSheet({ tx, confirm: false })} />
      )}

      {/* Weekly group */}
      {weekly.length > 0 && (
        <Section title="Weekly" txs={weekly} categories={categories} accounts={accounts}
          currency={currency} onOpen={tx => setSheet({ tx, confirm: false })} />
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
                Next occurrence: <strong>{nextLabel(sheet.tx)}</strong>
              </div>

              {!sheet.confirm ? (
                <>
                  <button className="msub-action-btn warn" onClick={() => handleEnd(sheet.tx)}>
                    <Icon name="close" size={16} /> Stop future occurrences
                  </button>
                  <button className="msub-action-btn danger"
                    onClick={() => setSheet(s => s ? { ...s, confirm: true } : s)}>
                    <Icon name="trash" size={16} /> Delete template
                  </button>
                </>
              ) : (
                <div className="msub-confirm">
                  <p>Delete "{sheet.tx.note}"? Past transactions are kept. Future ones won't be generated.</p>
                  <div className="msub-confirm-row">
                    <button onClick={() => setSheet(s => s ? { ...s, confirm: false } : s)}>Cancel</button>
                    <button className="danger" onClick={() => handleDelete(sheet.tx)}>Delete</button>
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

function Section({ title, txs, categories, accounts, currency, onOpen }: {
  title: string
  txs: Transaction[]
  categories: Category[]
  accounts: Account[]
  currency: CurrencyCode
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
                Next: {nextLabel(tx)}
                {isPast && <span className="msub-overdue"> · overdue</span>}
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
