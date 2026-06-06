import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmtCompact } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import type { Account, AccountType, OverdraftPolicy, ViewId, ViewProps } from '@/types'
import { useMobileBackDismiss } from './useMobileBackDismiss'

const COLORS = ['#ffdd3d', '#35d0a2', '#5bc0ff', '#a78bfa', '#ff6b8a', '#f59e0b']
const EMPTY_ACCOUNT: Omit<Account, 'id'> = {
  name: '',
  short: '',
  type: 'debit',
  color: COLORS[1],
  balance: 0,
  last4: null,
}

const TYPE_META: Record<AccountType, { label: string; group: string; icon: Parameters<typeof Icon>[0]['name'] }> = {
  cash: { label: 'Efectivo', group: 'Efectivo', icon: 'wallet' },
  debit: { label: 'Banco', group: 'Bancos', icon: 'cards' },
  savings: { label: 'Ahorro', group: 'Bancos', icon: 'piggy' },
  credit: { label: 'Tarjeta', group: 'Tarjetas', icon: 'cards' },
}

function accountBalanceKind(account: Account): 'asset' | 'debt' {
  return account.type === 'credit' || account.balance < 0 ? 'debt' : 'asset'
}

export function MobileReports({
  goto,
  onSettings,
  createRequest,
}: {
  goto: (view: ViewId) => void
  onSettings: () => void
  createRequest?: ViewProps['createRequest']
}) {
  const { accounts, currency, addAccount, updateAccount, deleteAccount } = useFinance()
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [managing, setManaging] = useState(false)
  useMobileBackDismiss(!!editing, () => setEditing(null))
  useMobileBackDismiss(managing, () => setManaging(false))

  const summary = useMemo(() => {
    const assets = accounts
      .filter(account => accountBalanceKind(account) === 'asset')
      .reduce((sum, account) => sum + Math.max(0, account.balance), 0)
    const liabilities = accounts
      .filter(account => accountBalanceKind(account) === 'debt')
      .reduce((sum, account) => sum + Math.abs(Math.min(0, account.balance)), 0)
    return { assets, liabilities, net: assets - liabilities }
  }, [accounts])

  const groups = ['Efectivo', 'Bancos', 'Tarjetas'].map(group => ({
    group,
    accounts: accounts.filter(account => TYPE_META[account.type].group === group),
  })).filter(group => group.accounts.length)

  useEffect(() => {
    if (createRequest?.target === 'account') setEditing('new')
  }, [createRequest])

  const save = (fields: Omit<Account, 'id'>) => {
    if (!fields.name.trim() || !fields.short.trim()) {
      toast('Completa nombre y etiqueta.', { icon: 'alert' })
      return
    }
    const clean = { ...fields, name: fields.name.trim(), short: fields.short.trim(), last4: fields.last4?.trim() || null }
    if (editing === 'new') addAccount(clean)
    else if (editing) updateAccount(editing.id, clean)
    toast(editing === 'new' ? 'Cuenta creada' : 'Cuenta actualizada', { icon: 'cards', type: 'ok' })
    setEditing(null)
  }

  const remove = (account: Account) => {
    try {
      deleteAccount(account.id)
      toast('Cuenta eliminada', { icon: 'trash', type: 'ok' })
      setEditing(null)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo eliminar la cuenta.', { icon: 'alert' })
    }
  }

  return (
    <div className="mobile-reports">
      <section className="mobile-networth-card">
        <span>Patrimonio neto</span>
        <strong>{fmtCompact(summary.net, currency)}</strong>
        <div>
          <article><small>Activos</small><b>{fmtCompact(summary.assets, currency)}</b></article>
          <article><small>Pasivos</small><b>{fmtCompact(summary.liabilities, currency)}</b></article>
        </div>
      </section>

      <section className="mobile-section-card mobile-account-section">
        <header>
          <div>
            <h2>Cuentas</h2>
            <p>Organizadas por tipo</p>
          </div>
          <button onClick={() => setEditing('new')}>Añadir</button>
        </header>
        {groups.map(group => (
          <div className="mobile-account-group" key={group.group}>
            <div className="mobile-account-group-title">
              <span>{group.group}</span>
              <strong>{fmtCompact(group.accounts.reduce((sum, account) => sum + account.balance, 0), currency)}</strong>
            </div>
            {group.accounts.map(account => {
              const used = account.type === 'credit' && account.limit
                ? Math.abs(Math.min(0, account.balance))
                : null
              const utilPct = used !== null && account.limit
                ? Math.min(100, used / account.limit * 100)
                : null
              return (
                <button key={account.id} className="mobile-account-row" onClick={() => setEditing(account)}>
                  <span style={{ color: account.color }}>
                    <Icon name={TYPE_META[account.type].icon} size={24} />
                  </span>
                  <div className="mobile-account-row-body">
                    <b>{account.name}</b>
                    <small>{TYPE_META[account.type].label}{account.last4 ? ` · ${account.last4}` : ''}</small>
                    {utilPct !== null && account.limit && (
                      <div className="mobile-credit-util">
                        <div className="mobile-credit-bar">
                          <div style={{
                            width: `${utilPct}%`,
                            background: utilPct >= 90 ? '#ff6b8a' : utilPct >= 70 ? '#f59e0b' : '#35d0a2',
                          }} />
                        </div>
                        <span className={utilPct >= 90 ? 'over' : utilPct >= 70 ? 'warn' : ''}>
                          {Math.round(utilPct)}% · {fmtCompact(account.limit - used!, currency)} libre
                        </span>
                      </div>
                    )}
                  </div>
                  <strong className={accountBalanceKind(account) === 'debt' ? 'expense' : ''}>{fmtCompact(account.balance, currency)}</strong>
                  <Icon name="arrowUp" size={15} style={{ transform: 'rotate(90deg)' }} />
                </button>
              )
            })}
          </div>
        ))}
        {!accounts.length && (
          <div className="mobile-empty-list">
            <Icon name="cards" size={26} />
            <strong>Sin cuentas</strong>
            <span>Añade efectivo, banco o tarjeta para empezar.</span>
          </div>
        )}
      </section>

      <section className="mobile-report-actions">
        <button onClick={() => setEditing('new')}><Icon name="plus" size={20} />Añadir cuenta</button>
        <button onClick={() => setManaging(true)}><Icon name="sliders" size={20} />Administrar</button>
      </section>

      <section className="mobile-section-card mobile-internal-sections">
        <header>
          <div>
            <h2>Secciones</h2>
            <p>Planificación y respaldo</p>
          </div>
        </header>
        <button onClick={() => goto('budgets')}><Icon name="target" size={20} />Presupuestos</button>
        <button onClick={() => goto('goals')}><Icon name="trend" size={20} />Metas</button>
        <button onClick={() => goto('calendar')}><Icon name="calendar" size={20} />Calendario</button>
        <button onClick={onSettings}><Icon name="fileJson" size={20} />Backup y configuración</button>
      </section>

      {editing && (
        <MobileAccountEditor
          account={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onDelete={remove}
          onSave={save}
        />
      )}

      {managing && (
        <div className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={() => setManaging(false)}>
          <section onClick={event => event.stopPropagation()}>
            <header>
              <span><Icon name="sliders" size={26} /></span>
              <button onClick={() => setManaging(false)}><Icon name="close" size={18} /></button>
            </header>
            <h2>Administrar cuentas</h2>
            <div className="mobile-manage-list">
              {accounts.map(account => (
                <button key={account.id} onClick={() => { setManaging(false); setEditing(account) }}>
                  <span style={{ color: account.color }}><Icon name={TYPE_META[account.type].icon} size={20} /></span>
                  <b>{account.name}</b>
                  <small>{fmtCompact(account.balance, currency)}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function MobileAccountEditor({
  account,
  onClose,
  onSave,
  onDelete,
}: {
  account?: Account
  onClose: () => void
  onSave: (fields: Omit<Account, 'id'>) => void
  onDelete: (account: Account) => void
}) {
  const [fields, setFields] = useState<Omit<Account, 'id'>>(account ?? EMPTY_ACCOUNT)
  const patch = <K extends keyof typeof fields>(key: K, value: typeof fields[K]) => {
    setFields(current => ({ ...current, [key]: value }))
  }

  return (
    <div className="mobile-editor-screen" role="dialog" aria-modal="true">
      <header>
        <button onClick={onClose}>Cancelar</button>
        <strong>{account ? 'Editar cuenta' : 'Nueva cuenta'}</strong>
        <button onClick={() => onSave(fields)}>Guardar</button>
      </header>
      <div className="mobile-editor-body">
        <label>
          <span>Nombre</span>
          <input value={fields.name} placeholder="Ej. Banco Popular" onChange={event => patch('name', event.target.value)} />
        </label>
        <div className="mobile-field-grid two">
          <label>
            <span>Etiqueta</span>
            <input value={fields.short} placeholder="Débito" onChange={event => patch('short', event.target.value)} />
          </label>
          <label>
            <span>Tipo</span>
            <select value={fields.type} onChange={event => patch('type', event.target.value as AccountType)}>
              <option value="cash">Efectivo</option>
              <option value="debit">Banco</option>
              <option value="savings">Ahorro</option>
              <option value="credit">Tarjeta</option>
            </select>
          </label>
        </div>
        <div className="mobile-field-grid two">
          <label>
            <span>Saldo</span>
            <input type="number" value={fields.balance} onChange={event => patch('balance', Number(event.target.value))} />
          </label>
          <label>
            <span>Últimos 4</span>
            <input maxLength={4} value={fields.last4 ?? ''} placeholder="Opcional" onChange={event => patch('last4', event.target.value)} />
          </label>
        </div>
        {fields.type === 'credit' && (
          <label>
            <span>Límite de crédito</span>
            <input type="number" value={fields.limit ?? ''} onChange={event => patch('limit', Number(event.target.value) || undefined)} />
          </label>
        )}
        {fields.type !== 'credit' && (
          <label>
            <span>Sobregiro</span>
            <select value={fields.overdraftPolicy ?? ''} onChange={event => patch('overdraftPolicy', (event.target.value || undefined) as OverdraftPolicy | undefined)}>
              <option value="">Usar configuración global</option>
              <option value="block">Bloquear sin saldo</option>
              <option value="warn">Advertir</option>
              <option value="allow">Permitir</option>
            </select>
          </label>
        )}
        <div className="mobile-color-grid">
          {COLORS.map(color => (
            <button key={color} className={fields.color === color ? 'on' : ''} style={{ background: color }} onClick={() => patch('color', color)} />
          ))}
        </div>
        {account && <button className="mobile-delete-button" onClick={() => onDelete(account)}><Icon name="trash" size={18} />Eliminar cuenta</button>}
      </div>
    </div>
  )
}
