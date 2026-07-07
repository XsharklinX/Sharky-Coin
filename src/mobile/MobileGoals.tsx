import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useFinance } from '@/store/finance'
import { useDialogs } from '@/components/ui/DialogProvider'
import { useSettings } from '@/store/settings'
import { dateLocale, fmt, localToday, savingsBalance } from '@/data/helpers'
import { CURRENCIES } from '@/data/seed'
import { playKeySound, playBackspaceSound, playDoneSound, playConfirmSound, playDeleteSound, playAchievementSound } from '@/lib/sound'
import { useT } from '@/i18n'
import { advanceRecurrenceDate } from '@/hooks/useRecurring'
import { MobileDatePicker } from './MobileDatePicker'
import { MobileAmountSheet } from './MobileAmountSheet'
import type { CurrencyCode, Goal, GoalAutoContribute, IconName, RecurrenceFrequency, ViewProps } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { useDialogA11y } from './useDialogA11y'

const COLORS = [
  '#ffdd3d','#ff6b35','#e8445a','#c765ff','#5e5ce6',
  '#0a84ff','#30d158','#ffd60a','#ff9f0a','#64d2ff',
]

const ICONS: IconName[] = [
  'target','piggy','home','car','plane','book','heart','graduation',
  'gift','trophy','shield','star','briefcase','wallet','laptop','phone',
  'gym','coffee','tree','crown','map','package','tool','monitor',
  'banknote','coins','handCoins','landmark','receipt',
]

type Sheet = { type: 'add' | 'edit'; goal?: Goal } | { type: 'detail'; goal: Goal } | null

function pct(saved: number, target: number) {
  return Math.min(100, Math.round((saved / target) * 100))
}

function currencyPrefix(currency: CurrencyCode): string {
  return CURRENCIES[currency].symbol
}

function fmtAmountText(text: string, prefix: string): string {
  if (!text) return `${prefix} 0`
  const n = parseFloat(text)
  if (isNaN(n)) return `${prefix} 0`
  if (text.endsWith('.')) return `${prefix} ${n.toLocaleString('en-US')}.`
  return `${prefix} ${n.toLocaleString('en-US', { minimumFractionDigits: text.includes('.') ? 2 : 0 })}`
}

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','.','0','back'] as const

function GoalNumpad({
  amountText,
  onPress,
  prefix,
  onDone,
}: {
  amountText: string
  onPress: (k: string) => void
  prefix: string
  onDone: () => void
}) {
  const t = useT()
  return (
    <div className="mgl-numpad-view">
      <div className="mgl-numpad-display">{fmtAmountText(amountText, prefix)}</div>
      <div className="mgl-numpad-grid">
        {NUMPAD_KEYS.map(k => (
          <button
            key={k}
            className={k === 'back' ? 'mgl-numpad-back' : 'mgl-numpad-key'}
            onClick={() => onPress(k)}
          >
            {k === 'back' ? <Icon name="close" size={18} /> : k}
          </button>
        ))}
      </div>
      <button className="mgl-numpad-done" onClick={onDone}>{t('done')}</button>
    </div>
  )
}

function GoalCard({ goal, currency, onClick }: { goal: Goal; currency: string; onClick: () => void }) {
  const t = useT()
  const lang = useSettings(s => s.language)
  const p = pct(goal.saved, goal.target)
  const cur = currency as Parameters<typeof fmt>[1]
  return (
    <button className="mgl-card" onClick={onClick}>
      <div className="mgl-card-top">
        <span className="mgl-icon" style={{ background: goal.color + '22', color: goal.color }}>
          <Icon name={goal.icon} size={22} />
        </span>
        <div className="mgl-card-info">
          <strong>{goal.name}</strong>
          {goal.deadline && <small>{new Date(goal.deadline).toLocaleDateString(dateLocale(lang), { day:'numeric', month:'short', year:'numeric' })}</small>}
        </div>
        <span className="mgl-pct" style={{ color: goal.color }}>{p}%</span>
      </div>
      <div className="mgl-bar-track">
        <div className="mgl-bar-fill" style={{ width: `${p}%`, background: goal.color }} />
      </div>
      <div className="mgl-card-bottom">
        <span>{fmt(goal.saved, cur)}</span>
        <span className="mgl-dim"> {t('of')} {fmt(goal.target, cur)}</span>
      </div>
      {goal.autoContribute && (
        <div className="mgl-auto-badge">
          <Icon name="repeat" size={11} />
          {t('autoContributeBadge')
            .replace('{amount}', fmt(goal.autoContribute.amount, cur))
            .replace('{freq}', goal.autoContribute.frequency === 'weekly' ? t('perWeekShort') : t('perMonthShort'))}
        </div>
      )}
    </button>
  )
}

function GoalForm({
  initial,
  currency,
  onSave,
  onClose,
}: {
  initial?: Goal
  currency: string
  onSave: (data: Omit<Goal,'id'|'saved'>) => void
  onClose: () => void
}) {
  const t = useT()
  const { accounts } = useFinance()
  const [name, setName]             = useState(initial?.name ?? '')
  const [amountText, setAmountText] = useState(initial?.target?.toString() ?? '')
  const [color, setColor]           = useState(initial?.color ?? COLORS[0])
  const [icon, setIcon]             = useState<IconName>(initial?.icon ?? 'target')
  const [deadline, setDeadline]     = useState(initial?.deadline ?? '')
  const [showNumpad, setShowNumpad] = useState(false)
  const [showDate, setShowDate]     = useState(false)

  const validAccounts = accounts.filter(a => a.type !== 'credit')
  const [autoEnabled, setAutoEnabled]     = useState(!!initial?.autoContribute)
  const [autoAmount, setAutoAmount]       = useState(initial?.autoContribute?.amount ?? 0)
  const [autoFrequency, setAutoFrequency] = useState<RecurrenceFrequency>(initial?.autoContribute?.frequency ?? 'monthly')
  const [autoAccountId, setAutoAccountId] = useState(initial?.autoContribute?.fromAccountId ?? validAccounts[0]?.id ?? '')
  const [autoAmountSheet, setAutoAmountSheet] = useState(false)

  const lang = useSettings(s => s.language)
  const cur = currency as CurrencyCode
  const prefix = currencyPrefix(cur)
  const today = localToday()
  const deadlinePast = !!deadline && deadline < today

  useMobileBackDismiss(true, showNumpad ? () => setShowNumpad(false) : showDate ? () => setShowDate(false) : autoAmountSheet ? () => setAutoAmountSheet(false) : onClose)
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose, !showNumpad && !showDate && !autoAmountSheet)

  const pressAmt = (key: string) => {
    if (key === 'back') {
      playBackspaceSound()
      setAmountText(v => v.slice(0, -1))
      return
    }
    playKeySound()
    setAmountText(v => {
      if (key === '.') {
        if (v.includes('.')) return v
        return (v || '0') + '.'
      }
      if (v === '0' && key !== '.') return key
      const next = v + key
      const [, dec] = next.split('.')
      if (dec && dec.length > 2) return v
      return next
    })
  }

  const handleDone = () => {
    playDoneSound()
    setShowNumpad(false)
  }

  const save = () => {
    const targetVal = parseFloat(amountText)
    if (!name.trim() || !targetVal || targetVal <= 0) return
    if (autoEnabled && (!autoAmount || autoAmount <= 0 || !autoAccountId)) return
    playConfirmSound()
    const autoContribute: GoalAutoContribute | undefined = autoEnabled
      ? {
          amount: autoAmount,
          frequency: autoFrequency,
          fromAccountId: autoAccountId,
          nextDate: initial?.autoContribute?.nextDate ?? advanceRecurrenceDate(today, autoFrequency),
        }
      : undefined
    onSave({ name: name.trim(), target: targetVal, color, icon, deadline: deadline || undefined, autoContribute })
  }

  const deadlineLabel = deadline
    ? new Date(`${deadline}T00:00:00`).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short', year: 'numeric' })
    : t('noDeadlineLabel')

  return (
    <div ref={dialogRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={initial ? t('editGoal') : t('newGoal')} onClick={onClose}>
      <section className="mgl-form" onClick={e => e.stopPropagation()}>
        <header>
          <span>{initial ? t('editGoal') : t('newGoal')}</span>
          <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        {showNumpad ? (
          <GoalNumpad amountText={amountText} onPress={pressAmt} prefix={prefix} onDone={handleDone} />
        ) : (
          <>
            <div className="mgl-form-body">
              <label className="mgl-field">
                <span>{t('name')}</span>
                <input
                  className="mgl-input"
                  placeholder={t('egGoalName')}
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </label>

              <div className="mgl-field">
                <span>{t('target')}</span>
                <button className="mgl-amount-tap" onClick={() => setShowNumpad(true)}>
                  <span>{fmtAmountText(amountText, prefix)}</span>
                  <Icon name="edit" size={14} style={{ opacity: .4 }} />
                </button>
              </div>

              <div className="mgl-field">
                <span>{t('deadlineOptional')}</span>
                <button
                  className={`mgl-amount-tap${deadlinePast ? ' warn' : ''}`}
                  onClick={() => setShowDate(true)}
                >
                  <span style={deadlinePast ? { color: 'var(--m-warn, #f59e0b)' } : undefined}>{deadlineLabel}</span>
                  <Icon name="calendar" size={14} style={{ opacity: .4 }} />
                </button>
                {deadlinePast && (
                  <small style={{ color: 'var(--m-warn, #f59e0b)', marginTop: 4, display: 'block', fontSize: 11 }}>
                    {t('deadlinePastWarning')}
                  </small>
                )}
              </div>

              <div className="mgl-field">
                <span>{t('color')}</span>
                <div className="mgl-colors">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      className={`mgl-color-dot${color === c ? ' on' : ''}`}
                      aria-label={t('colorOption').replace('{c}', c)}
                      aria-pressed={color === c}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>

              <div className="mgl-field">
                <span>{t('icon')}</span>
                <div className="mgl-icons">
                  {ICONS.map(ic => (
                    <button
                      key={ic}
                      className={`mgl-icon-btn${icon === ic ? ' on' : ''}`}
                      aria-label={t('iconOption').replace('{ic}', ic)}
                      aria-pressed={icon === ic}
                      style={icon === ic ? { background: color + '33', color } : {}}
                      onClick={() => setIcon(ic)}
                    >
                      <Icon name={ic} size={18} />
                    </button>
                  ))}
                </div>
              </div>

              {validAccounts.length > 0 && (
                <div className="mpr-form-section mpr-toggle-row">
                  <div className="mpr-toggle-row-text">
                    <span className="mpr-toggle-row-label">{t('autoContributeLabel')}</span>
                    <small className="mpr-toggle-row-desc">{t('autoContributeDesc')}</small>
                  </div>
                  <label className="mset-toggle-wrap">
                    <input
                      type="checkbox"
                      className="mset-toggle-input"
                      checked={autoEnabled}
                      onChange={e => setAutoEnabled(e.target.checked)}
                    />
                    <span className="mset-toggle" />
                  </label>
                </div>
              )}

              {autoEnabled && (
                <>
                  <div className="mgl-field">
                    <span>{t('autoContributeAmountLabel')}</span>
                    <button className="mgl-amount-tap" onClick={() => setAutoAmountSheet(true)}>
                      <span>{fmt(autoAmount, cur)}</span>
                      <Icon name="edit" size={14} style={{ opacity: .4 }} />
                    </button>
                  </div>

                  <div className="mpr-form-section">
                    <span className="mpr-overdraft-label">{t('frequencyLabel')}</span>
                    <div className="mpr-pill-row">
                      {(['weekly', 'monthly'] as RecurrenceFrequency[]).map(f => (
                        <button
                          key={f}
                          className={`mpr-pill${autoFrequency === f ? ' on' : ''}`}
                          style={autoFrequency === f ? { borderColor: color, color } : {}}
                          onClick={() => setAutoFrequency(f)}
                        >
                          {f === 'weekly' ? t('weekly') : t('monthly')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="mgl-field">
                    <span>{t('sourceAccount')}</span>
                    <select className="mgl-input" value={autoAccountId} onChange={e => setAutoAccountId(e.target.value)}>
                      {validAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance, cur)}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>

            <div className="mgl-form-actions">
              <button className="mgl-btn-cancel" onClick={onClose}>{t('cancel')}</button>
              <button className="mgl-btn-save" style={{ background: color }} onClick={save}>
                {initial ? t('save') : t('createGoal')}
              </button>
            </div>
          </>
        )}
      </section>

      {showDate && (
        <MobileDatePicker
          value={deadline || localToday()}
          onChange={v => { setDeadline(v); setShowDate(false) }}
          onClose={() => setShowDate(false)}
        />
      )}

      {autoAmountSheet && (
        <MobileAmountSheet
          title={t('autoContributeAmountLabel')}
          value={autoAmount}
          currency={cur}
          onDone={v => { setAutoAmount(v); setAutoAmountSheet(false) }}
          onClose={() => setAutoAmountSheet(false)}
        />
      )}
    </div>
  )
}

function ContributeSheet({ goal, currency, onClose }: { goal: Goal; currency: string; onClose: () => void }) {
  const t = useT()
  const { accounts, contribute } = useFinance()
  const validAccounts = accounts.filter(a => a.type !== 'credit')
  const [amountText, setAmountText] = useState('')
  const [accountId, setAccountId] = useState(validAccounts.find(a => a.type === 'savings')?.id ?? validAccounts[0]?.id ?? '')
  const [showNumpad, setShowNumpad] = useState(true)
  const cur = currency as Parameters<typeof fmt>[1]
  const prefix = currencyPrefix(currency as CurrencyCode)

  useMobileBackDismiss(true, showNumpad ? () => setShowNumpad(false) : onClose)
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose, !showNumpad)

  const pressAmt = (key: string) => {
    if (key === 'back') {
      playBackspaceSound()
      setAmountText(v => v.slice(0, -1))
      return
    }
    playKeySound()
    setAmountText(v => {
      if (key === '.') {
        if (v.includes('.')) return v
        return (v || '0') + '.'
      }
      if (v === '0' && key !== '.') return key
      const next = v + key
      const [, dec] = next.split('.')
      if (dec && dec.length > 2) return v
      return next
    })
  }

  const handleDone = () => {
    playDoneSound()
    setShowNumpad(false)
  }

  const submit = () => {
    const amt = parseFloat(amountText)
    if (!amt || amt <= 0 || !accountId) return
    try {
      contribute(goal.id, amt, accountId)
      if (goal.saved < goal.target && goal.saved + amt >= goal.target) playAchievementSound()
      else playConfirmSound()
      onClose()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t('errorContributing'), { icon: 'alert' })
    }
  }

  return (
    <div ref={dialogRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={t('contributeToGoal').replace('{name}', goal.name)} onClick={onClose}>
      <section className="mgl-form" onClick={e => e.stopPropagation()}>
        <header>
          <span>{t('contributeToGoal').replace('{name}', goal.name)}</span>
          <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        {showNumpad ? (
          <GoalNumpad amountText={amountText} onPress={pressAmt} prefix={prefix} onDone={handleDone} />
        ) : (
          <>
            <div className="mgl-form-body">
              <div className="mgl-contrib-display">
                <div className="mgl-contrib-ring" style={{ borderColor: goal.color }}>
                  <Icon name={goal.icon} size={28} style={{ color: goal.color }} />
                </div>
                <div>
                  <strong>{fmt(goal.saved, cur)}</strong>
                  <small> / {fmt(goal.target, cur)}</small>
                </div>
              </div>

              <div className="mgl-field">
                <span>{t('amountToContribute')}</span>
                <button className="mgl-amount-tap" onClick={() => setShowNumpad(true)}>
                  <span>{fmtAmountText(amountText, prefix)}</span>
                  <Icon name="edit" size={14} style={{ opacity: .4 }} />
                </button>
              </div>

              <label className="mgl-field">
                <span>{t('sourceAccount')}</span>
                <select className="mgl-input" value={accountId} onChange={e => setAccountId(e.target.value)}>
                  {validAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance, cur)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mgl-form-actions">
              <button className="mgl-btn-cancel" onClick={onClose}>{t('cancel')}</button>
              <button className="mgl-btn-save" style={{ background: goal.color }} onClick={submit}>
                {t('contribute')}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export function MobileGoals(_props: ViewProps) {
  const t = useT()
  const { accounts, goals, addGoal, updateGoal, deleteGoal, currency } = useFinance()
  const { confirm } = useDialogs()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null)

  const totalSaved  = goals.reduce((s, g) => s + g.saved, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target, 0)
  const backedSavings = savingsBalance(accounts)
  const savingsCoverage = totalSaved > 0 ? Math.min(999, Math.round(backedSavings / totalSaved * 100)) : 0
  const cur = currency as Parameters<typeof fmt>[1]

  return (
    <div className="mgl-root">
      {goals.length > 0 && (
        <div className="mgl-summary">
          <div className="mgl-sum-item">
            <span className="mgl-sum-label">{t('saved')}</span>
            <strong className="mgl-sum-value">{fmt(totalSaved, cur)}</strong>
          </div>
          <div className="mgl-sum-div" />
          <div className="mgl-sum-item">
            <span className="mgl-sum-label">{t('target')}</span>
            <strong className="mgl-sum-value">{fmt(totalTarget, cur)}</strong>
          </div>
          <div className="mgl-sum-div" />
          <div className="mgl-sum-item">
            <span className="mgl-sum-label">{t('savings')}</span>
            <strong className="mgl-sum-value">{savingsCoverage}%</strong>
            <small className="mgl-sum-hint">{fmt(backedSavings, cur)}</small>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="mgl-empty">
          <Icon name="target" size={48} style={{ opacity: .25 }} />
          <p>{t('noGoals')}</p>
          <button className="mgl-empty-btn" onClick={() => setSheet({ type: 'add' })}>
            {t('createFirstGoal')}
          </button>
        </div>
      ) : (
        <div className="mgl-list">
          {goals.map(g => (
            <div key={g.id} className="mgl-card-wrap">
              <GoalCard goal={g} currency={currency} onClick={() => setSheet({ type: 'detail', goal: g })} />
              <div className="mgl-card-actions">
                <button className="mgl-action-btn" onClick={() => setContributeGoal(g)}>
                  <Icon name="plus" size={15} /> {t('contribute')}
                </button>
                <button className="mgl-action-btn" aria-label={t('editGoalNamed').replace('{name}', g.name)} onClick={() => setSheet({ type: 'edit', goal: g })}>
                  <Icon name="edit" size={15} />
                </button>
                <button className="mgl-action-btn mgl-action-del" aria-label={t('deleteGoalNamed').replace('{name}', g.name)} onClick={() => {
                  void confirm({ title: t('deleteGoalConfirmTitle').replace('{name}', g.name), description: t('actionCannotBeUndone'), confirmLabel: t('delete'), icon: 'trash' }).then(ok => { if (ok) { playDeleteSound(); deleteGoal(g.id) } })
                }}>
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="mgl-fab" aria-label={t('newGoal')} onClick={() => setSheet({ type: 'add' })}>
        <Icon name="plus" size={24} />
      </button>

      {(sheet?.type === 'add' || sheet?.type === 'edit') && (
        <GoalForm
          initial={sheet.goal}
          currency={currency}
          onSave={data => {
            if (sheet.type === 'edit' && sheet.goal) {
              updateGoal(sheet.goal.id, data)
            } else {
              addGoal({ ...data, saved: 0 })
            }
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {contributeGoal && (
        <ContributeSheet goal={contributeGoal} currency={currency} onClose={() => setContributeGoal(null)} />
      )}
    </div>
  )
}
