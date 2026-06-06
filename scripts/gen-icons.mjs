import { chromium } from 'playwright-core'
import { writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root  = join(__dir, '..')
const svgSrc = readFileSync(join(root, 'public', 'icon.svg'), 'utf8')

const SIZES = [16, 32, 48, 180, 192, 512]

const html = `<!DOCTYPE html><html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:512px; height:512px; background:#0a0e16; display:flex; align-items:center; justify-content:center; }
  svg  { width:512px; height:512px; }
</style></head><body>${svgSrc}</body></html>`

const browser = await chromium.launch()
const page    = await browser.newPage()
await page.setViewportSize({ width: 512, height: 512 })
await page.setContent(html, { waitUntil: 'load' })

for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size })
  await page.evaluate((s) => {
    document.body.style.width  = s + 'px'
    document.body.style.height = s + 'px'
    document.querySelector('svg').style.width  = s + 'px'
    document.querySelector('svg').style.height = s + 'px'
  }, size)
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } })
  const out = join(root, 'public', 'icons', `icon-${size}.png`)
  writeFileSync(out, buf)
  console.log(`✓ icon-${size}.png`)
}

// Also write to public root for the PWA manifest
for (const size of [192, 512]) {
  const src = join(root, 'public', 'icons', `icon-${size}.png`)
  const dst = join(root, 'public', `icon-${size}.png`)
  writeFileSync(dst, readFileSync(src))
  console.log(`✓ public/icon-${size}.png`)
}

await browser.close()
console.log('Done.')
