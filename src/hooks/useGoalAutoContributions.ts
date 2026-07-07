import { useEffect, useRef } from 'react'
import { toast } from '@/components/ui/Toast'
import { localToday } from '@/data/helpers'
import { tt } from '@/i18n'
import { useFinance } from '@/store/finance'
import { advanceRecurrenceDate } from './useRecurring'

/**
 * Genera GoalContributions pendientes para las metas con aporte automático
 * activado, desde `autoContribute.nextDate` hasta hoy. Se detiene si la meta
 * se completa o si una transferencia falla por saldo insuficiente.
 */
export function useGoalAutoContributions(): void {
  const { goals, contribute, updateGoal } = useFinance()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const today = localToday()
    let created = 0
    let skipped = 0

    goals.filter(g => g.autoContribute).forEach(goal => {
      const auto = goal.autoContribute!
      let next = auto.nextDate
      let saved = goal.saved
      let generated = 0
      while (next <= today && saved < goal.target && generated < 24) {
        try {
          contribute(goal.id, auto.amount, auto.fromAccountId, undefined, next)
          saved += auto.amount
          created++
        } catch {
          skipped++
        }
        next = advanceRecurrenceDate(next, auto.frequency)
        generated++
      }
      if (next !== auto.nextDate) updateGoal(goal.id, { autoContribute: { ...auto, nextDate: next } })
    })

    if (created > 0) toast(
      tt(created > 1 ? 'goalAutoContribGeneratedMany' : 'goalAutoContribGeneratedOne', { n: created }),
      { icon: 'piggy', type: 'ok' },
    )
    if (skipped > 0) toast(
      tt(skipped > 1 ? 'goalAutoContribSkippedMany' : 'goalAutoContribSkippedOne', { n: skipped }),
      { icon: 'alert' },
    )
  }, [contribute, goals, updateGoal])
}
