// ── Enums / literals ──────────────────────────────────────
export type AccountType  = 'debit' | 'savings' | 'credit' | 'cash'
export type TxType       = 'income' | 'expense' | 'transfer'
export type CurrencyCode = 'DOP' | 'USD' | 'EUR' | 'MXN' | 'GBP' | 'COP' | 'ARS' | 'BRL' | 'CAD'
export type ThemeName    = 'dark' | 'light' | 'amoled' | 'system'
export type DensityName  = 'compact' | 'regular' | 'comfy'
export type OverdraftPolicy = 'block' | 'warn' | 'allow'
export type RecurrenceFrequency = 'weekly' | 'monthly'
export type IconName =
  // categorías existentes
  | 'home' | 'cart' | 'food' | 'car' | 'bolt' | 'play' | 'heart'
  | 'bag'  | 'book' | 'wallet' | 'laptop' | 'trend'
  // nuevas categorías
  | 'music' | 'coffee' | 'phone' | 'gym' | 'building' | 'bus'
  | 'gamepad' | 'gift' | 'scissors' | 'baby' | 'paw' | 'pill'
  | 'plane' | 'briefcase' | 'shirt' | 'pizza' | 'star' | 'fuel'
  | 'flame' | 'soda'
  // nav
  | 'grid' | 'list' | 'cards' | 'chart' | 'target'
  // acciones comunes
  | 'plus' | 'arrowUp' | 'arrowDn' | 'shark' | 'search'
  | 'bell' | 'close' | 'calendar' | 'dots'
  | 'edit' | 'trash' | 'download' | 'print'
  // extras
  | 'settings' | 'logout' | 'repeat' | 'tag' | 'camera'
  | 'check' | 'alert' | 'refresh' | 'dollar' | 'piggy'
  | 'sliders' | 'upload' | 'fileJson' | 'eye' | 'eyeOff' | 'info'
  | 'lock' | 'user' | 'palette'
  // 20 iconos nuevos
  | 'tree' | 'sun' | 'bike' | 'train' | 'tv' | 'monitor'
  | 'headphones' | 'clock' | 'key' | 'tool' | 'brush'
  | 'graduation' | 'stethoscope' | 'salad' | 'wine'
  | 'crown' | 'trophy' | 'shield' | 'map' | 'package'
  // iconos financieros
  | 'banknote' | 'coins' | 'handCoins' | 'landmark' | 'receipt'

// ── Entidades financieras ─────────────────────────────────
export interface Account {
  id:      string
  name:    string
  short:   string
  type:    AccountType
  color:   string
  balance: number
  /**
   * Saldo de apertura inmutable. El saldo "real" de una cuenta es siempre
   * `openingBalance + suma de movimientos`. Se conserva aparte para poder
   * auditar y recalcular `balance` si alguna vez deriva por un bug.
   * Opcional por compatibilidad: las cuentas antiguas lo back-derivan al cargar.
   */
  openingBalance?: number
  last4:   string | null
  limit?:  number
  overdraftPolicy?: OverdraftPolicy
  /**
   * Si es false, esta cuenta no cuenta para los totales/balance agregados
   * (Home, Profile, Accounts hero, Analytics, Budgets, Annual, widget,
   * exports). undefined/true = se incluye. La vista propia de la cuenta
   * (su balance y actividad) no se ve afectada.
   */
  includeInTotal?: boolean
  /**
   * Divisa propia de la cuenta. Su saldo y movimientos se registran en esta
   * divisa; los totales globales la convierten a la divisa base de la app con
   * el motor de tasas en vivo. `undefined` = divisa base (compatibilidad).
   */
  currency?: CurrencyCode
}

export interface Category {
  id:     string
  name:   string
  type:   'expense' | 'income'
  color:  string
  budget: number
  weeklyBudget?: number
  annualBudget?: number
  icon:   IconName
  /**
   * Si es true, el sobrante (o exceso) del presupuesto mensual del mes
   * anterior se suma (o resta) al presupuesto disponible de este mes.
   */
  rolloverEnabled?: boolean
}

/** Parte de una transacción dividida: cuánto del total va a cada categoría. */
export interface TxSplit {
  categoryId: string
  amount:     number
}

export interface Transaction {
  id:           string
  type:         TxType
  amount:       number
  date:         string              // YYYY-MM-DD
  note:         string
  categoryId?:  string              // income / expense
  accountId?:   string              // income / expense
  /**
   * División del monto entre 2+ categorías (ej. supermercado → comida +
   * limpieza). Si existe, las sumas deben igualar `amount` y los reportes /
   * presupuestos usan estas partes en lugar de `categoryId`. `categoryId`
   * se mantiene como categoría principal (la de mayor monto) por
   * compatibilidad con listas, búsqueda y exports simples.
   */
  splits?:      TxSplit[]
  fromAccount?: string              // transfer
  toAccount?:   string              // transfer
  /**
   * Solo transferencias entre cuentas de distinta divisa: monto que recibe la
   * cuenta destino en SU divisa (convertido con la tasa del momento de crear
   * la transferencia). `undefined` = misma divisa, se usa `amount`.
   */
  toAmount?:    number
  recurring?:   RecurrenceFrequency | null
  recurringStart?: string
  recurringEnd?: string
  recurringNext?: string
  /** Fechas (YYYY-MM-DD) de ocurrencias saltadas por el usuario: no se generan. */
  skippedDates?: string[]
  /** Solo suscripciones creadas desde el catálogo: id en SUBSCRIPTION_CATALOG, para mostrar el logo real de la marca. */
  serviceId?:   string
  tags?:        string[]            // ej. ['trabajo', 'viaje']
}

export interface GoalAutoContribute {
  amount:        number      // monto del PRÓXIMO aporte (crece con `increment`)
  frequency:     RecurrenceFrequency
  fromAccountId: string
  nextDate:      string      // YYYY-MM-DD
  /** Reto tipo "52 semanas": si >0, cada aporte sube este monto respecto al anterior. */
  increment?:    number
}

export interface Goal {
  id:        string
  name:      string
  target:    number
  saved:     number
  color:     string
  icon:      IconName
  deadline?: string          // YYYY-MM-DD
  /** Aporte periódico automático hacia esta meta, generado como GoalContribution. */
  autoContribute?: GoalAutoContribute
}

export interface GoalContribution {
  id: string
  goalId: string
  amount: number
  fromAccountId: string
  date: string
  note?: string
}

export interface Currency {
  code:     CurrencyCode
  symbol:   string
  decimals: number
}

// ── Helpers ───────────────────────────────────────────────
export interface Totals {
  income:  number
  expense: number
  net:     number
}

export interface CategoryTotal {
  category: Category
  amount:   number
}

export interface MonthSeries {
  key:     string
  label:   string
  income:  number
  expense: number
  net:     number
}

export interface WeekBucket {
  label: string
  value: number
}

export interface FmtOptions {
  decimals?: number
}

// ── Props compartidas de vistas ───────────────────────────
export type ViewId =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'stats'
  | 'budgets'
  | 'goals'
  | 'annual'
  | 'calendar'
  | 'reports'
  | 'subscriptions'
  | 'debt'
  | 'cashflow'

export interface ViewProps {
  txns:        Transaction[]
  mkey:        string
  onAdd:       () => void
  goto:        (view: ViewId) => void
  onEditTx:    (tx: Transaction) => void
  onDeleteTx?: (id: string) => void   // undo-aware delete desde App
  createRequest?: {
    target: 'account' | 'category' | 'goal'
    nonce: number
  }
}
