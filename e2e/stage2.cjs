/*
 * Prueba de la Etapa 2 con un navegador real (Chromium):
 * viñetas, pendientes con casilla y tachado de lápiz animado.
 *   - PC: ratón y teclado
 *   - Celular: toques reales
 *
 * Uso:  npm run build && node e2e/stage2.cjs
 */
const { chromium } = require('playwright')
const { startPreview } = require('./serve.cjs')
const { check, near, centerOf, shot, getState, open, waitSaved, taskDoc, bulletDoc, textDoc, consoleErrors, finish } = require('./lib.cjs')

/** Estado de cada pendiente del posit nº `i` (en orden de aparición). */
const taskInfo = (page, i = 0) =>
  page.evaluate((idx) => {
    const note = document.querySelectorAll('.note')[idx]
    return [...note.querySelectorAll('li.task-item')].map((li) => {
      const main = li.querySelector('.task-strike path.main')
      return {
        checked: li.dataset.checked === 'true',
        paths: li.querySelectorAll('.task-strike path.main').length,
        opacity: parseFloat(getComputedStyle(li.querySelector('.task-content')).opacity),
        dashoffset: main ? parseFloat(getComputedStyle(main).strokeDashoffset) : null,
        d: main ? main.getAttribute('d') : null,
      }
    })
  }, i)

/** Casillas marcadas según el documento guardado (no según lo que se ve). */
const docChecks = (page, i = 0) =>
  page.evaluate((idx) => {
    const n = Object.values(window.__posits.store.getState().notes)[idx]
    const out = []
    const walk = (x) => {
      if (x.type === 'taskItem') out.push(!!(x.attrs && x.attrs.checked))
      ;(x.content || []).forEach(walk)
    }
    walk(n.doc)
    return out
  }, i)

const nums = (d) => (d || '').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
const slow = (page, k) => page.evaluate((v) => document.documentElement.style.setProperty('--anim-scale', String(v)), k)

// ───────────────────────────── PC ─────────────────────────────

async function desktop(browser, url) {
  console.log('\n▶ PC (1280×800): listas, casillas y tachado de lápiz')
  const { ctx, page } = await open(browser, url, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 })

  // 0 · Posit de bienvenida con lista de ejemplo
  let t = await taskInfo(page)
  check('el posit de bienvenida trae una lista de pendientes de ejemplo', t.length === 5, `hay ${t.length}`)
  check('el pendiente ya marcado se ve tachado y más tenue desde el inicio', t[1].checked && t[1].paths >= 2 && near(t[1].opacity, 0.55, 0.03), JSON.stringify(t[1]))
  check('al cargar no se reanima: el trazo aparece ya completo', t[1].dashoffset === 0, JSON.stringify(t[1]))
  check('los pendientes sin marcar no tienen trazo y se ven normales', t[0].paths === 0 && t[0].opacity === 1, JSON.stringify(t[0]))

  // 1 · Marcar con el posit CERRADO
  await slow(page, 3)
  const first = await page.locator('.note').first().locator('.task-check').first().boundingBox()
  await page.mouse.click(centerOf(first).x, centerOf(first).y)
  await page.waitForTimeout(90)
  t = await taskInfo(page)
  check('marcar una casilla con el posit cerrado funciona', t[0].checked)
  check('el trazo se dibuja poco a poco (no aparece de golpe)', t[0].dashoffset > 1, JSON.stringify(t[0]))
  let s = await getState(page)
  check('…sin abrir el teclado ni seleccionar el posit', s.editingId === null && s.selectedId === null)
  await page.waitForTimeout(2800)
  t = await taskInfo(page)
  check('al terminar el trazo queda completo y la fila más tenue', t[0].dashoffset === 0 && near(t[0].opacity, 0.55, 0.03), JSON.stringify(t[0]))
  let checks = await docChecks(page)
  check('el cambio queda guardado en el documento del posit', checks[0] === true && checks.filter(Boolean).length === 2, JSON.stringify(checks))
  const d1 = t[0].d

  // 2 · Desmarcar
  await page.mouse.click(centerOf(first).x, centerOf(first).y)
  await page.waitForTimeout(150)
  t = await taskInfo(page)
  check('desmarcar quita el trazo', !t[0].checked && t[0].paths === 0, JSON.stringify(t[0]))
  await page.waitForTimeout(1300)
  t = await taskInfo(page)
  check('…y la fila recupera su opacidad', t[0].opacity === 1, JSON.stringify(t[0]))
  await slow(page, 1)

  // 3 · El trazo mide igual con el tablero alejado (zoom) que a tamaño normal
  await page.keyboard.press('-')
  await page.keyboard.press('-')
  await page.waitForTimeout(150)
  const zoomed = (await getState(page)).view.z
  const first2 = await page.locator('.note').first().locator('.task-check').first().boundingBox()
  await page.mouse.click(centerOf(first2).x, centerOf(first2).y)
  await page.waitForTimeout(1200)
  t = await taskInfo(page)
  const d2 = t[0].d
  const a = nums(d1)
  const b = nums(d2)
  const same = a.length === b.length && a.every((v, k) => near(v, b[k], 1.5))
  check(`el trazo se mide bien con zoom (${Math.round(zoomed * 100)} %): mismas coordenadas que a tamaño normal`, same, `${d1} ≠ ${d2}`)
  await page.mouse.click(centerOf(first2).x, centerOf(first2).y) // vuelve a desmarcar
  await page.keyboard.press('0')
  await page.waitForTimeout(500)

  // 4 · Crear una lista escribiendo, con los botones de la barra
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  const btnTasks = page.getByRole('button', { name: 'Lista de pendientes' })
  const btnBullets = page.getByRole('button', { name: 'Viñetas' })
  check('al escribir aparecen «Listo», viñetas y pendientes en la barra', (await btnTasks.isVisible()) && (await btnBullets.isVisible()) && (await page.getByRole('button', { name: 'Listo' }).isVisible()))
  await btnTasks.click()
  await page.keyboard.type('Comprar café')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Pagar la luz')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Llamar al banco')
  const editing = page.locator('.note.is-editing')
  let items = await editing.locator('li.task-item').count()
  check('el botón de pendientes crea la lista y Enter agrega otro pendiente', items === 3, `hay ${items}`)
  check('el botón queda marcado mientras el cursor está en la lista', (await btnTasks.getAttribute('aria-pressed')) === 'true')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Nota suelta')
  items = await editing.locator('li.task-item').count()
  const lastP = await editing.locator('.ProseMirror > p').last().textContent()
  check('Enter en un pendiente vacío sale de la lista', items === 3 && lastP === 'Nota suelta', `items=${items} p=${lastP}`)
  check('…y el botón se desmarca fuera de la lista', (await btnTasks.getAttribute('aria-pressed')) === 'false')

  // 5 · Marcar mientras se escribe: no se pierde el foco
  const second = await editing.locator('.task-check').nth(1).boundingBox()
  await page.mouse.click(centerOf(second).x, centerOf(second).y)
  await page.waitForTimeout(200)
  s = await getState(page)
  const focused = await page.evaluate(() => !!document.activeElement?.closest?.('.ProseMirror'))
  check('marcar una casilla mientras escribes no cierra el teclado', s.editingId !== null && focused, `editing=${s.editingId} enfocado=${focused}`)
  await page.waitForTimeout(900)
  const dBefore = (await editing.locator('li.task-item').nth(1).locator('path.main').first().getAttribute('d')) || ''

  // 6 · Si editas un pendiente marcado, el trazo se ajusta al texto
  const text2 = await editing.locator('li.task-item').nth(1).locator('.task-content').boundingBox()
  await page.mouse.click(text2.x + text2.width - 6, text2.y + text2.height / 2)
  await page.keyboard.press('End')
  await page.keyboard.type(' y el pan')
  await page.waitForTimeout(500)
  const dAfter = (await editing.locator('li.task-item').nth(1).locator('path.main').first().getAttribute('d')) || ''
  check('si editas un pendiente marcado, el trazo se ajusta al texto nuevo', dBefore !== dAfter && dAfter.length > 0, `${dBefore} = ${dAfter}`)

  // 7 · Deshacer una casilla (Ctrl+Z)
  const third = await editing.locator('.task-check').nth(2).boundingBox()
  await page.mouse.click(centerOf(third).x, centerOf(third).y)
  await page.waitForTimeout(200)
  let c3 = await docChecks(page, 1)
  const checkedNow = c3[2] === true
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(250)
  c3 = await docChecks(page, 1)
  check('Ctrl+Z deshace una casilla marcada', checkedNow && c3[2] === false, JSON.stringify(c3))
  await shot(page, 'e2-pc-editando')
  await page.keyboard.press('Escape')

  // 8 · Viñetas
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  await btnBullets.click()
  await page.keyboard.type('Leche')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Pan')
  let bullets = await page.locator('.note.is-editing ul:not([data-type="taskList"]) > li').count()
  check('el botón de viñetas crea una lista con puntos', bullets === 2, `hay ${bullets}`)
  await page.keyboard.press('Escape')

  // 9 · Atajos de escritura: «- » viñeta y «[ ] » pendiente
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  await page.keyboard.type('- uno')
  await page.keyboard.press('Enter')
  await page.keyboard.type('dos')
  bullets = await page.locator('.note.is-editing ul:not([data-type="taskList"]) > li').count()
  check('escribir «- » al inicio arma una lista de viñetas', bullets === 2, `hay ${bullets}`)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  await page.keyboard.type('[ ] tarea rápida')
  items = await page.locator('.note.is-editing li.task-item').count()
  check('escribir «[ ] » al inicio arma un pendiente con casilla', items === 1, `hay ${items}`)
  await page.keyboard.press('Escape')

  // 9b · Convertir entre pendientes, viñetas y texto con los botones
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  await page.getByRole('button', { name: 'Lista de pendientes' }).click()
  await page.keyboard.type('alfa')
  await page.keyboard.press('Enter')
  await page.keyboard.type('beta')
  const snapshot = () =>
    page.evaluate(() => {
      const n = document.querySelector('.note.is-editing .ProseMirror')
      return {
        tareas: n.querySelectorAll('li.task-item').length,
        puntos: n.querySelectorAll('ul:not([data-type="taskList"]) > li').length,
        anidadas: n.querySelectorAll('ul ul').length,
        parrafos: [...n.querySelectorAll(':scope > p')].map((p) => p.textContent),
        texto: n.textContent,
      }
    })
  await page.getByRole('button', { name: 'Viñetas' }).click()
  let conv = await snapshot()
  check('pasar de pendientes a viñetas convierte TODA la lista y conserva el texto', conv.tareas === 0 && conv.puntos === 2 && conv.anidadas === 0 && conv.texto === 'alfabeta', JSON.stringify(conv))
  await page.getByRole('button', { name: 'Lista de pendientes' }).click()
  conv = await snapshot()
  check('y de viñetas a pendientes también convierte toda la lista', conv.tareas === 2 && conv.puntos === 0 && conv.texto === 'alfabeta', JSON.stringify(conv))
  await page.keyboard.type('!') // el cursor sigue donde estaba (al final de «beta»)
  conv = await snapshot()
  check('al convertir, el cursor se queda donde estaba', conv.texto === 'alfabeta!', JSON.stringify(conv))
  await page.getByRole('button', { name: 'Lista de pendientes' }).click()
  conv = await snapshot()
  check('pulsar el botón de la lista activa quita la lista solo de ese renglón', conv.tareas === 1 && conv.parrafos.join('|') === 'beta!', JSON.stringify(conv))
  await page.keyboard.press('Escape')

  // 10 · El trazo sigue el tamaño del posit
  const wn = page.locator('.note').first()
  // Lleva el posit a la zona libre (que su esquina no quede detrás del estuche), como haría una persona
  await page.evaluate(() => {
    const r = document.querySelectorAll('.note')[0].getBoundingClientRect()
    const v = window.__posits.view
    const a = v.screenToBoard(r.left, r.top)
    const b = v.screenToBoard(r.right + 40, r.bottom + 40)
    v.ensureVisible({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }, false)
  })
  await page.waitForTimeout(150)
  const wb = await wn.locator('.paper').boundingBox()
  await page.mouse.click(centerOf(wb).x, centerOf(wb).y) // selecciona
  const before = (await taskInfo(page))[1].d
  const handle = await wn.locator('[data-resize="both"]').boundingBox()
  const underHandle = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)
    if (!el) return 'nada'
    const host = el.closest('.dock, .topbar, .note, .toast, .palette-pop')
    const r = el.getBoundingClientRect()
    return `${el.tagName} dentro de ${host ? host.className.toString().slice(0, 30) : '?'} @${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}; punto ${Math.round(x)},${Math.round(y)}`
  }, centerOf(handle))
  const w0 = await wn.evaluate((el) => Math.round(el.getBoundingClientRect().width))
  await page.mouse.move(centerOf(handle).x, centerOf(handle).y)
  await page.mouse.down()
  await page.mouse.move(centerOf(handle).x + 110, centerOf(handle).y + 10, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  const after = (await taskInfo(page))[1].d
  const w1 = await wn.evaluate((el) => Math.round(el.getBoundingClientRect().width))
  check('al agrandar el posit, el trazo se vuelve a ajustar a los renglones', before !== after && !!after, `ancho ${w0}→${w1}; bajo el tirador: ${underHandle}`)
  await page.mouse.click(40, 700) // fondo: deselecciona

  // 11 · Guardado y recarga
  await waitSaved(page)
  const savedChecks = await docChecks(page, 0)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  t = await taskInfo(page)
  check('al recargar se conservan las casillas marcadas', t.map((x) => x.checked).join() === savedChecks.join(), `${t.map((x) => x.checked)} vs ${savedChecks}`)
  const doneOnes = t.filter((x) => x.checked)
  check('…y el trazo aparece ya dibujado, sin reanimarse', doneOnes.length > 0 && doneOnes.every((x) => x.dashoffset === 0 && x.paths >= 2), JSON.stringify(doneOnes.map((x) => x.dashoffset)))

  await ctx.close()

  // 12 · Con «reducir movimiento» no hay animación
  const rm = await open(browser, url, { viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' })
  const rb = await rm.page.locator('.note').first().locator('.task-check').first().boundingBox()
  await rm.page.mouse.click(centerOf(rb).x, centerOf(rb).y)
  await rm.page.waitForTimeout(120)
  const rt = await taskInfo(rm.page)
  check('con «reducir movimiento» el trazo aparece al instante', rt[0].checked && rt[0].paths >= 2 && rt[0].dashoffset === 0, JSON.stringify(rt[0]))
  await rm.ctx.close()
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
  console.log('\n▶ Celular (390×844, toques reales): pendientes con el pulgar')
  const { ctx, page } = await open(browser, url, IPHONE)
  const tap = async (x, y) => {
    await page.touchscreen.tap(x, y)
    await page.waitForTimeout(90)
  }

  // Zona táctil ampliada: un toque un poco fuera del dibujo de la casilla también la marca
  const cb = await page.locator('.note').first().locator('.task-check').first().boundingBox()
  await tap(cb.x + cb.width / 2 - 18, cb.y + cb.height / 2 + 16)
  let t = await taskInfo(page)
  check('(celular) la casilla se acierta con el pulgar aunque el toque caiga fuera del dibujo', t[0].checked, JSON.stringify(t[0]))
  let s = await getState(page)
  check('(celular) marcar un pendiente no abre el teclado', s.editingId === null)
  const size = await page.locator('.note').first().locator('.task-check').first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { w: r.width, h: r.height }
  })
  const hit = await page.evaluate(() => {
    // tamaño real de la zona que responde al toque (label + su ampliación)
    const el = document.querySelector('.task-check')
    const r = el.getBoundingClientRect()
    const probes = [[-16, 0], [16 + r.width, 0], [0, -16], [0, 16 + r.height]].map(([dx, dy]) => {
      const e = document.elementFromPoint(r.left + dx + (dx > 0 ? 0 : 0), r.top + dy + r.height / 2)
      return !!e && !!e.closest('.task-check')
    })
    return probes
  })
  check('(celular) la zona táctil de la casilla es mayor que el dibujo', hit.some(Boolean), `dibujo ${Math.round(size.w)}×${Math.round(size.h)} px; sondas=${hit}`)
  await page.waitForTimeout(700)

  // Crear una lista con el pulgar (barra de edición solo con íconos)
  const add = await page.getByRole('button', { name: 'Nuevo posit' }).boundingBox()
  await tap(centerOf(add).x, centerOf(add).y)
  await page.waitForSelector('.note.is-editing')
  const labels = await page.evaluate(() => {
    const vis = (el) => getComputedStyle(el).display !== 'none'
    const btn = (n) => [...document.querySelectorAll('.ctx-btn')].find((b) => b.getAttribute('aria-label') === n || b.textContent.trim() === n)
    return {
      listo: vis(document.querySelector('.ctx-btn.is-primary .ctx-label')),
      viñetas: vis(btn('Viñetas').querySelector('.ctx-label')),
      pendientes: vis(btn('Lista de pendientes').querySelector('.ctx-label')),
    }
  })
  check('(celular) al escribir: «Listo» con texto y las listas solo con ícono', labels.listo && !labels.viñetas && !labels.pendientes, JSON.stringify(labels))
  const bar = await page.locator('.ctx').boundingBox()
  check('(celular) la barra de edición cabe en la pantalla', bar.x >= 0 && bar.x + bar.width <= 390, JSON.stringify(bar))
  const tb = await page.getByRole('button', { name: 'Lista de pendientes' }).boundingBox()
  await tap(centerOf(tb).x, centerOf(tb).y)
  await page.keyboard.type('Llamar al banco')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Comprar pan')
  const editing = page.locator('.note.is-editing')
  const n = await editing.locator('li.task-item').count()
  check('(celular) el botón de pendientes arma la lista', n === 2, `hay ${n}`)
  const cb2 = await editing.locator('.task-check').first().boundingBox()
  await tap(centerOf(cb2).x, centerOf(cb2).y)
  s = await getState(page)
  const kept = await page.evaluate(() => !!document.activeElement?.closest?.('.ProseMirror'))
  check('(celular) marcar mientras escribes mantiene el teclado abierto', s.editingId !== null && kept, `editing=${s.editingId} enfocado=${kept}`)
  await page.waitForTimeout(900)
  await shot(page, 'e2-cel-editando')

  // Cerrar y marcar el segundo con el posit cerrado
  const done = await page.getByRole('button', { name: 'Listo' }).boundingBox()
  await tap(centerOf(done).x, centerOf(done).y)
  await page.waitForTimeout(300)
  const cb3 = await page.locator('.note.is-selected .task-check').nth(1).boundingBox()
  await tap(centerOf(cb3).x, centerOf(cb3).y)
  await page.waitForTimeout(1200)
  const all = await page.evaluate(() => [...document.querySelectorAll('.note.is-selected li.task-item')].map((li) => li.dataset.checked === 'true'))
  s = await getState(page)
  check('(celular) con el posit ya cerrado también se marca con un toque', all.length === 2 && all.every(Boolean) && s.editingId === null, JSON.stringify(all))
  await shot(page, 'e2-cel-lista')
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
