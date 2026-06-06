import { useSettings } from '@/store/settings'

const en = {
  home: 'Home', movements: 'Movements', analytics: 'Analytics',
  add: 'Add', reports: 'Reports', profile: 'Profile',
  income: 'Income', expense: 'Expense', transfer: 'Transfer',
  save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
  search: 'Search', settings: 'Settings', loading: 'Loading...',
  jan:'January', feb:'February', mar:'March', apr:'April',
  may:'May', jun:'June', jul:'July', aug:'August',
  sep:'September', oct:'October', nov:'November', dec:'December',
  accounts: 'Accounts', debit: 'Debit', savings: 'Savings',
  credit: 'Credit', cash: 'Cash',
  goals: 'Goals', target: 'Target', saved: 'Saved', deadline: 'Deadline',
  contribute: 'Contribute', createGoal: 'Create goal', editGoal: 'Edit goal',
  newGoal: 'New goal', noGoals: 'No goals yet', createFirstGoal: 'Create first goal',
  totalSaved: 'Total saved', totalTarget: 'Total target', completed: 'Completed',
  budgets: 'Budgets', budget: 'Budget', noBudget: 'No budget',
  balance: 'Balance', expenses: 'Expenses',
  language: 'Language', theme: 'Theme', currency: 'Currency',
  darkMode: 'Dark mode', lightMode: 'Light mode',
  today: 'Today', yesterday: 'Yesterday',
  note: 'Note', category: 'Category', account: 'Account', date: 'Date',
  amount: 'Amount', recurring: 'Recurring', weekly: 'Weekly', monthly: 'Monthly',
  endDate: 'End date',
} satisfies Record<string, string>

export type LangKey = keyof typeof en
export type Language = 'en' | 'es'

const es: Record<LangKey, string> = {
  home: 'Inicio', movements: 'Movimientos', analytics: 'Gráficos',
  add: 'Agregar', reports: 'Informes', profile: 'Perfil',
  income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia',
  save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar',
  search: 'Buscar', settings: 'Configuración', loading: 'Cargando...',
  jan:'Enero', feb:'Febrero', mar:'Marzo', apr:'Abril',
  may:'Mayo', jun:'Junio', jul:'Julio', aug:'Agosto',
  sep:'Septiembre', oct:'Octubre', nov:'Noviembre', dec:'Diciembre',
  accounts: 'Cuentas', debit: 'Débito', savings: 'Ahorro',
  credit: 'Crédito', cash: 'Efectivo',
  goals: 'Metas', target: 'Objetivo', saved: 'Ahorrado', deadline: 'Fecha límite',
  contribute: 'Aportar', createGoal: 'Crear meta', editGoal: 'Editar meta',
  newGoal: 'Nueva meta', noGoals: 'No tienes metas aún', createFirstGoal: 'Crear primera meta',
  totalSaved: 'Total ahorrado', totalTarget: 'Objetivo total', completed: 'Completadas',
  budgets: 'Presupuestos', budget: 'Presupuesto', noBudget: 'Sin presupuesto',
  balance: 'Balance', expenses: 'Gastos',
  language: 'Idioma', theme: 'Tema', currency: 'Moneda',
  darkMode: 'Modo oscuro', lightMode: 'Modo claro',
  today: 'Hoy', yesterday: 'Ayer',
  note: 'Nota', category: 'Categoría', account: 'Cuenta', date: 'Fecha',
  amount: 'Monto', recurring: 'Recurrente', weekly: 'Semanal', monthly: 'Mensual',
  endDate: 'Fecha de fin',
}

const DICTS: Record<Language, Record<LangKey, string>> = { en, es }

export function useT() {
  const lang = (useSettings(s => s.language) ?? 'en') as Language
  const dict = DICTS[lang] ?? en
  return (key: LangKey): string => dict[key] ?? en[key]
}
