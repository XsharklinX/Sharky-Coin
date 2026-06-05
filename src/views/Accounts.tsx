import { useEffect, useState } from 'react'
import { AreaLine, Progress } from '@/components/ui/charts'
import { AnimatedMoney } from '@/components/ui/AnimatedMoney'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { useDialogs } from '@/components/ui/DialogProvider'
import { fmtCompact, monthKeys, totals, txForMonth } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import type { Account, AccountType, OverdraftPolicy, ViewProps } from '@/types'
import { Empty, MiniStat } from './shared'

const COLORS = ['#3b82f6', '#22c55e', '#a78bfa', '#f59e0b', '#f472b6', '#38bdf8']
const EMPTY_ACCOUNT: Omit<Account, 'id'> = { name: '', short: '', type: 'debit', color: COLORS[0], balance: 0, last4: null }

export function Accounts({ txns, createRequest }: ViewProps) {
  const { accounts, currency, addAccount, updateAccount, deleteAccount } = useFinance()
  const { confirm } = useDialogs()
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [transferring, setTransferring] = useState(false)
  const keys = monthKeys(txns)
  const net = accounts.reduce((sum, account) => sum + account.balance, 0)
  const assets = accounts.filter(account => account.balance >= 0).reduce((sum, account) => sum + account.balance, 0)
  const debt = accounts.filter(account => account.balance < 0).reduce((sum, account) => sum + account.balance, 0)

  useEffect(() => {
    if (createRequest?.target === 'account') setEditing('new')
  }, [createRequest])

  const remove = async (id: string) => {
    const account = accounts.find(item => item.id === id)
    const ok = await confirm({
      title: 'Eliminar cuenta',
      description: `Eliminaras la cuenta "${account?.name ?? 'seleccionada'}". Esta accion no se puede deshacer.`,
      confirmLabel: 'Eliminar cuenta',
      icon: 'trash',
      tone: 'danger',
    })
    if (!ok) return
    try {
      deleteAccount(id)
      toast('Cuenta eliminada', { icon: 'trash', type: 'ok' })
      setEditing(null)
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'No se pudo eliminar la cuenta.', { icon: 'cards' })
    }
  }

  return <div className="view">
    <div className="view-actions">
      <button className="btn-ghost" onClick={() => setTransferring(true)}><Icon name="cards" size={15} /> Transferir</button>
      <button className="btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={15} /> Nueva cuenta</button>
    </div>
    <div className="grid-3" style={{ marginBottom: 16 }}>
      <MiniStat label="Patrimonio neto" amount={net} color="var(--accent)" />
      <MiniStat label="Activos" amount={assets} color="var(--income)" />
      <MiniStat label="Deudas" amount={debt} color="var(--expense)" />
    </div>
    <div className="grid-acc">{accounts.map(account => {
      const credit = account.type === 'credit'
      const utilization = credit && account.limit ? Math.abs(account.balance) / account.limit * 100 : 0
      return <article className="card acct-card" key={account.id}>
        <header className="account-head"><span style={{ color: account.color }}><Icon name={credit ? 'cards' : 'wallet'} /></span><div><h3>{account.name}</h3><small>{account.short}{account.last4 ? ` ·· ${account.last4}` : ''}</small></div><button className="icon-btn account-edit" aria-label={`Editar ${account.name}`} onClick={() => setEditing(account)}><Icon name="edit" size={15} /></button></header>
        <small>{credit ? 'Saldo a pagar' : 'Saldo disponible'}</small><strong className={account.balance < 0 ? 'negative' : ''}><AnimatedMoney value={account.balance} decimals={0} /></strong>
        {credit && account.limit && <div><small>Uso de crédito: {utilization.toFixed(0)}% de {fmtCompact(account.limit, currency)}</small><Progress value={Math.abs(account.balance)} max={account.limit} color={account.color} height={6} /></div>}
        <AreaLine points={keys.map(key => totals(txForMonth(txns, key).filter(tx => tx.accountId === account.id)).net)} height={46} color={account.color} />
      </article>
    })}
    {accounts.length === 0 && <div className="card"><Empty icon="wallet" title="No tienes cuentas todavía"
      text="Agrega tu primera cuenta para registrar movimientos y seguir tu patrimonio."
      action={<button className="btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={15} /> Nueva cuenta</button>} /></div>}
    </div>
    {editing && <AccountForm account={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onDelete={remove} onSave={fields => {
      if (editing === 'new') addAccount(fields)
      else updateAccount(editing.id, fields)
      toast(editing === 'new' ? 'Cuenta creada' : 'Cuenta actualizada', { icon: 'cards', type: 'ok' })
      setEditing(null)
    }} />}
    {transferring && <TransferForm onClose={() => setTransferring(false)} />}
  </div>
}

function AccountForm({ account, onClose, onSave, onDelete }: { account?: Account; onClose: () => void; onSave: (fields: Omit<Account, 'id'>) => void; onDelete: (id: string) => void | Promise<void> }) {
  const [fields, setFields] = useState<Omit<Account, 'id'>>(account ?? EMPTY_ACCOUNT)
  const patch = <K extends keyof typeof fields>(key: K, value: typeof fields[K]) => setFields(current => ({ ...current, [key]: value }))
  const submit = () => {
    if (!fields.name.trim() || !fields.short.trim()) return toast('Completa el nombre y la etiqueta de la cuenta.', { icon: 'cards' })
    onSave({ ...fields, name: fields.name.trim(), short: fields.short.trim(), last4: fields.last4?.trim() || null })
  }
  return <div className="modal-overlay" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="account-form-title" onMouseDown={event => event.stopPropagation()}>
    <header className="modal-head"><h2 id="account-form-title">{account ? 'Editar cuenta' : 'Nueva cuenta'}</h2><button className="icon-btn" aria-label="Cerrar" onClick={onClose}><Icon name="close" size={16} /></button></header>
    <div className="field"><label htmlFor="account-name">Nombre</label><input id="account-name" className="select" value={fields.name} onChange={event => patch('name', event.target.value)} placeholder="Ej. Banco Popular" /></div>
    <div className="field-row"><div className="field"><label htmlFor="account-short">Etiqueta</label><input id="account-short" className="select" value={fields.short} onChange={event => patch('short', event.target.value)} placeholder="Ej. Débito" /></div><div className="field"><label htmlFor="account-type">Tipo</label><select id="account-type" className="select" value={fields.type} onChange={event => patch('type', event.target.value as AccountType)}><option value="debit">Débito</option><option value="savings">Ahorros</option><option value="credit">Crédito</option><option value="cash">Efectivo</option></select></div></div>
    <div className="field-row"><div className="field"><label htmlFor="account-balance">Saldo inicial</label><input id="account-balance" className="select" type="number" value={fields.balance} onChange={event => patch('balance', Number(event.target.value))} /></div><div className="field"><label htmlFor="account-last4">Últimos 4 dígitos</label><input id="account-last4" className="select" maxLength={4} value={fields.last4 ?? ''} onChange={event => patch('last4', event.target.value)} placeholder="Opcional" /></div></div>
    {fields.type === 'credit' && <div className="field"><label htmlFor="account-limit">Límite de crédito</label><input id="account-limit" className="select" type="number" value={fields.limit ?? ''} onChange={event => patch('limit', Number(event.target.value) || undefined)} /></div>}
    {fields.type !== 'credit' && <div className="field"><label htmlFor="account-overdraft">Política de sobregiro</label><select id="account-overdraft" className="select" value={fields.overdraftPolicy ?? ''} onChange={event => patch('overdraftPolicy', (event.target.value || undefined) as OverdraftPolicy | undefined)}><option value="">Usar configuración global</option><option value="block">Bloquear gastos sin saldo</option><option value="warn">Permitir con advertencia</option><option value="allow">Permitir sin advertencia</option></select></div>}
    <div className="color-list" aria-label="Color de la cuenta">{COLORS.map(color => <button aria-label={`Usar color ${color}`} className={fields.color === color ? 'selected' : ''} key={color} onClick={() => patch('color', color)} style={{ background: color }} />)}</div>
    <footer className="modal-actions">{account && <button className="btn-danger" onClick={() => void onDelete(account.id)}><Icon name="trash" size={15} /> Eliminar</button>}<button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={submit}>Guardar</button></footer>
  </section></div>
}

function TransferForm({ onClose }: { onClose: () => void }) {
  const { accounts, transfer } = useFinance()
  const [from, setFrom] = useState(accounts[0]?.id ?? ''), [to, setTo] = useState(accounts[1]?.id ?? '')
  const [amount, setAmount] = useState(''), [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const submit = () => {
    try {
      transfer({ fromAccount: from, toAccount: to, amount: Number(amount), date })
      toast('Transferencia registrada', { icon: 'cards', type: 'ok' })
      onClose()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'No se pudo realizar la transferencia.', { icon: 'cards' })
    }
  }
  return <div className="modal-overlay" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="transfer-title" onMouseDown={event => event.stopPropagation()}>
    <header className="modal-head"><h2 id="transfer-title">Transferir entre cuentas</h2><button className="icon-btn" aria-label="Cerrar" onClick={onClose}><Icon name="close" size={16} /></button></header>
    <div className="field"><label htmlFor="transfer-amount">Monto</label><input id="transfer-amount" className="select" type="number" value={amount} onChange={event => setAmount(event.target.value)} /></div>
    <div className="field-row"><div className="field"><label htmlFor="transfer-from">Desde</label><select id="transfer-from" className="select" value={from} onChange={event => setFrom(event.target.value)}>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className="field"><label htmlFor="transfer-to">Hacia</label><select id="transfer-to" className="select" value={to} onChange={event => setTo(event.target.value)}>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div></div>
    <div className="field"><label htmlFor="transfer-date">Fecha</label><input id="transfer-date" className="select" type="date" value={date} onChange={event => setDate(event.target.value)} /></div>
    <footer className="modal-actions"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={submit}>Transferir</button></footer>
  </section></div>
}
