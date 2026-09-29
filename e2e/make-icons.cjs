/*
 * Genera los íconos de la app (PNG) a partir del logo propio, con el mismo Chromium de las pruebas.
 * Uso:  node e2e/make-icons.cjs
 */
const { chromium } = require('playwright')
const path = require('node:path')

const PUBLIC = path.resolve(__dirname, '..', 'public')

// Logo propio (mismo dibujo que public/favicon.svg y src/ui/Logo.tsx)
const logo = `
  <g stroke="#1f262d" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M9 9 H55 V41 L41 56 H9 Z" fill="#FFD95E"/>
    <path d="M55 41 H41 V56 Z" fill="#FFF1B8"/>
    <path d="M18 24 H44 M18 34 H35" fill="none"/>
    <path d="M22 4 L41 4 L39.5 14 L23.5 14 Z" fill="#5F96D7" stroke-width="2.4"/>
  </g>`

/** `scale` = cuánto del lienzo ocupa el logo; `radius` = esquinas redondeadas del fondo. */
function icon({ size, scale, radius }) {
  const logoSize = 64 * (size / 64) * scale
  const off = (size - logoSize) / 2
  const grid = []
  const step = size / 10.7
  for (let i = 1; i < 11; i++) {
    grid.push(`<path d="M${i * step} 0V${size}M0 ${i * step}H${size}" stroke="rgb(88 122 156 / .22)" stroke-width="${size / 256}" fill="none"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><clipPath id="c"><rect width="${size}" height="${size}" rx="${radius}"/></clipPath></defs>
    <g clip-path="url(#c)">
      <rect width="${size}" height="${size}" fill="#fbf5e4"/>
      ${grid.join('')}
      <g transform="translate(${off} ${off}) scale(${logoSize / 64})">${logo}</g>
    </g>
  </svg>`
}

const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 0.68, radius: 42 },
  { file: 'icon-512.png', size: 512, scale: 0.68, radius: 112 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.68, radius: 0 }, // iOS redondea solo
  { file: 'icon-maskable-512.png', size: 512, scale: 0.5, radius: 0 }, // zona segura de Android
]

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  for (const ic of ICONS) {
    await page.setViewportSize({ width: ic.size, height: ic.size })
    await page.setContent(`<html><body style="margin:0;background:transparent">${icon(ic)}</body></html>`)
    await page.screenshot({ path: path.join(PUBLIC, ic.file), omitBackground: true })
    console.log('✔', ic.file)
  }
  await browser.close()
})()
