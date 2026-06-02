import { expect, test, type Page } from '@playwright/test'

async function openDemo(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const demo = page.getByRole('button', { name: 'Explorar con datos de ejemplo' })
  await demo.waitFor({ state: 'visible', timeout: 120_000 })
  await demo.click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
}

test('recorre las siete vistas sin caer en el error boundary', async ({ page }) => {
  await openDemo(page)
  for (const view of ['Transacciones', 'Cuentas', 'Estadísticas', 'Presupuestos', 'Metas', 'Resumen anual', 'Inicio']) {
    await page.getByRole('button', { name: new RegExp(view) }).first().click()
    await expect(page.getByRole('heading', { name: view })).toBeVisible()
  }

  await page.getByRole('button', { name: /Estadísticas/ }).first().click()
  await expect(page.getByText('Categorías principales')).toBeVisible()
  await expect(page.getByText('No pudimos cargar $harky')).toHaveCount(0)

  await page.getByRole('button', { name: /Presupuestos/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Presupuestos' })).toBeVisible()
  await expect(page.getByText('Presupuesto por categoría')).toBeVisible()
  await expect(page.locator('.budget-row')).toHaveCount(9)
  const categoriesAligned = await page.locator('.budget-row').evaluateAll(rows => rows.every(row => {
    const main = row.querySelector('.budget-category-main')
    const icon = row.querySelector('.budget-category-main > span')?.getBoundingClientRect()
    const name = row.querySelector('.budget-category-title > span:first-child')?.getBoundingClientRect()
    const bounds = row.getBoundingClientRect()
    if (!main || !icon || !name) return false
    const horizontal = getComputedStyle(main).flexDirection === 'row'
    const iconInsideRow = icon.y >= bounds.y && icon.y + icon.height <= bounds.y + bounds.height
    return horizontal && iconInsideRow && name.x > icon.x + icon.width
  }))
  expect(categoriesAligned).toBe(true)
})

test('aplica los cuatro temas desde el selector principal', async ({ page }) => {
  await openDemo(page)
  const theme = page.getByLabel('Tema visual')
  for (const value of ['midnight', 'slate', 'carbon', 'light']) {
    await theme.selectOption(value)
    await expect(page.locator('.app')).toHaveAttribute('data-theme', value)
  }
})

test('muestra estados vacíos profesionales y confirma acciones destructivas', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Empezar de cero' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
  await page.getByRole('button', { name: /Transacciones/ }).first().click()
  await expect(page.getByRole('heading', { name: 'No encontramos movimientos' })).toBeVisible()

  await page.getByRole('button', { name: /Metas/ }).first().click()
  await page.getByLabel('Nombre de la meta').fill('Reserva')
  await page.getByLabel('Monto objetivo').fill('10000')
  await page.getByRole('button', { name: 'Crear meta' }).click()
  page.on('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Eliminar Reserva' }).click()
  await expect(page.getByRole('heading', { name: 'Reserva' })).toBeVisible()
})
