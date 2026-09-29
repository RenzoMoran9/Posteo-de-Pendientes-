/*
 * Prueba de la Etapa 1 con un navegador real (Chromium):
 *   - PC: ratón, rueda, teclado
 *   - Celular: toques reales (tocar, arrastrar con un dedo, pellizcar con dos)
 * Comprueba: crear / escribir / mover / redimensionar / borrar+deshacer / color /
 * zoom y desplazamiento / guardado automático. Deja capturas en e2e/out/.
 *
 * Uso:  npm run build && npm run e2e
 */
const { chromium } = require('playwright')
const { startPreview } = require('./serve.cjs')
const { check, near, shot, getState, open, waitSaved, consoleErrors, finish } = require('./lib.cjs')

/** Posits de ejemplo para las capturas (el contenido es solo para mostrar el estilo). */
const doc = (...lines) => ({
  type: 'doc',
  content: lines.map((t) => (t ? { type: 'paragraph', content: [{ type: 'text', text: t }] } : { type: 'paragraph' })),
})

const SAMPLES = [
  { x: -420, y: -230, w: 240, h: 192, color: '#FF8A78', doc: doc('Reunión con Ana', 'Jueves 10:00, sala 2') },
  { x: 288, y: -250, w: 264, h: 216, color: '#CDB4F6', doc: doc('Ideas para el fin de semana', 'Cine, caminata y cocinar algo rico') },
  { x: -408, y: 96, w: 216, h: 168, color: '#8ECDF5', doc: doc('Pagar el recibo de luz') },
  { x: 312, y: 48, w: 240, h: 168, color: '#A3E6BE', doc: doc('Llamar al dentista', 'Pedir hora para la próxima semana') },
  { x: -144, y: 312, w: 264, h: 168, color: '#FFA9C8', doc: doc('Cumpleaños de mamá: el 14', 'Comprar torta y flores') },
  { x: 360, y: 288, w: 216, h: 168, color: '#DDBE92', doc: doc('Súper: manzanas, arroz y café') },
  { x: -672, y: -12, w: 216, h: 168, color: '#34507F', doc: doc('No olvidar respirar y tomar agua') },
]

async function seed(page) {
  await page.evaluate((samples) => {
    const s = window.__posits.store.getState()
    for (const n of samples) s.addNote({ x: n.x, y: n.y, w: n.w, h: n.h, color: n.color, doc: n.doc })
    window.__posits.store.getState().select(null)
  }, SAMPLES)
  await page.waitForTimeout(500)
}

// ───────────────────────────── PC ─────────────────────────────

async function desktop(browser, url) {
  console.log('\n▶ PC (1440×900, ratón y teclado)')
  const { ctx, page } = await open(browser, url, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 })

  await shot(page, 'pc-01-inicio')
  const c = await page.evaluate(() => {
    // el posit y su ícono de ejemplo (la esquina que sobresale) forman el conjunto que se centra
    const rs = [...document.querySelectorAll('.note, .note .sticker')].map((e) => e.getBoundingClientRect())
    const top = Math.min(...rs.map((r) => r.top))
    const bottom = Math.max(...rs.map((r) => r.bottom))
    const ins = window.__posits.view.insets()
    return { cy: (top + bottom) / 2, target: ins.top + (innerHeight - ins.top - ins.bottom) / 2 }
  })
  check('el posit de bienvenida arranca centrado en el área libre', near(c.cy, c.target, 6), JSON.stringify(c))

  // Crear con ＋ y escribir directo
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  await page.keyboard.type('Comprar café para la oficina')
  let s = await getState(page)
  const created = s.notes.find((n) => n.id === s.editingId)
  check('＋ crea un posit nuevo', s.notes.length === 2)
  const geo = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('.note')].map((e) => {
      const r = e.getBoundingClientRect()
      return { l: r.left, t: r.top, r: r.right, b: r.bottom }
    })
    return { rects, w: innerWidth, h: innerHeight }
  })
  const [ra, rb] = geo.rects
  const overlapPc = ra.l < rb.r && ra.r > rb.l && ra.t < rb.b && ra.b > rb.t
  check('el posit nuevo no tapa a los que ya había', !overlapPc, JSON.stringify(geo.rects))
  check('el posit nuevo queda a la vista', geo.rects.every((r) => r.l >= 0 && r.r <= geo.w && r.t >= 0 && r.b <= geo.h), JSON.stringify(geo.rects))
  check('el posit nuevo queda listo para escribir (con el foco)', !!created)
  check('se escribe directo sobre el posit', JSON.stringify(created?.doc).includes('Comprar café para la oficina'), JSON.stringify(created?.doc))
  await page.keyboard.press('Escape')
  s = await getState(page)
  check('Esc sale del modo escritura y deja el posit seleccionado', s.editingId === null && s.selectedId === created.id)

  // Color desde la paleta (se abre chiquita sobre el estuche)
  await page.getByRole('button', { name: 'Colores del papel' }).click()
  await page.getByRole('button', { name: 'Color Cielo' }).click()
  s = await getState(page)
  check('un color de la paleta cambia el color del posit seleccionado', s.notes.find((n) => n.id === created.id).color === '#8ECDF5')
  check('el color elegido pasa a ser el de los posits nuevos', s.defaultColor === '#8ECDF5')
  check('elegir un color cierra la paleta', (await page.getByRole('dialog', { name: 'Colores del papel' }).count()) === 0)

  // Mover arrastrando desde la cinta
  const id = created.id
  const before = s.notes.find((n) => n.id === id)
  const grip = await page.locator(`[data-note-id="${id}"] .note-grip`).boundingBox()
  const gx = grip.x + grip.width / 2
  const gy = grip.y + grip.height / 2
  await page.mouse.move(gx, gy)
  await page.mouse.down()
  await page.mouse.move(gx + 200, gy + 90, { steps: 14 })
  await shot(page, 'pc-02-arrastrando')
  await page.mouse.up()
  s = await getState(page)
  let after = s.notes.find((n) => n.id === id)
  check('arrastrar desde la cinta mueve el posit', near(after.x - before.x, 200, 14) && near(after.y - before.y, 90, 14), `dx=${after.x - before.x} dy=${after.y - before.y}`)

  // Redimensionar con el tirador de la esquina
  const h = await page.locator(`[data-note-id="${id}"] [data-resize="both"]`).boundingBox()
  const hx = h.x + h.width / 2
  const hy = h.y + h.height / 2
  const w0 = after.w
  const h0 = after.h
  await page.mouse.move(hx, hy)
  await page.mouse.down()
  await page.mouse.move(hx + 96, hy + 72, { steps: 10 })
  await page.mouse.up()
  s = await getState(page)
  after = s.notes.find((n) => n.id === id)
  check('el tirador de la esquina cambia el tamaño', near(after.w - w0, 96, 14) && near(after.h - h0, 72, 14), `dw=${after.w - w0} dh=${after.h - h0}`)

  // Un toque selecciona; otro toque escribe
  await page.mouse.click(60, 120) // fondo vacío
  s = await getState(page)
  check('tocar el fondo deselecciona', s.selectedId === null)
  const body = await page.locator(`[data-note-id="${id}"] .paper`).boundingBox()
  await page.mouse.click(body.x + body.width / 2, body.y + body.height / 2)
  s = await getState(page)
  check('un toque sobre el posit lo selecciona (sin abrir el teclado)', s.selectedId === id && s.editingId === null)
  await page.mouse.click(body.x + body.width / 2, body.y + body.height / 2)
  s = await getState(page)
  check('un segundo toque pasa a escribir', s.editingId === id)
  await page.keyboard.press('Escape')

  // Paleta completa
  await page.getByRole('button', { name: 'Colores del papel' }).click()
  await page.waitForSelector('.palette-pop')
  await shot(page, 'pc-03-paleta')
  await page.getByRole('button', { name: 'Color Vino' }).click()
  s = await getState(page)
  check('la paleta cambia el color (Vino)', s.notes.find((n) => n.id === id).color === '#8E3E5A')
  const ink = await page.evaluate((i) => getComputedStyle(document.querySelector(`[data-note-id="${i}"]`)).getPropertyValue('--note-ink').trim(), id)
  check('sobre un papel oscuro la tinta se vuelve clara', ink === '#fffaf0', ink)

  // Borrar y deshacer
  await page.getByRole('button', { name: 'Borrar' }).click()
  s = await getState(page)
  check('Borrar elimina el posit', s.notes.length === 1 && !s.notes.find((n) => n.id === id))
  check('aparece el aviso con Deshacer', s.toast === 'Posit borrado' && (await page.locator('.toast').isVisible()))
  await page.getByRole('button', { name: 'Deshacer' }).click()
  s = await getState(page)
  const restored = s.notes.find((n) => n.id === id)
  check('Deshacer devuelve el posit tal como estaba', !!restored && restored.color === '#8E3E5A' && JSON.stringify(restored.doc).includes('Comprar café'))

  // Zoom y desplazamiento
  const z0 = (await getState(page)).view
  await page.mouse.move(720, 450)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -240)
  await page.keyboard.up('Control')
  await page.waitForTimeout(80)
  const z1 = (await getState(page)).view
  check('Ctrl + rueda acerca el tablero', z1.z > z0.z * 1.15, `${z0.z} → ${z1.z}`)
  await page.mouse.move(220, 640)
  await page.mouse.down()
  await page.mouse.move(340, 690, { steps: 8 })
  await page.mouse.up()
  const z2 = (await getState(page)).view
  check('arrastrar el fondo desplaza el tablero', near(z2.x - z1.x, 120, 6) && near(z2.y - z1.y, 50, 6), `dx=${z2.x - z1.x} dy=${z2.y - z1.y}`)
  await page.getByRole('button', { name: 'Ver todo' }).click()
  await page.waitForTimeout(500)

  // Imán a la cuadrícula: se puede apagar y avisa
  await page.getByRole('button', { name: /Imán a la cuadrícula/ }).click()
  s = await getState(page)
  check('el botón de cuadrícula apaga el imán y avisa', s.magnet === false && (await page.locator('.toast').innerText()).includes('apagado'))
  await page.getByRole('button', { name: /Imán a la cuadrícula/ }).click()
  s = await getState(page)
  check('y lo vuelve a activar', s.magnet === true)

  // Doble clic en el fondo crea un posit
  const n0 = (await getState(page)).notes.length
  await page.mouse.dblclick(1150, 250)
  await page.waitForTimeout(150)
  s = await getState(page)
  check('doble clic en el fondo crea un posit ahí', s.notes.length === n0 + 1 && !!s.editingId)
  await page.keyboard.type('Nota rápida')
  await page.keyboard.press('Escape')

  // Atajos
  await page.keyboard.press('Delete')
  s = await getState(page)
  check('Suprimir borra el posit seleccionado', s.notes.length === n0)
  await page.getByRole('button', { name: 'Deshacer' }).click()

  // Varios posits para la captura
  await seed(page)
  await page.getByRole('button', { name: 'Ver todo' }).click()
  await page.waitForTimeout(500)
  await shot(page, 'pc-04-varios')

  // Selección con todos sus adornos
  const pick = await page.locator('[data-note-id]').nth(3).locator('.paper').boundingBox()
  await page.mouse.click(pick.x + pick.width / 2, pick.y + pick.height / 2)
  await page.waitForTimeout(250)
  await shot(page, 'pc-05-seleccion')

  // Guardado automático + persistencia al recargar
  await waitSaved(page)
  const total = (await getState(page)).notes.length
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.evaluate(() => document.fonts.ready)
  const reloaded = await getState(page)
  check('el guardado automático conserva todo al recargar', reloaded.notes.length === total, `${total} → ${reloaded.notes.length}`)
  check('también conserva textos y colores', reloaded.notes.some((n) => n.id === id && n.color === '#8E3E5A' && JSON.stringify(n.doc).includes('Comprar café')))

  await ctx.close()
}

// ───────────────────────────── Celular ─────────────────────────────

const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

async function phone(browser, url) {
  console.log('\n▶ Celular (390×844, toques reales)')
  const { ctx, page } = await open(browser, url, IPHONE)
  const cdp = await ctx.newCDPSession(page)
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
  const wait = (ms) => page.waitForTimeout(ms)

  async function tap(x, y) {
    await page.touchscreen.tap(x, y)
    await wait(60)
  }
  async function drag(from, to, steps = 12) {
    await send('touchStart', [{ x: from.x, y: from.y, id: 1 }])
    await wait(30)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      await send('touchMove', [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, id: 1 }])
      await wait(16)
    }
    await send('touchEnd', [])
    await wait(80)
  }
  async function pinch(center, d0, d1, steps = 12) {
    const pts = (d) => [
      { x: center.x - d / 2, y: center.y, id: 1 },
      { x: center.x + d / 2, y: center.y, id: 2 },
    ]
    await send('touchStart', pts(d0))
    await wait(30)
    for (let i = 1; i <= steps; i++) {
      await send('touchMove', pts(d0 + ((d1 - d0) * i) / steps))
      await wait(16)
    }
    await send('touchEnd', [])
    await wait(80)
  }
  const centerOf = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })

  await shot(page, 'cel-01-inicio')
  const c = await page.evaluate(() => {
    // el posit y su ícono de ejemplo (la esquina que sobresale) forman el conjunto que se centra
    const rs = [...document.querySelectorAll('.note, .note .sticker')].map((e) => e.getBoundingClientRect())
    const top = Math.min(...rs.map((r) => r.top))
    const bottom = Math.max(...rs.map((r) => r.bottom))
    const ins = window.__posits.view.insets()
    return { cy: (top + bottom) / 2, target: ins.top + (innerHeight - ins.top - ins.bottom) / 2 }
  })
  check('(celular) el posit de bienvenida arranca centrado', near(c.cy, c.target, 6), JSON.stringify(c))

  // Crear con ＋ (toque) y escribir
  const add = await page.getByRole('button', { name: 'Nuevo posit' }).boundingBox()
  await tap(...Object.values(centerOf(add)))
  await page.waitForSelector('.note.is-editing')
  await page.keyboard.type('Llamar al banco')
  let s = await getState(page)
  const created = s.notes.find((n) => n.id === s.editingId)
  check('(celular) ＋ crea un posit listo para escribir', s.notes.length === 2 && !!created)
  await wait(450) // termina el desplazamiento animado hacia el posit nuevo
  const geoPh = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('.note')].map((e) => {
      const r = e.getBoundingClientRect()
      return { l: r.left, t: r.top, r: r.right, b: r.bottom }
    })
    return { rects, w: innerWidth, h: innerHeight }
  })
  const [pa, pb] = geoPh.rects
  check('(celular) el posit nuevo no tapa al de bienvenida', !(pa.l < pb.r && pa.r > pb.l && pa.t < pb.b && pa.b > pb.t), JSON.stringify(geoPh.rects))
  const newRect = geoPh.rects[1]
  check('(celular) y el tablero se desplaza para mostrarlo', newRect.l >= 0 && newRect.r <= geoPh.w && newRect.t >= 0 && newRect.b <= geoPh.h, JSON.stringify(newRect))
  check('(celular) el texto queda en el posit', JSON.stringify(created?.doc).includes('Llamar al banco'))

  // Con el teclado abierto: simulamos que el teclado se come el alto de pantalla
  await page.setViewportSize({ width: 390, height: 500 })
  await wait(350)
  const vis = await page.evaluate(() => {
    const note = document.querySelector('.note.is-editing').getBoundingClientRect()
    const ctxbar = document.querySelector('.ctx')?.getBoundingClientRect()
    const case_ = document.querySelector('.case')
    return { noteBottom: note.bottom, noteTop: note.top, ctxTop: ctxbar ? ctxbar.top : null, hasCase: !!case_, innerHeight }
  })
  check('(celular) con el teclado abierto se oculta el estuche y queda "Listo"', !vis.hasCase && (await page.getByRole('button', { name: 'Listo' }).isVisible()))
  check('(celular) el posit que escribes queda a la vista sobre el teclado', vis.noteTop >= 0 && vis.noteTop < vis.innerHeight - 100, JSON.stringify(vis))
  await shot(page, 'cel-02-escribiendo')
  const done = await page.getByRole('button', { name: 'Listo' }).boundingBox()
  await tap(...Object.values(centerOf(done)))
  await page.setViewportSize({ width: 390, height: 844 })
  await wait(350)
  s = await getState(page)
  check('(celular) "Listo" cierra la escritura y deja el posit seleccionado', s.editingId === null && s.selectedId === created.id)

  // Mover con un dedo desde la cinta
  const id = created.id
  const before = s.notes.find((n) => n.id === id)
  const grip = await page.locator(`[data-note-id="${id}"] .note-grip`).boundingBox()
  await drag(centerOf(grip), { x: centerOf(grip).x - 30, y: centerOf(grip).y + 120 })
  s = await getState(page)
  let after = s.notes.find((n) => n.id === id)
  check('(celular) un dedo arrastra el posit desde la cinta', near(after.x - before.x, -30, 16) && near(after.y - before.y, 120, 16), `dx=${after.x - before.x} dy=${after.y - before.y}`)

  // Redimensionar con el dedo
  const hnd = await page.locator(`[data-note-id="${id}"] [data-resize="both"]`).boundingBox()
  const w0 = after.w
  await drag(centerOf(hnd), { x: centerOf(hnd).x + 40, y: centerOf(hnd).y + 60 })
  s = await getState(page)
  after = s.notes.find((n) => n.id === id)
  check('(celular) el tirador de la esquina agranda con el dedo', after.w - w0 > 20, `dw=${after.w - w0}`)

  // Desplazar el tablero con un dedo sobre el fondo
  const v0 = s.view
  // busca un punto de fondo realmente libre (ni posits ni barras encima)
  const from = await page.evaluate(() => {
    for (let y = 120; y < 700; y += 40) {
      for (let x = 8; x < 380; x += 24) {
        const el = document.elementFromPoint(x, y)
        if (el && el.classList.contains('board')) return { x, y }
      }
    }
    return { x: 8, y: 120 }
  })
  const under = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName}.${String(el.className).slice(0, 30)}` : 'nada' }, from)
  await drag(from, { x: from.x + 70, y: from.y + 60 })
  s = await getState(page)
  check('(celular) un dedo sobre el fondo desplaza el tablero', near(s.view.x - v0.x, 70, 12) && near(s.view.y - v0.y, 60, 12), `bajo el dedo: ${under}; dx=${s.view.x - v0.x} dy=${s.view.y - v0.y}`)

  // Pellizcar
  const z0 = s.view.z
  await pinch({ x: 195, y: 420 }, 90, 220)
  s = await getState(page)
  check('(celular) separar dos dedos acerca (zoom)', s.view.z > z0 * 1.6, `${z0} → ${s.view.z}`)
  const z1 = s.view.z
  await pinch({ x: 195, y: 420 }, 240, 100)
  s = await getState(page)
  check('(celular) juntar dos dedos aleja', s.view.z < z1 * 0.6, `${z1} → ${s.view.z}`)

  // Ver todo + tocar y volver a tocar para escribir
  await page.getByRole('button', { name: 'Ver todo' }).click()
  await wait(500)
  await seed(page)
  await page.getByRole('button', { name: 'Ver todo' }).click()
  await wait(500)
  await shot(page, 'cel-03-varios')
  // un posit cuyo centro esté libre (ni tapado por otros, ni por la barra de acciones que aparece al seleccionar)
  const idx = await page.evaluate(() => {
    const notes = [...document.querySelectorAll('.note')]
    const i = notes.findIndex((n, k) => {
      if (k === 0) return false
      const r = n.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const top = document.elementFromPoint(cx, cy)
      return cy > 90 && cy < innerHeight - 300 && top && top.closest('.note') === n
    })
    return i < 0 ? 4 : i
  })
  const target = await page.locator('.note').nth(idx).locator('.paper').boundingBox()
  await tap(...Object.values(centerOf(target)))
  s = await getState(page)
  check('(celular) un toque selecciona sin abrir el teclado', s.selectedId !== null && s.editingId === null)
  await shot(page, 'cel-04-seleccion')
  await tap(...Object.values(centerOf(target)))
  s = await getState(page)
  check('(celular) un segundo toque pasa a escribir', s.editingId !== null)
  await page.getByRole('button', { name: 'Listo' }).click()

  // Paleta en pantalla angosta
  await page.getByRole('button', { name: 'Colores del papel' }).click()
  await page.waitForSelector('.palette-pop')
  await shot(page, 'cel-05-paleta')
  const pop = await page.locator('.palette-pop').boundingBox()
  check('(celular) la paleta completa cabe en la pantalla', pop.x >= 0 && pop.x + pop.width <= 390, JSON.stringify(pop))
  await page.getByRole('button', { name: 'Color Turquesa' }).click()

  // Borrar y deshacer con el dedo
  const n0 = (await getState(page)).notes.length
  const del = await page.getByRole('button', { name: 'Borrar' }).boundingBox()
  await tap(...Object.values(centerOf(del)))
  s = await getState(page)
  check('(celular) Borrar elimina y ofrece Deshacer', s.notes.length === n0 - 1 && s.toast === 'Posit borrado')
  const undo = await page.getByRole('button', { name: 'Deshacer' }).boundingBox()
  await tap(...Object.values(centerOf(undo)))
  s = await getState(page)
  check('(celular) Deshacer recupera el posit', s.notes.length === n0)

  await ctx.close()
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

  console.log('\n▶ Consola del navegador')
  check('sin errores ni avisos en la consola', consoleErrors.length === 0, consoleErrors.join(' | '))

  process.exit(finish())
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
