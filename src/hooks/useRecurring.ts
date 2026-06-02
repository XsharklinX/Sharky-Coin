import { useEffect, useRef } from 'react'
import { useFinance } from '@/store/finance'
import { currentMonthKey, monthKey } from '@/data/helpers'
import { toast } from '@/components/ui/Toast'

const PROCESSED_KEY = 'sharky-recurring-v1'

/**
 * Detecta transacciones marcadas como `recurring: 'monthly'` del mes anterior
 * y las copia al mes actual si aún no existen. Se ejecuta una vez por mes.
 */
export function useRecurring() {
  const { transactions, addTx } = useFinance()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const curKey  = currentMonthKey()
    const processed: string[] = JSON.parse(localStorage.getItem(PROCESSED_KEY) ?? '[]')
    if (processed.includes(curKey)) return

    // mes anterior
    const [y, m] = curKey.split('-').map(Number)
    const prevDate = new Date(y, m - 2, 1)
    const prevKey  = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

    const recurring = transactions.filter(
      tx => tx.recurring === 'monthly' && monthKey(tx.date) === prevKey
    )

    let created = 0
    recurring.forEach(tx => {
      // no duplicar si ya existe en el mes actual con misma nota + categoría + cuenta
      const exists = transactions.some(t =>
        monthKey(t.date) === curKey &&
        t.note        === tx.note &&
        t.categoryId  === tx.categoryId &&
        t.accountId   === tx.accountId
      )
      if (exists) return
      addTx({
        type: tx.type, amount: tx.amount, note: tx.note,
        date: `${curKey}-01`,
        accountId: tx.accountId, categoryId: tx.categoryId,
        recurring: 'monthly',
      })
      created++
    })

    if (created > 0) {
      toast(
        `${created} gasto${created > 1 ? 's' : ''} recurrente${created > 1 ? 's' : ''} generado${created > 1 ? 's' : ''} para este mes`,
        { icon: 'calendar', type: 'ok' }
      )
    }

    localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processed, curKey]))
  }, [])
}
