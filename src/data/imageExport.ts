export async function exportElementPng(element: HTMLElement, name: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
  })
  const link = document.createElement('a')
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
