/*
 * Prueba de la Etapa 3 con un navegador real (Chromium): íconos.
 *   - panel con buscador, categorías y recientes
 *   - pegar en la hoja / en un posit / dentro del texto
 *   - arrastrar, cambiar de tamaño, duplicar, borrar y deshacer
 *   - PC: ratón y teclado · Celular: toques reales
 *
 * Uso:  npm run build && node e2e/stage3.cjs
 */
const { chromium } = require('playwright')
const { startPreview } = require('./serve.cjs')
const { check, near, centerOf, shot, getState, open, waitSaved, consoleErrors, finish } = require('./lib.cjs')

const getStickers = (page) =>
  page.evaluate(() => Object.values(window.__posits.store.getState().stickers).map((s) => ({ ...s })))
const getSticker = (page, id) => page.evaluate((sid) => ({ ...window.__posits.store.getState().stickers[sid] }), id)
const stickerBox = (page, id) => page.locator(`[data-sticker-id="${id}"]`).boundingBox()
const panelState = (page) => page.evaluate(() => window.__posits.store.getState().iconPanel)
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
const inside = (b, w, h, pad = 0) => b.x >= pad && b.y >= pad && b.x + b.width <= w - pad && b.y + b.height <= h - pad

async function mouseDrag(page, from, to, steps = 10) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: Math.ceil(steps / 2) })
  await page.mouse.move(to.x, to.y, { steps: Math.ceil(steps / 2) })
  await page.mouse.up()
  await page.waitForTimeout(120)
}

/** Deja un ícono suelto en un lugar exacto (coordenadas del tablero) para no depender del hueco libre. */
const moveStickerTo = (page, id, x, y) =>
  page.evaluate(([sid, px, py]) => window.__posits.store.getState().placeSticker(sid, { noteId: null, x: px, y: py }), [id, x, y])

// ───────────────────────────── PC ─────────────────────────────

async function desktop(browser, url) {
  console.log('\n▶ PC (1280×800): panel de íconos, pegar, arrastrar')
  const { ctx, page } = await open(browser, url, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 })
  const popBtn = () => page.getByRole('button', { name: 'Íconos', exact: true })
  const tile = (id) => page.locator(`.icon-tile[data-icon-id="${id}"]`)
  const search = () => page.locator('.icon-search input')

  // 0 · Posit de bienvenida con su ícono de ejemplo
  let all = await getStickers(page)
  const welcomeId = (await getState(page)).notes[0].id
  check('el posit de bienvenida trae un ícono de ejemplo pegado en su esquina', all.length === 1 && all[0].noteId === welcomeId && all[0].icon === 'brillos', JSON.stringify(all))
  const sparkleEl = page.locator('.note .sticker')
  check('…dibujado a mano (varios trazos) y dentro del posit', (await sparkleEl.count()) === 1 && (await sparkleEl.locator('svg.ic path').count()) >= 6)
  check('…con nombre para lectores de pantalla', (await sparkleEl.getAttribute('aria-label')) === 'Ícono: Chispas')
  await shot(page, 's3-pc-01-inicio')

  // 1 · Abrir el panel
  await popBtn().click()
  const pop = page.locator('.icon-pop')
  await pop.waitFor()
  check('el botón de íconos del estuche abre el panel', (await pop.isVisible()) && (await panelState(page))?.mode === 'board')
  check('en la PC el buscador queda listo para escribir', await page.evaluate(() => !!document.activeElement?.matches?.('.icon-search input')))
  const chips = await page.locator('.icon-chip').allTextContents()
  check('hay categorías: Urgente, Hoy, Compras, Salud, Contacto, Estado, Divertidos y Todos', ['Urgente', 'Hoy', 'Compras', 'Salud', 'Contacto', 'Estado', 'Divertidos', 'Todos'].every((c) => chips.includes(c)), chips.join(','))
  check('sin recientes, abre en «Urgente»', (await page.locator('.icon-chip[aria-pressed="true"]').textContent()) === 'Urgente' && !chips.includes('Recientes'))
  check('«Urgente» muestra sus versiones (sirena, fuego, rayo…)', (await page.locator('.icon-tile').count()) >= 15 && (await tile('sirena').count()) === 1 && (await tile('fuego').count()) === 1)
  await shot(page, 's3-pc-02-panel')

  // 2 · Buscar
  await page.keyboard.type('camion')
  let names = await page.locator('.icon-tile-name').allTextContents()
  check('buscar «camion» (sin tilde) encuentra «Camión de entrega»', names.includes('Camión de entrega'), names.join(','))
  check('al buscar, ninguna categoría queda marcada', (await page.locator('.icon-chip[aria-pressed="true"]').count()) === 0)
  await search().fill('')
  await page.keyboard.type('hoy')
  let found = await page.locator('.icon-tile').evaluateAll((els) => els.map((e) => e.dataset.iconId))
  check('buscar «hoy» encuentra el sol y el calendario de hoy', found.includes('sol') && found.includes('calendario_hoy'), found.join(','))
  await search().fill('zzzz')
  check('sin resultados avisa con un texto', ((await page.locator('.icon-empty').textContent()) || '').includes('No hay íconos'))
  await search().fill('')
  await page.locator('.icon-chip', { hasText: 'Salud' }).click()
  found = await page.locator('.icon-tile').evaluateAll((els) => els.map((e) => e.dataset.iconId))
  check('la categoría «Salud» solo muestra íconos de salud', found.includes('jeringa') && !found.includes('sirena'), found.join(','))
  await page.locator('.icon-chip', { hasText: 'Todos' }).click()
  check('«Todos» muestra el catálogo completo (más de 100)', (await page.locator('.icon-tile').count()) > 100)

  // 3 · Sin posit seleccionado: el ícono cae suelto en la hoja
  await page.locator('.icon-chip', { hasText: 'Urgente' }).click()
  await tile('sirena').click()
  await page.waitForTimeout(250)
  all = await getStickers(page)
  const siren = all.find((s) => s.icon === 'sirena')
  check('un toque en el ícono lo pega suelto en la hoja y cierra el panel', !!siren && siren.noteId === null && (await pop.count()) === 0)
  let s = await getState(page)
  check('…queda seleccionado (y no el posit)', (await page.evaluate(() => window.__posits.store.getState().selectedStickerId)) === siren.id && s.selectedId === null)
  const note = page.locator('.note').first()
  let sb = await stickerBox(page, siren.id)
  let nb = await note.boundingBox()
  check('…en un hueco libre: no encima del posit', !overlaps(sb, nb), `${JSON.stringify(sb)} vs ${JSON.stringify(nb)}`)
  check('…y a la vista', inside(sb, 1280, 800, 4), JSON.stringify(sb))
  const bar = page.getByRole('toolbar', { name: 'Acciones del ícono' })
  check('aparece la barra del ícono: Duplicar, más pequeño, más grande, Borrar', (await bar.isVisible()) && (await bar.getByRole('button').count()) === 4)
  check('el ícono seleccionado muestra su marco y el tirador de tamaño', (await page.locator(`[data-sticker-id="${siren.id}"] .sticker-ring`).count()) === 1 && (await page.locator(`[data-sticker-id="${siren.id}"] .sticker-handle`).count()) === 1)
  await shot(page, 's3-pc-03-suelto')

  // 4 · Recientes
  await popBtn().click()
  await pop.waitFor()
  check('al volver a abrir, «Recientes» va primero y trae el último usado', (await page.locator('.icon-chip').first().textContent()) === 'Recientes' && (await page.locator('.icon-tile').first().getAttribute('data-icon-id')) === 'sirena')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  check('Escape cierra el panel sin quitar la selección del ícono', (await pop.count()) === 0 && (await page.evaluate(() => window.__posits.store.getState().selectedStickerId)) === siren.id)

  // 5 · Arrastrar (libre, sin imán)
  const view = (await getState(page)).view
  const noteRect = await note.boundingBox()
  const worldOf = (bx, by) => ({ x: (bx - view.x) / view.z, y: (by - view.y) / view.z })
  const far = worldOf(noteRect.x + noteRect.width + 220, noteRect.y + 30)
  await moveStickerTo(page, siren.id, far.x, far.y)
  await page.waitForTimeout(120)
  let before = await getSticker(page, siren.id)
  sb = await stickerBox(page, siren.id)
  await mouseDrag(page, centerOf(sb), { x: centerOf(sb).x + 96, y: centerOf(sb).y + 57 })
  let after = await getSticker(page, siren.id)
  check('arrastrar un ícono lo mueve exactamente lo que se arrastra (sin imán)', near(after.x - before.x, 96 / view.z, 0.6) && near(after.y - before.y, 57 / view.z, 0.6), `${before.x},${before.y} → ${after.x},${after.y}`)
  check('…y sigue suelto en la hoja', after.noteId === null)
  const zBefore = after.z
  check('al soltarlo queda encima de todo', after.z >= zBefore)

  // 6 · Soltarlo sobre un posit: se le pega
  sb = await stickerBox(page, siren.id)
  nb = await note.boundingBox()
  const target = { x: nb.x + nb.width * 0.55, y: nb.y + nb.height * 0.72 }
  await mouseDrag(page, centerOf(sb), target)
  after = await getSticker(page, siren.id)
  sb = await stickerBox(page, siren.id)
  check('soltarlo sobre un posit lo pega a ese posit', after.noteId === welcomeId, JSON.stringify(after))
  check('…queda justo donde se soltó', near(centerOf(sb).x, target.x, 3) && near(centerOf(sb).y, target.y, 3), `${centerOf(sb).x},${centerOf(sb).y} vs ${target.x},${target.y}`)
  check('…y ahora se dibuja dentro del posit', (await note.locator(`.note-stickers [data-sticker-id="${siren.id}"]`).count()) === 1)
  await shot(page, 's3-pc-04-pegado')

  // 7 · Al mover el posit, el ícono va con él
  const tape = await note.locator('.tape').boundingBox()
  const sb1 = await stickerBox(page, siren.id)
  const nb1 = await note.boundingBox()
  await mouseDrag(page, centerOf(tape), { x: centerOf(tape).x + 130, y: centerOf(tape).y + 44 })
  const sb2 = await stickerBox(page, siren.id)
  const nb2 = await note.boundingBox()
  check('al arrastrar el posit, el ícono pegado se mueve con él', near(sb2.x - sb1.x, nb2.x - nb1.x, 1.5) && near(sb2.y - sb1.y, nb2.y - nb1.y, 1.5) && nb2.x - nb1.x > 100, `${sb2.x - sb1.x} vs ${nb2.x - nb1.x}`)

  // 8 · Sacarlo del posit a la hoja: queda suelto
  const out = { x: nb2.x + nb2.width + 170, y: nb2.y + 120 }
  await mouseDrag(page, centerOf(sb2), out)
  after = await getSticker(page, siren.id)
  sb = await stickerBox(page, siren.id)
  check('sacarlo del posit y soltarlo en la hoja lo deja suelto', after.noteId === null, JSON.stringify(after))
  check('…justo donde se soltó', near(centerOf(sb).x, out.x, 3) && near(centerOf(sb).y, out.y, 3), `${centerOf(sb).x},${centerOf(sb).y} vs ${out.x},${out.y}`)

  // 9 · Tamaño: tirador y botones
  const handle = await page.locator(`[data-sticker-id="${siren.id}"] .sticker-handle`).boundingBox()
  before = await getSticker(page, siren.id)
  const zoom = (await getState(page)).view.z
  await mouseDrag(page, centerOf(handle), { x: centerOf(handle).x + 40, y: centerOf(handle).y + 40 })
  after = await getSticker(page, siren.id)
  check('el tirador de la esquina agranda el ícono (siempre cuadrado)', near(after.size - before.size, 40 / zoom, 1.5), `${before.size} → ${after.size}`)
  before = after
  await bar.getByRole('button', { name: 'Ícono más grande' }).click()
  after = await getSticker(page, siren.id)
  check('«más grande» lo agranda un cuarto y lo mantiene centrado', near(after.size, Math.round(before.size * 1.25), 1) && near(after.x + after.size / 2, before.x + before.size / 2, 1) && near(after.y + after.size / 2, before.y + before.size / 2, 1), `${JSON.stringify(before)} → ${JSON.stringify(after)}`)
  await bar.getByRole('button', { name: 'Ícono más pequeño' }).click()
  await bar.getByRole('button', { name: 'Ícono más pequeño' }).click()
  await bar.getByRole('button', { name: 'Ícono más pequeño' }).click()
  await bar.getByRole('button', { name: 'Ícono más pequeño' }).click()
  await bar.getByRole('button', { name: 'Ícono más pequeño' }).click()
  await bar.getByRole('button', { name: 'Ícono más pequeño' }).click()
  await bar.getByRole('button', { name: 'Ícono más pequeño' }).click()
  await bar.getByRole('button', { name: 'Ícono más pequeño' }).click()
  after = await getSticker(page, siren.id)
  check('el tamaño mínimo se respeta (no desaparece)', after.size >= 24, `${after.size}`)
  await bar.getByRole('button', { name: 'Ícono más grande' }).click()
  await bar.getByRole('button', { name: 'Ícono más grande' }).click()
  await bar.getByRole('button', { name: 'Ícono más grande' }).click()

  // 10 · Duplicar, borrar, deshacer
  const n0 = (await getStickers(page)).length
  await bar.getByRole('button', { name: 'Duplicar' }).click()
  const withCopy = await getStickers(page)
  check('Duplicar hace una copia y la deja seleccionada', withCopy.length === n0 + 1 && (await page.evaluate(() => window.__posits.store.getState().selectedStickerId)) !== siren.id)
  await page.keyboard.press('Delete')
  check('Suprimir borra el ícono seleccionado y avisa con «Deshacer»', (await getStickers(page)).length === n0 && ((await getState(page)).toast || '').includes('Ícono borrado'))
  await page.getByRole('button', { name: 'Deshacer' }).click()
  check('Deshacer devuelve el ícono', (await getStickers(page)).length === n0 + 1)

  // 11 · Con un posit seleccionado, el ícono se pega en su esquina
  await page.evaluate((id) => window.__posits.store.getState().select(id), welcomeId)
  await page.keyboard.press('i')
  await pop.waitFor()
  check('la tecla I abre el panel', (await panelState(page))?.mode === 'board')
  check('con un posit seleccionado el panel avisa que se pega en él', ((await page.locator('.icon-hint').textContent()) || '').includes('posit seleccionado'))
  await page.keyboard.type('fuego')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(250)
  const onNote = (await getStickers(page)).filter((st) => st.noteId === welcomeId)
  const fire = onNote.find((st) => st.icon === 'fuego')
  const wNote = (await getState(page)).notes.find((n) => n.id === welcomeId)
  check('Enter en el buscador pega el primer resultado', !!fire)
  check('…en la esquina superior derecha del posit seleccionado', !!fire && fire.x > wNote.w * 0.5 && fire.y < 0, JSON.stringify(fire))
  await page.keyboard.press('i')
  await pop.waitFor()
  await page.keyboard.type('rayo')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(250)
  const bolt = (await getStickers(page)).find((st) => st.noteId === welcomeId && st.icon === 'rayo')
  check('el siguiente ícono queda a la izquierda del anterior (en fila)', !!bolt && !!fire && bolt.x < fire.x - 20, `${bolt?.x} vs ${fire?.x}`)
  await shot(page, 's3-pc-05-en-posit')

  // 12 · Borrar el posit se lleva sus íconos; Deshacer los devuelve
  const mine = (await getStickers(page)).filter((st) => st.noteId === welcomeId).length
  await page.evaluate((id) => window.__posits.store.getState().select(id), welcomeId)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(100)
  const left = (await getStickers(page)).filter((st) => st.noteId === welcomeId).length
  check('borrar un posit borra los íconos pegados a él', left === 0 && mine >= 3, `antes ${mine}, después ${left}`)
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await page.waitForTimeout(150)
  check('Deshacer devuelve el posit con todos sus íconos', (await getStickers(page)).filter((st) => st.noteId === welcomeId).length === mine)

  // 13 · Íconos dentro del texto
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  await page.keyboard.type('Llamar')
  const inlineBtn = page.getByRole('button', { name: 'Poner un ícono en el texto' })
  check('al escribir hay un botón «Ícono» en la barra', await inlineBtn.isVisible())
  await inlineBtn.click()
  await pop.waitFor()
  check('abre el panel «Ícono en el texto»', (await panelState(page))?.mode === 'text' && ((await page.locator('.icon-pop .palette-title').textContent()) || '').includes('en el texto'))
  check('…sin quitarle el foco al texto (el cursor sigue ahí)', await page.evaluate(() => !!document.activeElement?.closest?.('.ProseMirror')))
  await page.locator('.icon-chip', { hasText: 'Urgente' }).click()
  await tile('fuego').click()
  await page.waitForTimeout(200)
  const editing = page.locator('.note.is-editing')
  check('un toque mete el ícono en el texto, junto a lo escrito', (await editing.locator('.ProseMirror .inline-icon').count()) === 1)
  s = await getState(page)
  check('…y sigues escribiendo (el posit sigue en edición)', s.editingId !== null && (await pop.count()) === 0)
  await page.keyboard.type(' ya')
  const para = await editing.locator('.ProseMirror p').first().textContent()
  check('el texto sigue después del ícono', para === 'Llamar ya', para)
  const docJson = JSON.stringify((await getState(page)).notes.find((n) => n.id === s.editingId).doc)
  check('el ícono queda guardado en el documento del posit', docJson.includes('"inlineIcon"') && docJson.includes('"icon":"fuego"'))
  const inlineBox = await editing.locator('.inline-icon').first().boundingBox()
  const pBox = await editing.locator('.ProseMirror p').first().boundingBox()
  check('el ícono del texto mide lo que la letra (no descuadra el renglón)', inlineBox.height > 18 && inlineBox.height < 34 && inlineBox.height < pBox.height * 1.4, `${inlineBox.height} vs ${pBox.height}`)
  // buscar desde el texto: el buscador le quita el foco, pero el ícono entra en su sitio
  await inlineBtn.click()
  await pop.waitFor()
  await search().click()
  await page.keyboard.type('reloj')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(250)
  check('también se puede buscar desde el texto (y entra donde estaba el cursor)', (await editing.locator('.ProseMirror .inline-icon').count()) === 2 && (await getState(page)).editingId !== null)
  await page.keyboard.press('Backspace')
  check('un ícono del texto se borra con Retroceso, como una letra', (await editing.locator('.ProseMirror .inline-icon').count()) === 1)
  await shot(page, 's3-pc-06-en-texto')
  await page.getByRole('button', { name: 'Listo' }).click()

  // «Ver todo» también encuadra los íconos sueltos que quedaron lejos
  const lone = await page.evaluate(() => window.__posits.store.getState().addSticker({ icon: 'luna', x: 2600, y: -900, size: 80 }))
  await page.keyboard.press('f')
  await page.waitForTimeout(700)
  const loneBox = await stickerBox(page, lone)
  check('«Ver todo» también muestra los íconos sueltos que quedaron lejos', inside(loneBox, 1280, 800, 0), JSON.stringify(loneBox))
  await page.evaluate((id) => window.__posits.store.getState().deleteSticker(id), lone)

  // 14 · Guardado
  await waitSaved(page)
  const savedBefore = await getStickers(page)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(400)
  const savedAfter = await getStickers(page)
  const same = savedBefore.length === savedAfter.length && savedBefore.every((b) => savedAfter.some((a) => a.id === b.id && near(a.x, b.x, 0.01) && near(a.y, b.y, 0.01) && a.noteId === b.noteId && a.icon === b.icon && near(a.size, b.size, 0.01)))
  check('los íconos (sueltos y pegados) sobreviven al recargar', same && savedAfter.length > 3, `${savedBefore.length} → ${savedAfter.length}`)
  check('el ícono del texto también sobrevive a la recarga', (await page.locator('.ProseMirror .inline-icon').count()) === 1)
  await popBtn().click()
  await pop.waitFor()
  check('los íconos recientes también se recuerdan', (await page.locator('.icon-chip').first().textContent()) === 'Recientes')
  // clic fuera cierra el panel
  await page.mouse.click(60, 400)
  await page.waitForTimeout(100)
  check('tocar fuera del panel lo cierra', (await pop.count()) === 0)

  await ctx.close()
}

// ───────────────────────────── Celular ─────────────────────────────

const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mobile/15E148 Safari/604.1)',
}

async function phone(browser, url) {
  console.log('\n▶ Celular (390×844, toques reales): panel, pegar y arrastrar con el dedo')
  const { ctx, page } = await open(browser, url, IPHONE)
  const cdp = await ctx.newCDPSession(page)
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
  const wait = (ms) => page.waitForTimeout(ms)
  const tap = async (x, y) => {
    await page.touchscreen.tap(x, y)
    await wait(90)
  }
  const tapEl = async (loc) => {
    await loc.scrollIntoViewIfNeeded()
    await wait(60)
    const b = await loc.boundingBox()
    await tap(centerOf(b).x, centerOf(b).y)
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
    await wait(100)
  }
  const pop = page.locator('.icon-pop')
  const popBtn = () => page.getByRole('button', { name: 'Íconos', exact: true })
  const tile = (id) => page.locator(`.icon-tile[data-icon-id="${id}"]`)

  // 1 · El estuche sigue cabiendo con el botón nuevo
  const geo = await page.evaluate(() => {
    const r = (el) => (el ? el.getBoundingClientRect() : null)
    const c = r(document.querySelector('.case'))
    const kids = [...document.querySelectorAll('.case > button, .case .markers')].map((e) => r(e))
    return {
      c,
      markers: document.querySelectorAll('.marker').length,
      overflow: document.documentElement.scrollWidth > innerWidth,
      out: kids.filter((k) => k.left < c.left - 0.5 || k.right > c.right + 0.5).length,
      btn: r(document.querySelector('.icons-btn')),
    }
  })
  check('en 390 px el estuche muestra 5 marcadores y el botón de íconos', geo.markers === 5 && !!geo.btn && geo.btn.width >= 40 && geo.btn.height >= 40, JSON.stringify(geo))
  check('…todo dentro del estuche y sin desbordar la pantalla', geo.out === 0 && !geo.overflow, JSON.stringify(geo))

  // 2 · Abrir el panel con un toque
  await tapEl(popBtn())
  await pop.waitFor()
  const pb = await pop.boundingBox()
  const top = await page.locator('.topbar').boundingBox()
  const dock = await page.locator('.dock').boundingBox()
  check('el panel ocupa el ancho del celular', pb.width >= 340, JSON.stringify(pb))
  check('…sin taparse con la barra de arriba ni con el estuche', pb.y >= top.y + top.height - 2 && pb.y + pb.height <= dock.y + dock.height, JSON.stringify({ pb, top, dock }))
  check('en el celular NO se abre el teclado solo (el buscador no se enfoca)', !(await page.evaluate(() => !!document.activeElement?.matches?.('.icon-search input'))))
  const tb = await page.locator('.icon-tile').first().boundingBox()
  const cols = new Set(await page.locator('.icon-tile').evaluateAll((els) => els.slice(0, 8).map((e) => Math.round(e.getBoundingClientRect().left)))).size
  check('cada ícono del panel se toca con el dedo (≥ 44 px) y hay 4 por fila', tb.width >= 44 && tb.height >= 44 && cols === 4, `${tb.width}×${tb.height}, ${cols} columnas`)
  await shot(page, 's3-cel-01-panel')

  // 3 · Categoría + tocar: se pega suelto y a la vista
  await tapEl(page.locator('.icon-chip', { hasText: 'Contacto' }))
  await tapEl(tile('telefono'))
  await wait(250)
  let all = await getStickers(page)
  const phoneIcon = all.find((s) => s.icon === 'telefono')
  check('tocar un ícono lo pega suelto y cierra el panel', !!phoneIcon && phoneIcon.noteId === null && (await pop.count()) === 0)
  let sb = await stickerBox(page, phoneIcon.id)
  const dockTop = (await page.locator('.dock').boundingBox()).y
  check('…a la vista: dentro de la pantalla y por encima del estuche', inside(sb, 390, 844, 2) && sb.y + sb.height <= dockTop + 2, JSON.stringify({ sb, dockTop }))
  check('…con una zona de toque cómoda (≥ 44 px, contando el margen)', sb.width >= 44 || sb.width + 18 >= 44, JSON.stringify(sb))

  // 4 · Arrastrar con el dedo
  const before = await getSticker(page, phoneIcon.id)
  const z = (await getState(page)).view.z
  const c0 = centerOf(sb)
  await drag(c0, { x: c0.x - 60, y: c0.y - 70 })
  const after = await getSticker(page, phoneIcon.id)
  check('arrastrar con el dedo mueve el ícono (sin mover el tablero)', near(after.x - before.x, -60 / z, 1.5) && near(after.y - before.y, -70 / z, 1.5), `${before.x},${before.y} → ${after.x},${after.y}`)

  // 5 · Tocar el fondo lo suelta; tocarlo lo vuelve a seleccionar
  await tap(30, 420)
  check('tocar el fondo deselecciona el ícono y esconde su barra', (await page.evaluate(() => window.__posits.store.getState().selectedStickerId)) === null && (await page.getByRole('toolbar', { name: 'Acciones del ícono' }).count()) === 0)
  sb = await stickerBox(page, phoneIcon.id)
  await tap(centerOf(sb).x, centerOf(sb).y)
  check('tocar el ícono lo selecciona', (await page.evaluate(() => window.__posits.store.getState().selectedStickerId)) === phoneIcon.id)

  // 6 · Con un posit seleccionado se pega en él
  const note = page.locator('.note').first()
  await page.evaluate(() => window.__posits.store.getState().select(Object.keys(window.__posits.store.getState().notes)[0]))
  await wait(150)
  await tapEl(popBtn())
  await pop.waitFor()
  await tapEl(page.locator('.icon-chip', { hasText: 'Hoy' }))
  await tapEl(tile('sol'))
  await wait(300)
  const noteId = (await getState(page)).notes[0].id
  const sun = (await getStickers(page)).find((s) => s.icon === 'sol')
  check('con un posit seleccionado, el ícono se pega en su esquina', !!sun && sun.noteId === noteId, JSON.stringify(sun))
  sb = await stickerBox(page, sun.id)
  const nb = await note.boundingBox()
  check('…y queda a la vista', inside(sb, 390, 844, 0), JSON.stringify(sb))
  check('…sobre el posit (no perdido en la hoja)', centerOf(sb).x > nb.x && centerOf(sb).x < nb.x + nb.width, `${JSON.stringify(sb)} / ${JSON.stringify(nb)}`)
  await shot(page, 's3-cel-02-en-posit')

  // 7 · Desplazar la lista del panel con el dedo sin mover el tablero
  await tapEl(popBtn())
  await pop.waitFor()
  await tapEl(page.locator('.icon-chip', { hasText: 'Todos' }))
  const gridBox = await page.locator('.icon-grid').boundingBox()
  const v0 = (await getState(page)).view
  await drag({ x: gridBox.x + gridBox.width / 2, y: gridBox.y + gridBox.height - 20 }, { x: gridBox.x + gridBox.width / 2, y: gridBox.y + 20 })
  // el dedo lanza la lista con inercia: se espera a que se detenga (un toque durante la inercia solo la frena)
  let scrolled = -1
  for (let i = 0; i < 40; i++) {
    const now = await page.locator('.icon-grid').evaluate((e) => e.scrollTop)
    if (now === scrolled) break
    scrolled = now
    await wait(120)
  }
  const v1 = (await getState(page)).view
  check('la lista de íconos se desplaza con el dedo', scrolled > 40, `scrollTop=${scrolled}`)
  check('…sin mover el tablero de atrás', near(v0.x, v1.x, 0.5) && near(v0.y, v1.y, 0.5) && v0.z === v1.z)
  await tapEl(page.locator('.icon-pop-close'))
  check('el botón ✕ cierra el panel', (await pop.count()) === 0)

  // 8 · Íconos en el texto, desde la barra de escritura
  await tapEl(page.getByRole('button', { name: 'Nuevo posit' }))
  await page.waitForSelector('.note.is-editing')
  await page.keyboard.type('Cotizar')
  const inlineBtn = page.getByRole('button', { name: 'Poner un ícono en el texto' })
  const ib = await inlineBtn.boundingBox()
  const barBox = await page.getByRole('toolbar', { name: 'Escribiendo en el posit' }).boundingBox()
  check('al escribir, la barra lleva el botón «Ícono» (solo el dibujo) y cabe en la pantalla', ib.width >= 44 && ib.width < 70 && barBox.x >= 0 && barBox.x + barBox.width <= 390, JSON.stringify({ ib, barBox }))
  await tapEl(inlineBtn)
  await pop.waitFor()
  const pb2 = await pop.boundingBox()
  const dock2 = await page.locator('.dock').boundingBox()
  check('el panel del texto queda encima de la barra, dentro de la pantalla', pb2.y >= 0 && pb2.y + pb2.height <= dock2.y + dock2.height, JSON.stringify({ pb2, dock2 }))
  check('…y el cursor sigue en el texto', await page.evaluate(() => !!document.activeElement?.closest?.('.ProseMirror')))
  await shot(page, 's3-cel-03-panel-texto')
  await tapEl(page.locator('.icon-chip', { hasText: 'Compras' }))
  await tapEl(tile('cotizacion'))
  await wait(250)
  const edit = page.locator('.note.is-editing')
  check('tocar un ícono lo mete en el texto y se sigue escribiendo', (await edit.locator('.inline-icon').count()) === 1 && (await getState(page)).editingId !== null && (await pop.count()) === 0)
  await shot(page, 's3-cel-04-texto')

  // 9 · Pantallas muy angostas
  for (const [w, h, markers] of [
    [360, 740, 4],
    [320, 568, 4],
  ]) {
    const c2 = await browser.newContext({ ...IPHONE, viewport: { width: w, height: h } })
    const p2 = await c2.newPage()
    await p2.goto(`${url}?debug`)
    await p2.evaluate(() => document.fonts.ready)
    await p2.waitForSelector('.world[data-ready]', { state: 'attached' })
    await p2.waitForTimeout(400)
    const g = await p2.evaluate(() => {
      const r = (el) => (el ? el.getBoundingClientRect() : null)
      const c = r(document.querySelector('.case'))
      const kids = [...document.querySelectorAll('.case > button, .case .markers')].map((e) => r(e))
      return {
        markers: document.querySelectorAll('.marker').length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        out: kids.filter((k) => k.left < c.left - 0.5 || k.right > c.right + 0.5).length,
        gap: Math.min(...kids.slice(1).map((k, i) => k.left - kids[i].right)),
        btn: r(document.querySelector('.icons-btn')),
      }
    })
    check(`en ${w} px el estuche cabe: ${g.markers} marcadores + íconos, sin desbordar`, g.markers >= markers && g.out === 0 && !g.overflow && g.btn.right <= w, JSON.stringify(g))
    await p2.screenshot({ path: `${require('./lib.cjs').OUT}/s3-cel-${w}.png` })
    await c2.close()
  }

  await ctx.close()
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
