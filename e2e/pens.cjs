/*
 * Prueba con un navegador real (Chromium): la barra de abajo («estuche de instrumentos»).
 *   - ocho instrumentos = ocho tipos de letra, cada uno con su dibujo y una muestra escrita con esa letra
 *   - elegir uno cambia la letra del posit seleccionado y de los posits nuevos; el activo sigue al posit elegido
 *   - la paleta de colores se abre chiquita desde el botón de la derecha y muestra el color en uso
 *   - PC: ratón y teclado · Celular: toques reales, tira que se desliza, paleta a todo el ancho
 *
 * Uso:  npm run build && node e2e/pens.cjs
 */
const { chromium } = require('playwright')
const { startPreview } = require('./serve.cjs')
const { check, centerOf, shot, getState, open, waitSaved, consoleErrors, finish } = require('./lib.cjs')

const inside = (b, w, h, pad = 0) => b.x >= pad && b.y >= pad && b.x + b.width <= w - pad && b.y + b.height <= h - pad

const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mobile/15E148 Safari/604.1)',
}

const NAMES = ['Pluma', 'Bolígrafo', 'Lápiz', 'Punta fina', 'Pincel', 'Marcador', 'Portaminas', 'Marcador grueso']
const IDS = ['kalam', 'caveat', 'patrick', 'architects', 'gochi', 'covered', 'altura', 'marker']
const FAMILIES = ['Kalam', 'Caveat', 'Patrick Hand', 'Architects Daughter', 'Gochi Hand', 'Covered By Your Grace', 'Just Another Hand', 'Permanent Marker']

const activePen = (page) => page.evaluate(() => [...document.querySelectorAll('.pen')].filter((p) => p.getAttribute('aria-checked') === 'true').map((p) => p.dataset.fontId))
const pen = (page, id) => page.locator(`.pen[data-font-id="${id}"]`)
const noteFamily = (page, i = 0) => page.evaluate((idx) => getComputedStyle(document.querySelectorAll('.note .ProseMirror')[idx]).fontFamily, i)
const store = (page, fn, arg) => page.evaluate(fn, arg)

// ───────────────────────────── PC ─────────────────────────────

async function desktop(browser, url) {
  console.log('\n▶ PC (1280×800): instrumentos, letras y paleta')
  const { ctx, page } = await open(browser, url, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })

  // 1 · La barra
  const bar = await page.locator('.case').boundingBox()
  check('la barra queda centrada abajo, entera y sin desbordar', inside(bar, 1280, 800, 2) && Math.abs(bar.x + bar.width / 2 - 640) < 4 && bar.width > 800, JSON.stringify(bar))
  check('trae «Nuevo», ocho instrumentos, íconos y la paleta', (await page.getByRole('button', { name: 'Nuevo posit' }).count()) === 1 && (await page.locator('.pen').count()) === 8 && (await page.getByRole('button', { name: 'Íconos', exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Colores del papel' }).count()) === 1)
  const labels = await page.locator('.pen').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  check('cada instrumento tiene su nombre («Letra Pluma»…) para lectores de pantalla', JSON.stringify(labels) === JSON.stringify(NAMES.map((n) => `Letra ${n}`)), JSON.stringify(labels))
  check('los instrumentos forman un grupo de opciones (uno solo elegido)', (await page.getByRole('radiogroup', { name: 'Tipo de letra' }).count()) === 1 && (await page.getByRole('radio').count()) === 8 && (await activePen(page)).length === 1)

  // 2 · Cada ranura muestra su dibujo y cómo escribe
  const samples = await page.locator('.pen-sample').evaluateAll((els) => els.map((e) => ({ text: e.textContent, family: getComputedStyle(e).fontFamily })))
  check('cada ranura trae la muestra «Hola» escrita con su propia letra', samples.every((s, i) => s.text === 'Hola' && s.family.includes(FAMILIES[i])), JSON.stringify(samples))
  const art = await page.locator('.pen').evaluateAll((els) => els.map((e) => { const a = e.querySelector('.pen-art').getBoundingClientRect(); const s = e.querySelector('.pen-sample').getBoundingClientRect(); return { svg: !!e.querySelector('svg.pen-svg'), paths: e.querySelectorAll('svg path, svg rect, svg circle').length, artBottom: a.bottom, sampleTop: s.top } }))
  check('cada instrumento se dibuja con vectores propios (varias piezas) y no tapa su muestra', art.every((a) => a.svg && a.paths >= 5 && a.artBottom <= a.sampleTop + 0.5), JSON.stringify(art))
  const grads = await page.evaluate(() => ['pn-black', 'pn-steel', 'pn-grey', 'pn-wood', 'pn-lead', 'pn-orange', 'pn-blue', 'pn-gold'].filter((id) => document.getElementById(id)).length)
  check('con degradados de luz que les dan volumen (cilindros con brillo)', grads === 8, `${grads}`)
  const kinds = await page.locator('.pen svg').evaluateAll((els) => new Set(els.map((e) => e.innerHTML)).size)
  check('los ocho dibujos son distintos', kinds === 8, `${kinds}`)
  await shot(page, 'estuche-pc-01')

  // 3 · Instrumento en la mano (sin posit seleccionado): solo cambia los posits nuevos
  check('sin nada seleccionado, el instrumento elegido es la Pluma (la letra de siempre)', JSON.stringify(await activePen(page)) === '["kalam"]')
  const wel = (await getState(page)).notes[0].id
  await page.mouse.click(120, 500) // el fondo: deselecciona
  await pen(page, 'patrick').click()
  let s = await store(page, () => ({ def: window.__posits.store.getState().settings.defaultFont, first: Object.values(window.__posits.store.getState().notes)[0].font }))
  check('elegir el Lápiz sin posit seleccionado solo cambia la letra de los posits nuevos', s.def === 'patrick' && s.first === undefined)
  check('el Lápiz queda como el instrumento activo (ranura azul y levantado)', JSON.stringify(await activePen(page)) === '["patrick"]')
  const on = await pen(page, 'patrick').evaluate((e) => ({ tab: getComputedStyle(e, '::before').content, shadow: getComputedStyle(e).boxShadow, art: getComputedStyle(e.querySelector('.pen-art')).transform }))
  const off = await pen(page, 'kalam').evaluate((e) => ({ tab: getComputedStyle(e, '::before').content, shadow: getComputedStyle(e).boxShadow, art: getComputedStyle(e.querySelector('.pen-art')).transform }))
  check('…con la pestaña azul de arriba y el instrumento levantado (los otros, no)', on.tab !== 'none' && off.tab === 'none' && on.art !== off.art && on.shadow !== off.shadow, JSON.stringify({ on, off }))
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  s = await getState(page)
  const fresh = s.notes.find((n) => n.id === s.editingId)
  check('un posit nuevo nace con la letra del instrumento en la mano', fresh.font === 'patrick' && (await noteFamily(page, 1)).includes('Patrick Hand'), `${fresh.font} / ${await noteFamily(page, 1)}`)
  check('…y el de bienvenida sigue con la suya', (await noteFamily(page, 0)).includes('Kalam'))
  await page.keyboard.type('Hola con lápiz')
  await shot(page, 'estuche-pc-02-lapiz')

  // 4 · Con un posit seleccionado, el instrumento cambia su letra; el activo sigue al posit elegido
  await page.getByRole('button', { name: 'Listo' }).click().catch(() => page.keyboard.press('Escape'))
  await page.waitForTimeout(150)
  await pen(page, 'marker').click()
  s = await getState(page)
  check('con un posit seleccionado, el instrumento cambia la letra de ese posit', s.notes.find((n) => n.id === fresh.id).font === 'marker' && (await noteFamily(page, 1)).includes('Permanent Marker'))
  check('…y el activo es el Marcador grueso', JSON.stringify(await activePen(page)) === '["marker"]')
  await page.locator(`[data-note-id="${wel}"] .note-grip`).click({ force: true })
  await page.waitForTimeout(150)
  check('al seleccionar otro posit, el instrumento activo sigue a ese posit (la Pluma)', JSON.stringify(await activePen(page)) === '["kalam"]', JSON.stringify(await activePen(page)))
  await page.mouse.click(120, 500)
  check('al soltar la selección vuelve el instrumento «en la mano» (el Marcador grueso)', JSON.stringify(await activePen(page)) === '["marker"]', JSON.stringify(await activePen(page)))
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  await page.keyboard.press('Escape')

  // 5 · Teclado
  await pen(page, 'gochi').focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab') // (así el navegador sabe que se navega con teclado y dibuja el contorno de foco)
  await page.keyboard.press('Enter')
  check('con el teclado también se elige (Enter sobre el instrumento enfocado)', JSON.stringify(await activePen(page)) === '["gochi"]')
  check('los instrumentos se ven con el foco (contorno de foco)', await pen(page, 'gochi').evaluate((e) => getComputedStyle(e).outlineStyle !== 'none'))

  // 6 · La paleta
  const pal = page.getByRole('button', { name: 'Colores del papel' })
  check('el botón de la paleta muestra el color en uso', (await page.locator('.palette-chip').evaluate((e) => getComputedStyle(e).backgroundColor)) !== 'rgba(0, 0, 0, 0)')
  await pal.click()
  await page.getByRole('dialog', { name: 'Colores del papel' }).waitFor()
  await page.waitForTimeout(400) // termina la animación de aparecer
  const sw = await page.locator('.swatch').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } }))
  const pop = await page.locator('.palette-pop').boundingBox()
  check('la paleta trae los 24 colores en cuadritos chicos (34 px) y cabe en pantalla', sw.length === 24 && sw.every((x) => x.w === 34 && x.h === 34) && inside(pop, 1280, 800, 2), JSON.stringify({ n: sw.length, pop }))
  check('queda pegada a la derecha, sobre los botones (no sobre los instrumentos)', pop.x + pop.width <= bar.x + bar.width + 1 && pop.y + pop.height <= bar.y, JSON.stringify({ pop, bar }))
  check('el color en uso se ve marcado', (await page.locator('.swatch[aria-pressed="true"]').count()) === 1)
  check('la paleta lo dice con aria-expanded', (await pal.getAttribute('aria-expanded')) === 'true')
  await shot(page, 'estuche-pc-03-paleta')
  await page.keyboard.press('Escape')
  check('Esc cierra la paleta', (await page.getByRole('dialog', { name: 'Colores del papel' }).count()) === 0)
  await pal.click()
  await page.mouse.click(200, 300)
  check('tocar fuera también la cierra', (await page.getByRole('dialog', { name: 'Colores del papel' }).count()) === 0)
  await page.locator(`[data-note-id="${wel}"] .note-grip`).click({ force: true })
  await pal.click()
  await page.getByRole('button', { name: 'Color Cielo' }).click()
  s = await getState(page)
  check('elegir un color lo pone en el posit seleccionado y en los nuevos, y cierra la paleta', s.notes.find((n) => n.id === s.selectedId).color === '#8ECDF5' && s.defaultColor === '#8ECDF5' && (await page.getByRole('dialog', { name: 'Colores del papel' }).count()) === 0)
  check('el cuadrito del botón cambia al color elegido', (await page.locator('.palette-chip').evaluate((e) => getComputedStyle(e).backgroundColor)) === 'rgb(142, 205, 245)')

  // 7 · Íconos y paleta no se pisan
  await pal.click()
  await page.getByRole('button', { name: 'Íconos', exact: true }).click()
  check('abrir los íconos cierra la paleta (y viceversa)', (await page.getByRole('dialog', { name: 'Colores del papel' }).count()) === 0 && (await page.locator('.icon-pop').count()) === 1)
  await pal.click()
  check('…y abrir la paleta cierra los íconos', (await page.locator('.icon-pop').count()) === 0 && (await page.getByRole('dialog', { name: 'Colores del papel' }).count()) === 1)
  await page.keyboard.press('Escape')

  // 8 · Se recuerda
  await pen(page, 'altura').click()
  await waitSaved(page)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(500)
  await page.mouse.click(120, 500)
  check('el instrumento en la mano se recuerda al recargar', JSON.stringify(await activePen(page)) === '["altura"]', JSON.stringify(await activePen(page)))
  check('…y las letras de los posits también', (await noteFamily(page, 1)).includes('Permanent Marker'))
  await ctx.close()
}

// ───────────────────────────── Celular ─────────────────────────────

async function phone(browser, url) {
  console.log('\n▶ Celular (390×844, toques reales)')
  const { ctx, page } = await open(browser, url, IPHONE)
  const tap = async (loc) => {
    const b = await loc.boundingBox()
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(160)
  }

  const bar = await page.locator('.case').boundingBox()
  check('la barra cabe en la pantalla, pegada abajo', inside(bar, 390, 844, 2) && bar.y + bar.height > 780, JSON.stringify(bar))
  check('la barra mide lo justo (≤ 120 px de alto)', bar.height <= 120, `${bar.height}`)
  const geo = await page.evaluate(() => {
    const strip = document.querySelector('.pen-strip')
    const r = strip.getBoundingClientRect()
    const vis = [...document.querySelectorAll('.pen')].filter((p) => { const b = p.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1 }).length
    const pb = document.querySelector('.pen').getBoundingClientRect()
    return { scroll: strip.scrollWidth > strip.clientWidth + 4, vis, pw: Math.round(pb.width), ph: Math.round(pb.height), overflow: document.documentElement.scrollWidth > innerWidth }
  })
  check('se ven al menos tres instrumentos y el resto se desliza con el dedo', geo.vis >= 3 && geo.scroll && !geo.overflow, JSON.stringify(geo))
  check('cada instrumento es cómodo de tocar (≥ 52 × 76 px)', geo.pw >= 52 && geo.ph >= 76, JSON.stringify(geo))
  const tools = await page.locator('.tool-btn, .add-btn').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } }))
  check('«Nuevo», íconos y paleta miden ≥ 44 px', tools.length === 3 && tools.every((t) => t.w >= 44 && t.h >= 44), JSON.stringify(tools))
  await shot(page, 'estuche-cel-01')

  // elegir con el dedo
  await tap(pen(page, 'caveat'))
  check('tocar un instrumento lo elige (y cambia la letra del posit seleccionado si hay uno)', JSON.stringify(await activePen(page)) === '["caveat"]')

  // uno que no se ve: se desliza la tira y se toca
  await page.evaluate(() => document.querySelector('.pen-strip').scrollTo({ left: 9999 }))
  await page.waitForTimeout(250)
  const lastVisible = await pen(page, 'marker').evaluate((e) => { const r = e.getBoundingClientRect(); const s = document.querySelector('.pen-strip').getBoundingClientRect(); return r.left >= s.left - 1 && r.right <= s.right + 1 })
  check('al deslizar hasta el final se ve el Marcador grueso', lastVisible)
  await tap(pen(page, 'marker'))
  await page.waitForTimeout(450)
  check('…y se elige', JSON.stringify(await activePen(page)) === '["marker"]')
  await page.evaluate(() => document.querySelector('.pen-strip').scrollTo({ left: 0 }))
  await page.waitForTimeout(200)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(900)
  const centered = await pen(page, 'marker').evaluate((e) => { const r = e.getBoundingClientRect(); const s = document.querySelector('.pen-strip').getBoundingClientRect(); return { inView: r.left >= s.left - 1 && r.right <= s.right + 1, off: Math.abs(r.left + r.width / 2 - (s.left + s.width / 2)) } })
  check('al abrir la app, la tira se desliza sola para mostrar el instrumento que tienes en la mano', centered.inView, JSON.stringify(centered))

  // la paleta
  await tap(page.getByRole('button', { name: 'Colores del papel' }))
  const pop = await page.locator('.palette-pop').boundingBox()
  const sw = await page.locator('.swatch').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
  check('la paleta cabe en la pantalla, de a ocho en fila (tres filas) con cuadritos de ≥ 34 px', sw.length === 24 && Math.min(...sw) >= 34 && inside(pop, 390, 844, 2) && pop.height < 230, JSON.stringify({ min: Math.min(...sw), pop }))
  await shot(page, 'estuche-cel-02-paleta')
  await tap(page.getByRole('button', { name: 'Color Verde' }))
  const s = await getState(page)
  check('tocar un color lo elige y cierra la paleta', s.defaultColor === '#6CC070' && (await page.getByRole('dialog', { name: 'Colores del papel' }).count()) === 0)
  await ctx.close()

  // pantallas angostas
  for (const [w, h] of [
    [360, 740],
    [320, 568],
  ]) {
    const c2 = await browser.newContext({ ...IPHONE, viewport: { width: w, height: h } })
    const p2 = await c2.newPage()
    await p2.goto(`${url}?debug&mascot=off`)
    await p2.evaluate(() => document.fonts.ready)
    await p2.waitForSelector('.world[data-ready]', { state: 'attached' })
    await p2.waitForTimeout(500)
    const g = await p2.evaluate(() => {
      const c = document.querySelector('.case').getBoundingClientRect()
      const kids = [...document.querySelectorAll('.case > button, .case .pen-strip')].map((e) => e.getBoundingClientRect())
      return { c: { l: c.left, r: c.right }, out: kids.filter((k) => k.left < c.left - 0.5 || k.right > c.right + 0.5).length, overflow: document.documentElement.scrollWidth > innerWidth }
    })
    await p2.getByRole('button', { name: 'Colores del papel' }).tap()
    await p2.waitForTimeout(300)
    const pp = await p2.locator('.palette-pop').boundingBox()
    check(`${w} px: la barra y la paleta caben, sin desbordar`, g.out === 0 && !g.overflow && inside(pp, w, h, 1), JSON.stringify({ g, pp }))
    if (w === 320) await p2.screenshot({ path: require('./lib.cjs').OUT + '/estuche-cel-320.png' })
    await c2.close()
  }
}

// ───────────────────────────── main ─────────────────────────────

;(async () => {
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
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
