import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { currentMonthKey, dateLocale, fmt } from '@/data/helpers'
import { detectSubscriptions, type SubscriptionInsight } from '@/data/financeIntelligence'
import { advanceRecurrenceDate } from '@/hooks/useRecurring'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { translateCategoryName, useT } from '@/i18n'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { useDialogA11y } from './useDialogA11y'
import type { Account, Category, CurrencyCode, RecurrenceFrequency, Transaction } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)

function nextLabel(tx: Transaction, locale: string): string {
  const next = tx.recurringNext ?? tx.date
  return new Date(`${next}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

function freqLabel(tx: Transaction, t: ReturnType<typeof useT>) {
  return tx.recurring === 'weekly' ? t('perWeekShort') : t('perMonthShort')
}

function monthlyEquivalent(tx: Transaction): number {
  return tx.recurring === 'weekly' ? tx.amount * 4.33 : tx.amount
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

type SheetMode = { tx: Transaction; confirm: boolean } | null

export function MobileSubscriptions() {
  const { transactions, categories, accounts, currency, addTx, updateTx, deleteTx } = useFinance()
  const t = useT()
  const lang = (useSettings(s => s.language) ?? 'es') as 'en' | 'es'
  const locale = dateLocale(lang)
  const [sheet, setSheet] = useState<SheetMode>(null)
  const [converting, setConverting] = useState<SubscriptionInsight | null>(null)

  useMobileBackDismiss(!!sheet, () => setSheet(null))
  const dialogRef = useDialogA11y<HTMLDivElement>(() => setSheet(null), !!sheet)
  const convertRef = useDialogA11y<HTMLDivElement>(() => setConverting(null), !!converting)

  // Only recurring templates (not the generated instances — those have no recurring field)
  const recurring = transactions.filter(tx => tx.recurring)
  const monthly   = recurring.filter(tx => tx.recurring === 'monthly')
  const weekly    = recurring.filter(tx => tx.recurring === 'weekly')

  const totalMonthly = recurring.reduce((s, tx) => s + monthlyEquivalent(tx), 0)

  const detected = useMemo(
    () => detectSubscriptions(transactions, currentMonthKey()).filter(s => !s.alreadyRecurring),
    [transactions],
  )

  const handleEnd = (tx: Transaction) => {
    updateTx(tx.id, { recurringEnd: today() })
    toast(t('stoppedToast').replace('{name}', tx.note), { icon: 'check', type: 'ok' })
    setSheet(null)
  }

  const handleDelete = (tx: Transaction) => {
    deleteTx(tx.id)
    toast(t('deletedToast').replace('{name}', tx.note), { icon: 'trash', type: 'ok' })
    setSheet(null)
  }

  const handleConvert = (fields: { note: string; amount: number; categoryId: string; accountId: string; recurring: RecurrenceFrequency }) => {
    const start = today()
    try {
      addTx({
        type: 'expense',
        amount: fields.amount,
        date: start,
        note: fields.note,
        categoryId: fields.categoryId,
        accountId: fields.accountId,
        recurring: fields.recurring,
        recurringStart: start,
        recurringNext: advanceRecurrenceDate(start, fields.recurring),
      })
      toast(t('scheduledAsRecurringToast').replace('{name}', fields.note), { icon: 'check', type: 'ok' })
      setConverting(null)
    } catch (error) {
      toast(error instanceof Error ? error.message : t('couldNotCreateRecurrence'), { icon: 'alert' })
    }
  }

  if (recurring.length === 0 && detected.length === 0) {
    return (
      <div className="msub-root">
        <div className="msub-empty">
          <Icon name="repeat" size={40} style={{ opacity: .2 }} />
          <p>{t('noRecurringPayments')}</p>
          <small>{t('addRecurringHint')}</small>
        </div>
      </div>
    )
  }

  return (
    <div className="msub-root">
      {/* Hero stat */}
      {recurring.length > 0 && (
        <div className="msub-hero">
          <div className="msub-hero-label">{t('monthlyRecurringLabel')}</div>
          <div className="msub-hero-amount">{fmt(totalMonthly, currency)}</div>
          <div className="msub-hero-count">
            {t(recurring.length === 1 ? 'recurringPaymentSingular' : 'recurringPaymentPlural').replace('{n}', String(recurring.length))}
          </div>
        </div>
      )}

      {/* Detected subscriptions */}
      {detected.length > 0 && (
        <DetectedSection items={detected} categories={categories} accounts={accounts}
          currency={currency} t={t} onConvert={setConverting} />
      )}

      {/* Monthly group */}
      {monthly.length > 0 && (
        <Section title={t('monthly')} txs={monthly} categories={categories} accounts={accounts}
          currency={currency} locale={locale} lang={lang} t={t} onOpen={tx => setSheet({ tx, confirm: false })} />
      )}

      {weekly.length > 0 && (
        <Section title={t('weekly')} txs={weekly} categories={categories} accounts={accounts}
          currency={currency} locale={locale} lang={lang} t={t} onOpen={tx => setSheet({ tx, confirm: false })} />
      )}

      {/* Action sheet */}
      {sheet && (
        <div ref={dialogRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={sheet.tx.note} onClick={() => setSheet(null)}>
          <section className="msub-sheet" onClick={e => e.stopPropagation()}>
            <header>
              <span>{sheet.tx.note}</span>
              <button aria-label={t('close')} onClick={() => setSheet(null)}><Icon name="close" size={18} /></button>
            </header>
            <div className="msub-sheet-body">
              <div className="msub-sheet-amount">
                {fmt(sheet.tx.amount, currency)}
                <span>{freqLabel(sheet.tx, t)}</span>
              </div>
              <div className="msub-sheet-meta">
                {t('nextColon')} <strong>{nextLabel(sheet.tx, locale)}</strong>
              </div>

              {!sheet.confirm ? (
                <>
                  <button className="msub-action-btn warn" onClick={() => handleEnd(sheet.tx)}>
                    <Icon name="close" size={16} /> {t('stopFutureOccurrences')}
                  </button>
                  <button className="msub-action-btn danger"
                    onClick={() => setSheet(s => s ? { ...s, confirm: true } : s)}>
                    <Icon name="trash" size={16} /> {t('deleteTemplateLabel')}
                  </button>
                </>
              ) : (
                <div className="msub-confirm">
                  <p>{t('deleteTemplateConfirm').replace('{name}', sheet.tx.note)}</p>
                  <div className="msub-confirm-row">
                    <button onClick={() => setSheet(s => s ? { ...s, confirm: false } : s)}>{t('cancel')}</button>
                    <button className="danger" onClick={() => handleDelete(sheet.tx)}>{t('delete')}</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Convert detected subscription to recurrence */}
      {converting && (
        <ConvertSheet dialogRef={convertRef} insight={converting} categories={categories} accounts={accounts}
          currency={currency} lang={lang} t={t} onClose={() => setConverting(null)} onConfirm={handleConvert} />
      )}
    </div>
  )
}

function DetectedSection({ items, categories, accounts, currency, t, onConvert }: {
  items: SubscriptionInsight[]
  categories: Category[]
  accounts: Account[]
  currency: CurrencyCode
  t: ReturnType<typeof useT>
  onConvert: (insight: SubscriptionInsight) => void
}) {
  return (
    <div className="msub-section">
      <div className="msub-section-header">
        <span>{t('detectedAutomaticallyLabel')}</span>
      </div>
      {items.map(item => {
        const cat = categories.find(c => c.id === item.categoryId)
        const acct = accounts.find(a => a.id === item.accountId)
        return (
          <div key={`${item.merchant}|${item.categoryId}|${item.accountId}`} className="msub-row msub-detected-row">
            <span className="msub-cat-icon" style={{ background: (cat?.color ?? '#888') + '22', color: cat?.color ?? '#888' }}>
              <Icon name={cat?.icon ?? 'repeat'} size={20} />
            </span>
            <div className="msub-row-info">
              <b>{titleCase(item.merchant)}</b>
              <small>
                {item.months} {t(item.months === 1 ? 'monthsSingular' : 'monthsPlural')} · {t('confidencePct').replace('{pct}', String(item.confidence))}
                {acct && <> · <span style={{ color: acct.color }}>●</span> {acct.short}</>}
              </small>
            </div>
            <div className="msub-row-right">
              <strong className="text-expense">−{fmt(item.amount, currency)}</strong>
              <button className="msub-convert-btn" onClick={() => onConvert(item)}>
                <Icon name="repeat" size={14} /> {t('convertLabel')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ConvertSheet({ dialogRef, insight, categories, accounts, currency, lang, t, onClose, onConfirm }: {
  dialogRef: React.RefObject<HTMLDivElement>
  insight: SubscriptionInsight
  categories: Category[]
  accounts: Account[]
  currency: CurrencyCode
  lang: 'en' | 'es'
  t: ReturnType<typeof useT>
  onClose: () => void
  onConfirm: (fields: { note: string; amount: number; categoryId: string; accountId: string; recurring: RecurrenceFrequency }) => void
}) {
  const expenseCategories = categories.filter(c => c.type === 'expense')
  const [note, setNote] = useState(titleCase(insight.merchant))
  const [amountText, setAmountText] = useState(String(Math.round(insight.amount)))
  const [categoryId, setCategoryId] = useState(insight.categoryId ?? expenseCategories[0]?.id ?? '')
  const [accountId, setAccountId] = useState(insight.accountId ?? accounts[0]?.id ?? '')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly')

  const amount = Number(amountText) || 0
  const canSave = note.trim().length > 0 && amount > 0 && !!categoryId && !!accountId

  return (
    <div ref={dialogRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={t('convertToRecurrenceTitle')} onClick={onClose}>
      <section className="mgl-form" onClick={e => e.stopPropagation()}>
        <header>
          <span>{t('convertToRecurrenceTitle')}</span>
          <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
        </header>
        <div className="mgl-form-body">
          <label className="mgl-field">
            <span>{t('name')}</span>
            <input className="mgl-input" value={note} onChange={e => setNote(e.target.value)} />
          </label>
          <label className="mgl-field">
            <span>{t('amount')}</span>
            <input className="mgl-input" type="number" inputMode="decimal" min="0" value={amountText}
              onChange={e => setAmountText(e.target.value)} />
          </label>
          <label className="mgl-field">
            <span>{t('category')}</span>
            <select className="mgl-input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              {expenseCategories.map(c => <option key={c.id} value={c.id}>{translateCategoryName(c, lang)}</option>)}
            </select>
          </label>
          <label className="mgl-field">
            <span>{t('account')}</span>
            <select className="mgl-input" value={accountId} onChange={e => setAccountId(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="mgl-field">
            <span>{t('frequencyLabel')}</span>
            <select className="mgl-input" value={frequency} onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}>
              <option value="monthly">{t('monthly')}</option>
              <option value="weekly">{t('weekly')}</option>
            </select>
          </label>
          <p className="msub-detected-hint">
            {t('detectedInPrefix')} {insight.months} {t(insight.months === 1 ? 'monthsSingular' : 'monthsPlural')} · {t('lastChargeSuffix').replace('{amount}', fmt(insight.amount, currency))}
          </p>
        </div>
        <div className="mgl-form-actions">
          <button className="mgl-btn-cancel" onClick={onClose}>{t('cancel')}</button>
          <button className="mgl-btn-save" style={{ background: 'var(--accent)' }} disabled={!canSave}
            onClick={() => onConfirm({ note: note.trim(), amount, categoryId, accountId, recurring: frequency })}>
            {t('createRecurrenceLabel')}
          </button>
        </div>
      </section>
    </div>
  )
}

function Section({ title, txs, categories, accounts, currency, locale, lang, t, onOpen }: {
  title: string
  txs: Transaction[]
  categories: Category[]
  accounts: Account[]
  currency: CurrencyCode
  locale: string
  lang: 'en' | 'es'
  t: ReturnType<typeof useT>
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
              <b>{tx.note || (cat ? translateCategoryName(cat, lang) : '—')}</b>
              <small>
                {t('nextAbbrev')} {nextLabel(tx, locale)}
                {isPast && <span className="msub-overdue"> · {t('overdueLabel')}</span>}
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
