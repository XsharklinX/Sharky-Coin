import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { fmt, fmtCompact } from '@/data/helpers'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useFmt } from '@/hooks/useFmt'
import { playAccountsSound } from '@/lib/sound'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { MobileAmountSheet } from './MobileAmountSheet'
import { MobileTextSheet } from './MobileTextSheet'
import { MobileDigitSheet } from './MobileDigitSheet'
import type { Account, AccountType, OverdraftPolicy, ViewId, ViewProps } from '@/types'

const COLORS = ['#ffdd3d','#35d0a2','#5bc0ff','#a78bfa','#ff6b8a','#f59e0b']

const EMPTY_ACCOUNT: Omit<Account, 'id'> = {
  name: '', short: '', type: 'debit', color: COLORS[1], balance: 0, last4: null,
}

const TYPE_META: Record<AccountType, { label: string; icon: Parameters<typeof Icon>[0]['name'] }> = {
  cash:    { label: 'Efectivo', icon: 'wallet' },
  debit:   { label: 'Débito',  icon: 'cards'  },
  savings: { label: 'Ahorros', icon: 'piggy'  },
  credit:  { label: 'Crédito', icon: 'cards'  },
}


export function MobileProfile({
  userName,
  onSettings,
  goto,
  createRequest,
}: {
  userName?: string
  onSettings: () => void
  goto: (view: ViewId) => void
  createRequest?: ViewProps['createRequest']
}) {
  const { displayName, setDisplayName } = useSettings()
  const { accounts, currency, addAccount, updateAccount, deleteAccount } = useFinance()
  const fmtVal = useFmt()

  const [editingName,    setEditingName]    = useState(false)
  const [nameInput,      setNameInput]      = useState(displayName || userName || '')
  const [editingAccount, setEditingAccount] = useState<Account | 'new' | null>(null)

  useMobileBackDismiss(!!editingAccount, () => setEditingAccount(null))

  useEffect(() => { playAccountsSound() }, [])

  useEffect(() => {
    if (createRequest?.target === 'account') setEditingAccount('new')
  }, [createRequest])

  const effectiveName = displayName || userName || ''
  const initial       = effectiveName ? effectiveName.slice(0, 1).toUpperCase() : '$'

  const saveName = () => {
    const trimmed = nameInput.trim()
    setDisplayName(trimmed)
    setEditingName(false)
    if (trimmed) toast(`Nombre actualizado a "${trimmed}"`, { icon: 'check', type: 'ok' })
  }

  const saveAccount = (fields: Omit<Account, 'id'>) => {
    if (!fields.name.trim() || !fields.short.trim()) {
      toast('Completa el nombre y la etiqueta.', { icon: 'alert' })
      return
    }
    const clean = { ...fields, name: fields.name.trim(), short: fields.short.trim(), last4: fields.last4?.trim() || null }
    if (editingAccount === 'new') addAccount(clean)
    else if (editingAccount) updateAccount(editingAccount.id, clean)
    toast(editingAccount === 'new' ? 'Cuenta creada' : 'Cuenta actualizada', { icon: 'cards', type: 'ok' })
    setEditingAccount(null)
  }

  const deleteAcc = (account: Account) => {
    try {
      deleteAccount(account.id)
      toast('Cuenta eliminada', { icon: 'trash', type: 'ok' })
      setEditingAccount(null)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo eliminar la cuenta.', { icon: 'alert' })
    }
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="mpr-root">

      {/* ── Avatar / Name ── */}
      <div className="mpr-hero">
        <div className="mpr-avatar">{initial}</div>
        {editingName ? (
          <div className="mpr-name-editor">
            <input
              type="text"
              value={nameInput}
              placeholder="Tu nombre"
              autoCapitalize="words"
              enterKeyHint="done"
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            />
            <div className="mpr-name-actions">
              <button onClick={() => setEditingName(false)}>Cancelar</button>
              <button className="primary" onClick={saveName}>Guardar</button>
            </div>
          </div>
        ) : (
          <>
            <h2>{effectiveName || 'Mi cuenta'}</h2>
            <button className="mpr-edit-name-btn" onClick={() => { setNameInput(effectiveName); setEditingName(true) }}>
              <Icon name="edit" size={13} />
              {effectiveName ? 'Editar nombre' : 'Agregar nombre'}
            </button>
          </>
        )}

        <div className="mpr-balance-badge">
          <span>Balance total</span>
          <strong>{fmtVal(totalBalance, currency)}</strong>
        </div>
      </div>

      {/* ── Accounts ── */}
      <div className="mpr-section">
        <div className="mpr-section-header">
          <span>Cuentas</span>
          <button className="mpr-add-btn" onClick={() => setEditingAccount('new')}>
            <Icon name="plus" size={15} /> Agregar
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="mpr-empty">
            <Icon name="cards" size={28} style={{ opacity: .25 }} />
            <p>Sin cuentas aún</p>
            <button onClick={() => setEditingAccount('new')}>Crear cuenta</button>
          </div>
        ) : (
          <div className="mpr-account-list">
            {accounts.map(a => (
              <button key={a.id} className="mpr-account-row" onClick={() => setEditingAccount(a)}>
                <span className="mpr-account-icon" style={{ background: a.color + '22', color: a.color }}>
                  <Icon name={TYPE_META[a.type].icon} size={20} />
                </span>
                <div className="mpr-account-info">
                  <b>{a.name}</b>
                  <small>{TYPE_META[a.type].label}{a.last4 ? ` · ·· ${a.last4}` : ''}</small>
                </div>
                <strong className={a.balance < 0 ? 'text-expense' : ''}>
                  {fmtVal(a.balance, currency)}
                </strong>
                <Icon name="arrowUp" size={14} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick links ── */}
      <div className="mpr-section">
        <div className="mpr-section-header"><span>Accesos rápidos</span></div>
        <div className="mpr-quick-grid">
          <button className="mpr-quick-card" onClick={onSettings}>
            <span className="mpr-quick-icon" style={{ background: '#ffdd3d22', color: '#ffdd3d' }}>
              <Icon name="settings" size={22} />
            </span>
            <strong>Configuración</strong>
            <small>Backup · Seguridad · Tema</small>
          </button>
          <button className="mpr-quick-card" onClick={() => goto('subscriptions')}>
            <span className="mpr-quick-icon" style={{ background: '#5bc0ff22', color: '#5bc0ff' }}>
              <Icon name="repeat" size={22} />
            </span>
            <strong>Recurrentes</strong>
            <small>Pagos y cobros fijos</small>
          </button>
          <button className="mpr-quick-card" onClick={() => goto('goals')}>
            <span className="mpr-quick-icon" style={{ background: '#35d0a222', color: '#35d0a2' }}>
              <Icon name="target" size={22} />
            </span>
            <strong>Metas</strong>
            <small>Ahorro por objetivo</small>
          </button>
          <button className="mpr-quick-card" onClick={() => goto('annual')}>
            <span className="mpr-quick-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
              <Icon name="chart" size={22} />
            </span>
            <strong>Informe anual</strong>
            <small>Resumen del año</small>
          </button>
          <button className="mpr-quick-card" onClick={() => goto('calendar')}>
            <span className="mpr-quick-icon" style={{ background: '#f59e0b22', color: '#f59e0b' }}>
              <Icon name="calendar" size={22} />
            </span>
            <strong>Calendario</strong>
            <small>Gastos por día</small>
          </button>
          <button className="mpr-quick-card" onClick={() => goto('debt')}>
            <span className="mpr-quick-icon" style={{ background: '#ff6b8a22', color: '#ff6b8a' }}>
              <Icon name="dollar" size={22} />
            </span>
            <strong>Deudas</strong>
            <small>Plan de pago</small>
          </button>
        </div>
      </div>

      {/* ── Account editor sheet ── */}
      {editingAccount !== null && (
        <AccountEditorSheet
          account={editingAccount === 'new' ? undefined : editingAccount}
          onClose={() => setEditingAccount(null)}
          onSave={saveAccount}
          onDelete={editingAccount !== 'new' ? deleteAcc : undefined}
        />
      )}
    </div>
  )
}

const OVERDRAFT_OPTIONS: { value: OverdraftPolicy | ''; label: string }[] = [
  { value: '',       label: 'Global' },
  { value: 'block',  label: 'Bloquear' },
  { value: 'warn',   label: 'Avisar' },
  { value: 'allow',  label: 'Permitir' },
]

type SubSheet = 'balance' | 'limit' | 'short' | 'last4' | null

function AccountEditorSheet({
  account,
  onClose,
  onSave,
  onDelete,
}: {
  account?: Account
  onClose: () => void
  onSave: (fields: Omit<Account, 'id'>) => void
  onDelete?: (account: Account) => void
}) {
  const { currency } = useFinance()
  const [fields, setFields] = useState<Omit<Account, 'id'>>(account ?? EMPTY_ACCOUNT)
  const [confirmDel, setConfirmDel] = useState(false)
  const [sub, setSub] = useState<SubSheet>(null)

  const patch = <K extends keyof typeof fields>(key: K, val: typeof fields[K]) =>
    setFields(cur => ({ ...cur, [key]: val }))

  useMobileBackDismiss(sub !== null, () => setSub(null))
  useMobileBackDismiss(sub === null, onClose)

  const row = (
    label: string,
    icon: Parameters<typeof Icon>[0]['name'],
    display: string,
    dim: boolean,
    target: SubSheet,
  ) => (
    <button className="mpr-form-row" onClick={() => setSub(target)}>
      <Icon name={icon} size={15} style={{ color: 'var(--m-muted)', flexShrink: 0 }} />
      <span className="mpr-form-row-label">{label}</span>
      <span className={dim ? 'mpr-form-row-dim' : 'mpr-form-row-val'}>{display}</span>
      <Icon name="arrowUp" size={12} style={{ transform: 'rotate(90deg)', color: 'var(--m-muted)', flexShrink: 0 }} />
    </button>
  )

  return (
    <>
      <div className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={onClose}>
        <section className="mpr-editor-sheet" onClick={e => e.stopPropagation()}>

          {/* Header compacto con icono dinámico */}
          <header className="mpr-editor-header">
            <div className="mpr-editor-header-icon" style={{ background: fields.color + '28', color: fields.color }}>
              <Icon name={TYPE_META[fields.type].icon} size={18} />
            </div>
            <input
              className="mpr-editor-name-input"
              value={fields.name}
              placeholder="Nombre de la cuenta"
              autoCapitalize="words"
              onChange={e => patch('name', e.target.value)}
            />
            <button className="mpr-editor-close" onClick={onClose}>
              <Icon name="close" size={18} />
            </button>
          </header>

          <div className="mpr-editor-body">

            {/* Tipo */}
            <div className="mpr-form-section">
              {(Object.entries(TYPE_META) as [AccountType, typeof TYPE_META[AccountType]][]).map(([type, meta]) => (
                <button
                  key={type}
                  className={`mpr-type-pill${fields.type === type ? ' on' : ''}`}
                  style={fields.type === type ? { borderColor: fields.color, background: fields.color + '20', color: fields.color } : {}}
                  onClick={() => patch('type', type)}
                >
                  <Icon name={meta.icon} size={14} />
                  {meta.label}
                </button>
              ))}
            </div>

            {/* Color */}
            <div className="mpr-form-section mpr-color-strip">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`mpr-color-dot${fields.color === c ? ' on' : ''}`}
                  style={{ background: c }}
                  onClick={() => patch('color', c)}
                />
              ))}
            </div>

            {/* Filas tapeables */}
            <div className="mpr-form-rows">
              {row('Balance', 'coins',
                fields.balance !== 0 ? fmt(fields.balance, currency) : '0.00',
                fields.balance === 0, 'balance')}

              {fields.type === 'credit' && row('Límite', 'cards',
                fields.limit ? fmt(fields.limit, currency) : 'Sin límite',
                !fields.limit, 'limit')}

              {row('Etiqueta', 'edit',
                fields.short || 'Añadir',
                !fields.short, 'short')}

              {row('Últimos 4', 'cards',
                fields.last4 ? `·· ${fields.last4}` : 'Opcional',
                !fields.last4, 'last4')}
            </div>

            {/* Sobregiro (solo no crédito) */}
            {fields.type !== 'credit' && (
              <div className="mpr-form-section mpr-overdraft-row">
                <span className="mpr-overdraft-label">Sobregiro</span>
                <div className="mpr-pill-row">
                  {OVERDRAFT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`mpr-pill${(fields.overdraftPolicy ?? '') === opt.value ? ' on' : ''}`}
                      style={(fields.overdraftPolicy ?? '') === opt.value
                        ? { borderColor: fields.color, background: fields.color + '22', color: fields.color }
                        : {}}
                      onClick={() => patch('overdraftPolicy', (opt.value || undefined) as OverdraftPolicy | undefined)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Eliminar */}
            {account && onDelete && (
              !confirmDel
                ? <button className="mpr-del-btn" onClick={() => setConfirmDel(true)}>
                    <Icon name="trash" size={15} /> Eliminar cuenta
                  </button>
                : <div className="mpr-confirm-del">
                    <p>¿Eliminar "{account.name}"?</p>
                    <div>
                      <button onClick={() => setConfirmDel(false)}>Cancelar</button>
                      <button className="danger" onClick={() => onDelete(account)}>
                        <Icon name="trash" size={15} /> Eliminar
                      </button>
                    </div>
                  </div>
            )}
          </div>

          <div className="mpr-editor-actions">
            <button className="mpr-btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="mpr-btn-save" style={{ background: fields.color }} onClick={() => onSave(fields)}>
              {account ? 'Guardar' : 'Crear cuenta'}
            </button>
          </div>
        </section>
      </div>

      {sub === 'balance' && (
        <MobileAmountSheet
          title="Balance inicial"
          value={fields.balance}
          currency={currency}
          onDone={v => { patch('balance', v); setSub(null) }}
          onClose={() => setSub(null)}
        />
      )}
      {sub === 'limit' && (
        <MobileAmountSheet
          title="Límite de crédito"
          value={fields.limit ?? 0}
          currency={currency}
          onDone={v => { patch('limit', v || undefined); setSub(null) }}
          onClose={() => setSub(null)}
        />
      )}
      {sub === 'short' && (
        <MobileTextSheet
          title="Etiqueta"
          value={fields.short}
          placeholder="Ej. Débito, Cash, Visa"
          maxLength={12}
          onDone={v => patch('short', v)}
          onClose={() => setSub(null)}
        />
      )}
      {sub === 'last4' && (
        <MobileDigitSheet
          title="Últimos 4 dígitos"
          value={fields.last4 ?? ''}
          maxDigits={4}
          onDone={v => patch('last4', v || null)}
          onClose={() => setSub(null)}
        />
      )}
    </>
  )
}
