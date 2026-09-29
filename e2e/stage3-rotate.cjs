/*
 * Prueba con un navegador real (Chromium): girar íconos.
 *   - tirador de giro (ratón y dedo), imán a 0°/45°/90°…, Mayús (15°) y Alt (libre)
 *   - botones ↺ ↻ y teclas [ ]
 *   - cambiar el tamaño de un ícono girado (el tirador sigue bajo el dedo)
 *   - íconos pegados a un posit, guardado, duplicar y «Ver todo»
 *
 * Uso:  npm run build && node e2e/stage3-rotate.cjs
 */
const { chromium } = require('playwright')
const { startPreview } = require('./serve.cjs')
const { check, near, centerOf, shot, getState, open, waitSaved, consoleErrors, finish } = require('./lib.cjs')

const getSticker = (page, id) => page.evaluate((sid) => ({ ...window.__posits.store.getState().stickers[sid] }), id)
const stickerBox = (page, id) => page.locator(`[data-sticker-id="${id}"]`).boundingBox()
const knobBox = (page, id) => page.locator(`[data-sticker-id="${id}"] .sticker-rotate`).boundingBox()
const cornerBox = (page, id) => page.locator(`[data-sticker-id="${id}"] .sticker-handle`).boundingBox()
const inside = (b, w, h, pad = 0) => b.x >= pad && b.y >= pad && b.x + b.width <= w - pad && b.y + b.height <= h - pad
const setTilt = (page, id, tilt) => page.evaluate(([sid, t]) => window.__posits.store.getState().patchSticker(sid, { tilt: t }), [id, tilt])
const rad = (d) => (d * Math.PI) / 180
const pointAt = (c, r, phiDeg) => ({ x: c.x + r * Math.cos(rad(phiDeg)), y: c.y + r * Math.sin(rad(phiDeg)) })

/** Pone un ícono suelto, grande y derecho, en un lugar libre a la derecha del posit de bienvenida. */
async function addLoose(page, { x = 430, y = 40, size = 96, tilt = 0, icon = 'sirena' } = {}) {
  return page.evaluate(([px, py, sz, t, ic]) => window.__posits.store.getState().addSticker({ icon: ic, x: px, y: py, size: sz, tilt: t }), [x, y, size, tilt, icon])
}

async function mouseDrag(page, from, to, steps = 10) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: Math.ceil(steps / 2) })
  await page.mouse.move(to.x, to.y, { steps: Math.ceil(steps / 2) })
  await page.mouse.up()
  await page.waitForTimeout(120)
}

/**
 * Un solo gesto con el ratón: agarra la perilla del ícono `id`, la lleva por una ruta de ángulos de pantalla
 * alrededor del centro del ícono (0° = derecha, 90° = abajo, −90° = arriba) y la suelta al final.
 */
async function spin(page, id, phis, { R = 120, mods = [], during } = {}) {
  const c = centerOf(await stickerBox(page, id))
  const k = centerOf(await knobBox(page, id))
  for (const m of mods) await page.keyboard.down(m)
  await page.mouse.move(k.x, k.y)
  await page.mouse.down()
  for (const phi of phis) {
    const p = pointAt(c, R, phi)
    await page.mouse.move(p.x, p.y, { steps: 6 })
  }
  await page.waitForTimeout(60)
  if (during) await during()
  await page.mouse.up()
  for (const m of mods) await page.keyboard.up(m)
  await page.waitForTimeout(120)
  return c
}

// ───────────────────────────── PC ─────────────────────────────

async function desktop(browser, url) {
  console.log('\n▶ PC (1280×800): tirador de giro, botones, teclas y tamaño de un ícono girado')
  const { ctx, page } = await open(browser, url, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 })
  const welcomeId = (await getState(page)).notes[0].id

  const id = await addLoose(page)
  await page.waitForTimeout(150)
  const bar = page.getByRole('toolbar', { name: 'Acciones del ícono' })
  const rotL = bar.getByRole('button', { name: 'Girar a la izquierda' })
  const rotR = bar.getByRole('button', { name: 'Girar a la derecha' })

  // 1 · Lo que se ve al seleccionar un ícono
  check('el ícono seleccionado muestra el tirador de giro (además del de tamaño)', (await page.locator(`[data-sticker-id="${id}"] .sticker-rotate`).count()) === 1 && (await page.locator(`[data-sticker-id="${id}"] .sticker-handle`).count()) === 1)
  check('la barra del ícono trae girar a la izquierda y a la derecha (6 botones)', (await rotL.isVisible()) && (await rotR.isVisible()) && (await bar.getByRole('button').count()) === 6)
  let sb = await stickerBox(page, id)
  let kb = await knobBox(page, id)
  check('el tirador de giro queda arriba del ícono, centrado y a la vista', centerOf(kb).y < sb.y - 12 && near(centerOf(kb).x, centerOf(sb).x, 1.5) && inside(kb, 1280, 800, 0), JSON.stringify({ sb, kb }))
  check('…con una zona de toque cómoda (≥ 40 px)', kb.width >= 40 && kb.height >= 40, JSON.stringify(kb))

  // 2 · Girar arrastrando la perilla: sigue al ratón y se pega a los ángulos rectos
  const c = centerOf(sb)
  let seen = {}
  await spin(page, id, [-45, 0], {
    during: async () => {
      seen = {
        marked: (await page.locator(`[data-sticker-id="${id}"][data-rotating]`).count()) === 1,
        angle: await page.locator(`[data-sticker-id="${id}"]`).getAttribute('data-angle'),
        pill: await page.locator(`[data-sticker-id="${id}"]`).evaluate((el) => getComputedStyle(el, '::after').content),
      }
      await shot(page, 'giro-pc-01-girando')
    },
  })
  check('mientras se gira, el ícono lleva la marca «girando» y muestra los grados', seen.marked && seen.angle === '90°', JSON.stringify(seen))
  check('…el rótulo de grados se dibuja (90°)', (seen.pill || '').includes('90'), seen.pill)
  let st = await getSticker(page, id)
  check('soltar a la derecha lo deja girado exactamente 90° (imán)', st.tilt === 90, `${st.tilt}`)
  check('…la marca «girando» desaparece y el estilo queda igual al guardado', (await page.locator(`[data-sticker-id="${id}"][data-rotating]`).count()) === 0 && (await page.locator(`[data-sticker-id="${id}"]`).evaluate((el) => el.style.rotate)) === '90deg')
  sb = await stickerBox(page, id)
  check('…y no se movió de su sitio al girar (gira sobre su centro)', near(centerOf(sb).x, c.x, 1) && near(centerOf(sb).y, c.y, 1), `${JSON.stringify(centerOf(sb))} vs ${JSON.stringify(c)}`)

  // 3 · Seguir girando: la perilla ya está a la derecha; llevarla abajo suma 90° más, y a la izquierda cruza los ±180°
  await spin(page, id, [45, 90])
  st = await getSticker(page, id)
  check('de la derecha hacia abajo: 180°', st.tilt === 180, `${st.tilt}`)
  await spin(page, id, [135, 180])
  st = await getSticker(page, id)
  check('pasar de 180° sigue girando sin saltos (se guarda como −90°)', st.tilt === -90, `${st.tilt}`)
  await spin(page, id, [-135, -90])
  st = await getSticker(page, id)
  check('y de vuelta hacia arriba: 0° (derecho)', st.tilt === 0, `${st.tilt}`)
  await spin(page, id, [-45, 0, 45, 90, 135, 180, -135, -90], { R: 130 })
  st = await getSticker(page, id)
  check('una vuelta completa con el ratón (ida por el otro lado) termina en 0° sin acumular vueltas', st.tilt === 0, `${st.tilt}`)

  // 4 · Imanes y teclas modificadoras
  await setTilt(page, id, 0)
  await page.waitForTimeout(80)
  await spin(page, id, [-90 + 43])
  st = await getSticker(page, id)
  check('cerca de 45° se pega a 45° exactos', st.tilt === 45, `${st.tilt}`)
  await setTilt(page, id, 0)
  await page.waitForTimeout(80)
  await spin(page, id, [-90 + 24])
  st = await getSticker(page, id)
  check('a 24° no hay imán: queda donde se soltó (≈ 24°)', near(st.tilt, 24, 1.5), `${st.tilt}`)
  await setTilt(page, id, 0)
  await page.waitForTimeout(80)
  await spin(page, id, [-90 + 24], { mods: ['Shift'] })
  st = await getSticker(page, id)
  check('con Mayús va de 15° en 15° (24° → 30°)', st.tilt === 30, `${st.tilt}`)
  await setTilt(page, id, 0)
  await page.waitForTimeout(80)
  await spin(page, id, [-90 + 43], { mods: ['Alt'] })
  st = await getSticker(page, id)
  check('con Alt es libre (43° se queda en ≈ 43°, sin imán)', near(st.tilt, 43, 1.5) && st.tilt !== 45, `${st.tilt}`)

  // 5 · Un toque en la perilla, sin arrastrar, no cambia nada
  await setTilt(page, id, 17)
  await page.waitForTimeout(80)
  kb = await knobBox(page, id)
  await page.mouse.click(centerOf(kb).x, centerOf(kb).y)
  await page.waitForTimeout(100)
  st = await getSticker(page, id)
  check('tocar la perilla sin arrastrar deja el ícono como estaba', st.tilt === 17 && (await page.evaluate(() => window.__posits.store.getState().selectedStickerId)) === id, `${st.tilt}`)

  // 6 · Botones ↺ ↻: siempre terminan en ángulos de 15° en 15°
  await setTilt(page, id, 9)
  await page.waitForTimeout(80)
  await rotR.click()
  check('desde 9°, «girar a la derecha» lo deja en 15°', (await getSticker(page, id)).tilt === 15)
  await rotR.click()
  check('otro toque: 30°', (await getSticker(page, id)).tilt === 30)
  await rotL.click()
  await rotL.click()
  check('dos a la izquierda: 0° (derecho)', (await getSticker(page, id)).tilt === 0)
  await rotL.click()
  check('otro a la izquierda: −15°', (await getSticker(page, id)).tilt === -15)
  await setTilt(page, id, 9)
  await page.waitForTimeout(80)
  await rotL.click()
  check('desde 9°, «girar a la izquierda» lo endereza en un toque (0°)', (await getSticker(page, id)).tilt === 0)
  check('el dibujo gira de verdad en pantalla (estilo rotate)', (await page.locator(`[data-sticker-id="${id}"]`).evaluate((el) => el.style.rotate)) === '0deg')

  // 7 · Teclas [ y ]
  await page.keyboard.press(']')
  check('la tecla ] gira a la derecha', (await getSticker(page, id)).tilt === 15)
  await page.keyboard.press(']')
  await page.keyboard.press('[')
  check('la tecla [ gira a la izquierda', (await getSticker(page, id)).tilt === 15)
  for (let i = 0; i < 12; i++) await page.keyboard.press(']')
  check('12 pasos de 15° = media vuelta más 15° (195° se guarda como −165°)', (await getSticker(page, id)).tilt === -165, `${(await getSticker(page, id)).tilt}`)

  // 8 · Cambiar el tamaño de un ícono girado: la esquina sigue bajo el ratón
  for (const tilt of [90, 180, -60, 30]) {
    await page.evaluate(([sid, t]) => window.__posits.store.getState().patchSticker(sid, { tilt: t, size: 96, x: 430, y: 40 }), [id, tilt])
    await page.waitForTimeout(80)
    const before = await getSticker(page, id)
    const z = (await getState(page)).view.z
    const hb = centerOf(await cornerBox(page, id))
    const sc = centerOf(await stickerBox(page, id))
    // hacia afuera desde el centro, siguiendo la diagonal del tirador
    const out = { x: hb.x - sc.x, y: hb.y - sc.y }
    const len = Math.hypot(out.x, out.y)
    const to = { x: hb.x + (out.x / len) * 44, y: hb.y + (out.y / len) * 44 }
    await mouseDrag(page, hb, to)
    const after = await getSticker(page, id)
    const hb2 = centerOf(await cornerBox(page, id))
    check(`girado ${tilt}°: arrastrar el tirador hacia afuera lo agranda`, after.size > before.size + 20 / z, `${before.size} → ${after.size}`)
    check(`…crece desde su centro y el tirador sigue bajo el ratón (${tilt}°)`, near(after.x + after.size / 2, before.x + before.size / 2, 0.6) && near(after.y + after.size / 2, before.y + before.size / 2, 0.6) && Math.hypot(hb2.x - to.x, hb2.y - to.y) < 4, `tirador a ${Math.hypot(hb2.x - to.x, hb2.y - to.y).toFixed(1)} px del ratón`)
  }
  await page.evaluate((sid) => window.__posits.store.getState().patchSticker(sid, { size: 96, tilt: 0, x: 430, y: 40 }), id)

  // 9 · Un ícono pegado a un posit también se gira
  const noteBox = await page.locator('.note').first().boundingBox()
  await page.evaluate(([sid, nid]) => window.__posits.store.getState().placeSticker(sid, { noteId: nid, x: 150, y: 120 }), [id, welcomeId])
  await page.waitForTimeout(150)
  await page.evaluate((sid) => window.__posits.store.getState().selectSticker(sid), id)
  await page.waitForTimeout(100)
  sb = await stickerBox(page, id)
  const cn = centerOf(sb)
  kb = await knobBox(page, id)
  await mouseDrag(page, centerOf(kb), pointAt(cn, 110, 0))
  st = await getSticker(page, id)
  check('un ícono pegado a un posit también se gira con la perilla (90°)', st.noteId === welcomeId && st.tilt === 90, JSON.stringify(st))
  sb = await stickerBox(page, id)
  check('…sin salirse del posit al que está pegado', near(centerOf(sb).x, cn.x, 1) && near(centerOf(sb).y, cn.y, 1) && sb.x > noteBox.x - 30, JSON.stringify(sb))
  await shot(page, 'giro-pc-02-en-posit')

  // 10 · Duplicar conserva el giro; guardado
  await setTilt(page, id, 30)
  await bar.getByRole('button', { name: 'Duplicar' }).click()
  const copyId = await page.evaluate(() => window.__posits.store.getState().selectedStickerId)
  check('Duplicar conserva el giro del original', copyId !== id && (await getSticker(page, copyId)).tilt === 30)
  await waitSaved(page)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(400)
  check('el giro sobrevive a recargar la página', (await getSticker(page, id)).tilt === 30 && (await getSticker(page, copyId)).tilt === 30)

  // 11 · «Ver todo» cuenta el espacio del ícono ya girado (a 45° ocupa √2 veces más)
  const far = await addLoose(page, { x: 420, y: -1500, size: 240, tilt: 45, icon: 'luna' })
  await page.keyboard.press('f')
  await page.waitForTimeout(700)
  const fb = await stickerBox(page, far)
  const topEdge = (await page.locator('.topbar > .pill').first().boundingBox()).y + (await page.locator('.topbar > .pill').first().boundingBox()).height
  check('«Ver todo» deja un ícono lejano y girado entero, sin taparlo con la barra de arriba', inside(fb, 1280, 800, 0) && fb.y >= topEdge - 1, `${JSON.stringify(fb)} (barra hasta ${topEdge})`)
  await page.evaluate((sid) => window.__posits.store.getState().deleteSticker(sid), far)

  // 12 · Composición para la captura: varios íconos con distintos giros
  await page.evaluate(() => {
    const s = window.__posits.store.getState()
    const put = (icon, x, y, size, tilt) => s.addSticker({ icon, x, y, size, tilt })
    put('fuego', 420, -10, 84, -18)
    put('rayo', 540, 60, 72, 24)
    put('cohete', 430, 130, 92, 45)
    put('campana', 560, 190, 80, -35)
    put('trofeo', 660, 20, 88, 12)
  })
  await page.keyboard.press('f')
  await page.waitForTimeout(700)
  await page.mouse.click(40, 600)
  await shot(page, 'giro-pc-03-varios')

  await ctx.close()
}

// ───────────────────────────── Celular ─────────────────────────────

const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mobile/15E148 Safari/604.1)',
}

async function phone(browser, url) {
  console.log('\n▶ Celular (390×844, toques reales): girar con el dedo y con los botones')
  const { ctx, page } = await open(browser, url, IPHONE)
  const cdp = await ctx.newCDPSession(page)
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
  const wait = (ms) => page.waitForTimeout(ms)
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

  const id = await addLoose(page, { x: 20, y: 300, size: 96, tilt: 0 })
  await page.keyboard.press('f')
  await wait(700)
  const bar = page.getByRole('toolbar', { name: 'Acciones del ícono' })
  const geoBar = async (label) => {
    const g = await page.evaluate(() => {
      const b = document.querySelector('[role="toolbar"][aria-label="Acciones del ícono"]')
      const r = b.getBoundingClientRect()
      const btns = [...b.querySelectorAll('button')].map((x) => x.getBoundingClientRect())
      return { l: r.left, r: r.right, w: innerWidth, n: btns.length, minW: Math.min(...btns.map((x) => x.width)), minH: Math.min(...btns.map((x) => x.height)), overflow: document.documentElement.scrollWidth > innerWidth }
    })
    check(`${label}: los 6 botones caben en la pantalla y se pueden tocar`, g.n === 6 && g.l >= 0 && g.r <= g.w && !g.overflow && g.minW >= 36 && g.minH >= 44, JSON.stringify(g))
    return g
  }
  await geoBar('390 px')

  // 1 · Girar con el dedo
  let sb = await stickerBox(page, id)
  let kb = await knobBox(page, id)
  const c = centerOf(sb)
  check('la perilla de giro se ve entera en el celular y se puede tocar (≥ 40 px)', inside(kb, 390, 844, 0) && kb.width >= 40 && kb.height >= 40, JSON.stringify(kb))
  await drag(centerOf(kb), pointAt(c, 100, -45))
  await drag(centerOf(await knobBox(page, id)), pointAt(c, 100, 0))
  let st = await getSticker(page, id)
  check('arrastrar la perilla con el dedo gira el ícono (y se pega a 90°)', st.tilt === 90, `${st.tilt}`)
  const z = (await getState(page)).view.z
  check('…sin mover ni acercar el tablero', z === (await getState(page)).view.z)
  await shot(page, 'giro-cel-01')

  // 2 · Botones con el dedo
  await page.touchscreen.tap(centerOf(await bar.getByRole('button', { name: 'Girar a la derecha' }).boundingBox()).x, centerOf(await bar.getByRole('button', { name: 'Girar a la derecha' }).boundingBox()).y)
  await wait(100)
  check('tocar «girar a la derecha» suma un paso (105°… o el siguiente múltiplo de 15°)', (await getSticker(page, id)).tilt === 105, `${(await getSticker(page, id)).tilt}`)
  const lb = await bar.getByRole('button', { name: 'Girar a la izquierda' }).boundingBox()
  await page.touchscreen.tap(centerOf(lb).x, centerOf(lb).y)
  await page.touchscreen.tap(centerOf(lb).x, centerOf(lb).y)
  await wait(100)
  check('dos toques a la izquierda: vuelve a 75°', (await getSticker(page, id)).tilt === 75, `${(await getSticker(page, id)).tilt}`)

  // 3 · Cambiar el tamaño de un ícono girado con el dedo
  await setTilt(page, id, 90)
  await wait(120)
  const before = await getSticker(page, id)
  const hb = centerOf(await cornerBox(page, id))
  const sc = centerOf(await stickerBox(page, id))
  const out = { x: hb.x - sc.x, y: hb.y - sc.y }
  const len = Math.hypot(out.x, out.y)
  const to = { x: hb.x + (out.x / len) * 36, y: hb.y + (out.y / len) * 36 }
  await drag(hb, to)
  const after = await getSticker(page, id)
  const hb2 = centerOf(await cornerBox(page, id))
  check('girado 90°, el tirador de tamaño sigue bajo el dedo al agrandar', after.size > before.size + 15 && Math.hypot(hb2.x - to.x, hb2.y - to.y) < 5, `${before.size} → ${after.size}, a ${Math.hypot(hb2.x - to.x, hb2.y - to.y).toFixed(1)} px`)

  // 4 · Arrastrar un ícono girado sigue funcionando (no lo confunde con el giro)
  sb = await stickerBox(page, id)
  const p0 = centerOf(sb)
  const b0 = await getSticker(page, id)
  await drag(p0, { x: p0.x + 50, y: p0.y - 40 })
  const b1 = await getSticker(page, id)
  check('un ícono girado se sigue arrastrando con el dedo (mueve, no gira)', b1.tilt === b0.tilt && near(b1.x - b0.x, 50 / z, 2) && near(b1.y - b0.y, -40 / z, 2), `${JSON.stringify(b0)} → ${JSON.stringify(b1)}`)

  await ctx.close()

  // 5 · La barra del ícono en pantallas angostas
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
    await p2.evaluate(() => window.__posits.store.getState().addSticker({ icon: 'sirena', x: 300, y: 40, size: 96, tilt: 0 }))
    await p2.waitForTimeout(200)
    const g = await p2.evaluate(() => {
      const b = document.querySelector('[role="toolbar"][aria-label="Acciones del ícono"]')
      const r = b.getBoundingClientRect()
      const btns = [...b.querySelectorAll('button')].map((x) => x.getBoundingClientRect())
      return { l: r.left, r: r.right, w: innerWidth, n: btns.length, minW: Math.min(...btns.map((x) => x.width)), minH: Math.min(...btns.map((x) => x.height)), overflow: document.documentElement.scrollWidth > innerWidth }
    })
    check(`${w} px: la barra del ícono (6 botones) cabe entera y sin desbordar`, g.n === 6 && g.l >= 0 && g.r <= g.w && !g.overflow && g.minW >= 36 && g.minH >= 44, JSON.stringify(g))
    if (w === 320) await p2.screenshot({ path: require('./lib.cjs').OUT + '/giro-cel-320.png' })
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
