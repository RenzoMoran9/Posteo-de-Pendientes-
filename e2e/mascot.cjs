/*
 * Prueba con un navegador real (Chromium): la mascota de Claude.
 *   - se ve sobre el estuche, hecha de bloques en 3D (caras de CSS con perspectiva y luz)
 *   - mira al cursor, al dedo y al cursor de escritura; parpadea; se duerme y se despierta
 *   - saluda, comenta lo que escribes (con sugerencias que se pueden aceptar), celebra los pendientes
 *   - al tocarla se abre la conversación con Claude; «Que calle» / «Ocultar» están en sus ajustes (y volver a mostrarla)
 *   - la nube de comentarios (con sus botones) sale sola; aquí se provoca con mascotDebug.poke()
 *   - PC: ratón y teclado · Celular: toques reales, sin estorbar al estuche ni al teclado
 *
 * Uso:  npm run build && node e2e/mascot.cjs
 */
const { chromium } = require('playwright')
const { startPreview } = require('./serve.cjs')
const { check, near, centerOf, shot, getState, open, waitSaved, consoleErrors, finish } = require('./lib.cjs')

const mstate = (page) =>
  page.evaluate(() => {
    const s = window.__posits.mascot.getState()
    return { mood: s.mood, asleep: s.asleep, talking: s.talking, bubble: s.bubble ? { text: s.bubble.text, chips: s.bubble.chips.map((c) => c.label) } : null }
  })
const mode = (page) => page.evaluate(() => window.__posits.store.getState().settings.mascot)
const bubble = (page) => page.locator('.mb')
/** Cuánto se corrieron los ojos sobre la cara (en u, las unidades del modelo). */
const pupils = (page) =>
  page.evaluate(() => {
    const g = document.querySelector('.m-eyes')
    return { x: parseFloat(g.style.getPropertyValue('--ex')) || 0, y: parseFloat(g.style.getPropertyValue('--ey')) || 0 }
  })
/** Escala (ancho, alto) con la que se dibuja el ojo izquierdo, y su recorte. */
const eyeShape = (page) =>
  page.evaluate(() => {
    const e = document.querySelector('.m-eye-l')
    const cs = getComputedStyle(e)
    const m = new DOMMatrixReadOnly(cs.transform)
    return { sx: m.a, sy: m.d, sv: parseFloat(cs.getPropertyValue('--sy')), clip: cs.clipPath }
  })
const armAngle = (page, sel) => page.evaluate((q) => parseFloat(getComputedStyle(document.querySelector(q)).rotate) || 0, sel)
const tilt = (page) =>
  page.evaluate(() => {
    const t = document.querySelector('.m-tilt')
    return { ry: parseFloat(t.style.getPropertyValue('--ry')) || 0, rx: parseFloat(t.style.getPropertyValue('--rx')) || 0 }
  })
const display = (page, sel) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).display, sel)
const inside = (b, w, h, pad = 0) => b.x >= pad && b.y >= pad && b.x + b.width <= w - pad && b.y + b.height <= h - pad
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
/** La mascota pierde el azar: con esto sus sugerencias salen siempre. */
const fixRng = (page, v = 0.05) => page.evaluate((x) => (window.__posits.mascotDebug.brain.rng = () => x), v)
const resetBrain = (page) => page.evaluate(() => window.__posits.mascotDebug.brain.reset())
const waitBubble = (page, ms = 4000) => page.waitForSelector('.mb', { timeout: ms })
/** Provoca la nube con los ajustes (lo que antes hacía tocar a la mascota; ahora tocarla abre la conversación). */
const poke = (page) => page.evaluate(() => window.__posits.mascotDebug.poke())
const chatOpen = (page) => page.evaluate(() => window.__posits.chat.getState().open)
const noBubbleFor = async (page, ms) => {
  await page.waitForTimeout(ms)
  return (await bubble(page).count()) === 0
}

// ───────────────────────────── PC ─────────────────────────────

async function desktop(browser, url) {
  console.log('\n▶ PC (1280×800): aspecto 3D, mirada, parpadeo, saludo, comentarios y ajustes')
  const { ctx, page } = await open(browser, url, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 }, 'debug', false)

  // 1 · Se ve, con capas en 3D, en la esquina y sin tapar el estuche
  const m = page.locator('.mascot')
  await m.waitFor()
  const mb = await m.boundingBox()
  const cs = await page.locator('.case').boundingBox()
  check('la mascota se ve en la esquina de abajo a la derecha, entera y sin tapar el estuche', inside(mb, 1280, 800, 4) && mb.x > cs.x + cs.width && mb.width >= 100, JSON.stringify({ mb, cs }))
  const model = await page.evaluate(() => {
    const faces = [...document.querySelectorAll('.m-tilt .fc')]
    const bg = (sel) => getComputedStyle(document.querySelector(sel)).backgroundImage
    return {
      perspective: getComputedStyle(document.querySelector('.m-stage')).perspective,
      style: getComputedStyle(document.querySelector('.m-tilt')).transformStyle,
      faces: faces.length,
      distinct: new Set(faces.map((f) => getComputedStyle(f).transform)).size,
      hidden: faces.every((f) => getComputedStyle(f).backfaceVisibility === 'hidden'),
      bodyFaces: document.querySelectorAll('.m-body .fc').length,
      legs: document.querySelectorAll('.m-leg').length,
      arms: document.querySelectorAll('.m-arm').length,
      eyes: document.querySelectorAll('.m-eye').length,
      tones: new Set([bg('.m-body .fc-f'), bg('.m-body .fc-t'), bg('.m-body .fc-l'), bg('.m-body .fc-r'), getComputedStyle(document.querySelector('.m-body .fc-b')).backgroundColor]).size,
    }
  })
  check('es un modelo 3D de verdad: bloques hechos con caras en un escenario con perspectiva', model.perspective !== 'none' && model.style === 'preserve-3d' && model.faces >= 28 && model.distinct >= 5 && model.hidden, JSON.stringify(model))
  check('…un cuerpo de cinco caras, dos bracitos, cuatro patas y dos ojos', model.bodyFaces === 5 && model.arms === 2 && model.legs === 4 && model.eyes === 2, JSON.stringify(model))
  check('…con luz: cada cara del cuerpo tiene un tono distinto', model.tones === 5, JSON.stringify(model))
  check('el botón tiene nombre para lectores de pantalla', ((await page.locator('.mascot-figure').getAttribute('aria-label')) || '').includes('Claude'))

  // 2 · Se presenta la primera vez, escribiendo el texto y moviendo la boca
  await waitBubble(page, 4500)
  check('la primera vez se presenta con una nube (y los lectores de pantalla la oyen entera)', (await page.locator('.mb .sr-only[role="status"]').count()) === 1 && (await page.locator('.mb-text[aria-hidden="true"]').count()) === 1)
  await page.waitForTimeout(200)
  const talking = (await mstate(page)).talking
  check('mientras la nube «escribe», la mascota está hablando', talking)
  await page.waitForTimeout(3200)
  const st = await mstate(page)
  check('el texto se completa y se presenta («la mascota de Claude»)', (st.bubble?.text || '').includes('mascota de Claude') && !st.talking, JSON.stringify(st))
  check('la nube cabe en la pantalla y su contorno se dibuja (nube con bultos)', inside(await bubble(page).boundingBox(), 1280, 800, 0) && ((await page.locator('.mb-cloud-body').first().getAttribute('d')) || '').split('C').length > 8)
  check('recuerda que ya se presentó', (await page.evaluate(() => window.__posits.store.getState().settings.mascotMet)) === true)
  await shot(page, 'mascota-pc-01-saludo')
  await bubble(page).click()
  await page.waitForTimeout(150)
  check('tocar la nube la cierra', (await bubble(page).count()) === 0)

  // 2b · Se arrastra a otro sitio y ahí se queda
  const fig = await page.locator('.mascot-figure').boundingBox()
  await page.mouse.move(centerOf(fig).x, centerOf(fig).y)
  await page.mouse.down()
  await page.mouse.move(900, 600, { steps: 8 })
  await page.mouse.move(400, 500, { steps: 10 })
  check('mientras se arrastra, la mascota se agarra (sorprendida) y no se abre ninguna nube', (await m.getAttribute('data-dragging')) !== null && (await m.getAttribute('data-mood')) === 'surprised')
  const legsDangle = await page.evaluate(() => [...document.querySelectorAll('.m-leg')].map((l) => getComputedStyle(l).animationName))
  check('…y en brazos las patitas cuelgan y patalean', legsDangle.length === 4 && legsDangle.every((n) => n.startsWith('m-dangle')), JSON.stringify(legsDangle))
  await page.mouse.up()
  await page.waitForTimeout(400)
  let moved = await m.boundingBox()
  const pos = await page.evaluate(() => window.__posits.store.getState().settings.mascotPos)
  check('al soltarla se queda donde la dejaste (y se guarda)', !!pos && near(centerOf(moved).x, 400, 6) && near(centerOf(moved).y, 500, 6), JSON.stringify({ pos, moved }))
  check('soltarla no cuenta como un toque (no abre la nube)', (await bubble(page).count()) === 0)
  await page.mouse.move(centerOf(moved).x, centerOf(moved).y)
  await page.mouse.down()
  await page.mouse.move(640, 5, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  moved = await m.boundingBox()
  const topBar = await page.locator('.topbar').boundingBox()
  check('no se deja llevar tan arriba que la nube se salga: queda bajo la barra con sitio para hablar', moved.y >= topBar.y + topBar.height + 200, JSON.stringify({ moved, topBar }))
  await poke(page)
  await waitBubble(page, 1500)
  await page.waitForTimeout(3300)
  const s2b = await mstate(page)
  check('al tocarla en su nuevo sitio, la nube sale del lado que cabe y ofrece devolverla', (await bubble(page).getAttribute('data-side')) !== null && s2b.bubble.chips.includes('A su sitio') && inside(await bubble(page).boundingBox(), 1280, 800, 0), JSON.stringify(s2b))
  await shot(page, 'mascota-pc-08-arrastrada')
  await waitSaved(page)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(700)
  const back = await m.boundingBox()
  check('el sitio se recuerda al recargar', near(back.x, moved.x, 3) && near(back.y, moved.y, 3), JSON.stringify({ back, moved }))
  await page.waitForTimeout(2300) // que pase el saludo de la visita
  await page.evaluate(() => window.__posits.mascot.getState().hush())
  await poke(page)
  await waitBubble(page, 1500)
  await page.waitForTimeout(3300)
  await page.getByRole('button', { name: 'A su sitio' }).click()
  await page.waitForTimeout(500)
  const home = await m.boundingBox()
  check('«A su sitio» la devuelve a su lugar de siempre (esquina, sobre el estuche)', (await page.evaluate(() => window.__posits.store.getState().settings.mascotPos)) === null && home.x > 1100 && home.y > 600, JSON.stringify(home))

  // 3 · Mira al cursor
  await page.mouse.move(80, 420)
  await page.waitForTimeout(450)
  let p = await pupils(page)
  let t = await tilt(page)
  check('con el cursor a la izquierda, los ojos y el cuerpo miran a la izquierda', p.x < -0.3 && t.ry < -5, JSON.stringify({ p, t }))
  await shot(page, 'mascota-pc-02-mira-izquierda')
  await page.mouse.move(1270, 300)
  await page.waitForTimeout(450)
  p = await pupils(page)
  t = await tilt(page)
  check('con el cursor a la derecha, miran a la derecha', p.x > 0.1 && t.ry > 0, JSON.stringify({ p, t }))
  await page.mouse.move(1200, 4)
  await page.waitForTimeout(450)
  p = await pupils(page)
  t = await tilt(page)
  check('con el cursor arriba, miran arriba y el cuerpo se inclina hacia atrás', p.y < -0.3 && t.rx > 3, JSON.stringify({ p, t }))
  check('los ojos nunca se salen de la cara', Math.abs(p.x) <= 1.26 && Math.abs(p.y) <= 1.01, JSON.stringify(p))

  // 4 · Parpadea
  await page.waitForFunction(() => document.querySelector('.mascot')?.hasAttribute('data-blink'), null, { timeout: 9000 })
  const blinkShape = await eyeShape(page)
  check('parpadea sola de vez en cuando (los ojos se aplastan como una rayita)', blinkShape.sv < 0.2, JSON.stringify(blinkShape))
  await page.waitForFunction(() => !document.querySelector('.mascot')?.hasAttribute('data-blink'), null, { timeout: 1000 })

  // 5 · Mira el cursor de escritura cuando escribes (con el ratón quieto)
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  await page.keyboard.type('Hola')
  await page.waitForTimeout(3400)
  const caret = await page.evaluate(() => {
    const id = window.__posits.store.getState().editingId
    const el = document.querySelector(`[data-note-id="${id}"]`)
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  const eyeC = await m.boundingBox()
  p = await pupils(page)
  const wantX = Math.sign(caret.x - (eyeC.x + eyeC.width / 2))
  check('escribiendo, con el ratón quieto, mira al posit donde escribes', wantX !== 0 && Math.sign(p.x) === wantX && Math.abs(p.x) > 0.15, JSON.stringify({ p, caret, eyeC }))

  // 6 · Comenta lo que escribes: al hacer una pausa, no mientras tecleas
  await fixRng(page, 0.05)
  await resetBrain(page)
  await page.keyboard.type(' Llamar urgente al proveedor')
  const quiet = await noBubbleFor(page, 1200)
  check('mientras tecleas no te interrumpe', quiet)
  await waitBubble(page, 3500)
  let s2 = await mstate(page)
  check('al hacer una pausa comenta lo escrito («urgente») con un botón para aceptar', s2.bubble && s2.bubble.chips.includes('Pintar de rojo'), JSON.stringify(s2))
  check('…y se le nota el ánimo (sorprendida por lo urgente)', ['surprised', 'idle'].includes(s2.mood))
  const talkAnim = await page.evaluate(() => ({ rig: getComputedStyle(document.querySelector('.m-rig')).animationName, arm: getComputedStyle(document.querySelector('.m-arm-l')).animationName }))
  check('…asintiendo y moviendo los bracitos mientras «escribe»', (await m.getAttribute('data-talking')) === '1' && talkAnim.rig === 'm-nod' && talkAnim.arm === 'm-flap-l', JSON.stringify(talkAnim))
  await shot(page, 'mascota-pc-03-sugerencia')
  const noteId = await page.evaluate(() => window.__posits.store.getState().editingId)
  await page.waitForTimeout(3300) // que termine de escribirse (los botones aparecen al final)
  await page.getByRole('button', { name: 'Pintar de rojo' }).click()
  await page.waitForTimeout(200)
  const after = await page.evaluate((id) => ({ color: window.__posits.store.getState().notes[id].color, editing: window.__posits.store.getState().editingId }), noteId)
  check('aceptar la sugerencia pinta el posit de rojo', after.color.toLowerCase() === '#ef6a62', JSON.stringify(after))
  check('…sin sacarte del posit (sigues escribiendo)', after.editing === noteId && (await page.evaluate(() => !!document.activeElement?.closest?.('.ProseMirror'))))
  check('…y la nube se va y la mascota se alegra', (await bubble(page).count()) === 0 && (await mstate(page)).mood === 'happy')

  // 7 · No es pesada: otro comentario enseguida no sale
  await page.keyboard.type(' y la factura')
  check('no vuelve a hablar hasta pasado un rato (no insiste)', await noBubbleFor(page, 3200))

  // 8 · Sugerencia de ícono: se pega en el posit sin quitarte el teclado
  await resetBrain(page)
  await page.keyboard.press('Enter')
  await page.keyboard.type('Llamar a Juan')
  await waitBubble(page, 5000)
  await page.waitForTimeout(3300)
  s2 = await mstate(page)
  check('con «llamar» ofrece poner un teléfono', s2.bubble && s2.bubble.chips.includes('Poner teléfono'), JSON.stringify(s2))
  await page.getByRole('button', { name: 'Poner teléfono' }).click()
  await page.waitForTimeout(250)
  const phone = await page.evaluate((id) => Object.values(window.__posits.store.getState().stickers).filter((x) => x.noteId === id && x.icon === 'telefono').length, noteId)
  check('aceptar pega el ícono de teléfono en la esquina del posit', phone === 1)
  check('…y se sigue escribiendo (ni el posit ni el teclado se cerraron)', (await getState(page)).editingId === noteId && (await page.evaluate(() => window.__posits.store.getState().selectedStickerId)) === null)
  await shot(page, 'mascota-pc-04-icono-pegado')
  await page.getByRole('button', { name: 'Listo' }).click()

  // 8b · Cansancio: ofrece pedirle ayuda al asistente, y el botón abre la conversación con la pregunta ya enviada
  await resetBrain(page)
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  await page.keyboard.type('Ya no puedo más, mucho trabajo')
  await waitBubble(page, 5000)
  await page.waitForTimeout(3300)
  s2 = await mstate(page)
  check('ante el cansancio ofrece «Pedirle ayuda al asistente»', !!s2.bubble && s2.bubble.chips.includes('Pedirle ayuda al asistente'), JSON.stringify(s2))
  await page.getByRole('button', { name: 'Pedirle ayuda al asistente' }).click()
  await page.waitForSelector('.chat')
  await page.waitForFunction(() => window.__posits.chat.getState().messages.length >= 2 && window.__posits.chat.getState().status === 'idle', null, { timeout: 5000 })
  const asked = await page.evaluate(() => window.__posits.chat.getState().messages.map((m) => ({ role: m.role, text: m.text })))
  check('…abre la conversación, envía la pregunta y contesta', asked[0].role === 'user' && asked[0].text.includes('mucha carga de trabajo') && asked[1].role === 'assistant' && asked[1].text.length > 10, JSON.stringify(asked))
  check('…y la nube se fue (con la conversación abierta la mascota no comenta sola)', (await bubble(page).count()) === 0)
  await page.evaluate(() => window.__posits.chat.getState().clear())
  await page.getByRole('button', { name: 'Cerrar la conversación' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Listo' }).click().catch(() => {})

  // 9 · Celebra los pendientes
  await resetBrain(page)
  const box1 = await page.locator('.note').first().locator('.task-check').first().boundingBox()
  await page.mouse.click(centerOf(box1).x, centerOf(box1).y)
  await page.waitForTimeout(250)
  await page.waitForTimeout(250)
  const cheer = { eye: await eyeShape(page), arm: await armAngle(page, '.m-arm-l'), party: await display(page, '.m-party') }
  check('al marcar un pendiente, la mascota festeja (ojos como «^ ^», brazos arriba y destellos)', (await mstate(page)).mood === 'happy' && cheer.eye.clip.includes('50% 6%') && cheer.arm > 20 && cheer.party === 'inline', JSON.stringify(cheer))
  await waitBubble(page, 2500)
  s2 = await mstate(page)
  check('…y dice cuántos van («Van 2 de 5»)', /2/.test(s2.bubble?.text || '') && /5/.test(s2.bubble?.text || ''), JSON.stringify(s2))
  await shot(page, 'mascota-pc-05-festejo')
  await bubble(page).click()

  // 10 · Al tocarla se abre la conversación; los ajustes de la mascota están ahí
  await page.mouse.move(600, 300)
  await page.locator('.mascot-figure').click()
  await page.waitForSelector('.chat')
  check('al tocarla se abre la conversación con el asistente (y no una nube)', (await chatOpen(page)) && (await bubble(page).count()) === 0 && (await page.locator('.chat').getAttribute('aria-label')) === 'Conversación con el asistente')
  await page.waitForTimeout(500)
  const cbox = await page.locator('.chat').boundingBox()
  const mbox = await m.boundingBox()
  check('el panel queda sobre la mascota, entero en pantalla y sin taparla', inside(cbox, 1280, 800, 2) && cbox.y + cbox.height <= mbox.y + 4, JSON.stringify({ cbox, mbox }))
  const lookChat = await pupils(page)
  const inputBox = await page.locator('[data-chat-input]').boundingBox()
  await page.mouse.move(mbox.x + mbox.width / 2, mbox.y + mbox.height / 2) // el cursor sobre ella: no cuenta como mirada
  await page.waitForTimeout(3300)
  const lookInput = await pupils(page)
  check('con el panel abierto, la mascota mira hacia el campo donde se escribe (a su izquierda y arriba)', inputBox.x + inputBox.width / 2 < mbox.x && lookInput.x < -0.2 && lookInput.y < 0, JSON.stringify({ lookChat, lookInput, inputBox, mbox }))
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.waitForTimeout(200)
  check('los ajustes traen «Que calle» y «Ocultar»', (await page.getByRole('button', { name: 'Que calle' }).count()) === 1 && (await page.getByRole('button', { name: 'Ocultar', exact: true }).count()) === 1)
  await page.getByRole('button', { name: 'Que calle' }).click()
  await page.waitForTimeout(200)
  check('«Que calle» la deja en modo callada (sigue a la vista, sin nubes)', (await mode(page)) === 'quiet' && (await m.getAttribute('data-quiet')) === '1' && (await bubble(page).count()) === 0)
  check('…y el botón cambia a «Que hable»', (await page.getByRole('button', { name: 'Que hable' }).count()) === 1)
  await page.getByRole('button', { name: 'Cerrar la conversación' }).click()
  await page.waitForTimeout(200)
  check('cerrar la conversación quita el panel', (await page.locator('.chat').count()) === 0 && !(await chatOpen(page)))
  await resetBrain(page)
  await page.getByRole('button', { name: 'Nuevo posit' }).click()
  await page.waitForSelector('.note.is-editing')
  await page.keyboard.type('Entregar hoy urgente')
  check('callada no comenta lo que escribes', await noBubbleFor(page, 3400))
  await page.getByRole('button', { name: 'Listo' }).click()
  check('callada sigue mirando: las pupilas se mueven con el cursor', (await page.mouse.move(60, 400), await page.waitForTimeout(400), (await pupils(page)).x < -0.3))
  await poke(page)
  await waitBubble(page, 1500)
  await page.waitForTimeout(3300)
  s2 = await mstate(page)
  check('aunque esté callada, si se le toca la nube contesta (y ofrece «Que hable»)', !!s2.bubble && s2.bubble.chips[0] === 'Que hable', JSON.stringify(s2))
  await page.getByRole('button', { name: 'Ocultar' }).click()
  await page.waitForTimeout(250)
  check('«Ocultar» la esconde: solo asoma la mascotita', (await mode(page)) === 'off' && (await page.locator('.mascot').count()) === 0 && (await page.locator('.mascot-peek').isVisible()))
  await shot(page, 'mascota-pc-06-escondida')
  await waitSaved(page)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(600)
  check('el ajuste se recuerda al recargar (sigue escondida)', (await mode(page)) === 'off' && (await page.locator('.mascot-peek').count()) === 1)
  await page.locator('.mascot-peek').click()
  await page.waitForTimeout(300)
  check('tocar la mascotita la vuelve a mostrar, despierta y avisando', (await mode(page)) === 'on' && (await page.locator('.mascot').count()) === 1 && ((await mstate(page)).bubble?.text || '').includes('Aquí estoy'))
  await bubble(page).click()

  // 11 · Se duerme y se despierta
  await page.evaluate(() => window.__posits.mascotDebug.sleep(true))
  await page.waitForTimeout(500)
  const asleep = { eye: await eyeShape(page), zzz: await display(page, '.m-zzz') }
  check('dormida: ojos cerrados (rayitas) y las «zzz»', (await m.getAttribute('data-mood')) === 'sleep' && asleep.eye.sy < 0.3 && asleep.zzz === 'inline', JSON.stringify(asleep))
  await shot(page, 'mascota-pc-07-dormida')
  check('dormida no habla', (await mstate(page)).bubble === null)
  await page.mouse.move(700, 350)
  await page.waitForTimeout(400)
  check('al mover el ratón se despierta (sorprendida)', (await mstate(page)).asleep === false && (await m.getAttribute('data-mood')) === 'surprised')

  // 12 · Saludo con resumen (una vez por sesión)
  await page.evaluate(() => sessionStorage.removeItem('posits:greeted'))
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await waitBubble(page, 4500)
  await page.waitForTimeout(3200)
  const greet = (await mstate(page)).bubble?.text || ''
  check('en la siguiente visita saluda según la hora y resume los pendientes', /^(Buenos días|Buenas tardes|Buenas noches)\./.test(greet) && /pendiente/.test(greet), greet)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  check('pero solo una vez por sesión: al recargar no repite el saludo', await noBubbleFor(page, 3200))

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
  console.log('\n▶ Celular (390×844, toques reales): sitio, dedo, teclado y pantallas angostas')
  const { ctx, page } = await open(browser, url, IPHONE, 'debug', false)
  const m = page.locator('.mascot')
  await m.waitFor()
  const tap = async (x, y) => {
    await page.touchscreen.tap(x, y)
    await page.waitForTimeout(120)
  }

  let mb = await m.boundingBox()
  let dock = await page.locator('.dock').boundingBox()
  check('en el celular se apoya sobre el estuche sin tapar ningún botón', mb.y + mb.height <= dock.y + 3 && inside(mb, 390, 844, 2), JSON.stringify({ mb, dock }))
  check('…y mide lo justo (≈ 82 px)', near(mb.width, 82, 2), `${mb.width}`)

  // La presentación cabe y no estorba
  await waitBubble(page, 4500)
  await page.waitForTimeout(3300)
  const b1 = await bubble(page).boundingBox()
  const top = await page.locator('.topbar').boundingBox()
  check('la nube cabe en la pantalla del celular, debajo de la barra de arriba', inside(b1, 390, 844, 4) && b1.y >= top.y + top.height, JSON.stringify({ b1, top }))
  await shot(page, 'mascota-cel-01-saludo')
  await tap(centerOf(b1).x, centerOf(b1).y)
  check('un toque en la nube la cierra', (await bubble(page).count()) === 0)

  // Sube cuando aparece la barra de acciones del posit
  const y0 = (await m.boundingBox()).y
  const noteBox = await page.locator('.note').first().boundingBox()
  await tap(noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height * 0.75)
  await page.waitForTimeout(500)
  mb = await m.boundingBox()
  dock = await page.locator('.dock').boundingBox()
  check('al aparecer la barra de acciones, la mascota sube de un saltito y sigue sin taparla', mb.y < y0 - 20 && mb.y + mb.height <= dock.y + 3, JSON.stringify({ y0, mb, dock }))

  // Mira con el dedo
  await tap(30, 300)
  await page.waitForTimeout(450)
  let p = await pupils(page)
  check('mira hacia donde tocas con el dedo', p.x < -0.3, JSON.stringify(p))

  // La nube con sus ajustes: los botones se pueden pulsar con el dedo
  await poke(page)
  await waitBubble(page, 1500)
  await page.waitForTimeout(3300)
  const b2 = await bubble(page).boundingBox()
  const chip = await page.locator('.mb-chip').first().boundingBox()
  check('la nube cabe en la pantalla y sus botones miden ≥ 36 px', inside(b2, 390, 844, 4) && chip.height >= 36 && chip.width >= 60, JSON.stringify({ b2, chip }))
  await shot(page, 'mascota-cel-02-toque')
  // la nube se va sola tras unos segundos (y la captura tarda): se vuelve a llamar justo antes de tocar el botón
  await poke(page)
  await waitBubble(page, 1500)
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Que calle' }).tap()
  await page.waitForTimeout(250)
  check('«Que calle» funciona con el dedo', (await mode(page)) === 'quiet')
  await page.evaluate(() => window.__posits.store.getState().setMascotMode('on'))

  // Se arrastra con el dedo, para apartarla de lo que tapa
  const cdp = await ctx.newCDPSession(page)
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
  async function drag(from, to, steps = 14) {
    await send('touchStart', [{ x: from.x, y: from.y, id: 1 }])
    await page.waitForTimeout(30)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      await send('touchMove', [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, id: 1 }])
      await page.waitForTimeout(16)
    }
    await send('touchEnd', [])
    await page.waitForTimeout(150)
  }
  await page.evaluate(() => window.__posits.mascot.getState().hush())
  await page.waitForTimeout(300)
  await page.locator('.mascot-figure').scrollIntoViewIfNeeded()
  const f0 = centerOf(await page.locator('.mascot-figure').boundingBox())
  const view0 = (await getState(page)).view
  await drag(f0, { x: 90, y: 470 })
  await page.waitForTimeout(400)
  const dragged = await m.boundingBox()
  const posT = await page.evaluate(() => window.__posits.store.getState().settings.mascotPos)
  check('con el dedo se arrastra a otro sitio y ahí se queda', !!posT && near(centerOf(dragged).x, 90, 8) && near(centerOf(dragged).y, 470, 8), JSON.stringify({ posT, dragged }))
  const view1 = (await getState(page)).view
  check('…sin mover el tablero de atrás ni abrir una nube', (await bubble(page).count()) === 0 && near(view1.x, view0.x, 0.5) && near(view1.y, view0.y, 0.5) && near(view1.z, view0.z, 1e-6), JSON.stringify({ view0, view1 }))
  check('…y soltarla no abre la conversación', !(await chatOpen(page)))
  await poke(page)
  await waitBubble(page, 1500)
  await page.waitForTimeout(3300)
  const bl = await bubble(page).boundingBox()
  check('en la parte izquierda la nube se abre hacia la derecha y cabe en la pantalla', (await bubble(page).getAttribute('data-side')) === 'left' && inside(bl, 390, 844, 2), JSON.stringify(bl))
  await shot(page, 'mascota-cel-04-arrastrada')
  await page.getByRole('button', { name: 'A su sitio' }).tap()
  await page.waitForTimeout(500)
  const homeP = await m.boundingBox()
  check('«A su sitio» la devuelve sobre el estuche', (await page.evaluate(() => window.__posits.store.getState().settings.mascotPos)) === null && homeP.x > 290, JSON.stringify(homeP))

  // Escribiendo (teclado abierto): se hace chica y no tapa la barra
  await page.evaluate(() => window.__posits.mascot.getState().hush())
  await tap(5, 500)
  await page.getByRole('button', { name: 'Nuevo posit' }).tap()
  await page.waitForSelector('.note.is-editing')
  await page.waitForTimeout(500)
  const scale = await page.evaluate(() => {
    const mm = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.mascot')).transform)
    return mm.a
  })
  mb = await m.boundingBox()
  dock = await page.locator('.dock').boundingBox()
  check('con el teclado abierto se hace más chica (≈ 70 %) y sigue sobre la barra', near(scale, 0.7, 0.03) && mb.y + mb.height <= dock.y + 3, JSON.stringify({ scale, mb, dock }))
  await shot(page, 'mascota-cel-03-escribiendo')
  await ctx.close()

  // Pantallas angostas
  for (const [w, h] of [
    [360, 740],
    [320, 568],
  ]) {
    const c2 = await browser.newContext({ ...IPHONE, viewport: { width: w, height: h } })
    const p2 = await c2.newPage()
    await p2.goto(`${url}?debug`)
    await p2.evaluate(() => document.fonts.ready)
    await p2.waitForSelector('.world[data-ready]', { state: 'attached' })
    await p2.waitForSelector('.mb', { timeout: 4500 })
    await p2.waitForTimeout(3300)
    const mm = await p2.locator('.mascot').boundingBox()
    const bb = await p2.locator('.mb').boundingBox()
    const dk = await p2.locator('.dock').boundingBox()
    const tb = await p2.locator('.topbar').boundingBox()
    const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    check(`${w} px: la mascota y su nube caben, sin tapar el estuche ni la barra de arriba`, inside(mm, w, h, 2) && inside(bb, w, h, 2) && mm.y + mm.height <= dk.y + 3 && bb.y >= tb.y + tb.height - 1 && !overlaps(mm, dk) && !overflow, JSON.stringify({ mm, bb, dk, tb }))
    if (w === 320) await p2.screenshot({ path: require('./lib.cjs').OUT + '/mascota-cel-320.png' })
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
