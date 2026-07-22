import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { guessCategoryId } from '@/data/bankCsv'
import { fmtCompact, visibleAccounts } from '@/data/helpers'
import { useBankSuggestions, type BankSuggestion } from '@/store/bankSuggestions'
import { useFinance } from '@/store/finance'
import { useT } from '@/i18n'
import type { Account, AccountType, CurrencyCode, IconName } from '@/types'
import { SheetPortal } from '../SheetPortal'
import { useDialogA11y } from '../useDialogA11y'
import { useMobileBackDismiss } from '../useMobileBackDismiss'

export const ACCT_ICONS: Record<AccountType, IconName> = {
  cash: 'wallet', debit: 'cards', savings: 'piggy', credit: 'cards',
}

/**
 * Acciones compartidas para convertir una transacción detectada por aviso
 * bancario (`BankSuggestion`) en un movimiento real. Lo usan tanto la campanita
 * (MobileNotificationCenter) como Ajustes > Detección de transacciones, para no
 * duplicar el flujo de "elegir cuenta + agregar".
 *
 *  - `resolveFor(item)`  → la cuenta que le corresponde por el mapeo recordado
 *    del paquete de la app bancaria (o `undefined` si aún no se ha elegido una).
 *  - `handleAdd(item)`   → si ya hay cuenta resuelta, agrega el movimiento de
 *    una; si no, abre el selector de cuenta.
 *  - `openPicker(item)`  → abre el selector de cuenta para el aviso.
 *  - `pickerNode`        → el sheet del selector (renderízalo una vez en el árbol).
 */
export function useBankSuggestionActions() {
  const { accounts, categories, addTx, currency } = useFinance()
  const bankStore = useBankSuggestions()
  const t = useT()
  const [pickerItem, setPickerItem] = useState<BankSuggestion | null>(null)

  const resolveFor = (item: BankSuggestion): Account | undefined => {
    const mappedId = bankStore.packageAccountMap[item.pkg]
    if (!mappedId) return undefined
    return accounts.find(a => a.id === mappedId)
  }

  const addFromSuggestion = (item: BankSuggestion, account: Account) => {
    // Aplica las reglas de categoría aprendidas (o las de fábrica, tipo
    // UBER→Transporte) a la nota del aviso. `allowFallback=false`: si ninguna
    // regla encaja se deja SIN categoría en vez de meterla en la primera que
    // haya — una categoría equivocada engaña más que una vacía. Y como al
    // guardar categorizando la app aprende la regla, el siguiente aviso igual
    // ya se clasifica solo.
    const categoryId = guessCategoryId(item.note, categories, item.type, false)
    addTx({
      type: item.type,
      amount: item.amount,
      date: item.date,
      note: item.note,
      accountId: account.id,
      categoryId,
    })
    bankStore.remove(item.id)
    toast(categoryId ? t('movementAddedCategorized') : t('movementAdded'), { icon: 'check', type: 'ok' })
  }

  const handleAdd = (item: BankSuggestion) => {
    const account = resolveFor(item)
    if (account) {
      addFromSuggestion(item, account)
    } else {
      setPickerItem(item)
    }
  }

  const openPicker = (item: BankSuggestion) => setPickerItem(item)

  const closePicker = () => setPickerItem(null)

  const chooseAccount = (item: BankSuggestion, account: Account) => {
    // Recuerda el mapeo para que los próximos avisos de este banco se agreguen
    // de un toque, sin volver a preguntar.
    bankStore.rememberAccountForPackage(item.pkg, account.id)
    addFromSuggestion(item, account)
    closePicker()
  }

  const pickerNode = <AccountPickerSheet
    item={pickerItem}
    accounts={visibleAccounts(accounts)}
    currency={currency as CurrencyCode}
    onChoose={chooseAccount}
    onClose={closePicker}
  />

  return { handleAdd, openPicker, resolveFor, pickerNode }
}

function AccountPickerSheet({ item, accounts, currency, onChoose, onClose }: {
  item: BankSuggestion | null
  accounts: Account[]
  currency: CurrencyCode
  onChoose: (item: BankSuggestion, account: Account) => void
  onClose: () => void
}) {
  const t = useT()
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose, !!item, false)
  useMobileBackDismiss(!!item, onClose)

  if (!item) return null

  return (
    <SheetPortal>
      <div ref={dialogRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={onClose}>
        <section onClick={e => e.stopPropagation()}>
          <header>
            <span>{t('chooseAccountForLabel').replace('{note}', item.note)}</span>
            <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
          </header>
          {accounts.length === 0 ? (
            <div className="mobile-picker-list" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
              {t('noAccountsYet')}
            </div>
          ) : (
            <div className="mobile-picker-list">
              {accounts.map(account => (
                <button key={account.id} className="mobile-picker-row" onClick={() => onChoose(item, account)}>
                  <span style={{ color: account.color }}>
                    <Icon name={ACCT_ICONS[account.type] ?? 'wallet'} size={22} />
                  </span>
                  <b>{account.name}</b>
                  <small>{fmtCompact(account.balance, currency)}</small>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </SheetPortal>
  )
}
