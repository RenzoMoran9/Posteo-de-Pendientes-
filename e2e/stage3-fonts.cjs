/*
 * Prueba de la Etapa 3 (letras): letra por posit, negrita / cursiva / subrayado.
 *   - PC: ratón y teclado · Celular: toques reales
 *
 * Uso:  npm run build && node e2e/stage3-fonts.cjs
 */
const { chromium } = require('playwright')
const { startPreview } = require('./serve.cjs')
const { check, near, centerOf, shot, getState, open, waitSaved, consoleErrors, finish } = require('./lib.cjs')

const FONTS = [
  ['kalam', 'Pluma', 'Kalam', 1],
  ['caveat', 'Bolígrafo', 'Caveat', 1.3],
  ['patrick', 'Lápiz', 'Patrick Hand', 1.08],
  ['architects', 'Punta fina', 'Architects Daughter', 1.04],
  ['gochi', 'Pincel', 'Gochi Hand', 1.02],
  ['covered', 'Marcador', 'Covered By Your Grace', 1.08],
  ['altura', 'Portaminas', 'Just Another Hand', 1.25],
  ['marker', 'Marcador grueso', 'Permanent Marker', 0.86],
]

const noteFont = (page, i = 0) =>
  page.evaluate((idx) => {
    const pm = document.querySelectorAll('.note .ProseMirror')[idx]
    const cs = getComputedStyle(pm)
    return { family: cs.fontFamily, size: parseFloat(cs.fontSize) }
  }, i)

const loaded = (page, family, size = 22) => page.evaluate(async ([f, s]) => {
  await document.fonts.load(`${s}px "${f}"`)
  return document.fonts.check(`${s}px "${f}"`)
}, [family, size])

/** Altura del trazo de lápiz (0 = arriba del renglón, 1 = abajo) en el primer renglón del pendiente marcado. */
const strikeRatio = (page) =>
  page.evaluate(() => {
    const li = document.querySelector('.note li.task-item[data-checked="true"]')
    if (!li) return null
    const path = li.querySelector('.task-strike path.main')
    if (!path) return null
    const content = li.querySelector('.task-content')
    const w = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    const n = w.nextNode()
    range.selectNodeContents(n)
    const r = range.getClientRects()[0]
    const pr = path.getBoundingClientRect()
    return { ratio: ((pr.top + pr.bottom) / 2 - r.top) / r.height, lineH: r.height }
  })

async function desktop(browser, url) {
  console.log('\n▶ PC (1280×800): letra por posit, negrita, cursiva y subrayado')
  const { ctx, page } = await open(browser, url, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 })
  const noteId = (await getState(page)).notes[0].id
  const fmtBtn = () => page.getByRole('button', { name: 'Letra y estilo del texto' })
  const pop = page.locator('.fmt-pop')
  const font = (id) => pop.locator(`.fmt-font[data-font-id="${id}"]`)

  // 0 · Por defecto
  let f = await noteFont(page)
  check('el posit nace con la letra de siempre («Pluma»: Kalam, 22 px)', f.family.startsWith('Kalam') && near(f.size, 22, 0.1), JSON.stringify(f))

  // 1 · Seleccionado (sin escribir): solo la letra
  await page.evaluate((id) => window.__posits.store.getState().select(id), noteId)
  await fmtBtn().click()
  await pop.waitFor()
  check('con el posit seleccionado, el botón «Letra» abre el selector', await pop.isVisible())
  check('…con las 8 letras para elegir', (await pop.locator('.fmt-font').count()) === 8)
  check('…marcando la que tiene ahora («Pluma»)', (await font('kalam').getAttribute('aria-checked')) === 'true')
  check('…sin los botones de negrita / cursiva / subrayado (no se está escribiendo)', (await pop.locator('.fmt-mark').count()) === 0)
  const names = await pop.locator('.fmt-name').allTextContents()
  check('cada letra se muestra con su nombre y una muestra escrita con ella', names.length === 8 && names.includes('Bolígrafo') && (await pop.locator('.fmt-sample').first().evaluate((e) => getComputedStyle(e).fontFamily.startsWith('Kalam'))))
  await shot(page, 's3f-pc-01-selector')

  // 2 · Elegir cada letra: se aplica al posit, con el tamaño ajustado, y el tachado de lápiz sigue en su renglón
  for (const [id, name, family, scale] of FONTS) {
    await font(id).click()
    await page.waitForTimeout(120)
    const ok = await loaded(page, family, 22 * scale)
    await page.waitForTimeout(250)
    f = await noteFont(page)
    const st = (await getState(page)).notes[0]
    check(`«${name}» (${family}) se aplica al posit`, st.font === id && f.family.includes(family) && ok, JSON.stringify({ st: st.font, f, ok }))
    check(`…con el tamaño ajustado (${(22 * scale).toFixed(1)} px) para que se vea igual de grande`, near(f.size, 22 * scale, 0.2), `${f.size}`)
    const sr = await strikeRatio(page)
    check(`…y el tachado de lápiz queda a media altura de los renglones`, !!sr && sr.ratio > 0.3 && sr.ratio < 0.78, JSON.stringify(sr))
  }
  await font('caveat').click()
  await page.waitForTimeout(250)
  await shot(page, 's3f-pc-02-caveat')

  // 3 · Persistencia
  await waitSaved(page)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(500)
  f = await noteFont(page)
  check('la letra elegida se recuerda al recargar', (await getState(page)).notes[0].font === 'caveat' && f.family.includes('Caveat'), JSON.stringify(f))

  // 4 · Escribiendo: negrita, cursiva y subrayado
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  const edit = page.locator('.note.is-editing')
  await page.keyboard.type('Reunión con el proveedor')
  check('un posit nuevo usa la letra de siempre', (await noteFont(page, 1)).family.startsWith('Kalam'))
  await fmtBtn().click()
  await pop.waitFor()
  check('escribiendo, el selector trae además negrita, cursiva y subrayado', (await pop.locator('.fmt-mark').count()) === 3)
  check('…y no le quita el cursor al texto', await page.evaluate(() => !!document.activeElement?.closest?.('.ProseMirror')))
  await page.keyboard.press('Control+a')
  await pop.getByRole('button', { name: 'Negrita' }).click()
  check('Negrita: el texto seleccionado queda en negrita', (await edit.locator('.ProseMirror strong').count()) === 1 && (await edit.locator('.ProseMirror strong').textContent()) === 'Reunión con el proveedor')
  check('…y el botón queda marcado', (await pop.getByRole('button', { name: 'Negrita' }).getAttribute('aria-pressed')) === 'true')
  const w = await edit.locator('.ProseMirror strong').evaluate((e) => getComputedStyle(e).fontWeight)
  check('…con peso de letra de negrita', Number(w) >= 700, w)
  await pop.getByRole('button', { name: 'Cursiva' }).click()
  await pop.getByRole('button', { name: 'Subrayado' }).click()
  check('Cursiva y Subrayado se suman', (await edit.locator('.ProseMirror em').count()) === 1 && (await edit.locator('.ProseMirror u').count()) === 1)
  const ul = await edit.locator('.ProseMirror u').evaluate((e) => getComputedStyle(e).textDecorationLine)
  check('…el subrayado se dibuja de verdad', ul.includes('underline'), ul)
  let doc = JSON.stringify((await getState(page)).notes[1].doc)
  check('los estilos quedan guardados en el documento (marcas bold, italic y underline)', ['bold', 'italic', 'underline'].every((m) => doc.includes(`"type":"${m}"`)), doc)
  await pop.getByRole('button', { name: 'Negrita' }).click()
  await pop.getByRole('button', { name: 'Cursiva' }).click()
  await pop.getByRole('button', { name: 'Subrayado' }).click()
  check('tocar de nuevo los quita', (await edit.locator('.ProseMirror strong, .ProseMirror em, .ProseMirror u').count()) === 0)
  // atajos de teclado
  await page.keyboard.press('Control+b')
  await page.keyboard.press('Control+i')
  await page.keyboard.press('Control+u')
  check('los atajos Ctrl+B, Ctrl+I y Ctrl+U también funcionan', (await edit.locator('.ProseMirror strong').count()) === 1 && (await edit.locator('.ProseMirror em').count()) === 1 && (await edit.locator('.ProseMirror u').count()) === 1)
  await page.keyboard.press('Control+z')
  check('Ctrl+Z deshace un cambio de estilo', (await edit.locator('.ProseMirror u').count()) === 0)

  // 5 · Cambiar de letra escribiendo: no se pierde el cursor ni el texto
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  await pop.locator('.fmt-font[data-font-id="patrick"]').click()
  await page.waitForTimeout(200)
  check('cambiar de letra mientras se escribe no cierra el teclado', await page.evaluate(() => !!document.activeElement?.closest?.('.ProseMirror')) && (await getState(page)).editingId !== null)
  check('…ni cambia lo escrito', ((await edit.locator('.ProseMirror').textContent()) || '').includes('Reunión con el proveedor'))
  check('…y el posit tiene su propia letra (el otro no cambia)', (await noteFont(page, 1)).family.includes('Patrick Hand') && (await noteFont(page, 0)).family.includes('Caveat'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  check('Escape cierra el selector', (await pop.count()) === 0)

  // 6 · Un posit con lista y letra distinta: la casilla y el texto siguen alineados
  await page.getByRole('button', { name: 'Listo' }).click().catch(() => {})
  await shot(page, 's3f-pc-03-estilos')
  await ctx.close()
}

const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mobile/15E148 Safari/604.1)',
}

async function phone(browser, url) {
  console.log('\n▶ Celular (390×844, toques reales): letra y estilo')
  const { ctx, page } = await open(browser, url, IPHONE)
  const wait = (ms) => page.waitForTimeout(ms)
  const tapEl = async (loc) => {
    await loc.scrollIntoViewIfNeeded()
    await wait(60)
    const b = await loc.boundingBox()
    await page.touchscreen.tap(centerOf(b).x, centerOf(b).y)
    await wait(110)
  }
  const pop = page.locator('.fmt-pop')

  // 1 · Posit seleccionado
  const noteId = (await getState(page)).notes[0].id
  await page.evaluate((id) => window.__posits.store.getState().select(id), noteId)
  await wait(150)
  const bar = page.getByRole('toolbar', { name: 'Acciones del posit' })
  let bb = await bar.boundingBox()
  check('la barra del posit (Duplicar · Letra · Borrar) cabe en el celular', bb.x >= 0 && bb.x + bb.width <= 390 && (await bar.getByRole('button').count()) === 3, JSON.stringify(bb))
  await tapEl(page.getByRole('button', { name: 'Letra y estilo del texto' }))
  await pop.waitFor()
  const pb = await pop.boundingBox()
  const top = await page.locator('.topbar').boundingBox()
  check('el selector cabe en la pantalla y no se tapa con la barra de arriba', pb.x >= 0 && pb.x + pb.width <= 390 && pb.y >= top.y + top.height - 2, JSON.stringify(pb))
  const fb = await pop.locator('.fmt-font').first().boundingBox()
  check('cada letra es un botón cómodo para el dedo (≥ 44 px de alto)', fb.height >= 44, JSON.stringify(fb))
  await shot(page, 's3f-cel-01-selector')
  await tapEl(pop.locator('.fmt-font[data-font-id="patrick"]'))
  await wait(250)
  check('tocar una letra la aplica al posit', (await getState(page)).notes[0].font === 'patrick')
  await tap(page, 8, top.y + top.height + 14) // fuera del selector (queda debajo de la barra de arriba)
  check('tocar fuera cierra el selector', (await pop.count()) === 0)

  // 2 · Escribiendo
  await tapEl(page.getByRole('button', { name: 'Nuevo posit' }))
  await page.waitForSelector('.note.is-editing')
  const tb = page.getByRole('toolbar', { name: 'Escribiendo en el posit' })
  bb = await tb.boundingBox()
  const nbtn = await tb.getByRole('button').count()
  check('al escribir, la barra (Listo · viñetas · pendientes · ícono · letra) cabe en 390 px', bb.x >= 0 && bb.x + bb.width <= 390 && nbtn === 5, `${JSON.stringify(bb)} botones=${nbtn}`)
  await tapEl(page.getByRole('button', { name: 'Negrita' }).or(page.getByRole('button', { name: 'Letra y estilo del texto' })))
  await pop.waitFor()
  await tapEl(pop.getByRole('button', { name: 'Negrita' }))
  await page.keyboard.type('Urgente')
  const edit = page.locator('.note.is-editing')
  check('activar «Negrita» antes de escribir deja el texto nuevo en negrita', (await edit.locator('.ProseMirror strong').count()) === 1 && (await edit.locator('.ProseMirror strong').textContent()) === 'Urgente')
  check('…sin cerrar el teclado', await page.evaluate(() => !!document.activeElement?.closest?.('.ProseMirror')))
  await shot(page, 's3f-cel-02-escribiendo')

  // 3 · Pantallas angostas: la barra de escritura sigue cabiendo
  for (const [w, h] of [
    [360, 740],
    [320, 568],
  ]) {
    const c2 = await browser.newContext({ ...IPHONE, viewport: { width: w, height: h } })
    const p2 = await c2.newPage()
    await p2.goto(`${url}?debug`)
    await p2.evaluate(() => document.fonts.ready)
    await p2.waitForSelector('.world[data-ready]', { state: 'attached' })
    await p2.waitForTimeout(400)
    await p2.touchscreen.tap(w / 2, 20 + 0)
    const btn = p2.getByRole('button', { name: 'Nuevo posit' })
    const bx = await btn.boundingBox()
    await p2.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2)
    await p2.waitForSelector('.note.is-editing')
    await p2.waitForTimeout(200)
    const g = await p2.evaluate(() => {
      const t = document.querySelector('.ctx.is-editing')
      const r = t.getBoundingClientRect()
      return { x: r.left, right: r.right, buttons: [...t.querySelectorAll('.ctx-btn')].filter((b) => getComputedStyle(b).display !== 'none').length, overflow: document.documentElement.scrollWidth > innerWidth }
    })
    check(`en ${w} px la barra de escritura cabe (${g.buttons} botones)`, g.x >= 0 && g.right <= w && !g.overflow, JSON.stringify(g))
    await p2.screenshot({ path: `${require('./lib.cjs').OUT}/s3f-cel-${w}.png` })
    await c2.close()
  }
  await ctx.close()

  async function tap(p, x, y) {
    await p.touchscreen.tap(x, y)
    await p.waitForTimeout(110)
  }
}

async function main() {
  const server = await startPreview()
  const browser = await chromium.launch()
  try {
    await desktop(browser, server.url)
    await phone(browser, server.url)
  } finally {
    await browser.close()
    server.stop()
  }
  check('sin errores ni avisos en la consola', consoleErrors.length === 0, consoleErrors.join(' | '))
  process.exit(finish())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
