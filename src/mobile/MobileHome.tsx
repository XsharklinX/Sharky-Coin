import { Icon } from '@/components/ui/Icon'
import { byCategory, fmtCompact, monthLabel, totals, txForMonth } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { MobileTransactionList } from './MobileTransactionList'
import type { Transaction } from '@/types'

export function MobileHome({
  mkey,
  onAdd,
  onMovements,
  onBudgets,
  onEditTx,
  onDeleteTx,
}: {
  mkey: string
  onAdd: () => void
  onMovements: () => void
  onBudgets: () => void
  onEditTx: (tx: Transaction) => void
  onDeleteTx?: (id: string) => void
}) {
  const { transactions, categories, currency } = useFinance()
  const monthTx = txForMonth(transactions, mkey)
  const summary = totals(monthTx)
  const expenseCategories = categories.filter(category => category.type === 'expense')
  const totalBudget = expenseCategories.reduce((sum, category) => sum + category.budget, 0)
  const remaining = totalBudget - summary.expense
  const topCategory = byCategory(monthTx, 'expense', categories)[0]
  const budgetPct = totalBudget > 0 ? Math.min(999, Math.round(summary.expense / totalBudget * 100)) : 0
  const recent = monthTx.slice(0, 5)
  const alerts = [
    remaining < 0 ? `Presupuesto excedido por ${fmtCompact(Math.abs(remaining), currency)}.` : '',
    topCategory && topCategory.category.budget > 0 && topCategory.amount > topCategory.category.budget
      ? `${topCategory.category.name} superó su límite mensual.`
      : '',
    summary.net < 0 ? 'El mes está cerrando en negativo.' : '',
    summary.expense === 0 ? 'Todavía no hay gastos este mes.' : '',
  ].filter(Boolean).slice(0, 2)

  return (
    <div className="mobile-home">
      <section className="mobile-hero-card">
        <span>{monthLabel(mkey)}</span>
        <h2>{summary.net >= 0 ? 'Balance disponible' : 'Balance del mes'}</h2>
        <strong className={summary.net >= 0 ? 'income' : 'expense'}>
          {fmtCompact(summary.net, currency)}
        </strong>
        <button onClick={onAdd}><Icon name="plus" size={19} />Agregar movimiento</button>
      </section>

      <section className="mobile-metrics-row">
        <article>
          <small>Gastos</small>
          <strong className="expense">{fmtCompact(summary.expense, currency)}</strong>
        </article>
        <article>
          <small>Ingresos</small>
          <strong className="income">{fmtCompact(summary.income, currency)}</strong>
        </article>
        <article>
          <small>Presupuesto</small>
          <strong>{totalBudget ? `${Math.max(0, 100 - budgetPct)}%` : 'N/D'}</strong>
        </article>
      </section>

      <section className="mobile-budget-card">
        <div>
          <small>Presupuesto restante</small>
          <strong className={remaining >= 0 ? 'income' : 'expense'}>{fmtCompact(remaining, currency)}</strong>
        </div>
        <div className="mobile-progress-track">
          <span style={{ width: `${Math.min(100, budgetPct)}%` }} />
        </div>
        <button onClick={onBudgets}>Ver presupuestos</button>
      </section>

      {alerts.length > 0 && (
        <section className="mobile-alert-stack">
          {alerts.map(alert => (
            <article key={alert}>
              <Icon name="alert" size={18} />
              <span>{alert}</span>
            </article>
          ))}
        </section>
      )}

      <section className="mobile-section-card">
        <header>
          <div>
            <h2>Últimos movimientos</h2>
            <p>{recent.length ? 'Actividad reciente del mes' : 'Sin actividad todavía'}</p>
          </div>
          <button onClick={onMovements}>Ver todo</button>
        </header>
        {recent.length
          ? <MobileTransactionList transactions={recent} onEdit={onEditTx} onDelete={onDeleteTx} compact />
          : <button className="mobile-empty-action" onClick={onAdd}>Agregar el primero</button>}
      </section>
    </div>
  )
}
