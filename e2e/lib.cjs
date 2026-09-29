// Utilidades compartidas por las pruebas de navegador (Etapas 1 y 2).
const fs = require('node:fs')
const path = require('node:path')

const OUT = path.resolve(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })

const results = []
const consoleErrors = []

function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? '  ✔' : '  ✘'} ${name}${ok ? '' : `  →  ${detail}`}`)
}

const near = (a, b, tol) => Math.abs(a - b) <= tol
const centerOf = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, ...opts })
  console.log(`    📷 ${path.relative(process.cwd(), file)}`)
  return file
}

const getState = (page) =>
  page.evaluate(() => {
    const s = window.__posits.store.getState()
    return {
      notes: Object.values(s.notes).map((n) => ({ ...n })),
      selectedId: s.selectedId,
      editingId: s.editingId,
      magnet: s.settings.magnet,
      defaultColor: s.settings.defaultColor,
      toast: s.toast ? s.toast.message : null,
      saveStatus: s.saveStatus,
      view: { ...window.__posits.view.get() },
    }
  })

/** Abre la app en un contexto nuevo, espera al tablero listo y a que termine el fundido de entrada. */
async function open(browser, url, opts) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${m.type()}] ${m.text()}`)
  })
  page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`))
  await page.goto(`${url}?debug`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(450)
  return { ctx, page }
}

async function waitSaved(page) {
  await page.waitForFunction(() => window.__posits.store.getState().saveStatus === 'saved')
}

/** Documento con un título y una lista: items = [texto, hecho]. */
const taskDoc = (title, items) => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: title }] },
    {
      type: 'taskList',
      content: items.map(([text, checked]) => ({
        type: 'taskItem',
        attrs: { checked },
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      })),
    },
  ],
})

const bulletDoc = (title, items) => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: title }] },
    {
      type: 'bulletList',
      content: items.map((text) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      })),
    },
  ],
})

const textDoc = (...lines) => ({
  type: 'doc',
  content: lines.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
})

function finish() {
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`)
  return failed.length ? 1 : 0
}

module.exports = {
  OUT,
  results,
  consoleErrors,
  check,
  near,
  centerOf,
  shot,
  getState,
  open,
  waitSaved,
  taskDoc,
  bulletDoc,
  textDoc,
  finish,
}
