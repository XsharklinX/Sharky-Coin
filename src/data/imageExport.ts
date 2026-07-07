import { localToday } from '@/data/helpers'
import { saveFile } from '@/hooks/useTauri'

const COLOR_PROPS = [
  'color', 'background-color', 'background-image',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline-color', 'box-shadow', 'fill', 'stroke', 'text-decoration-color', 'caret-color',
] as const

// Detecta funciones de color modernas que html2canvas 1.x no sabe parsear
// (color-mix, oklch, oklab, lab, lch) — usadas en toda la paleta de la app.
const MODERN_COLOR_RE = /color-mix|oklch|oklab|lab\(|lch\(/i
const COLOR_FN_RE = /[a-z-]+\((?:[^()]|\([^()]*\))*\)/gi

let resolveCtx: CanvasRenderingContext2D | null | undefined

/** Resuelve color-mix()/oklch()/oklab()/lab()/lch() a rgb()/rgba() vía un canvas 2D. */
function resolveColorFunctions(value: string): string {
  if (!value || !MODERN_COLOR_RE.test(value)) return value
  if (resolveCtx === undefined) resolveCtx = document.createElement('canvas').getContext('2d')
  if (!resolveCtx) return value
  const ctx = resolveCtx
  return value.replace(COLOR_FN_RE, (token) => {
    const sentinel = '#102030'
    ctx.fillStyle = sentinel
    ctx.fillStyle = token
    const resolved = ctx.fillStyle
    return resolved === sentinel ? token : resolved
  })
}

function inlineResolvedColors(original: Element, clone: HTMLElement) {
  const computed = window.getComputedStyle(original)
  for (const prop of COLOR_PROPS) {
    const value = computed.getPropertyValue(prop)
    if (!value) continue
    const resolved = resolveColorFunctions(value)
    if (resolved !== value) clone.style.setProperty(prop, resolved, 'important')
  }
}

function inlinePseudoColors(original: Element, doc: Document, pseudo: '::before' | '::after', exportId: string) {
  const computed = window.getComputedStyle(original, pseudo)
  if (computed.content === 'none' || computed.content === '') return
  const decls: string[] = []
  for (const prop of COLOR_PROPS) {
    const value = computed.getPropertyValue(prop)
    if (!value) continue
    const resolved = resolveColorFunctions(value)
    if (resolved !== value) decls.push(`${prop}: ${resolved} !important;`)
  }
  if (!decls.length) return
  const style = doc.createElement('style')
  style.textContent = `[data-export-id="${exportId}"]${pseudo} { ${decls.join(' ')} }`
  doc.head.appendChild(style)
}

export async function exportElementPng(element: HTMLElement, name: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas')

  // html2canvas no soporta color-mix()/oklch(): marcamos cada nodo para
  // poder reescribir sus colores resueltos sobre el clon que usa para renderizar.
  const nodes = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))]
  nodes.forEach((el, i) => el.setAttribute('data-export-id', `export-${i}`))

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      onclone: (clonedDoc) => {
        for (const original of nodes) {
          const id = original.getAttribute('data-export-id')!
          const clone = clonedDoc.querySelector<HTMLElement>(`[data-export-id="${id}"]`)
          if (!clone) continue
          inlineResolvedColors(original, clone)
          inlinePseudoColors(original, clonedDoc, '::before', id)
          inlinePseudoColors(original, clonedDoc, '::after', id)
        }
      },
    })

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('No se pudo generar la imagen')
    const filename = `${name}-${localToday()}.png`
    await saveFile(blob, filename, 'Imagen de $harky', ['png'])
  } finally {
    nodes.forEach(el => el.removeAttribute('data-export-id'))
  }
}
