import { useEffect, useRef } from 'react'
import { toast } from '@/components/ui/Toast'
import { localToday } from '@/data/helpers'
import { tt } from '@/i18n'
import { useFinance } from '@/store/finance'
import type { RecurrenceFrequency, Transaction } from '@/types'

export function advanceRecurrenceDate(date: string, frequency: RecurrenceFrequency): string {
  const next = new Date(`${date}T00:00:00`)
  if (frequency === 'weekly') next.setDate(next.getDate() + 7)
  else next.setMonth(next.getMonth() + 1)
  return localToday(next)
}

export function firstRecurrenceDate(tx: Transaction): string {
  return tx.recurringNext ?? advanceRecurrenceDate(tx.recurringStart ?? tx.date, tx.recurring ?? 'monthly')
}

export function useRecurring(): void {
  const { transactions, addTx, updateTx } = useFinance()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const today = localToday()
    let created = 0
    let skipped = 0

    transactions.filter(tx => tx.recurring).forEach(template => {
      let next = firstRecurrenceDate(template)
      let generated = 0
      while (next <= today && (!template.recurringEnd || next <= template.recurringEnd) && generated < 24) {
        const exists = transactions.some(tx => tx.date === next && tx.note === template.note
          && tx.categoryId === template.categoryId && tx.accountId === template.accountId)
        const isSkipped = template.skippedDates?.includes(next) ?? false
        if (!exists && !isSkipped) {
          // Un recurrente nunca debe poder tumbar el arranque: si el saldo no
          // alcanza (política "bloquear") lo saltamos y seguimos generando el resto.
          try {
            addTx({
              type: template.type, amount: template.amount, note: template.note,
              date: next, accountId: template.accountId, categoryId: template.categoryId,
              tags: template.tags,
            })
            created++
          } catch {
            skipped++
          }
        }
        next = advanceRecurrenceDate(next, template.recurring!)
        generated++
      }
      if (next !== template.recurringNext) updateTx(template.id, { recurringNext: next })
    })

    if (created > 0) toast(
      tt(created > 1 ? 'recurringGeneratedMany' : 'recurringGeneratedOne', { n: created }),
      { icon: 'calendar', type: 'ok' },
    )
    if (skipped > 0) toast(
      tt(skipped > 1 ? 'recurringSkippedMany' : 'recurringSkippedOne', { n: skipped }),
      { icon: 'alert' },
    )
  }, [addTx, transactions, updateTx])
}
