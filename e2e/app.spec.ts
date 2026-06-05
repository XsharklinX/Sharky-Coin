import { expect, test, type Page } from '@playwright/test'

async function openDemo(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const demo = page.getByRole('button', { name: 'Explorar con datos de ejemplo' })
  await demo.waitFor({ state: 'visible', timeout: 120_000 })
  await demo.click()
  await expect(page.getByRole('heading', { name: /^(Inicio|Mis finanzas)$/ })).toBeVisible()
}

test('recorre las ocho vistas sin caer en el error boundary', async ({ page }) => {
  await openDemo(page)
  await expect(page.getByRole('button', { name: 'Crear' })).toBeVisible()
  for (const view of ['Transacciones', 'Cuentas', 'Estadísticas', 'Presupuestos', 'Metas', 'Calendario', 'Reporte anual', 'Inicio']) {
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
  const backgrounds = {
    midnight: 'rgb(7, 17, 31)',
    slate: 'rgb(17, 24, 39)',
    carbon: 'rgb(17, 18, 20)',
    light: 'rgb(244, 247, 251)',
  }
  for (const value of ['midnight', 'slate', 'carbon', 'light'] as const) {
    await theme.selectOption(value)
    await expect(page.locator('.app')).toHaveAttribute('data-theme', value)
    expect(await page.locator('.main').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(backgrounds[value])
    expect(await page.locator('.app').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(1200)
  }
})

test('mantiene las categorías de presupuesto utilizables en ventanas estrechas', async ({ page }) => {
  await page.setViewportSize({ width: 620, height: 900 })
  await openDemo(page)
  await page.getByRole('button', { name: /Presupuestos/ }).first().click()

  const rows = page.locator('.budget-row')
  await expect(rows).toHaveCount(9)
  const categoriesFit = await rows.evaluateAll(items => items.every(row => {
    const bounds = row.getBoundingClientRect()
    const icon = row.querySelector('.budget-category-main > span')?.getBoundingClientRect()
    const input = row.querySelector('.budget-input')?.getBoundingClientRect()
    const available = row.querySelector('.budget-available')?.getBoundingClientRect()
    if (!icon || !input || !available) return false
    return icon.x >= bounds.x
      && icon.x + icon.width <= bounds.x + bounds.width
      && input.x >= bounds.x
      && input.x + input.width <= bounds.x + bounds.width
      && available.x >= bounds.x
      && available.x + available.width <= bounds.x + bounds.width
  }))
  expect(categoriesFit).toBe(true)
})

test('crea puntos de recuperación locales y registra actividad', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: /Mi cuenta/ }).click()
  await page.getByRole('button', { name: 'Datos' }).click()
  await expect(page.getByText('Recuperación automática')).toBeVisible()
  await page.getByRole('button', { name: 'Crear punto' }).click()
  await expect(page.getByText('Creado manualmente')).toBeVisible()

  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByText('Actividad reciente')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Configuración' }).getByText('Punto de recuperación creado')).toBeVisible()
})

test('muestra estados vacíos profesionales y confirma acciones destructivas', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Empezar de cero' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
  await page.getByRole('button', { name: /Transacciones/ }).first().click()
  await expect(page.getByRole('heading', { name: 'No encontramos movimientos' })).toBeVisible()

  await page.getByRole('button', { name: /Metas/ }).first().click()
  await page.getByRole('button', { name: 'Nueva meta' }).click()
  await page.getByLabel('Nombre de la meta').fill('Reserva')
  await page.getByLabel('Monto objetivo').fill('10000')
  await page.getByRole('button', { name: 'Crear meta' }).click()
  await page.getByRole('button', { name: 'Eliminar Reserva' }).click()
  await expect(page.getByRole('dialog', { name: 'Eliminar meta' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('heading', { name: 'Reserva' })).toBeVisible()
})

test('el menú global de creación abre cada flujo principal', async ({ page }) => {
  await openDemo(page)

  await page.getByRole('button', { name: 'Crear' }).click()
  await page.getByRole('dialog', { name: 'Crear nuevo' }).getByRole('button', { name: /Movimiento/ }).click()
  await expect(page.getByRole('dialog', { name: 'Nuevo movimiento' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar' }).click()

  await page.getByRole('button', { name: 'Crear' }).click()
  await page.getByRole('dialog', { name: 'Crear nuevo' }).getByRole('button', { name: /^Cuenta/ }).click()
  await expect(page.getByRole('dialog', { name: 'Nueva cuenta' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar' }).click()

  await page.getByRole('button', { name: 'Crear' }).click()
  await page.getByRole('dialog', { name: 'Crear nuevo' }).getByRole('button', { name: /Categoría/ }).click()
  await expect(page.getByRole('dialog', { name: 'Nueva categoría de gasto' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar' }).click()

  await page.getByRole('button', { name: 'Crear' }).click()
  await page.getByRole('dialog', { name: 'Crear nuevo' }).getByRole('button', { name: /^Meta/ }).click()
  await expect(page.getByRole('dialog', { name: 'Crear una meta de ahorro' })).toBeVisible()
})

test('mantiene navegación y creación usables en viewport de teléfono', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 840 })
  await openDemo(page)

  await expect(page.locator('.sidebar')).toBeHidden()
  await expect(page.getByRole('navigation', { name: /Navegaci/ })).toBeVisible()
  await page.getByRole('button', { name: 'Analítica' }).click()
  await expect(page.getByRole('heading', { name: 'Analítica' })).toBeVisible()

  await page.getByRole('button', { name: 'Agregar' }).click()
  await expect(page.getByRole('heading', { name: 'Agregar', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Movimiento / }).click()
  await expect(page.getByRole('dialog', { name: 'Nuevo movimiento' })).toBeVisible()
})
