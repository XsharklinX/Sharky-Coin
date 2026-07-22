import { useCallback, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { deleteWithUndo } from '@/lib/undoDelete'
import { useDialogs } from '@/components/ui/DialogProvider'
import { isDuplicateTransaction } from '@/data/bankCsv'
import { fmtCompact, localToday } from '@/data/helpers'
import { ACCENT_COLORS } from '@/constants'
import { dateLocale } from '@/data/helpers'
import { CURRENCIES } from '@/data/seed'
import { advanceRecurrenceDate } from '@/hooks/useRecurring'
import { isTauri } from '@/hooks/useTauri'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import { useNotes } from '@/store/notes'
import { noteTotals } from '@/data/notes'
import { translateCategoryName, useT } from '@/i18n'
import { playBackspaceSound, playDoneSound, playKeySound, playOperatorSound, playSoftHaptic } from '@/lib/sound'
import { parseQuickAdd } from '@/data/quickAddParse'
import { openNativeScanner } from '@/lib/mlkitOcr'
import { recognizeReceipt, type ReceiptOcrResult } from '@/lib/receiptOcr'
import { MobileDatePicker } from './MobileDatePicker'
import type { Category, IconName, RecurrenceFrequency, Transaction } from '@/types'
import type { BatchReceiptInput } from './MobileReceiptBatch'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { useDialogA11y } from './useDialogA11y'
import { useSubmitGuard } from './useSubmitGuard'
import { SheetPortal } from './SheetPortal'

type MobileTxMode = Transaction['type']

// El escaneo de varios recibos seguidos con la cámara en vivo (Fase 6 del
// roadmap) solo tiene sentido en Android+Tauri — es donde existe la cámara
// nativa; en web/desktop ya está la galería con selección múltiple.
const isAndroidTauri = isTauri() && /android/i.test(navigator.userAgent)

const today = localToday
const keypad = [
  '7', '8', '9', '÷',
  '4', '5', '6', '×',
  '1', '2', '3', '−',
  '0', '.', '+',
] as const
const MODE_ORDER: MobileTxMode[] = ['expense', 'income', 'transfer']
const SWIPE_THRESHOLD = 48
const OPERATORS = ['+', '−', '×', '÷'] as const
type Operator = (typeof OPERATORS)[number]
const CATEGORY_COLORS = ACCENT_COLORS
const CATEGORY_ICONS: IconName[] = [
  'cart', 'food', 'car', 'bolt', 'heart', 'home',
  'bag', 'book', 'wallet', 'laptop', 'trend', 'play',
  'music', 'coffee', 'phone', 'gym', 'bus', 'building',
  'gamepad', 'gift', 'scissors', 'baby', 'paw', 'pill',
  'plane', 'briefcase', 'shirt', 'pizza', 'star', 'fuel', 'flame', 'soda',
  'banknote', 'coins', 'handCoins', 'landmark', 'receipt',
  'tree', 'sun', 'bike', 'train', 'tv', 'monitor', 'headphones', 'clock',
  'key', 'tool', 'brush', 'graduation', 'stethoscope', 'salad', 'wine',
  'crown', 'trophy', 'shield', 'map', 'package',
]

const ACCT_ICONS: Record<string, IconName> = {
  cash: 'wallet', debit: 'cards', savings: 'piggy', credit: 'cards',
}

function cleanAmount(value: string): string {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '')
  const [integer = '', ...rest] = normalized.split('.')
  const decimal = rest.join('').slice(0, 2)
  const safeInteger = integer.replace(/^0+(?=\d)/, '')
  return rest.length ? `${safeInteger || '0'}.${decimal}` : safeInteger
}

function lastOperatorIndex(expr: string): number {
  return Math.max(...OPERATORS.map(op => expr.lastIndexOf(op)))
}

function lastSegment(expr: string): string {
  const cut = lastOperatorIndex(expr)
  return cut === -1 ? expr : expr.slice(cut + 1)
}

// Evaluates a left-to-right expression with standard ×/÷ precedence over +/−.
function evaluateExpression(expr: string): number {
  const raw = expr.match(/[+−×÷]|[\d.]+/g)
  if (!raw?.length) return 0
  const tokens = (OPERATORS as readonly string[]).includes(raw[raw.length - 1]) ? raw.slice(0, -1) : raw
  if (!tokens.length) return 0

  const terms: number[] = []
  const signs: ('+' | '−')[] = []
  let acc = Number(tokens[0]) || 0
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as Operator
    const val = Number(tokens[i + 1]) || 0
    if (op === '×') acc *= val
    else if (op === '÷') acc = val !== 0 ? acc / val : acc
    else {
      terms.push(acc)
      signs.push(op)
      acc = val
    }
  }
  terms.push(acc)

  return terms.reduce((sum, term, idx) => idx === 0 ? term : sum + (signs[idx - 1] === '−' ? -term : term), 0)
}

function formatDateShort(date: string, locale: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export function MobileCreateFlow({
  mkey,
  initialMode,
  receiptPreview,
  onOpenBatch,
  onSaved,
}: {
  mkey: string
  initialMode?: MobileTxMode
  receiptPreview?: { dataUrl: string; mimeType: string; name: string }
  onOpenBatch?: (receipts: BatchReceiptInput[]) => void
  onSaved: () => void
}) {
  const t = useT()
  const { confirm } = useDialogs()
  const settings = useSettings()
  const lang = (settings.language ?? 'es') as 'en' | 'es'
  const locale = dateLocale(lang)
  const { accounts, categories, transactions, currency, addTx, transfer, addCategory, updateCategory, deleteCategory } = useFinance()
  const noteInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<MobileTxMode>(initialMode ?? 'expense')
  const [amountText, setAmountText] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)   // no default account
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [note, setNote] = useState('')
  const [noteFocused, setNoteFocused] = useState(false)
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false)
  // Categoría que se está editando (pulsación larga en la grilla). null = crear.
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const { submitting, beginSubmit, endSubmit } = useSubmitGuard()
  const [transferPicker, setTransferPicker] = useState<'from' | 'to' | null>(null)
  const [accountPicker, setAccountPicker] = useState(false)
  const [datePicker, setDatePicker] = useState(false)
  const [date, setDate] = useState(() => {
    const current = today()
    return current.startsWith(mkey) ? current : `${mkey}-01`
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [triedSave, setTriedSave] = useState(false)
  const [shaking,   setShaking]   = useState(false)
  const [recurring, setRecurring] = useState(false)
  const [recurFreq, setRecurFreq] = useState<RecurrenceFrequency>('monthly')
  const [recurEnd,  setRecurEnd]  = useState('')
  const [recurEndPicker, setRecurEndPicker] = useState(false)
  const [scanMenuOpen, setScanMenuOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scannedImage, setScannedImage] = useState<{ dataUrl: string; name: string } | null>(null)
  // Confirmación visual: qué campos se acaban de rellenar por el escaneo, para
  // resaltarlos un instante (el "vi el monto y lo entendí" sin cámara en vivo).
  const [justScanned, setJustScanned] = useState<Set<'amount' | 'date' | 'account'>>(new Set())
  // Lista de compras abierta que coincide con el recibo escaneado (por monto),
  // para ofrecer marcarla como comprada de una vez.
  const [matchedListId, setMatchedListId] = useState<string | null>(null)
  const notes = useNotes(s => s.notes)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const amount = evaluateExpression(amountText)
  const hasOperator = OPERATORS.some(op => amountText.includes(op))
  const categoryType = mode === 'income' ? 'income' : 'expense'
  const visibleCategories = useMemo(
    () => categories.filter(c => c.type === categoryType).slice(0, 24),
    [categories, categoryType],
  )
  const activeCategory = visibleCategories.find(c => c.id === categoryId) ?? null
  const activeAccountId = accountId && accounts.some(a => a.id === accountId) ? accountId : null
  const activeAccount = activeAccountId ? accounts.find(a => a.id === activeAccountId) : null
  const fromAccountObj = accounts.find(a => a.id === fromAccount)
  const toAccountObj = accounts.find(a => a.id === toAccount)
  const validTransfer = mode === 'transfer' && !!fromAccount && !!toAccount && fromAccount !== toAccount

  // Notas anteriores únicas para el modo + categoría actual (autocompletar)
  const pastNotes = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const tx of transactions) {
      if (tx.type !== mode || !tx.note) continue
      if (categoryId && tx.categoryId !== categoryId) continue
      const n = tx.note.trim()
      if (n && !seen.has(n)) { seen.add(n); result.push(n) }
      if (result.length >= 20) break
    }
    return result
  }, [transactions, mode, categoryId])

  // Save is only allowed when account is explicitly selected
  const canSave = amount > 0 && date && (
    mode === 'transfer'
      ? validTransfer
      : !!activeCategory && !!activeAccountId
  )
  const isToday = date === today()

  useMobileBackDismiss(categoryEditorOpen, () => setCategoryEditorOpen(false))
  useMobileBackDismiss(!!transferPicker, () => setTransferPicker(null))
  // El resaltado por escaneo se apaga solo — es una confirmación momentánea,
  // no un estado permanente del campo.
  const scanHighlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const applyJustScanned = useCallback((fields: Set<'amount' | 'date' | 'account'>) => {
    if (scanHighlightTimer.current) clearTimeout(scanHighlightTimer.current)
    setJustScanned(fields)
    if (fields.size > 0) {
      scanHighlightTimer.current = setTimeout(() => setJustScanned(new Set()), 2200)
    }
  }, [])

  useMobileBackDismiss(accountPicker, () => setAccountPicker(false))
  useMobileBackDismiss(datePicker, () => setDatePicker(false))
  useMobileBackDismiss(recurEndPicker, () => setRecurEndPicker(false))
  useMobileBackDismiss(scanMenuOpen, () => setScanMenuOpen(false))

  const accountPickerRef = useDialogA11y<HTMLDivElement>(() => setAccountPicker(false), accountPicker)
  const transferPickerRef = useDialogA11y<HTMLDivElement>(() => setTransferPicker(null), !!transferPicker)
  const scanMenuRef = useDialogA11y<HTMLDivElement>(() => setScanMenuOpen(false), scanMenuOpen)

  const switchMode = useCallback((next: MobileTxMode) => { setMode(next); setCategoryId(null); setNote(''); setAccountId(null); setTriedSave(false); setFormError(null) }, [])

  const cycleMode = useCallback((direction: 1 | -1) => {
    const currentIndex = MODE_ORDER.indexOf(mode)
    const nextIndex = (currentIndex + direction + MODE_ORDER.length) % MODE_ORDER.length
    switchMode(MODE_ORDER[nextIndex])
  }, [mode, switchMode])

  const handleSwipeStart = useCallback((event: ReactTouchEvent) => {
    const touch = event.touches[0]
    swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }, [])

  const handleSwipeEnd = useCallback((event: ReactTouchEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return
    cycleMode(deltaX < 0 ? 1 : -1)
  }, [cycleMode])

  const pressKey = useCallback((key: (typeof keypad)[number] | 'back') => {
    setFormError(null)
    if (key === 'back') { playBackspaceSound(); setAmountText(v => v.slice(0, -1)); return }
    if ((OPERATORS as readonly string[]).includes(key)) {
      playOperatorSound()
      setAmountText(v => (!v || (OPERATORS as readonly string[]).includes(v.slice(-1)) ? v : v + key))
      return
    }
    if (key === '.') {
      playOperatorSound()
      setAmountText(v => {
        const segment = lastSegment(v)
        if (segment.includes('.')) return v
        return v + (segment ? '.' : '0.')
      })
      return
    }
    playKeySound()
    setAmountText(v => {
      const cut = lastOperatorIndex(v)
      const head = cut === -1 ? '' : v.slice(0, cut + 1)
      const segment = cut === -1 ? v : v.slice(cut + 1)
      // Si el segmento es solo "0." (o "0.0", "0.00"), cualquier dígito no-cero reemplaza
      // el segmento completo en lugar de ir al decimal — evita el efecto "0.05" al escribir "5"
      if (/^0\.0*$/.test(segment) && key !== '0') return head + key
      return head + cleanAmount(segment + key)
    })
  }, [])

  const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 420)
  }

  const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const openReceiptBatch = async (files: File[]) => {
    const receipts = await Promise.all(files.map(async file => ({ dataUrl: await fileToDataUrl(file), name: file.name })))
    onOpenBatch?.(receipts)
  }

  // Fase 6 del roadmap: la cámara en vivo también sirve para escanear varios
  // recibos seguidos, no solo uno. Abre el escáner, pregunta "¿otro más?" tras
  // cada captura, y arma el lote con la extracción que cada foto ya trae —
  // MobileReceiptBatch la reusa directo, sin volver a correr OCR.
  const openCameraBatch = async () => {
    const collected: BatchReceiptInput[] = []
    while (true) {
      const scan = await openNativeScanner()
      if (!scan) break
      collected.push({
        dataUrl: scan.dataUrl,
        name: `recibo-${collected.length + 1}.jpg`,
        amount: scan.amount,
        date: scan.date,
        cardLast4: scan.cardLast4,
        merchant: scan.merchant,
      })
      const again = await confirm({
        title: t('scanAnotherTitle'),
        description: t('scanAnotherDesc').replace('{n}', String(collected.length)),
        confirmLabel: t('scanAnotherConfirm'),
        cancelLabel: t('scanAnotherDone'),
        icon: 'camera',
      })
      if (!again) break
    }
    if (collected.length === 0) return
    if (collected.length === 1) {
      // Un solo recibo: el formulario normal es mejor que abrir el modo lote.
      const only = collected[0]
      await scanReceiptDataUrl(only.dataUrl, only.name, {
        rawText: '', amount: only.amount ?? null, date: only.date ?? null, cardLast4: only.cardLast4 ?? null, merchant: only.merchant ?? null,
      })
      return
    }
    onOpenBatch?.(collected)
  }

  // Cámara nativa (con recuadro azul en vivo y auto-captura) en Android+Tauri;
  // en web/desktop, o si el plugin falla por cualquier razón, cae al
  // `<input capture>` de siempre. La cámara ya trae el monto/fecha/tarjeta
  // extraídos (Fase 4 del roadmap) — se le pasan directo a scanReceiptDataUrl
  // para no correr OCR dos veces sobre la misma foto.
  const openCamera = async () => {
    const scan = await openNativeScanner()
    if (scan) {
      await scanReceiptDataUrl(scan.dataUrl, 'recibo.jpg', {
        rawText: '', amount: scan.amount, date: scan.date, cardLast4: scan.cardLast4, merchant: scan.merchant,
      })
      return
    }
    cameraInputRef.current?.click()
  }

  const scanReceiptFile = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    await scanReceiptDataUrl(dataUrl, file.name)
  }

  // Núcleo compartido por las tres fuentes de recibo (input `capture`, galería,
  // y la cámara nativa) — todas terminan con un data URL que reconocer, así
  // que solo el paso de "obtener la imagen" difiere. `preExtracted` salta el
  // OCR cuando la cámara nativa ya trae los campos resueltos (Fase 4).
  const scanReceiptDataUrl = async (dataUrl: string, name: string, preExtracted?: ReceiptOcrResult) => {
    setScannedImage({ dataUrl, name })
    setScanning(true)
    setJustScanned(new Set())
    try {
      const result = preExtracted ?? await recognizeReceipt(dataUrl)
      let found = false
      const highlighted = new Set<'amount' | 'date' | 'account'>()

      if (result.amount !== null) {
        setAmountText(String(result.amount))
        const foundAmountLabel = `${CURRENCIES[currency].symbol} ${result.amount.toLocaleString('en-US', { minimumFractionDigits: CURRENCIES[currency].decimals, maximumFractionDigits: CURRENCIES[currency].decimals })}`
        toast(t('scanAmountFound').replace('{amount}', foundAmountLabel), { icon: 'check', type: 'ok' })
        found = true
        highlighted.add('amount')
      }
      if (result.date !== null) {
        setDate(result.date)
        if (!found) toast(t('scanDateFound').replace('{date}', formatDateShort(result.date, locale)), { icon: 'calendar', type: 'ok' })
        found = true
        highlighted.add('date')
      }

      // Últimos 4 dígitos de la tarjeta impresos en el recibo → ubica sola la
      // cuenta correcta entre las del usuario (mismo criterio que las
      // notificaciones bancarias). Si hay más de una cuenta con esos 4
      // dígitos (raro, pero posible) no se adivina — mejor que el usuario elija.
      if (result.cardLast4) {
        const matches = accounts.filter(a => a.last4 === result.cardLast4)
        if (matches.length === 1) {
          setAccountId(matches[0].id)
          toast(t('scanAccountFound').replace('{account}', matches[0].name), { icon: 'cards', type: 'ok' })
          highlighted.add('account')
        }
      }

      // Si el monto reconocido coincide (con margen) con lo que falta de
      // pagar en una lista de compras abierta, se ofrece marcarla comprada:
      // el recibo ES la compra de esa lista.
      if (result.amount !== null) {
        const candidate = notes.find(n => {
          if (n.type !== 'shopping' || n.archived) return false
          const totals = noteTotals(n)
          if (totals.pricedCount === 0 || totals.remaining <= 0) return false
          return Math.abs(totals.remaining - result.amount!) <= Math.max(1, totals.remaining * 0.05)
        })
        if (candidate) setMatchedListId(candidate.id)
      }

      applyJustScanned(highlighted)
      if (!found) toast(t('scanNothingFound'), { icon: 'alert' })
    } catch {
      toast(t('scanFailed'), { icon: 'alert' })
    } finally {
      setScanning(false)
    }
  }

  // Marca como comprados todos los ítems pendientes de la lista detectada y
  // usa su título como nota del movimiento — cierra el círculo: recibo → lista.
  const applyMatchedList = () => {
    if (!matchedListId) return
    const note = useNotes.getState().notes.find(n => n.id === matchedListId)
    if (!note) { setMatchedListId(null); return }
    for (const item of note.items) {
      if (!item.done) useNotes.getState().toggleItem(note.id, item.id)
    }
    setNote(note.title)
    setMatchedListId(null)
    toast(t('listMarkedBoughtToast').replace('{list}', note.title), { icon: 'check', type: 'ok' })
  }

  const save = () => {
    if (!canSave) {
      const msg = amount <= 0
        ? t('amountError')
        : mode !== 'transfer' && !activeCategory
          ? t('categoryError')
          : mode !== 'transfer' && !activeAccountId
            ? t('accountError')
            : mode === 'transfer' && fromAccount === toAccount
              ? t('differentAccountsError')
              : t('fillAllError')
      setFormError(msg)
      setTriedSave(true)
      triggerShake()
      return
    }
    setTriedSave(false)
    setFormError(null)
    if (!beginSubmit()) return
    try {
      let duplicate = false
      if (mode === 'transfer') {
        transfer({ fromAccount, toAccount, amount, date, note: note.trim() || t('transfer') })
      } else {
        const finalNote = note.trim() || activeCategory!.name
        duplicate = isDuplicateTransaction(transactions, { date, amount, note: finalNote, accountId: activeAccountId! })
        addTx({
          type: mode, amount, date,
          note: finalNote,
          categoryId: activeCategory!.id,
          accountId: activeAccountId!,
          ...(recurring ? {
            recurring: recurFreq,
            recurringStart: date,
            recurringEnd: recurEnd || undefined,
            recurringNext: advanceRecurrenceDate(date, recurFreq),
          } : {}),
        })
      }
      playDoneSound()
      toast(
        duplicate
          ? t('possibleDuplicateMovement')
          : recurring
          ? t(recurFreq === 'weekly' ? 'weeklyRecurringScheduled' : 'monthlyRecurringScheduled')
          : mode === 'transfer' ? t('transferRecorded') : t('movementSaved'),
        { icon: duplicate ? 'alert' : 'check', type: duplicate ? undefined : 'ok' },
      )
      setAmountText('')
      setNote('')
      setCategoryId(null)
      setAccountId(null)
      setRecurring(false)
      setRecurEnd('')
      endSubmit()
      onSaved()
    } catch (error) {
      endSubmit()
      toast(error instanceof Error ? error.message : t('couldNotSave'), { icon: 'alert' })
    }
  }

  const closeCategoryEditor = () => { setCategoryEditorOpen(false); setEditingCategory(null) }

  const createCategory = (fields: { name: string; icon: IconName; color: string; budget: number }) => {
    const name = fields.name.trim()
    if (!name) { toast(t('enterCategoryName'), { icon: 'alert' }); return }
    addCategory({ name, icon: fields.icon, color: fields.color, budget: fields.budget, type: categoryType })
    toast(t('categoryCreated').replace('{name}', name), { icon: 'check', type: 'ok' })
    closeCategoryEditor()
  }

  const saveCategory = (fields: { name: string; icon: IconName; color: string; budget: number }) => {
    if (!editingCategory) return createCategory(fields)
    const name = fields.name.trim()
    if (!name) { toast(t('enterCategoryName'), { icon: 'alert' }); return }
    updateCategory(editingCategory.id, { name, icon: fields.icon, color: fields.color, budget: fields.budget })
    toast(t('categoryUpdated'), { icon: 'check', type: 'ok' })
    closeCategoryEditor()
  }

  // Borrado desde el editor: usa el mismo «Deshacer» que el resto de la app.
  // Si la categoría tiene movimientos, el store lo impide (no se puede dejar un
  // gasto huérfano) y se avisa con el motivo en vez de fallar en silencio.
  const removeCategory = (category: Category) => {
    try {
      const snapshot = category
      deleteWithUndo({
        message: t('categoryDeleted'),
        onDelete: () => deleteCategory(snapshot.id),
        onRestore: () => addCategory(snapshot),
      })
      if (categoryId === category.id) setCategoryId(null)
      closeCategoryEditor()
    } catch (error) {
      toast(error instanceof Error ? error.message : t('couldNotSave'), { icon: 'alert' })
    }
  }

  const openCategoryEditor = (category: Category) => { setEditingCategory(category); setCategoryEditorOpen(true) }

  // Alta por lenguaje natural: «gasté 500 en el súper ayer» rellena tipo, monto,
  // concepto, fecha y categoría de un tirón. Solo propone — el usuario ve el
  // formulario ya lleno y confirma. Deja intactos los campos que la frase no
  // menciona, para poder complementar en vez de sobrescribir.
  const [smartText, setSmartText] = useState('')
  const applySmartText = () => {
    const phrase = smartText.trim()
    if (!phrase) return
    const parsed = parseQuickAdd(phrase, categories)
    // switchMode resetea categoría/nota/cuenta, así que va PRIMERO; los setters
    // de abajo, al ser llamadas de estado posteriores, ganan sobre ese reset.
    if (parsed.type !== mode) switchMode(parsed.type)
    if (parsed.amount !== null) setAmountText(String(parsed.amount))
    if (parsed.note) setNote(parsed.note)
    setDate(parsed.date)
    if (parsed.categoryId) setCategoryId(parsed.categoryId)
    setSmartText('')
    playSoftHaptic()
    toast(t('smartAddFilled'), { icon: 'check', type: 'ok' })
  }

  // Pulsación larga sobre una categoría → editarla. Se cancela si el dedo se
  // mueve (>10px), para no dispararse durante un scroll. `fired` deja que el
  // onClick sepa que ya se abrió el editor y no seleccione la categoría además.
  const longPress = useRef<{ timer: number; fired: boolean; x: number; y: number }>({ timer: 0, fired: false, x: 0, y: 0 })
  const categoryPressHandlers = (category: Category) => ({
    onPointerDown: (e: React.PointerEvent) => {
      longPress.current.fired = false
      longPress.current.x = e.clientX
      longPress.current.y = e.clientY
      longPress.current.timer = window.setTimeout(() => {
        longPress.current.fired = true
        openCategoryEditor(category)
      }, 500)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (Math.hypot(e.clientX - longPress.current.x, e.clientY - longPress.current.y) > 10) {
        window.clearTimeout(longPress.current.timer)
      }
    },
    onPointerUp: () => window.clearTimeout(longPress.current.timer),
    onPointerCancel: () => window.clearTimeout(longPress.current.timer),
  })

  const amountColor = mode === 'income' ? '#35d0a2' : mode === 'transfer' ? '#ffdd3d' : '#f65574'
  const currencyPrefix = CURRENCIES[currency].symbol
  const showFirstMovementHint = transactions.length === 0 && !settings.dismissedAlerts.includes('create-first-movement')

  return (
    <div className="mobile-create-flow" aria-label={t('addMovement')}>

      {/* ─── Scrollable top section ─── */}
      <div className="mobile-create-scroll" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>

        {/* Recibo compartido desde otra app — solo referencia visual, no se guarda */}
        {receiptPreview && (
          <div className="mobile-create-receipt-preview">
            {receiptPreview.mimeType.startsWith('image/') ? (
              <img src={receiptPreview.dataUrl} alt={receiptPreview.name} />
            ) : (
              <div className="mobile-create-receipt-file">
                <Icon name="book" size={22} />
                <span>{receiptPreview.name}</span>
              </div>
            )}
            <span className="mobile-create-receipt-hint">{t('receiptHint')}</span>
          </div>
        )}

        {/* Escanear recibo (cámara o galería) — solo si no llegó uno compartido desde otra app */}
        {!receiptPreview && (
          <>
            {scannedImage ? (
              <div className="mobile-create-receipt-preview">
                <img src={scannedImage.dataUrl} alt={scannedImage.name} />
                <span className="mobile-create-receipt-hint">
                  {scanning ? t('scanningReceipt') : t('receiptHint')}
                </span>
              </div>
            ) : null}
            {/* El monto del recibo coincide con lo que falta de una lista de
                compras abierta: probablemente ES esa compra. */}
            {matchedListId && (() => {
              const list = notes.find(n => n.id === matchedListId)
              if (!list) return null
              return (
                <div className="mobile-create-list-match">
                  <span className="mobile-create-list-match-icon"><Icon name="cart" size={16} /></span>
                  <span className="mobile-create-list-match-text">
                    {t('listMatchQuestion').replace('{list}', list.title)}
                  </span>
                  <div className="mobile-create-list-match-actions">
                    <button onClick={() => setMatchedListId(null)}>{t('no')}</button>
                    <button className="primary" onClick={applyMatchedList}>{t('yesMarkBought')}</button>
                  </div>
                </div>
              )
            })()}
            {!scannedImage && (
              <button className="mobile-receipt-scan-btn" onClick={() => setScanMenuOpen(true)}>
                <Icon name="receipt" size={16} />
                {t('scanReceipt')}
              </button>
            )}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) scanReceiptFile(f); e.target.value = '' }} />
            <input ref={galleryInputRef} type="file" accept="image/*" multiple
              style={{ display: 'none' }}
              onChange={e => {
                const files = Array.from(e.target.files ?? [])
                if (files.length > 1 && onOpenBatch) void openReceiptBatch(files)
                else if (files[0]) scanReceiptFile(files[0])
                e.target.value = ''
              }} />
          </>
        )}

        {showFirstMovementHint && (
          <div className="mobile-context-hint">
            <span><Icon name="info" size={16} /></span>
            <div>
              <b>{t('firstMovementHintTitle')}</b>
              <small>{t('firstMovementHintText')}</small>
            </div>
            <button aria-label={t('dismiss')} onClick={() => settings.dismissAlert('create-first-movement')}>
              <Icon name="close" size={16} />
            </button>
          </div>
        )}

        {/* Mode tabs */}
        <div className="mobile-segment" role="tablist" aria-label={t('movementType')}>
          {([['expense', t('expense')], ['income', t('income')], ['transfer', t('transfer')]] as const).map(([value, label]) => (
            <button key={value} className={mode === value ? 'on' : ''} role="tab" aria-selected={mode === value}
              onClick={() => switchMode(value)}>
              {label}
            </button>
          ))}
        </div>

        {mode !== 'transfer' && (
          <div className="mobile-smart-add">
            <Icon name="bolt" size={16} />
            <input
              type="text"
              value={smartText}
              placeholder={t('smartAddPlaceholder')}
              enterKeyHint="done"
              onChange={e => setSmartText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applySmartText() } }}
            />
            {smartText.trim() && (
              <button className="mobile-smart-add-go" onClick={applySmartText} aria-label={t('smartAddApply')}>
                <Icon name="arrowUp" size={16} style={{ transform: 'rotate(90deg)' }} />
              </button>
            )}
          </div>
        )}

        {mode !== 'transfer' ? (
          <>
            {/* Category header */}
            <div className="mobile-create-section-header">
              <span>{t('category')}</span>
              {visibleCategories.length > 0 && <em className="mobile-create-hint">{t('longPressToEditCategory')}</em>}
              <button className="mobile-create-new-btn" onClick={() => { setEditingCategory(null); setCategoryEditorOpen(true) }}>
                <Icon name="plus" size={12} /> {t('new')}
              </button>
            </div>

            {/* Category grid */}
            {visibleCategories.length ? (
              <div className={`mobile-category-grid${triedSave && !activeCategory ? ' field-error' : ''}`}>
                {visibleCategories.map(category => {
                  const selected = activeCategory?.id === category.id
                  return (
                    <button key={category.id} className={selected ? 'on' : ''} aria-pressed={selected}
                      {...categoryPressHandlers(category)}
                      onClick={() => {
                        // Si venía de una pulsación larga, ya se abrió el editor: no seleccionar.
                        if (longPress.current.fired) return
                        setCategoryId(category.id); setTriedSave(false)
                      }}>
                      <span style={{ color: category.color, background: `color-mix(in oklab, ${category.color} 22%, transparent)` }}>
                        <Icon name={category.icon} size={20} />
                      </span>
                      <small>{translateCategoryName(category, lang)}</small>
                    </button>
                  )
                })}
                <button className="mobile-category-add" onClick={() => { setEditingCategory(null); setCategoryEditorOpen(true) }}>
                  <span><Icon name="plus" size={20} /></span>
                  <small>{t('new')}</small>
                </button>
              </div>
            ) : (
              <button className="mobile-empty-action" onClick={() => setCategoryEditorOpen(true)}>
                {t('createCategoryToContinue')}
              </button>
            )}

            <div className="mobile-create-section-header mobile-create-account-header">
              <span>{t('account')}</span>
            </div>
            <button
              className={`mobile-create-account-card${!activeAccount ? ' unset' : ''}${triedSave && !activeAccountId ? ' field-error' : ''}`}
              onClick={() => setAccountPicker(true)}
              aria-label={t('account')}
              aria-hidden="true"
              tabIndex={-1}
            >
              <span
                className="mobile-create-account-icon"
                style={{
                  color: activeAccount?.color ?? 'var(--m-primary)',
                  background: `color-mix(in oklab, ${activeAccount?.color ?? 'var(--m-primary)'} 16%, transparent)`,
                }}
              >
                <Icon name={activeAccount ? ACCT_ICONS[activeAccount.type] : 'cards'} size={20} />
              </span>
              <div className="mobile-create-account-copy">
                <strong>{activeAccount ? activeAccount.name : t('selectAccount')}</strong>
                <small>
                  {activeAccount
                    ? `${fmtCompact(activeAccount.balance, currency)} · ${t(activeAccount.type)}`
                    : accounts.length > 0
                      ? t('selectAccountHint')
                      : t('noAccountsYet')}
                </small>
              </div>
              <Icon name="arrowDn" size={16} />
            </button>

            {/* Recurring toggle */}
            <button
              className={`mobile-create-recurring-toggle${recurring ? ' active' : ''}`}
              onClick={() => setRecurring(r => !r)}
            >
              <span className="mobile-recur-icon">
                <Icon name="repeat" size={16} />
              </span>
              <span className="mobile-recur-copy">
                <span className="mobile-recur-label">{t('repeatMovement')}</span>
                <small className="mobile-recur-desc">{t('repeatMovementDesc')}</small>
              </span>
              <span className={`mobile-recur-switch${recurring ? ' on' : ''}`} />
            </button>

            {recurring && (
              <div className="mobile-create-recurring-opts">
                <div className="mobile-recur-opt-row">
                  <span className="mobile-recur-opt-label">{t('frequencyLabelShort')}</span>
                  <div className="mobile-segment mobile-recur-freq">
                    <button className={recurFreq === 'weekly' ? 'on' : ''} onClick={() => setRecurFreq('weekly')}>
                      {t('weekly')}
                    </button>
                    <button className={recurFreq === 'monthly' ? 'on' : ''} onClick={() => setRecurFreq('monthly')}>
                      {t('monthly')}
                    </button>
                  </div>
                </div>
                <div className="mobile-recur-opt-row">
                  <span className="mobile-recur-opt-label">{t('endDateLabel')}</span>
                  <button className="mobile-create-date-pill" onClick={() => setRecurEndPicker(true)}>
                    <Icon name="calendar" size={13} />
                    <span>{recurEnd ? `${t('until')} ${formatDateShort(recurEnd, locale)}` : t('noEndDate')}</span>
                    {recurEnd && (
                      <span style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); setRecurEnd('') }}>
                        <Icon name="close" size={12} />
                      </span>
                    )}
                  </button>
                </div>
                <p className="mobile-recur-hint">
                  <Icon name="info" size={13} />
                  {t('recurringVisibleHint')}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Transfer: visual account cards */}
            <div className="mobile-transfer-cards">
              <button className="mobile-transfer-card" onClick={() => setTransferPicker('from')}>
                <span style={{ color: fromAccountObj?.color ?? '#ffdd3d', background: `color-mix(in oklab, ${fromAccountObj?.color ?? '#ffdd3d'} 16%, transparent)` }}>
                  <Icon name={ACCT_ICONS[fromAccountObj?.type ?? 'cash']} size={26} />
                </span>
                <b>{fromAccountObj?.name ?? t('origin')}</b>
                <small>{fromAccountObj ? fmtCompact(fromAccountObj.balance, currency) : '—'}</small>
                <em>{t('from')}</em>
              </button>
              <div className="mobile-transfer-arrow">→</div>
              <button className="mobile-transfer-card" onClick={() => setTransferPicker('to')}>
                <span style={{ color: toAccountObj?.color ?? '#35d0a2', background: `color-mix(in oklab, ${toAccountObj?.color ?? '#35d0a2'} 16%, transparent)` }}>
                  <Icon name={ACCT_ICONS[toAccountObj?.type ?? 'cash']} size={26} />
                </span>
                <b>{toAccountObj?.name ?? t('destination')}</b>
                <small>{toAccountObj ? fmtCompact(toAccountObj.balance, currency) : '—'}</small>
                <em>{t('to')}</em>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── Fixed bottom: amount + quick row + keypad + done ─── */}
      <div className="mobile-create-bottom">
        {/* Amount display */}
        <div className={`mobile-create-amount-row${shaking ? ' shake' : ''}`}>
          <div className="mobile-create-amount-left">
            <span className="mobile-create-amount-label">
              {mode === 'expense' ? t('expense') : mode === 'income' ? t('income') : t('amount')}
            </span>
            {mode !== 'transfer' && (
              <button
                className={`mobile-create-pad-account${!activeAccount ? ' unset' : ''}${triedSave && !activeAccountId ? ' field-error' : ''}${justScanned.has('account') ? ' scan-found' : ''}`}
                onClick={() => setAccountPicker(true)}
                type="button"
                aria-label={t('account')}
              >
                <span
                  className="mobile-create-pad-account-icon"
                  style={{
                    color: activeAccount?.color ?? 'var(--m-primary)',
                    background: `color-mix(in oklab, ${activeAccount?.color ?? 'var(--m-primary)'} 18%, transparent)`,
                  }}
                >
                  <Icon name={activeAccount ? ACCT_ICONS[activeAccount.type] : 'cards'} size={15} />
                </span>
                <span className="mobile-create-pad-account-text">
                  {activeAccount ? activeAccount.name : t('selectAccount')}
                </span>
                <Icon name="arrowDn" size={12} />
              </button>
            )}
          </div>
          <span className="mobile-create-amount-stack">
            {hasOperator && (
              <small className="mobile-create-amount-expr">{currencyPrefix} {amountText}</small>
            )}
            <strong className={`mobile-create-amount-value${justScanned.has('amount') ? ' scan-found' : ''}`} style={{ color: amountText ? amountColor : '#3a3a3a' }}>
              {amountText
                ? (amountText.endsWith('.')
                    ? `${currencyPrefix} ${amount.toLocaleString('en-US')}.`
                    : `${currencyPrefix} ${amount.toLocaleString('en-US', { minimumFractionDigits: amountText.includes('.') ? 2 : 0, maximumFractionDigits: amountText.includes('.') ? 2 : 0 })}`)
                : `${currencyPrefix} 0`}
            </strong>
          </span>
        </div>
        {formError && (
          <div className="mobile-create-error">
            <Icon name="alert" size={13} />
            {formError}
          </div>
        )}

        {/* Quick row: account · note · date — kept inside this same compact panel */}
        <div className="mobile-create-quick-row">
          <div className="mobile-quick-note-input">
            <Icon name="edit" size={13} />
            <input
              ref={noteInputRef}
              type="text"
              value={note}
              placeholder={t('notePlaceholder')}
              enterKeyHint="done"
              autoCapitalize="sentences"
              autoCorrect="on"
              onChange={e => setNote(e.target.value)}
              onFocus={() => setNoteFocused(true)}
              onBlur={() => setNoteFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter') noteInputRef.current?.blur() }}
            />
          </div>
          <button className={`mobile-quick-date-btn${justScanned.has('date') ? ' scan-found' : ''}`} onClick={() => setDatePicker(true)}>
            <Icon name="calendar" size={13} />
            <span>{isToday ? t('today') : formatDateShort(date, locale)}</span>
          </button>
        </div>

        {/* Chips de notas anteriores — visibles solo mientras se escribe la nota */}
        {noteFocused && pastNotes.length > 0 && (
          <div className="mobile-note-chips">
            {pastNotes.map(n => (
              <button
                key={n}
                className="mobile-note-chip"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setNote(n); noteInputRef.current?.blur() }}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Numpad + Done — escondidos mientras se escribe la nota, para no competir con el teclado del SO */}
        {!noteFocused && (
          <div className="mobile-keypad-row">
            <div className="mobile-keypad-compact">
              {keypad.map(key => (
                <button
                  key={key}
                  className={[
                    (OPERATORS as readonly string[]).includes(key) ? 'op' : '',
                    key === '0' ? 'wide' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => pressKey(key)}>
                  {key}
                </button>
              ))}
            </div>
            {/* Columna de acciones: borrar arriba, Listo abajo — sin espacios sobrantes */}
            <div className="mobile-keypad-actions">
              <button className="mobile-back-button" onClick={() => pressKey('back')} aria-label={t('delete')}>
                <Icon name="close" size={18} />
              </button>
              <button className="mobile-done-button" disabled={submitting} onClick={save} aria-label={mode === 'transfer' ? t('transfer') : t('save')}>
                <Icon name="check" size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Single account picker */}
      {accountPicker && (
        <SheetPortal>
        <div ref={accountPickerRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={() => setAccountPicker(false)}>
          <section onClick={e => e.stopPropagation()}>
            <header>
              <span>{t('selectAccount')}</span>
              <button aria-label={t('close')} onClick={() => setAccountPicker(false)}><Icon name="close" size={18} /></button>
            </header>
            {accounts.length === 0 ? (
              <div className="mobile-picker-list" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                {t('noAccountsYet')}
              </div>
            ) : (
              <div className="mobile-picker-list">
                {accounts.map(account => (
                  <button key={account.id}
                    className={`mobile-picker-row${account.id === activeAccountId ? ' active' : ''}`}
                    onClick={() => { setAccountId(account.id); setAccountPicker(false); setTriedSave(false) }}>
                    <span style={{ color: account.color }}>
                      <Icon name={ACCT_ICONS[account.type] ?? 'wallet'} size={22} />
                    </span>
                    <b>{account.name}</b>
                    <small>{fmtCompact(account.balance, currency)}</small>
                    {account.id === activeAccountId && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 4 }} />}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
        </SheetPortal>
      )}

      {/* Transfer account picker sheet */}
      {transferPicker && (
        <SheetPortal>
        <div ref={transferPickerRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={() => setTransferPicker(null)}>
          <section onClick={e => e.stopPropagation()}>
            <header>
              <span>{transferPicker === 'from' ? t('sourceAccount') : t('destinationAccount')}</span>
              <button aria-label={t('close')} onClick={() => setTransferPicker(null)}><Icon name="close" size={18} /></button>
            </header>
            <div className="mobile-picker-list">
              {accounts.map(account => {
                const selected = transferPicker === 'from' ? account.id === fromAccount : account.id === toAccount
                return (
                  <button key={account.id} className={`mobile-picker-row${selected ? ' active' : ''}`}
                    onClick={() => {
                      if (transferPicker === 'from') setFromAccount(account.id)
                      else setToAccount(account.id)
                      setTransferPicker(null)
                    }}>
                    <span style={{ color: account.color }}>
                      <Icon name={ACCT_ICONS[account.type] ?? 'wallet'} size={22} />
                    </span>
                    <b>{account.name}</b>
                    <small>{fmtCompact(account.balance, currency)}</small>
                    {selected && <Icon name="check" size={16} style={{ color: 'var(--accent, #ffdd3d)', marginLeft: 4 }} />}
                  </button>
                )
              })}
            </div>
          </section>
        </div>
        </SheetPortal>
      )}

      {/* Receipt scan source picker */}
      {scanMenuOpen && (
        <SheetPortal>
        <div ref={scanMenuRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" onClick={() => setScanMenuOpen(false)}>
          <section onClick={e => e.stopPropagation()}>
            <header>
              <span>{t('scanReceipt')}</span>
              <button aria-label={t('close')} onClick={() => setScanMenuOpen(false)}><Icon name="close" size={18} /></button>
            </header>
            <div className="mobile-picker-list">
              <button className="mobile-picker-row" onClick={() => { setScanMenuOpen(false); void openCamera() }}>
                <Icon name="camera" size={20} />
                <b>{t('scanReceiptCamera')}</b>
              </button>
              {isAndroidTauri && onOpenBatch && (
                <button className="mobile-picker-row" onClick={() => { setScanMenuOpen(false); void openCameraBatch() }}>
                  <Icon name="receipt" size={20} />
                  <b>{t('scanReceiptCameraBatch')}</b>
                </button>
              )}
              <button className="mobile-picker-row" onClick={() => { setScanMenuOpen(false); galleryInputRef.current?.click() }}>
                <Icon name="upload" size={20} />
                <b>{t('scanReceiptGallery')}</b>
              </button>
            </div>
          </section>
        </div>
        </SheetPortal>
      )}

      {/* Date picker */}
      {datePicker && (
        <MobileDatePicker
          value={date}
          onChange={setDate}
          onClose={() => setDatePicker(false)}
        />
      )}

      {/* Recurring end date picker */}
      {recurEndPicker && (
        <MobileDatePicker
          value={recurEnd || date}
          onChange={v => setRecurEnd(v)}
          onClose={() => setRecurEndPicker(false)}
        />
      )}

      {categoryEditorOpen && (
        <MobileCategoryEditor
          type={categoryType}
          category={editingCategory}
          onClose={closeCategoryEditor}
          onSave={saveCategory}
          onDelete={editingCategory ? () => removeCategory(editingCategory) : undefined}
        />
      )}
    </div>
  )
}

export type MobileCreateTarget = Transaction | 'new'

function MobileCategoryEditor({
  type,
  category,
  onClose,
  onSave,
  onDelete,
}: {
  type: Category['type']
  /** Categoría a editar; null/undefined = crear una nueva. */
  category?: Category | null
  onClose: () => void
  onSave: (fields: { name: string; icon: IconName; color: string; budget: number }) => void
  onDelete?: () => void
}) {
  const t = useT()
  const editing = !!category
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState<IconName>(category?.icon ?? (type === 'income' ? 'wallet' : 'cart'))
  const [color, setColor] = useState(category?.color ?? (type === 'income' ? '#35d0a2' : '#ffdd3d'))
  const [budget, setBudget] = useState(category?.budget ? String(category.budget) : '')

  useMobileBackDismiss(true, onClose)

  return (
    <div className="mobile-editor-screen" role="dialog" aria-modal="true">
      <header>
        <button onClick={onClose}>{t('cancel')}</button>
        <strong>{editing ? t('editCategory') : t('newCategory')}</strong>
        <button onClick={() => onSave({ name, icon, color, budget: Number(budget) || 0 })}>{editing ? t('save') : t('create')}</button>
      </header>
      <div className="mobile-editor-body">
        <label>
          <span>{t('type')}</span>
          <input value={type === 'income' ? t('income') : t('expense')} readOnly />
        </label>
        <label>
          <span>{t('name')}</span>
          <input
            type="text"
            value={name}
            placeholder={type === 'income' ? t('egIncomeCategory') : t('egExpenseCategory')}
            autoCapitalize="words"
            autoCorrect="on"
            enterKeyHint="done"
            onChange={event => setName(event.target.value)}
          />
        </label>
        {type === 'expense' && (
          <label>
            <span>{t('monthlyBudget')}</span>
            <input type="number" value={budget} placeholder="0" onChange={event => setBudget(event.target.value)} />
          </label>
        )}
        <div>
          <span className="mobile-editor-label">{t('icon')}</span>
          <div className="mobile-icon-grid">
            {CATEGORY_ICONS.map(item => (
              <button key={item} className={icon === item ? 'on' : ''} onClick={() => setIcon(item)}>
                <Icon name={item} size={22} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mobile-editor-label">{t('color')}</span>
          <div className="mobile-color-grid">
            {CATEGORY_COLORS.map(item => (
              <button key={item} className={color === item ? 'on' : ''} style={{ background: item }} onClick={() => setColor(item)} />
            ))}
          </div>
        </div>
        {onDelete && (
          <button className="mobile-editor-delete" onClick={onDelete}>
            <Icon name="trash" size={16} /> {t('deleteCategory')}
          </button>
        )}
      </div>
    </div>
  )
}
