/*
 * Prueba del tamaño de los posits con un navegador real (Chromium):
 *   - la esquina agranda o achica TODO el posit (papel, letra e íconos pegados) en diagonal, sin deformarlo;
 *   - los bordes (ratón) cambian solo el ancho o el alto y los íconos pegados siguen al borde más cercano;
 *   - los botones «más pequeño / más grande» de la barra del posit;
 *   - los íconos pegados a un posit escalado se arrastran, cambian de tamaño y se pasan a otro posit sin saltos;
 *   - en el celular, al tocar un posit se ve entero y su esquina se alcanza (no la tapan las barras ni la mascota).
 * Deja capturas en e2e/out/.
 *
 * Uso:  npm run build && node e2e/resize.cjs
 */
const { chromium } = require('playwright')
const { startPreview } = require('./serve.cjs')
const { check, near, shot, open, consoleErrors, finish } = require('./lib.cjs')

/** Medidas de un posit tal como se ven en la pantalla (y lo guardado). */
const measure = (page, id) =>
  page.evaluate((id) => {
    const el = document.querySelector(`[data-note-id="${id}"]`)
    const n = window.__posits.store.getState().notes[id]
    const r = el.getBoundingClientRect()
    // una línea de texto de verdad: su alto en pantalla dice cuánto se ve la letra
    const t = el.querySelector('.ProseMirror p')
    const range = document.createRange()
    range.selectNodeContents(t)
    const line = range.getClientRects()[0]
    const stickers = [...el.querySelectorAll('.sticker')].map((st) => {
      const b = st.getBoundingClientRect()
      return {
        id: st.getAttribute('data-sticker-id'),
        fx: (b.left + b.width / 2 - r.left) / r.width,
        fy: (b.top + b.height / 2 - r.top) / r.height,
        w: b.width,
        cx: b.left + b.width / 2,
        cy: b.top + b.height / 2,
      }
    })
    return { w: r.width, h: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom, ratio: r.width / r.height, line: line ? line.height : 0, k: n.scale ?? 1, store: { w: n.w, h: n.h, x: n.x, y: n.y }, stickers, layoutH: el.offsetHeight }
  }, id)

const noteIds = (page) => page.evaluate(() => Object.keys(window.__posits.store.getState().notes))

async function mouseDrag(page, handle, dx, dy) {
  const b = await handle.boundingBox()
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(120)
}

const handle = (page, id, which) => page.locator(`[data-note-id="${id}"] [data-resize="${which}"]`)
const select = async (page, id) => {
  await page.evaluate((id) => window.__posits.store.getState().select(id), id)
  await page.waitForTimeout(150)
}

// ───────────────────────────── PC ─────────────────────────────

async function desktop(browser, url) {
  console.log('\n▶ PC (1440×900, ratón): la esquina, los bordes y los botones')
  const { ctx, page } = await open(browser, url, { viewport: { width: 1440, height: 900 } })
  const [id] = await noteIds(page)
  await select(page, id)

  // ── La esquina achica todo, en diagonal ──
  const a = await measure(page, id)
  await mouseDrag(page, handle(page, id, 'both'), -60, -60)
  const b = await measure(page, id)
  check('la esquina achica el posit en las dos direcciones a la vez (diagonal)', b.w < a.w - 20 && b.h < a.h - 20, `antes ${a.w.toFixed(0)}×${a.h.toFixed(0)} → ${b.w.toFixed(0)}×${b.h.toFixed(0)}`)
  check('…sin deformarlo (la forma es la misma)', near(b.ratio, a.ratio, 0.01), `${a.ratio.toFixed(3)} → ${b.ratio.toFixed(3)}`)
  check('…con la escala guardada y el ancho y alto del papel intactos', b.k < 1 && b.k > 0.3 && b.store.w === a.store.w && b.store.h === a.store.h, `scale=${b.k} w=${b.store.w} h=${b.store.h}`)
  check('…y la letra se achica igual que el papel', near(b.line / a.line, b.w / a.w, 0.02), `letra ×${(b.line / a.line).toFixed(3)} · papel ×${(b.w / a.w).toFixed(3)}`)
  const sa = a.stickers[0]
  const sb = b.stickers[0]
  check('el ícono pegado sigue en su esquina del posit (misma posición relativa)', near(sb.fx, sa.fx, 0.01) && near(sb.fy, sa.fy, 0.01), `(${sa.fx.toFixed(3)}, ${sa.fy.toFixed(3)}) → (${sb.fx.toFixed(3)}, ${sb.fy.toFixed(3)})`)
  check('…y se achica con el posit', near(sb.w / sa.w, b.w / a.w, 0.03), `ícono ×${(sb.w / sa.w).toFixed(3)} · papel ×${(b.w / a.w).toFixed(3)}`)
  await shot(page, 'tam-pc-01-achicado')

  await mouseDrag(page, handle(page, id, 'both'), 150, 150)
  const c = await measure(page, id)
  check('arrastrar la esquina hacia afuera lo agranda en diagonal, también sin deformarlo', c.w > b.w + 30 && c.h > b.h + 30 && near(c.ratio, a.ratio, 0.01), `${b.w.toFixed(0)}×${b.h.toFixed(0)} → ${c.w.toFixed(0)}×${c.h.toFixed(0)}`)
  check('…y el ícono lo acompaña (misma posición relativa, más grande)', near(c.stickers[0].fx, sa.fx, 0.01) && c.stickers[0].w > sb.w, `w ${sb.w.toFixed(0)} → ${c.stickers[0].w.toFixed(0)}`)

  // hacia adentro de más: nunca más chico que 96 de ancho a la vista ni menos de 0,3×
  for (let i = 0; i < 3; i++) await mouseDrag(page, handle(page, id, 'both'), -400, -400)
  const d = await measure(page, id)
  const z = await page.evaluate(() => window.__posits.view.get().z)
  check('no se deja achicar sin fin: el ancho a la vista no baja de 96', d.w / z >= 95.5 && d.k >= 0.3, `ancho ${(d.w / z).toFixed(1)} · escala ${d.k.toFixed(3)}`)
  await shot(page, 'tam-pc-02-minimo')

  // se guarda y sobrevive a la recarga
  await page.waitForFunction(() => window.__posits.store.getState().saveStatus === 'saved')
  await page.reload()
  await page.addStyleTag({ content: '.mascot, .mascot-peek { display: none !important }' })
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(500)
  const e = await measure(page, id)
  check('la escala se guarda y el posit se ve igual al recargar', near(e.k, d.k, 1e-9) && near(e.w, d.w, 1) && near(e.h, d.h, 1), `escala ${d.k.toFixed(3)} → ${e.k.toFixed(3)}`)

  // ── Los botones de la barra ──
  await select(page, id)
  const k0 = (await measure(page, id)).k
  await page.getByRole('button', { name: 'Posit más grande' }).click()
  await page.waitForTimeout(80)
  const k1 = (await measure(page, id)).k
  check('«Posit más grande» agranda todo el posit un paso (×1,15)', near(k1 / k0, 1.15, 0.001), `×${(k1 / k0).toFixed(4)}`)
  await page.getByRole('button', { name: 'Posit más pequeño' }).click()
  await page.waitForTimeout(80)
  const k2 = (await measure(page, id)).k
  check('«Posit más pequeño» lo achica un paso y vuelve a lo de antes', near(k2, k0, 1e-6), `${k0.toFixed(4)} → ${k2.toFixed(4)}`)
  for (let i = 0; i < 40; i++) await page.getByRole('button', { name: 'Posit más pequeño' }).click()
  const k3 = await measure(page, id)
  check('con los botones tampoco pasa del mínimo', k3.k >= 0.3 && k3.w / z >= 95.5, `escala ${k3.k.toFixed(3)} ancho ${(k3.w / z).toFixed(1)}`)
  for (let i = 0; i < 60; i++) await page.getByRole('button', { name: 'Posit más grande' }).click()
  const k4 = await measure(page, id)
  check('…ni del máximo (4× y 1400 de ancho)', k4.k <= 4 + 1e-9 && k4.w / z <= 1400.5, `escala ${k4.k.toFixed(3)} ancho ${(k4.w / z).toFixed(0)}`)
  await ctx.close()

  // ── Bordes con íconos pegados, y mover / girar / agrandar íconos en un posit escalado ──
  const c2 = await open(browser, url, { viewport: { width: 1440, height: 900 } })
  const p2 = c2.page
  const made = await p2.evaluate(() => {
    const s = window.__posits.store.getState()
    for (const id of Object.keys(s.notes)) s.deleteNote(id)
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }] }
    const n = window.__posits.store.getState().addNote({ x: 200, y: 120, w: 288, h: 288, exact: true, doc })
    const st = window.__posits.store.getState()
    const tl = st.addSticker({ icon: 'sol', noteId: n, x: 10, y: 10, size: 48, tilt: 0, select: false })
    const tr = st.addSticker({ icon: 'fuego', noteId: n, x: 288 - 40, y: -20, size: 48, tilt: 0, select: false })
    const br = st.addSticker({ icon: 'rayo', noteId: n, x: 288 - 70, y: 288 - 70, size: 48, tilt: 0, select: false })
    const other = window.__posits.store.getState().addNote({ x: 700, y: 120, w: 240, h: 240, exact: true, doc })
    window.__posits.store.getState().select(n)
    return { n, tl, tr, br, other }
  })
  await p2.waitForTimeout(400)
  const local = (id) => p2.evaluate((id) => { const st = window.__posits.store.getState().stickers[id]; return { x: st.x, y: st.y, size: st.size } }, id)
  const before = { tl: await local(made.tl), tr: await local(made.tr), br: await local(made.br) }
  const w0 = (await measure(p2, made.n)).store.w

  await mouseDrag(p2, handle(p2, made.n, 'x'), 96, 0)
  const afterX = { tl: await local(made.tl), tr: await local(made.tr), br: await local(made.br) }
  const mx = await measure(p2, made.n)
  const dw = mx.store.w - w0
  check('el borde derecho cambia solo el ancho del papel', dw > 60 && mx.store.h === 288 && mx.k === 1, `w ${w0} → ${mx.store.w}`)
  check('…los íconos de la derecha van con el borde y el de la izquierda se queda', near(afterX.tr.x - before.tr.x, dw, 0.5) && near(afterX.br.x - before.br.x, dw, 0.5) && afterX.tl.x === before.tl.x, `dw=${dw} · tr ${afterX.tr.x - before.tr.x} · br ${afterX.br.x - before.br.x} · tl ${afterX.tl.x - before.tl.x}`)
  await shot(p2, 'tam-pc-03-borde-ancho')

  const layoutH0 = (await measure(p2, made.n)).layoutH
  await mouseDrag(p2, handle(p2, made.n, 'y'), 0, 96)
  const afterY = { tl: await local(made.tl), tr: await local(made.tr), br: await local(made.br) }
  const my = await measure(p2, made.n)
  const dh = my.layoutH - layoutH0
  check('el borde de abajo cambia solo el alto (el ancho ni la escala se tocan)', dh > 60 && my.store.w === mx.store.w && my.k === 1, `alto ${layoutH0} → ${my.layoutH}`)
  check('…el ícono de abajo va con el borde y los de arriba se quedan', near(afterY.br.y - afterX.br.y, dh, 1) && afterY.tr.y === afterX.tr.y && afterY.tl.y === afterX.tl.y, `dh=${dh} · br ${afterY.br.y - afterX.br.y}`)
  await shot(p2, 'tam-pc-04-borde-alto')

  // en un posit escalado los bordes también funcionan (en las medidas del papel)
  await p2.evaluate((n) => window.__posits.store.getState().resizeNote(n, { scale: 0.5 }), made.n)
  await p2.waitForTimeout(100)
  const sc0 = await measure(p2, made.n)
  const scStore0 = sc0.store.w
  await mouseDrag(p2, handle(p2, made.n, 'x'), 48, 0)
  const sc1 = await measure(p2, made.n)
  check('con el posit a la mitad, arrastrar el borde 48 px a la vista agrega ~96 al papel (los px de pantalla valen la mitad)', near(sc1.store.w - scStore0, 96, 12) && sc1.k === 0.5, `w ${scStore0} → ${sc1.store.w}`)

  // mover el posit escalado con el ratón: lo sigue exactamente
  const gripBox = await p2.locator(`[data-note-id="${made.n}"] .note-grip`).boundingBox()
  await p2.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2)
  await p2.mouse.down()
  await p2.mouse.move(gripBox.x + gripBox.width / 2 + 120, gripBox.y + gripBox.height / 2 + 60, { steps: 10 })
  await p2.mouse.up()
  const moved = await measure(p2, made.n)
  check('mover un posit escalado: se mueve lo que se arrastra y conserva su escala', near(moved.left - sc1.left, 120, 3) && near(moved.top - sc1.top, 60, 3) && moved.k === 0.5, `dx=${(moved.left - sc1.left).toFixed(1)} dy=${(moved.top - sc1.top).toFixed(1)}`)

  // ── Íconos en un posit escalado ──
  await p2.evaluate((n) => window.__posits.store.getState().resizeNote(n, { w: 288, scale: 0.5 }), made.n)
  await select(p2, made.n)
  const t0 = await measure(p2, made.n)
  const sk = t0.stickers.find((s) => s.id === made.tl)
  await p2.mouse.move(sk.cx, sk.cy)
  await p2.mouse.down()
  await p2.mouse.move(sk.cx + 40, sk.cy + 30, { steps: 8 })
  await p2.mouse.up()
  const t1 = await measure(p2, made.n)
  const sk1 = t1.stickers.find((s) => s.id === made.tl)
  check('arrastrar un ícono de un posit a la mitad: va exactamente bajo el ratón', near(sk1.cx - sk.cx, 40, 2) && near(sk1.cy - sk.cy, 30, 2), `dx=${(sk1.cx - sk.cx).toFixed(1)} dy=${(sk1.cy - sk.cy).toFixed(1)}`)

  const visW0 = sk1.w
  const stHandle = p2.locator(`[data-sticker-id="${made.tl}"] [data-resize-sticker]`)
  await p2.waitForTimeout(150)
  const hb = await stHandle.boundingBox()
  if (hb) {
    await p2.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
    await p2.mouse.down()
    await p2.mouse.move(hb.x + hb.width / 2 + 24, hb.y + hb.height / 2 + 24, { steps: 8 })
    await p2.mouse.up()
    const t2 = await measure(p2, made.n)
    const sk2 = t2.stickers.find((s) => s.id === made.tl)
    check('agrandar un ícono con su tirador en un posit a la mitad: crece lo que se arrastra (sin doblarse ni encogerse)', sk2.w - visW0 > 20 && sk2.w - visW0 < 60, `de ${visW0.toFixed(1)} a ${sk2.w.toFixed(1)}`)
  } else {
    check('el ícono seleccionado tiene tirador de tamaño', false, 'no hay tirador')
  }

  // pasar un ícono de un posit a la mitad a otro posit de tamaño natural: conserva el tamaño que se le ve
  const t3 = await measure(p2, made.n)
  const mv = t3.stickers.find((s) => s.id === made.tr)
  const other = await p2.locator(`[data-note-id="${made.other}"] .paper`).boundingBox()
  await p2.mouse.move(mv.cx, mv.cy)
  await p2.mouse.down()
  await p2.mouse.move(other.x + other.width / 2, other.y + other.height / 2, { steps: 14 })
  await p2.mouse.up()
  await p2.waitForTimeout(120)
  const info = await p2.evaluate(([sid, other]) => {
    const st = window.__posits.store.getState().stickers[sid]
    const b = document.querySelector(`[data-sticker-id="${sid}"]`).getBoundingClientRect()
    return { noteId: st.noteId, size: st.size, w: b.width, cx: b.left + b.width / 2, cy: b.top + b.height / 2, other }
  }, [made.tr, made.other])
  check('un ícono soltado sobre otro posit se le pega', info.noteId === made.other, `noteId=${info.noteId}`)
  check('…y conserva el tamaño que se le veía (no salta al pasar de un posit escalado a otro)', near(info.w, mv.w, 2), `${mv.w.toFixed(1)} → ${info.w.toFixed(1)}`)
  check('…y queda donde se soltó', near(info.cx, other.x + other.width / 2, 3) && near(info.cy, other.y + other.height / 2, 3), `(${info.cx.toFixed(0)}, ${info.cy.toFixed(0)})`)

  // duplicar un posit escalado: la copia se ve igual de grande
  await select(p2, made.n)
  const dupBefore = await measure(p2, made.n)
  await p2.getByRole('button', { name: 'Duplicar posit' }).click()
  await p2.waitForTimeout(150)
  const ids = await noteIds(p2)
  const copy = ids.find((i) => ![made.n, made.other].includes(i))
  const dup = await measure(p2, copy)
  check('duplicar un posit escalado: la copia se ve del mismo tamaño y con sus íconos', near(dup.w, dupBefore.w, 1) && near(dup.h, dupBefore.h, 1) && dup.stickers.length === dupBefore.stickers.length, `${dupBefore.w.toFixed(0)}×${dupBefore.h.toFixed(0)} → ${dup.w.toFixed(0)}×${dup.h.toFixed(0)} (íconos ${dupBefore.stickers.length}→${dup.stickers.length})`)
  await shot(p2, 'tam-pc-05-escalado')
  await c2.ctx.close()

  // ── Un posit abajo del todo se trae a la vista al tocarlo ──
  const c3 = await open(browser, url, { viewport: { width: 1440, height: 900 } })
  const p3 = c3.page
  const low = await p3.evaluate(() => {
    const s = window.__posits.store.getState()
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Abajo' }] }] }
    const v = window.__posits.view.get()
    // en pantalla: bajo, justo encima de las barras (cuando aparece la de acciones, su borde de abajo queda tapado)
    const y = (600 - v.y) / v.z
    const x = (1000 - v.x) / v.z
    return s.addNote({ x, y, w: 240, h: 170, exact: true, doc })
  })
  await p3.evaluate(() => window.__posits.store.getState().select(null))
  await p3.waitForTimeout(200)
  const box = await p3.locator(`[data-note-id="${low}"] .paper`).boundingBox()
  await p3.mouse.click(box.x + box.width / 2, box.y + 40)
  await p3.waitForTimeout(1000)
  const lowNow = await measure(p3, low)
  const dockTop = await p3.evaluate(() => Math.min(...['.dock', '.ctx', '.case'].map((s) => document.querySelector(s)?.getBoundingClientRect().top ?? 9999)))
  check('al tocar un posit que quedaba abajo, se trae a la vista entero (con el tirador de la esquina) sobre las barras', lowNow.bottom + 28 <= dockTop + 1, `borde de abajo ${lowNow.bottom.toFixed(0)} · barras desde ${dockTop.toFixed(0)}`)
  await c3.ctx.close()
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
  console.log('\n▶ Celular (390×844, toques reales): tocar, ver entero y achicar con la esquina')
  // con la mascota puesta (callada): es lo que ve la persona y ella también puede tapar el tirador
  const { ctx, page } = await open(browser, url, IPHONE, 'debug&mascot=quiet', false)
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
    await wait(120)
  }

  const [id] = await noteIds(page)
  const a = await measure(page, id)
  const paper = await page.locator(`[data-note-id="${id}"] .paper`).boundingBox()
  await page.touchscreen.tap(paper.x + paper.width / 2, paper.y + paper.height / 2)
  await wait(1200)
  const sel = await page.evaluate((id) => {
    const el = document.querySelector(`[data-note-id="${id}"]`)
    const r = el.getBoundingClientRect()
    const h = el.querySelector('[data-resize="both"]').getBoundingClientRect()
    const cx = h.left + h.width / 2
    const cy = h.top + h.height / 2
    const top = document.elementFromPoint(cx, cy)
    const mascot = document.querySelector('.mascot-figure')?.getBoundingClientRect()
    return {
      note: { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
      handle: { x: cx, y: cy },
      onTop: top ? `${top.className}|${top.getAttribute('data-resize') || ''}` : null,
      hitsHandle: !!top?.closest('[data-resize="both"]'),
      mascot: mascot ? { left: mascot.left, top: mascot.top } : null,
      z: window.__posits.view.get().z,
    }
  }, id)
  await shot(page, 'tam-cel-01-seleccionado')
  check('al tocar el posit alto, se ve entero (nada queda bajo la barra de arriba ni las de abajo)', sel.note.top >= 60 && sel.note.bottom <= 844 - 190, JSON.stringify(sel.note))
  check('…y su tirador de la esquina queda a la mano: ni la barra de acciones ni la mascota lo tapan', sel.hitsHandle, `arriba del tirador hay: ${sel.onTop}`)

  const h = await page.locator(`[data-note-id="${id}"] [data-resize="both"]`).boundingBox()
  await drag({ x: h.x + h.width / 2, y: h.y + h.height / 2 }, { x: h.x + h.width / 2 - 60, y: h.y + h.height / 2 - 60 })
  const b = await measure(page, id)
  check('(celular) la esquina achica con el dedo en diagonal, sin deformar el posit', b.w < a.w - 10 && b.h < a.h - 10 && near(b.ratio, a.ratio, 0.01), `${a.w.toFixed(0)}×${a.h.toFixed(0)} → ${b.w.toFixed(0)}×${b.h.toFixed(0)}`)
  check('(celular) el ícono pegado lo acompaña (misma posición relativa) y se achica', near(b.stickers[0].fx, a.stickers[0].fx, 0.01) && near(b.stickers[0].fy, a.stickers[0].fy, 0.01) && b.stickers[0].w < a.stickers[0].w, `(${b.stickers[0].fx.toFixed(3)}, ${b.stickers[0].fy.toFixed(3)})`)
  await shot(page, 'tam-cel-02-achicado')

  // los botones «−» y «+» (solo con el dibujo en la pantalla angosta) también están a mano
  const k0 = b.k
  await page.getByRole('button', { name: 'Posit más grande' }).tap()
  await wait(120)
  const c = await measure(page, id)
  check('(celular) «Posit más grande» (solo el dibujo, con nombre para lectores de pantalla) agranda un paso', near(c.k / k0, 1.15, 0.001), `×${(c.k / k0).toFixed(3)}`)
  const bar = await page.locator('.ctx').boundingBox()
  check('(celular) la barra del posit (duplicar, −, +, letra, borrar) cabe en la pantalla', bar.x >= 0 && bar.x + bar.width <= 390, JSON.stringify(bar))

  // 320 px
  await page.setViewportSize({ width: 320, height: 640 })
  await wait(400)
  const bar320 = await page.locator('.ctx').boundingBox()
  check('(celular 320 px) la barra del posit sigue cabiendo', bar320 && bar320.x >= 0 && bar320.x + bar320.width <= 320, JSON.stringify(bar320))
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
  const errors = consoleErrors.filter((e) => !/favicon|manifest/i.test(e))
  check('sin errores ni avisos en la consola', errors.length === 0, errors.slice(0, 3).join(' | '))
  process.exit(finish())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
