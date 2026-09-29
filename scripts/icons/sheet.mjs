// Hoja de revisión de los íconos (una imagen para mirarlos todos juntos):
//   node scripts/icons/sheet.mjs [--cat urgente] [--ids a,b,c] [--size 150] [--cols 6] [--bg cream|yellow|navy|white] [--out ruta.png]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { iconSvg } from './render.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1']] : acc), []),
)

const data = JSON.parse(fs.readFileSync(path.join(here, 'out/icons.json'), 'utf8'))
let icons = data.icons
if (args.cat) icons = icons.filter((i) => args.cat.split(',').includes(i.cat))
if (args.ids) icons = args.ids.split(',').map((id) => icons.find((i) => i.id === id) ?? data.icons.find((i) => i.id === id)).filter(Boolean)

const size = Number(args.size ?? 150)
const cols = Number(args.cols ?? 6)
const bgs = { cream: ['#fbf5e4', '#232a31'], yellow: ['#FFD95E', '#232a31'], navy: ['#34507F', '#fffaf0'], white: ['#ffffff', '#232a31'], gray: ['#3B3F46', '#fffaf0'] }
const [bg, ink] = bgs[args.bg ?? 'cream'] ?? bgs.cream

const cells = icons
  .map((i) => `<figure><div class="art">${iconSvg(i, data.colors, { size, ink })}</div><figcaption>${i.name}<small>${i.id}</small></figcaption></figure>`)
  .join('')
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:22px;background:${bg};color:${ink};font:15px 'Kalam',system-ui,sans-serif}
  .grid{display:grid;grid-template-columns:repeat(${cols},${size + 36}px);gap:14px 8px}
  figure{margin:0;text-align:center}
  .art{display:grid;place-items:center;height:${size + 16}px}
  figcaption{margin-top:4px;line-height:1.1}
  small{display:block;opacity:.55;font-size:11px}
</style><div class="grid">${cells}</div>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: cols * (size + 44) + 44, height: 400 }, deviceScaleFactor: Number(args.dpr ?? 1) })
await page.setContent(html)
await page.waitForTimeout(150)
const out = args.out ?? path.join(here, 'out/sheet.png')
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log(`${icons.length} íconos → ${out}`)
