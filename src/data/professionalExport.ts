import { byCategory, fmt, getAccount, getCategory, monthLabel, monthlySeries, totals, txForMonth } from './helpers'
import type { FinanceState } from '@/store/finance'

const downloadName = (prefix: string, extension: string) => `${prefix}-${new Date().toISOString().slice(0, 10)}.${extension}`

export async function exportExcel(state: FinanceState): Promise<void> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = '$harky'
  wb.created = new Date()

  const addSheet = (name: string, rows: Record<string, string | number | undefined>[]) => {
    const ws = wb.addWorksheet(name)
    if (!rows.length) return
    ws.columns = Object.keys(rows[0]).map(key => ({ header: key, key, width: Math.max(14, key.length + 4) }))
    ws.addRows(rows)
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }
    ws.eachRow(row => row.eachCell(cell => {
      if (typeof cell.value === 'number') cell.numFmt = '#,##0.00;[Red]-#,##0.00'
    }))
  }

  // Hoja 1: Resumen anual
  const years = Array.from(new Set(state.transactions.map(tx => Number(tx.date.slice(0, 4))))).sort()
  const annualRows = years.flatMap(year =>
    monthlySeries(state.transactions, year).map(m => ({
      Año: year, Mes: m.label, Ingresos: m.income, Gastos: m.expense, Ahorro: m.net,
    }))
  )
  addSheet('Resumen anual', annualRows)

  // Hoja 2: Por categoría
  const categoryRows = state.categories.map(c => {
    const amount = state.transactions
      .filter(tx => tx.categoryId === c.id && tx.type === c.type)
      .reduce((s, tx) => s + tx.amount, 0)
    return { Categoría: c.name, Tipo: c.type === 'expense' ? 'Gasto' : 'Ingreso', Total: amount, Presupuesto: c.budget }
  })
  addSheet('Por categoría', categoryRows)

  // Una hoja por mes
  const months = Array.from(new Set(state.transactions.map(tx => tx.date.slice(0, 7)))).sort().reverse()
  months.forEach(month => {
    const rows = txForMonth(state.transactions, month).map(tx => ({
      Fecha: tx.date,
      Tipo: tx.type === 'income' ? 'Ingreso' : tx.type === 'expense' ? 'Gasto' : 'Transferencia',
      Categoría: getCategory(tx.categoryId, state.categories)?.name ?? '',
      Cuenta: tx.type === 'transfer'
        ? `${getAccount(tx.fromAccount, state.accounts)?.name ?? ''} → ${getAccount(tx.toAccount, state.accounts)?.name ?? ''}`
        : getAccount(tx.accountId, state.accounts)?.name ?? '',
      Descripción: tx.note,
      Monto: tx.type === 'expense' ? -tx.amount : tx.amount,
    }))
    if (rows.length) addSheet(month.slice(0, 31), rows)
  })

  const buffer = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  const link = document.createElement('a')
  link.href = url
  link.download = downloadName('sharky-finanzas', 'xlsx')
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportMonthlyPdf(state: FinanceState, month: string, ownerName: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const rows = txForMonth(state.transactions, month)
  const summary = totals(rows)
  const categories = byCategory(rows, 'expense', state.categories)
  let y = 22

  doc.setFillColor(59, 130, 246)
  doc.roundedRect(16, 14, 18, 18, 4, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.text('$', 23, 26)
  doc.setTextColor(23, 32, 51)
  doc.setFontSize(20)
  doc.text('$harky', 40, 25)
  doc.setFontSize(10)
  doc.setTextColor(102, 112, 133)
  doc.text('Estado de cuenta personal', 40, 31)
  doc.text(`Titular: ${ownerName}`, 150, 20)
  doc.text(monthLabel(month), 150, 26)

  y = 48
  doc.setFillColor(244, 247, 251)
  doc.roundedRect(16, y, 178, 24, 4, 4, 'F')
  doc.setTextColor(102, 112, 133)
  doc.text('INGRESOS', 24, y + 8); doc.text('GASTOS', 83, y + 8); doc.text('AHORRO', 142, y + 8)
  doc.setTextColor(23, 32, 51)
  doc.setFontSize(12)
  doc.text(fmt(summary.income, state.currency), 24, y + 17)
  doc.text(fmt(summary.expense, state.currency), 83, y + 17)
  doc.text(fmt(summary.net, state.currency), 142, y + 17)

  y += 38
  doc.setFontSize(13); doc.text('Movimientos', 16, y); y += 8
  doc.setFontSize(9); doc.setTextColor(102, 112, 133)
  doc.text('Fecha', 16, y); doc.text('Descripción', 40, y); doc.text('Categoría', 116, y); doc.text('Monto', 166, y)
  y += 3; doc.setDrawColor(220, 226, 234); doc.line(16, y, 194, y); y += 6
  rows.forEach(tx => {
    if (y > 278) { doc.addPage(); y = 22 }
    doc.setTextColor(23, 32, 51)
    doc.text(tx.date, 16, y)
    doc.text(tx.note.slice(0, 40), 40, y)
    doc.text((getCategory(tx.categoryId, state.categories)?.name ?? 'Transferencia').slice(0, 22), 116, y)
    const signed = tx.type === 'expense' ? -tx.amount : tx.amount
    doc.text(fmt(signed, state.currency), 166, y)
    y += 7
  })

  if (categories.length) {
    if (y > 246) { doc.addPage(); y = 22 }
    y += 6; doc.setFontSize(13); doc.text('Principales categorías de gasto', 16, y); y += 8; doc.setFontSize(9)
    categories.slice(0, 5).forEach(category => {
      doc.text(category.category.name, 16, y); doc.text(fmt(category.amount, state.currency), 166, y); y += 6
    })
  }

  doc.save(downloadName(`sharky-estado-${month}`, 'pdf'))
}
