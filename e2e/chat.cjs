/*
 * Prueba con un navegador real (Chromium): la conversación con Claude.
 * No se habla con Anthropic de verdad: la API se simula interceptando las peticiones a api.anthropic.com (con eventos SSE
 * iguales a los reales) y la cuenta de Claude del enlace de prueba se simula con un `window.claude.use('sample')` falso.
 *   - modo sencillo (sin cuenta ni clave): responde por reglas, propone, aplica y deshace
 *   - con clave propia: la guarda, pide consentimiento, manda la petición correcta, muestra la propuesta, la aplica y la deshace
 *   - con la cuenta de Claude del enlace de prueba: sin clave, respuesta en vivo, permiso denegado → modo sencillo
 *   - errores (clave mala, límite), detener, ajustes (modelo, privacidad), conversación guardada al recargar
 *   - IA gratuita: Gemini (Google) y Groq simulados, y «otra IA» compatible con OpenAI: elegir, sacar la clave, probar, conversar, errores
 *   - voz: dictado y lectura en voz alta (simulados)
 *   - PC: ratón y teclado · Celular: toques reales, hoja a todo el ancho
 *
 * Uso:  npm run build && node e2e/chat.cjs
 */
const { chromium } = require('playwright')
const { startPreview } = require('./serve.cjs')
const { check, centerOf, shot, waitSaved, consoleErrors, finish } = require('./lib.cjs')

const inside = (b, w, h, pad = 0) => b.x >= pad && b.y >= pad && b.x + b.width <= w - pad && b.y + b.height <= h - pad

const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mobile/15E148 Safari/604.1)',
}
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 }

// ───────────── simulación de la API de Anthropic (SSE) ─────────────

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }

function sseBody(text, stop = 'end_turn') {
  const chunks = text.match(/[\s\S]{1,40}/g) || ['']
  const ev = (e, d) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`
  return (
    ev('message_start', { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', content: [], model: 'claude-opus-5-5', stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }) +
    ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) +
    chunks.map((c) => ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: c } })).join('') +
    ev('content_block_stop', { type: 'content_block_stop', index: 0 }) +
    ev('message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 30 } }) +
    ev('message_stop', { type: 'message_stop' })
  )
}

const PROPOSAL =
  'Te propongo poner primero lo que puedes hacer ya y numerarlo, dejando al final lo que ya marcaste.\n\n' +
  '<acciones>\n[{"do":"reorder","note":"n1","list":1,"order":[5,4,3,1]},{"do":"number","note":"n1","list":1}]\n</acciones>'

/** Instala la API falsa. `script` decide qué contestar (por defecto, la propuesta de ordenar y numerar). */
async function mockApi(ctx, state) {
  state.calls = []
  await ctx.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const body = req.postDataJSON()
    state.calls.push({ url: req.url(), headers: req.headers(), body })
    const r = state.next ? state.next(body) : { text: PROPOSAL }
    if (r.status && r.status !== 200) {
      return route.fulfill({ status: r.status, headers: { ...CORS, 'content-type': 'application/json', ...(r.headers || {}) }, body: JSON.stringify({ type: 'error', error: { type: r.type || 'api_error', message: r.message || 'error' } }) })
    }
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/event-stream; charset=utf-8' }, body: sseBody(r.text, r.stop) })
  })
}

// ───────────── simulación de Gemini (Google) y de un servicio compatible con OpenAI (Groq, OpenRouter) ─────────────

const split40 = (text) => text.match(/[\s\S]{1,40}/g) || ['']

/** Lo que manda Gemini con `alt=sse`: un `data:` con un JSON por trozo (y saltos \r\n). */
const geminiBody = (text, finish = 'STOP') =>
  split40(text)
    .map((c, i, all) => `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: c }] }, ...(i === all.length - 1 ? { finishReason: finish } : {}) }] })}\r\n\r\n`)
    .join('')

/** Lo que manda un servicio compatible con OpenAI: trozos con `delta.content` y un `[DONE]` al final. */
const openaiBody = (text, finish = 'stop') =>
  split40(text).map((c) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: c }, finish_reason: null }] })}\n\n`).join('') +
  `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: finish }] })}\n\ndata: [DONE]\n\n`

/** Instala los servicios falsos. `geminiNext` y `openaiNext` deciden qué contestar (por defecto, la propuesta de ordenar y numerar). */
async function mockFree(ctx, state) {
  state.gemini = []
  state.openai = []
  await ctx.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const body = req.postDataJSON()
    state.gemini.push({ url: req.url(), headers: req.headers(), body })
    const r = state.geminiNext ? state.geminiNext(body) : { text: PROPOSAL }
    if (r.status && r.status !== 200) {
      // Google contesta «text/event-stream» aun cuando falla, con un JSON dentro
      const err = { error: { code: r.status, message: r.message || 'error', status: r.apiStatus || 'INVALID_ARGUMENT', ...(r.reason ? { details: [{ reason: r.reason }] } : {}) } }
      return route.fulfill({ status: r.status, headers: { ...CORS, 'content-type': 'text/event-stream' }, body: JSON.stringify(err) })
    }
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/event-stream' }, body: geminiBody(r.text, r.finish) })
  })
  const openai = async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const body = req.postDataJSON()
    state.openai.push({ url: req.url(), headers: req.headers(), body })
    const r = state.openaiNext ? state.openaiNext(body) : { text: PROPOSAL }
    if (r.status && r.status !== 200) return route.fulfill({ status: r.status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ error: { message: r.message || 'error', code: r.code } }) })
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/event-stream' }, body: openaiBody(r.text, r.finish) })
  }
  await ctx.route('https://api.groq.com/**', openai)
  await ctx.route('https://openrouter.ai/**', openai)
}

// ───────────── simulaciones dentro de la página ─────────────

const SAMPLE_SCRIPT = () => {
  const st = (window.__sample = { calls: [], mode: 'ok', text: null, chunks: 4, delay: 120 })
  const PROPOSAL_TEXT =
    'Te propongo numerar tu lista.\n\n<acciones>\n[{"do":"number","note":"n1","list":1}]\n</acciones>'
  const fn = async (input, opts) => {
    st.calls.push({ input: JSON.parse(JSON.stringify(input)), opts: { cache: opts && opts.cache, modelTier: opts && opts.modelTier, hasSignal: !!(opts && opts.signal) } })
    if (st.mode === 'denied') throw { code: 'not_granted', message: 'no' }
    const text = st.text ?? PROPOSAL_TEXT
    const size = Math.ceil(text.length / st.chunks)
    let acc = ''
    for (let i = 0; i < text.length; i += size) {
      await new Promise((r) => setTimeout(r, st.delay))
      if (opts && opts.signal && opts.signal.aborted) throw { code: 'cancelled', message: 'x', text: acc }
      const delta = text.slice(i, i + size)
      acc += delta
      opts.onText({ text: acc, delta })
    }
    return { text: acc, truncated: false, modelTierApplied: opts.modelTier || 'default' }
  }
  window.claude = { use: async (name) => (name === 'sample' ? fn : null) }
}

const VOICE_SCRIPT = () => {
  const def = (name, value) => Object.defineProperty(window, name, { value, configurable: true, writable: true })
  window.__spoken = []
  def(
    'SpeechSynthesisUtterance',
    class {
      constructor(t) {
        this.text = t
      }
    },
  )
  def('speechSynthesis', {
    speak(u) {
      window.__spoken.push({ text: u.text, lang: u.lang })
      setTimeout(() => u.onend && u.onend(), 60)
    },
    cancel() {},
  })
  window.__heard = 'qué debo hacer primero'
  class FakeRecognition {
    start() {
      setTimeout(() => {
        this.onresult && this.onresult({ results: [Object.assign([{ transcript: 'qué debo' }], { isFinal: false })] })
        setTimeout(() => {
          this.onresult && this.onresult({ results: [Object.assign([{ transcript: window.__heard }], { isFinal: true })] })
          this.onend && this.onend()
        }, 120)
      }, 80)
    }
    stop() {
      this.onend && this.onend()
    }
    abort() {}
  }
  def('SpeechRecognition', FakeRecognition)
  def('webkitSpeechRecognition', FakeRecognition)
}

const IGNORED = /status of (401|429|529)|Failed to load resource/

async function openApp(browser, url, opts, { init = [], api = null, free = null, query = 'debug&mascot=quiet', storage = null } = {}) {
  const ctx = await browser.newContext(opts)
  for (const f of init) await ctx.addInitScript(f)
  if (storage) await ctx.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)), storage)
  if (api) await mockApi(ctx, api)
  if (free) await mockFree(ctx, free)
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !IGNORED.test(m.text())) consoleErrors.push(`[${m.type()}] ${m.text()}`)
  })
  page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`))
  await page.goto(`${url}?${query}`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(500)
  return { ctx, page }
}

// ───────────── ayudas ─────────────

const chatState = (page) =>
  page.evaluate(() => {
    const s = window.__posits.chat.getState()
    return { open: s.open, view: s.view, status: s.status, via: s.via, hasKey: s.hasKey, sampleOk: s.sampleOk, settings: s.settings, messages: s.messages.map((m) => ({ role: m.role, text: m.text, via: m.via, note: m.note, streaming: m.streaming, proposal: m.proposal && { state: m.proposal.state, canUndo: m.proposal.canUndo, items: m.proposal.items.length } })) }
  })
const tasks = (page) => page.evaluate(() => [...document.querySelectorAll('.note')[0].querySelectorAll('.task-item')].map((li) => li.querySelector('.task-content').textContent.trim()))
const doneMarks = (page) => page.evaluate(() => [...document.querySelectorAll('.note')[0].querySelectorAll('.task-item')].map((li) => li.dataset.checked === 'true'))
const openChat = async (page, touch) => {
  const b = await page.locator('.mascot-figure').boundingBox()
  if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
  await page.waitForSelector('.chat')
  await page.waitForTimeout(350)
}
const sayIt = async (page, text) => {
  await page.locator('[data-chat-input]').fill(text)
  await page.locator('.chat-round-send').click()
}
const lastBot = (page) => page.locator('.msg-bot').last()
const waitIdle = (page, ms = 15000) => page.waitForFunction(() => window.__posits.chat.getState().status === 'idle', null, { timeout: ms })

const ORIGINAL = [
  'Toca este posit y vuelve a tocarlo para escribir',
  'Marca una casilla: se tacha como con lápiz',
  'Arrástralo desde la cinta',
  'Cambia el color con los marcadores',
  'Pega íconos con el botón de la hojita',
]
const ORDERED = [
  '1. Pega íconos con el botón de la hojita',
  '2. Cambia el color con los marcadores',
  '3. Arrástralo desde la cinta',
  '4. Toca este posit y vuelve a tocarlo para escribir',
  '5. Marca una casilla: se tacha como con lápiz',
]

// ───────────────────────────── PC: modo sencillo ─────────────────────────────

async function simple(browser, url) {
  console.log('\n▶ PC · modo sencillo (sin cuenta de Claude ni clave)')
  const { ctx, page } = await openApp(browser, url, DESKTOP)

  await openChat(page, false)
  let st = await chatState(page)
  check('tocar la mascota abre la conversación, en modo sencillo', st.open && st.via === 'local' && st.sampleOk === false)
  check('se ve el saludo, la explicación de que no hay conexión y las ideas para empezar', (await page.locator('.chat-welcome-title').innerText()).includes('asistente') && (await page.locator('.chat-callout').count()) === 1 && (await page.locator('.chat-suggest .chat-chip').count()) === 4)
  check('no pide consentimiento (en este modo nada sale del aparato)', (await page.locator('.chat-consent').count()) === 0)
  check('el campo de escribir tiene el foco (PC)', await page.evaluate(() => document.activeElement === document.querySelector('[data-chat-input]')))
  check('el estado del encabezado dice «modo sencillo»', (await page.locator('.chat-status').innerText()).includes('modo sencillo'))
  await shot(page, 'chat-pc-01-vacio')

  // Enter envía
  await page.keyboard.type('¿Qué hago primero?')
  await page.keyboard.press('Enter')
  await waitIdle(page)
  st = await chatState(page)
  check('con Enter se envía y contesta por reglas', st.messages.length === 2 && st.messages[1].via === 'local' && /primero/i.test(st.messages[1].text + st.messages[0].text))
  check('la respuesta lleva la etiqueta «respuesta sencilla, sin IA»', (await lastBot(page).locator('.msg-tag').count()) === 1)
  check('el campo se vació y sigue con el foco', (await page.locator('[data-chat-input]').inputValue()) === '')

  // Mayús+Enter baja de renglón
  await page.locator('[data-chat-input]').focus()
  await page.keyboard.type('uno')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('dos')
  check('Mayús+Enter baja de renglón sin enviar', (await page.locator('[data-chat-input]').inputValue()) === 'uno\ndos' && (await chatState(page)).messages.length === 2)
  await page.locator('[data-chat-input]').fill('')

  // Ordenar → propuesta → aplicar → deshacer
  await sayIt(page, 'Ordena mis pendientes')
  await waitIdle(page)
  await page.waitForSelector('.proposal')
  check('«ordena» genera una propuesta (un posit amarillo) con Aplicar y No, gracias', (await page.locator('.proposal').count()) === 1 && (await page.getByRole('button', { name: 'Aplicar' }).count()) === 1 && (await page.getByRole('button', { name: 'No, gracias' }).count()) === 1)
  check('…y todavía no cambió nada en el posit', JSON.stringify(await tasks(page)) === JSON.stringify(ORIGINAL))
  await shot(page, 'chat-pc-02-propuesta')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await page.waitForTimeout(400)
  const after = await tasks(page)
  check('«Aplicar» reordena el posit de verdad (lo hecho pasa al final)', after.at(-1).startsWith('Marca una casilla') && after[0].startsWith('Toca este posit') && (await doneMarks(page)).at(-1) === true, JSON.stringify(after))
  check('…y el posit queda seleccionado para verlo', (await page.evaluate(() => window.__posits.store.getState().selectedId)) !== null)
  check('la propuesta pasa a «Cambios aplicados» y ofrece Deshacer', (await page.locator('.proposal-title').last().innerText()).toLowerCase().includes('aplicados') && (await page.getByRole('button', { name: 'Deshacer' }).count()) === 1)
  await shot(page, 'chat-pc-03-aplicada')
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await page.waitForTimeout(400)
  check('«Deshacer» deja el posit como estaba', JSON.stringify(await tasks(page)) === JSON.stringify(ORIGINAL), JSON.stringify(await tasks(page)))
  check('…y la propuesta queda «deshecha», sin botones', (await page.locator('.proposal[data-state="undone"]').count()) === 1 && (await page.locator('.proposal .chat-btn').count()) === 0)

  // Numerar
  await sayIt(page, 'Numera mi lista por favor')
  await waitIdle(page)
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await page.waitForTimeout(400)
  check('«numera» antepone 1., 2., 3.… a los renglones del posit', (await tasks(page)).every((t, i) => t.startsWith(`${i + 1}. `)), JSON.stringify(await tasks(page)))
  await page.getByRole('button', { name: 'Deshacer' }).click()

  // Lo que no entiende
  await sayIt(page, '¿Cuál es la capital de Francia?')
  await waitIdle(page)
  check('lo que no entiende lo dice y explica qué sí sabe hacer', /sin conexión|no estoy conectado/i.test(await lastBot(page).innerText()) && (await page.locator('.proposal').count()) === 2)

  // No, gracias
  await sayIt(page, 'ordena')
  await waitIdle(page)
  await page.getByRole('button', { name: 'No, gracias' }).click()
  check('«No, gracias» descarta la propuesta sin tocar el posit', (await page.locator('.proposal[data-state="dismissed"]').count()) === 1 && JSON.stringify(await tasks(page)) === JSON.stringify(ORIGINAL))

  // Atajos
  await page.getByRole('button', { name: 'Cerrar la conversación' }).click()
  check('la ✕ cierra el panel', (await page.locator('.chat').count()) === 0)
  await page.mouse.click(60, 400)
  await page.keyboard.press('c')
  await page.waitForSelector('.chat')
  check('la tecla C abre la conversación', (await chatState(page)).open)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('Esc la cierra', (await page.locator('.chat').count()) === 0)
  await page.keyboard.press('c')
  await page.waitForSelector('.chat')
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('Esc dentro de los ajustes vuelve a la conversación (sin cerrarla)', (await page.locator('.chat').count()) === 1 && (await chatState(page)).view === 'chat')

  // La conversación se guarda
  await waitSaved(page)
  await page.waitForTimeout(700)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(600)
  await openChat(page, false)
  st = await chatState(page)
  check('la conversación se recuerda al recargar', st.messages.length >= 8 && st.messages[0].role === 'user', `${st.messages.length}`)
  check('…con las propuestas en su estado (descartada, deshecha), ya sin botones de Deshacer', (await page.locator('.proposal[data-state="dismissed"]').count()) === 1 && (await page.getByRole('button', { name: 'Deshacer' }).count()) === 0)

  // Borrar
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Borrar la conversación' }).click()
  check('«Borrar la conversación» la vacía (y vuelve a la conversación)', (await chatState(page)).messages.length === 0 && (await page.locator('.chat-welcome').count()) === 1)
  await ctx.close()
}

// ───────────────────────────── PC: con clave propia ─────────────────────────────

async function withKey(browser, url) {
  console.log('\n▶ PC · con clave propia (API de Anthropic simulada)')
  const api = {}
  const { ctx, page } = await openApp(browser, url, DESKTOP, { api, init: [VOICE_SCRIPT] })
  await openChat(page, false)

  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('radio', { name: /^Claude/ }).click() // por defecto se ofrece Gemini (gratis); aquí se prueba la clave de Claude
  check('en los ajustes se ve cómo conectar la clave y el aviso de seguridad', (await page.locator('.chat-key-form').count()) === 1 && (await page.locator('.chat-help').first().innerText()).includes('límite de gasto'))
  await page.locator('.chat-key-form input').fill('clave-rara')
  check('avisa si la clave no tiene el formato de Anthropic', (await page.locator('.chat-warn').count()) === 1)
  await page.locator('.chat-key-form input').fill('sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789')
  check('con formato correcto no avisa', (await page.locator('.chat-warn').count()) === 0)
  check('la clave se escribe oculta (y se puede ver)', (await page.locator('.chat-key-form input').getAttribute('type')) === 'password')
  await page.getByRole('button', { name: 'Guardar clave' }).click()
  await page.waitForTimeout(200)
  let st = await chatState(page)
  check('guarda la clave y pasa a usar la API', st.hasKey && st.via === 'api')
  check('la clave queda en este aparato (localStorage), no en la conversación', await page.evaluate(() => localStorage.getItem('posits:claude:key') === 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789' && !localStorage.getItem('posits:chat:v1')?.includes('sk-ant')))
  check('los ajustes ahora muestran «Clave guardada» y «Olvidar clave»', (await page.getByRole('button', { name: 'Olvidar clave' }).count()) === 1)
  await shot(page, 'chat-pc-04-ajustes')
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()

  check('el encabezado dice que usa la clave y el modelo', (await page.locator('.chat-status').innerText()).includes('con tu clave · Claude Opus 5.5'))
  check('antes de la primera consulta pide consentimiento y no deja enviar', (await page.locator('.chat-consent').count()) === 1 && (await page.locator('.chat-round-send').isDisabled()))
  await page.locator('[data-chat-input]').fill('Ordena y numera mi lista')
  check('…aunque haya texto, enviar sigue bloqueado', await page.locator('.chat-round-send').isDisabled())
  await shot(page, 'chat-pc-05-consentimiento')
  await page.getByRole('button', { name: 'Entendido, seguir' }).click()
  await page.waitForTimeout(150)
  check('tras aceptar, desaparece el aviso y se puede enviar', (await page.locator('.chat-consent').count()) === 0 && !(await page.locator('.chat-round-send').isDisabled()))

  // Envío
  api.next = () => ({ text: PROPOSAL })
  await page.locator('.chat-round-send').click()
  await page.waitForFunction(() => window.__posits.mascot.getState().mood === 'think', null, { timeout: 3000 }).catch(() => {})
  await waitIdle(page)
  check('se hizo UNA petición a la API de mensajes, con la clave', api.calls.length === 1 && api.calls[0].url === 'https://api.anthropic.com/v1/messages' && api.calls[0].headers['x-api-key'] === 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789', JSON.stringify(api.calls.map((c) => c.url)))
  const body = api.calls[0].body
  check('…con el modelo elegido, transmisión en vivo y nivel de esfuerzo medio', body.model === 'claude-opus-5-5' && body.stream === true && body.output_config?.effort === 'medium' && body.max_tokens === 16000, JSON.stringify({ m: body.model, s: body.stream, o: body.output_config, t: body.max_tokens }))
  check('…con las instrucciones (solo pendientes, acciones) y sin «thinking» (Opus siempre piensa)', body.system.includes('SOLO') === false && body.system.includes('Solo eso') && body.system.includes('<acciones>') && !('thinking' in body))
  const userTurn = body.messages.at(-1).content
  check('…y la foto del tablero con el posit numerado y su lista', userTurn.includes('<tablero>') && userTurn.includes('[n1] posit Amarillo · 1 de 5 pendientes hechos') && userTurn.includes('1. [ ] Toca este posit') && userTurn.endsWith('Ordena y numera mi lista'))
  st = await chatState(page)
  const bot = st.messages[1]
  check('la respuesta se muestra sin el bloque <acciones> y con su propuesta', bot.via === 'api' && bot.text.startsWith('Te propongo poner primero') && !bot.text.includes('acciones') && bot.proposal?.state === 'pending' && bot.proposal.items === 2, JSON.stringify(bot))
  check('la propuesta detalla los dos cambios', (await page.locator('.proposal-list > li').count()) === 2 && (await page.locator('.proposal').innerText()).includes('Reordenar la lista 1'))
  check('la mascota reacciona a la propuesta (no se queda «pensando»)', (await page.evaluate(() => window.__posits.mascot.getState().mood)) !== 'think')
  await shot(page, 'chat-pc-06-api-propuesta')

  await page.getByRole('button', { name: 'Aplicar' }).click()
  await page.waitForTimeout(500)
  check('«Aplicar» ordena y numera el posit', JSON.stringify(await tasks(page)) === JSON.stringify(ORDERED), JSON.stringify(await tasks(page)))
  check('…manteniendo marcado el pendiente que ya estaba hecho (ahora el último)', (await doneMarks(page)).join() === 'false,false,false,false,true')
  check('…y la mascota festeja', (await page.evaluate(() => window.__posits.mascot.getState().mood)) === 'happy')
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await page.waitForTimeout(400)
  check('«Deshacer» restaura el orden y el texto originales', JSON.stringify(await tasks(page)) === JSON.stringify(ORIGINAL))

  // Segunda consulta: lleva la conversación y lo que pasó con la propuesta
  api.next = () => ({ text: 'De nada. Cuando quieras, seguimos con el resto.' })
  await sayIt(page, 'Gracias')
  await waitIdle(page)
  const turns = api.calls[1].body.messages
  check('la segunda consulta lleva la conversación anterior sin repetir la foto vieja', turns.length === 3 && turns.map((t) => t.role).join() === 'user,assistant,user' && !turns[0].content.includes('<tablero>') && turns[2].content.includes('<tablero>'))
  check('…y le cuenta a Claude que la propuesta se aplicó y luego se deshizo', turns[1].content.includes('aplicó tu propuesta y luego la deshizo'), turns[1].content)

  // Cambiar de modelo
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('radio', { name: /Claude Haiku 4\.5/ }).click()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await sayIt(page, '¿Y ahora?')
  await waitIdle(page)
  const b3 = api.calls[2].body
  check('con Haiku la petición va con ese modelo y sin nivel de esfuerzo (no lo admite)', b3.model === 'claude-haiku-4-5' && !('output_config' in b3), JSON.stringify({ m: b3.model, o: b3.output_config }))
  check('el modelo elegido se recuerda', await page.evaluate(() => JSON.parse(localStorage.getItem('posits:claude')).model === 'claude-haiku-4-5'))

  // Privacidad
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('switch', { name: /Dejar que la IA lea mis posits/ }).uncheck()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await sayIt(page, 'Ayúdame con mis pendientes')
  await waitIdle(page)
  const b4 = api.calls[3].body.messages.at(-1).content
  check('con «Dejar que la IA lea mis posits» apagado, no se envía el texto de los posits', b4.includes('no permitió que leas el contenido') && !b4.includes('Toca este posit') && b4.includes('1 posits'), b4.slice(0, 300))

  // Lectura en voz alta
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('switch', { name: /Leer las respuestas en voz alta/ }).check()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  api.next = () => ({ text: 'Empieza por lo urgente:\n1. Firmar el acta\n2. Enviar el oficio' })
  await sayIt(page, 'Dame un plan corto')
  await waitIdle(page)
  await page.waitForTimeout(200)
  const spoken = await page.evaluate(() => window.__spoken)
  check('con «Leer las respuestas en voz alta» la respuesta se lee (sin viñetas raras y en español)', spoken.length === 1 && spoken[0].text.includes('Firmar el acta') && !spoken[0].text.includes('\n') && /^es/i.test(spoken[0].lang), JSON.stringify(spoken))

  // Dictado
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('switch', { name: /Leer las respuestas en voz alta/ }).uncheck()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  api.next = () => ({ text: 'Primero, lo urgente.' })
  const mic = page.getByRole('button', { name: 'Hablarle por voz' })
  check('con dictado disponible aparece el botón del micrófono', (await mic.count()) === 1)
  const before = api.calls.length
  await mic.click()
  await page.waitForFunction(() => document.querySelector('[data-chat-input]').value.length > 0, null, { timeout: 3000 })
  check('mientras habla, el texto aparece en el campo', (await page.locator('[data-chat-input]').inputValue()).includes('qué debo'))
  await waitIdle(page)
  await page.waitForFunction((n) => window.__posits.chat.getState().messages.length >= n, (await chatState(page)).messages.length, { timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(400)
  const heard = (await chatState(page)).messages.filter((m) => m.role === 'user').at(-1).text
  check('al terminar de hablar, lo dictado se envía solo', heard === 'qué debo hacer primero' && api.calls.length === before + 1, `${heard} / ${api.calls.length}`)

  // Errores
  api.next = () => ({ status: 401, type: 'authentication_error', message: 'invalid x-api-key' })
  await sayIt(page, 'hola')
  await waitIdle(page)
  let note = (await chatState(page)).messages.at(-1).note
  check('una clave mala se explica en español y no se pierde la conversación', note?.tone === 'error' && note.text.includes('La clave no es válida'), JSON.stringify(note))
  await shot(page, 'chat-pc-07-error')
  api.next = () => ({ status: 429, headers: { 'retry-after-ms': '20' }, type: 'rate_limit_error', message: 'rate limited' })
  await sayIt(page, 'otra vez')
  await waitIdle(page)
  note = (await chatState(page)).messages.at(-1).note
  check('el límite de uso se explica («espera un momento»)', note?.tone === 'error' && note.text.includes('límite de uso'), JSON.stringify(note))
  api.next = () => ({ status: 400, type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' })
  await sayIt(page, 'y ahora')
  await waitIdle(page)
  note = (await chatState(page)).messages.at(-1).note
  check('sin saldo en la cuenta también se explica', note?.text.includes('no tiene saldo'), JSON.stringify(note))

  // Respuesta cortada por largo y bloque cortado
  api.next = () => ({ text: 'Va la propuesta.\n<acciones>\n[{"do":"number","note":"n1"', stop: 'max_tokens' })
  await sayIt(page, 'numera')
  await waitIdle(page)
  const cut = (await chatState(page)).messages.at(-1)
  check('un bloque de acciones cortado a la mitad no se aplica y se avisa', cut.text === 'Va la propuesta.' && !cut.proposal && /se cortó/.test(cut.note?.text || ''), JSON.stringify(cut))

  // Acción inválida
  api.next = () => ({ text: 'Lo hago.\n<acciones>[{"do":"reorder","note":"n9","list":1,"order":[1]},{"do":"borrar_todo","note":"n1"}]</acciones>' })
  await sayIt(page, 'haz algo raro')
  await waitIdle(page)
  const bad = (await chatState(page)).messages.at(-1)
  check('acciones inventadas o sobre posits que no existen se descartan con aviso (no se aplica nada)', !bad.proposal && /No pude preparar el cambio/.test(bad.note?.text || '') && JSON.stringify(await tasks(page)) === JSON.stringify(ORIGINAL), JSON.stringify(bad))

  // Crear posit
  api.next = () => ({ text: 'Te lo dejo en un posit nuevo.\n<acciones>[{"do":"add_note","title":"Plan de hoy","items":["Firmar el acta","Enviar el oficio"],"kind":"tasks","color":"Cielo"}]</acciones>' })
  await sayIt(page, 'Hazme un plan')
  await waitIdle(page)
  const notesBefore = await page.evaluate(() => Object.keys(window.__posits.store.getState().notes).length)
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await page.waitForTimeout(500)
  const made = await page.evaluate(() => {
    const s = window.__posits.store.getState()
    const n = Object.values(s.notes).find((x) => JSON.stringify(x.doc).includes('Plan de hoy'))
    return n && { color: n.color, visible: !!document.querySelector(`[data-note-id="${n.id}"]`), count: Object.keys(s.notes).length, text: document.querySelector(`[data-note-id="${n.id}"]`)?.innerText }
  })
  check('«Aplicar» crea un posit nuevo con su título, sus pendientes y el color pedido', made && made.count === notesBefore + 1 && made.color === '#8ECDF5' && made.visible && /Plan de hoy/.test(made.text) && /Firmar el acta/.test(made.text), JSON.stringify(made))
  await shot(page, 'chat-pc-08-posit-nuevo')
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await page.waitForTimeout(400)
  check('«Deshacer» quita el posit nuevo (sin aviso extra de «Posit borrado»)', (await page.evaluate(() => Object.keys(window.__posits.store.getState().notes).length)) === notesBefore && (await page.locator('.toast').count()) === 0)

  // Olvidar clave
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Olvidar clave' }).click()
  st = await chatState(page)
  check('«Olvidar clave» la borra del aparato y vuelve al modo sencillo', !st.hasKey && st.via === 'local' && (await page.evaluate(() => localStorage.getItem('posits:claude:key'))) === null)
  await ctx.close()
}

// ───────────────────────────── PC: con la cuenta de Claude (enlace de prueba) ─────────────────────────────

async function withAccount(browser, url) {
  console.log('\n▶ PC · con la cuenta de Claude del enlace de prueba (sin clave)')
  const { ctx, page } = await openApp(browser, url, DESKTOP, { init: [SAMPLE_SCRIPT] })
  await openChat(page, false)
  let st = await chatState(page)
  check('detecta la cuenta de Claude y la usa sin pedir clave', st.sampleOk === true && st.via === 'sample' && (await page.locator('.chat-status').innerText()).includes('con tu cuenta de Claude'))
  check('pide consentimiento (se envía el contenido de los posits)', (await page.locator('.chat-consent').count()) === 1)
  await page.getByRole('button', { name: 'Entendido, seguir' }).click()

  await page.locator('[data-chat-input]').fill('Numera mi lista')
  await page.locator('.chat-round-send').click()
  await page.waitForFunction(() => window.__posits.chat.getState().status === 'waiting')
  check('mientras espera la primera palabra, la mascota está pensando y aparecen los puntitos', (await page.evaluate(() => window.__posits.mascot.getState().mood)) === 'think' && (await page.locator('.msg-dots').count()) === 1)
  await page.waitForFunction(() => window.__posits.chat.getState().status === 'streaming', null, { timeout: 4000 })
  const midText = await page.evaluate(() => window.__posits.chat.getState().messages.at(-1).text)
  check('la respuesta se va escribiendo en vivo (con el cursor parpadeante)', midText.length > 0 && (await page.locator('.msg-caret').count()) === 1, midText)
  check('…mientras la mascota mueve los bracitos y asiente al «hablar»', (await page.locator('.mascot').getAttribute('data-talking')) === '1')
  check('…y nadie ve el bloque <acciones> mientras se escribe', !(await page.locator('.msg-bot').last().innerText()).includes('<'))
  await waitIdle(page)
  const call = await page.evaluate(() => window.__sample.calls[0])
  check('la petición lleva las instrucciones como primer turno, sin caché y con el nivel del modelo', call.input[0].role === 'user' && call.input[0].content.includes('INSTRUCCIONES PERMANENTES') && call.opts.cache === false && call.opts.modelTier === 'complex' && call.opts.hasSignal, JSON.stringify(call.opts))
  check('…y la foto del tablero en el último turno', call.input.at(-1).content.includes('[n1] posit Amarillo') && call.input.at(-1).content.endsWith('Numera mi lista'))
  st = await chatState(page)
  check('la respuesta queda completa, con su propuesta', st.messages[1].via === 'sample' && st.messages[1].proposal?.state === 'pending' && !st.messages[1].text.includes('acciones'))
  check('la mascota deja de «hablar»', (await page.locator('.mascot').getAttribute('data-talking')) === null)
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await page.waitForTimeout(400)
  check('«Aplicar» numera la lista', (await tasks(page)).every((t, i) => t.startsWith(`${i + 1}. `)))
  await shot(page, 'chat-pc-09-cuenta')

  // ajustes: sin formulario de clave
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  check('en los ajustes explica que se usa su cuenta y no muestra el formulario de clave', (await page.locator('.chat-set-p').first().innerText()).includes('tu cuenta de Claude') && (await page.locator('.chat-key-form').count()) === 0)
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()

  // Detener
  await page.evaluate(() => Object.assign(window.__sample, { text: 'Voy a explicarte con calma cómo organizar tus pendientes de la semana, paso a paso y sin prisa alguna.', chunks: 20, delay: 150 }))
  await sayIt(page, 'Explícame')
  await page.waitForFunction(() => window.__posits.chat.getState().status === 'streaming', null, { timeout: 4000 })
  check('mientras responde, el botón de enviar se vuelve «Detener»', (await page.getByRole('button', { name: 'Detener' }).count()) === 1)
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Detener' }).click()
  await waitIdle(page)
  const stopped = (await chatState(page)).messages.at(-1)
  check('«Detener» corta la respuesta, deja lo escrito y lo avisa', stopped.text.length > 0 && stopped.text.length < 90 && stopped.note?.text === 'Detenido.' && !stopped.streaming, JSON.stringify(stopped))

  // Permiso denegado → modo sencillo
  await page.evaluate(() => (window.__sample.mode = 'denied'))
  await sayIt(page, '¿Qué tengo pendiente?')
  await waitIdle(page)
  const denied = (await chatState(page)).messages.at(-1)
  st = await chatState(page)
  check('si la persona no autoriza el uso de su cuenta, contesta en modo sencillo y lo explica', denied.via === 'local' && /No hay permiso para usar Claude desde aquí/.test(denied.note?.text || '') && st.via === 'local', JSON.stringify(denied))
  await sayIt(page, 'otra')
  await waitIdle(page)
  check('…y no vuelve a insistir con la cuenta en cada mensaje', (await page.evaluate(() => window.__sample.calls.length)) === 3)
  await ctx.close()
}

// ───────────────────────────── PC: IA gratuita (Gemini, Groq, otra) ─────────────────────────────

/** Abre «Usar otro modelo (avanzado)» si está cerrado (queda abierto cuando el modelo escrito no es de la lista). */
const openMore = async (page) => {
  if (!(await page.locator('.chat-more').evaluate((el) => el.open))) await page.locator('.chat-more summary').click()
}

const KEY_GEMINI = 'AIzaSyD-ejemplo0123456789abcdefghijklmno'
const KEY_GROQ = 'gsk_0123456789abcdefghijklmnopqrstuv'

async function freeAi(browser, url) {
  console.log('\n▶ PC · IA gratuita (Gemini de Google, Groq y «otra IA» simulados)')
  const free = {}
  const { ctx, page } = await openApp(browser, url, DESKTOP, { free })
  await openChat(page, false)
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()

  // ── Elegir quién contesta ──
  const chips = await page.getByRole('radio').evaluateAll((els) => els.filter((e) => e.classList.contains('chat-provider')).map((e) => ({ name: e.querySelector('.chat-provider-name').textContent, tag: e.querySelector('small').textContent, on: e.getAttribute('aria-checked') === 'true' })))
  check('los ajustes ofrecen quién contesta: Gemini y Groq (gratis), otra IA y Claude (de pago)', chips.map((c) => `${c.name}:${c.tag}`).join() === 'Gemini:gratis,Groq:gratis,Otra IA:avanzado,Claude:de pago', JSON.stringify(chips))
  check('Gemini viene elegida por defecto (es la gratuita más fácil)', chips[0].on && chips.slice(1).every((c) => !c.on))
  check('explica cómo sacar la clave gratis: tres pasos y un enlace a Google AI Studio que abre en otra pestaña', (await page.locator('.chat-steps li').count()) === 3 && (await page.locator('a.chat-btn-link').getAttribute('href')) === 'https://aistudio.google.com/apikey' && (await page.locator('a.chat-btn-link').getAttribute('target')) === '_blank' && (await page.locator('a.chat-btn-link').getAttribute('rel')).includes('noopener'))
  const priv = await page.locator('.chat-privacy').innerText()
  check('avisa con claridad la privacidad del plan gratuito de Google (lo pueden usar y revisar personas)', priv.includes('mejorar sus productos') && priv.includes('personas de Google pueden revisarlo') && priv.includes('datos sensibles'), priv)
  check('sin clave, avisa que está en modo sencillo y que se conecta aquí', (await page.locator('.chat-set-p').nth(1).innerText()).includes('sin conexión a una IA'))
  check('todavía no hay botón de «Probar conexión» (falta la clave)', (await page.getByRole('button', { name: 'Probar conexión' }).count()) === 0)
  await shot(page, 'chat-pc-10-gemini-clave')

  // ── La clave ──
  await page.locator('.chat-key-form input').fill('sk-ant-api03-abcdefghijklmnopqrstuvwxyz')
  check('si pegas una clave de otro servicio, avisa', (await page.locator('.chat-warn').first().innerText()).includes('otro servicio'))
  await page.locator('.chat-key-form input').fill('AIza corta')
  check('si lleva espacios, avisa', (await page.locator('.chat-warn').first().innerText()).includes('espacios'))
  await page.locator('.chat-key-form input').fill(KEY_GEMINI)
  check('con una clave que se ve bien no avisa', (await page.locator('.chat-key-form .chat-warn').count()) === 0)
  await page.getByRole('button', { name: 'Guardar clave' }).click()
  await page.waitForTimeout(200)
  let st = await chatState(page)
  check('guarda la clave y pasa a contestar Gemini (sin tocar la de Claude)', st.via === 'gemini' && st.settings.provider === 'gemini' && !st.hasKey && (await page.evaluate(() => localStorage.getItem('posits:key:gemini'))) === 'AIzaSyD-ejemplo0123456789abcdefghijklmno')
  check('la clave no queda en la conversación guardada', await page.evaluate(() => !(localStorage.getItem('posits:chat:v1') || '').includes('AIza')))
  check('los ajustes dicen «Clave guardada», el modelo recomendado y que va directo a Google', (await page.getByRole('button', { name: 'Olvidar clave' }).count()) === 1 && (await page.locator('.chat-set-active').innerText()).includes('gemini-3.8-flash'))
  check('los tres modelos de Gemini se pueden elegir y el recomendado viene marcado', (await page.getByRole('radio', { name: /Gemini 3\.8 Flash/ }).getAttribute('aria-checked')) === 'true' && (await page.getByRole('radio', { name: /Gemini 3\.5 Flash-Lite/ }).count()) === 1 && (await page.getByRole('radio', { name: /Gemini 2\.5 Flash/ }).count()) === 1)

  // ── Probar la conexión ──
  free.geminiNext = () => ({ text: 'ok' })
  await page.getByRole('button', { name: 'Probar conexión' }).click()
  await page.waitForSelector('.chat-test-result[data-status="ok"]')
  const res = await page.locator('.chat-test-result').innerText()
  check('«Probar conexión» dice que funciona y con qué modelo', res.includes('¡Funciona!') && res.includes('gemini-3.8-flash'), res)
  const probe = free.gemini[0]
  check('…mandó una prueba mínima (sin el tablero) a Google, con la clave en el encabezado', free.gemini.length === 1 && probe.url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse' && probe.headers['x-goog-api-key'] === KEY_GEMINI && probe.body.contents.length === 1 && probe.body.contents[0].parts[0].text === 'Hola' && !JSON.stringify(probe.body).includes('<tablero>'), JSON.stringify(probe.body).slice(0, 200))
  free.geminiNext = () => ({ status: 400, message: 'API key not valid. Please pass a valid API key.', reason: 'API_KEY_INVALID' })
  await page.getByRole('button', { name: 'Probar conexión' }).click()
  await page.waitForSelector('.chat-test-result[data-status="error"]')
  check('con una clave mala, la prueba lo explica en español', (await page.locator('.chat-test-result').innerText()).includes('La clave no es válida'))
  free.geminiNext = () => ({ text: 'ok' })
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()

  // ── Conversar ──
  check('el encabezado dice quién contesta: Gemini, gratis, y su modelo', (await page.locator('.chat-name').textContent()) === 'Gemini' && (await page.locator('.chat-status').innerText()).includes('gratis · Gemini 3.8 Flash') && (await page.locator('.chat').getAttribute('aria-label')) === 'Conversación con Gemini')
  check('el saludo ya no dice «soy Claude»', (await page.locator('.chat-welcome-title').innerText()).includes('tu asistente'))
  const consent = await page.locator('.chat-consent').innerText()
  check('antes de la primera consulta pide consentimiento y nombra a Google con su advertencia de privacidad', (await page.locator('.chat-consent').count()) === 1 && consent.includes('Google') && consent.includes('mejorar sus productos') && (await page.locator('.chat-round-send').isDisabled()), consent)
  await shot(page, 'chat-pc-11-gemini-consentimiento')
  await page.getByRole('button', { name: 'Entendido, seguir' }).click()
  free.gemini.length = 0
  free.geminiNext = () => ({ text: PROPOSAL })
  await sayIt(page, 'Ordena y numera mi lista')
  await waitIdle(page)
  const call = free.gemini[0]
  check('la consulta va a la API de Gemini (streamGenerateContent) con la clave en el encabezado y sin «Authorization»', free.gemini.length === 1 && call.url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse' && call.headers['x-goog-api-key'] === KEY_GEMINI && !call.headers.authorization, JSON.stringify({ u: call.url, h: Object.keys(call.headers) }))
  check('…con las instrucciones aparte (sin hacerse pasar por Claude) y la conversación con papeles user / model', call.body.systemInstruction.parts[0].text.includes('funcionas con Gemini') && !call.body.systemInstruction.parts[0].text.includes('Eres Claude') && call.body.systemInstruction.parts[0].text.includes('Solo eso') && call.body.contents.at(-1).role === 'user')
  const lastTurn = call.body.contents.at(-1).parts[0].text
  check('…y la foto del tablero con el posit numerado', lastTurn.includes('<tablero>') && lastTurn.includes('[n1] posit Amarillo') && lastTurn.endsWith('Ordena y numera mi lista'))
  st = await chatState(page)
  check('la respuesta se muestra sin el bloque <acciones> y con su propuesta', st.messages[1].via === 'gemini' && st.messages[1].text.startsWith('Te propongo poner primero') && st.messages[1].proposal?.state === 'pending' && st.messages[1].proposal.items === 2)
  await shot(page, 'chat-pc-12-gemini-propuesta')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await page.waitForTimeout(500)
  check('«Aplicar» ordena y numera el posit, igual que con Claude', JSON.stringify(await tasks(page)) === JSON.stringify(ORDERED), JSON.stringify(await tasks(page)))
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await page.waitForTimeout(400)
  check('«Deshacer» lo devuelve a como estaba', JSON.stringify(await tasks(page)) === JSON.stringify(ORIGINAL))

  // segunda consulta: lleva la conversación (el papel de la IA es «model»)
  free.geminiNext = () => ({ text: 'De nada.' })
  await sayIt(page, 'Gracias')
  await waitIdle(page)
  const turns = free.gemini[1].body.contents
  check('la segunda consulta lleva la conversación anterior (user, model, user)', turns.map((t) => t.role).join() === 'user,model,user' && !turns[0].parts[0].text.includes('<tablero>') && turns[2].parts[0].text.includes('<tablero>'), turns.map((t) => t.role).join())

  // ── Cambiar de modelo ──
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('radio', { name: /Gemini 3\.5 Flash-Lite/ }).click()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  check('el encabezado muestra el modelo elegido', (await page.locator('.chat-status').innerText()).includes('Gemini 3.5 Flash-Lite'))
  await sayIt(page, '¿Y ahora?')
  await waitIdle(page)
  check('la consulta usa el modelo elegido', free.gemini[2].url.includes('/models/gemini-3.5-flash-lite:streamGenerateContent'), free.gemini[2].url)
  check('el modelo elegido se recuerda en el aparato', await page.evaluate(() => JSON.parse(localStorage.getItem('posits:claude')).models.gemini === 'gemini-3.5-flash-lite'))
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await openMore(page)
  await page.locator('.chat-more input').fill('gemini-2.5-pro')
  await page.locator('.chat-more input').press('Enter')
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await sayIt(page, 'otra')
  await waitIdle(page)
  check('escribir otro modelo (avanzado) también funciona', free.gemini[3].url.includes('/models/gemini-2.5-pro:streamGenerateContent'), free.gemini[3].url)
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await openMore(page)
  await page.locator('.chat-more input').fill('')
  await page.locator('.chat-more input').press('Enter')
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await sayIt(page, 'y otra')
  await waitIdle(page)
  check('dejarlo vacío vuelve al modelo recomendado', free.gemini[4].url.includes('/models/gemini-3.8-flash:streamGenerateContent'), free.gemini[4].url)

  // ── Errores ──
  const lastNote = async () => (await chatState(page)).messages.at(-1).note
  free.geminiNext = () => ({ status: 429, apiStatus: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota' })
  await sayIt(page, 'hola')
  await waitIdle(page)
  let note = await lastNote()
  check('el límite gratuito se explica («espera un momento» o prueba otra IA)', note?.tone === 'error' && note.text.includes('límite de uso') && note.text.includes('otra IA'), JSON.stringify(note))
  free.geminiNext = () => ({ status: 400, message: 'API key not valid. Please pass a valid API key.', reason: 'API_KEY_INVALID' })
  await sayIt(page, 'hola')
  await waitIdle(page)
  note = await lastNote()
  check('una clave mala se explica en español', note?.text.includes('La clave no es válida'), JSON.stringify(note))
  free.geminiNext = () => ({ status: 404, apiStatus: 'NOT_FOUND', message: 'models/gemini-3.8-flash is not found for API version v1beta' })
  await sayIt(page, 'hola')
  await waitIdle(page)
  note = await lastNote()
  check('un modelo que ya no existe se explica y manda a elegir otro', note?.text.includes('Ese modelo no existe'), JSON.stringify(note))
  free.geminiNext = () => ({ status: 400, apiStatus: 'FAILED_PRECONDITION', message: 'User location is not supported for the API use.' })
  await sayIt(page, 'hola')
  await waitIdle(page)
  note = await lastNote()
  check('un país sin servicio gratuito se explica', note?.text.includes('país o región'), JSON.stringify(note))
  await shot(page, 'chat-pc-13-gemini-error')

  // ── Cambiar a Groq ──
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('radio', { name: /^Groq/ }).click()
  check('al elegir Groq se ven sus pasos y su enlace, y sigue en modo sencillo hasta poner la clave', (await page.locator('.chat-steps li').count()) === 3 && (await page.locator('a.chat-btn-link').getAttribute('href')) === 'https://console.groq.com/keys' && (await chatState(page)).via === 'local')
  check('el aviso de privacidad cambia al de Groq', (await page.locator('.chat-privacy').innerText()).includes('no usa lo que envías para entrenar'))
  await page.locator('.chat-key-form input').fill('AIzaSyD-esta-no-es-de-groq-000000000')
  check('avisa si la clave no es de Groq (empieza con gsk_)', (await page.locator('.chat-warn').first().innerText()).includes('gsk_'))
  await page.locator('.chat-key-form input').fill(KEY_GROQ)
  await page.getByRole('button', { name: 'Guardar clave' }).click()
  await page.waitForTimeout(200)
  st = await chatState(page)
  check('guarda la clave de Groq aparte y pasa a contestar por la conexión compatible con OpenAI', st.via === 'openai' && (await page.evaluate(() => localStorage.getItem('posits:key:groq'))) === 'gsk_0123456789abcdefghijklmnopqrstuv' && (await page.evaluate(() => localStorage.getItem('posits:key:gemini'))) === 'AIzaSyD-ejemplo0123456789abcdefghijklmno')
  free.openaiNext = () => ({ text: 'Empieza por lo urgente.' })
  await page.getByRole('button', { name: 'Probar conexión' }).click()
  await page.waitForSelector('.chat-test-result[data-status="ok"]')
  check('«Probar conexión» funciona también con Groq', (await page.locator('.chat-test-result').innerText()).includes('llama-3.3-70b-versatile') && free.openai.length === 1)
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  check('el encabezado dice Groq, gratis y su modelo', (await page.locator('.chat-name').textContent()) === 'Groq' && (await page.locator('.chat-status').innerText()).includes('gratis · Llama 3.3 70B'))
  free.openai.length = 0
  await sayIt(page, 'Dame un plan corto')
  await waitIdle(page)
  const g = free.openai[0]
  check('la consulta va a Groq (chat/completions) con la clave como «Bearer»', free.openai.length === 1 && g.url === 'https://api.groq.com/openai/v1/chat/completions' && g.headers.authorization === `Bearer ${KEY_GROQ}`, JSON.stringify({ u: g?.url, h: g?.headers.authorization }))
  check('…con el modelo, streaming, las instrucciones como mensaje «system» y sin hacerse pasar por Claude', g.body.model === 'llama-3.3-70b-versatile' && g.body.stream === true && g.body.messages[0].role === 'system' && g.body.messages[0].content.includes('funcionas con Groq') && !g.body.messages[0].content.includes('Eres Claude') && g.body.messages.at(-1).content.includes('<tablero>'))
  check('la respuesta se muestra', (await lastBot(page).innerText()).includes('Empieza por lo urgente.'))
  free.openaiNext = () => ({ status: 413, message: 'Request too large for model `llama-3.3-70b-versatile` on tokens per minute (TPM)' })
  await sayIt(page, 'otra')
  await waitIdle(page)
  note = await lastNote()
  check('«demasiado texto» (límite de Groq) se explica y sugiere apagar la lectura de posits', note?.text.includes('demasiado texto') && note.text.includes('Dejar que la IA lea mis posits'), JSON.stringify(note))
  free.openaiNext = () => ({ status: 429, message: 'Rate limit reached for model' })
  await sayIt(page, 'otra')
  await waitIdle(page)
  check('el límite de uso de Groq también', (await lastNote())?.text.includes('límite de uso'))

  // ── «Otra IA» (compatible con OpenAI) ──
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('radio', { name: /^Otra IA/ }).click()
  check('«Otra IA» pide la clave, la dirección y el modelo', (await page.locator('.chat-key-form input').count()) === 1 && (await page.getByLabel('Dirección del servicio').count()) === 1 && (await page.getByLabel('Nombre del modelo').count()) === 1)
  await page.locator('.chat-key-form input').fill('sk-or-v1-cualquiera-0123456789')
  await page.getByRole('button', { name: 'Guardar clave' }).click()
  await page.waitForTimeout(150)
  check('con la clave sola todavía no contesta (faltan la dirección y el modelo)', (await chatState(page)).via === 'local')
  await page.getByLabel('Dirección del servicio').fill('http://inseguro.example/v1')
  await page.getByLabel('Dirección del servicio').press('Enter')
  check('una dirección sin https se rechaza con un aviso', (await page.locator('.chat-field .chat-warn').innerText()).includes('https://') && (await chatState(page)).via === 'local')
  await page.getByLabel('Dirección del servicio').fill('openrouter.ai/api/v1/')
  await page.getByLabel('Dirección del servicio').press('Enter')
  await page.getByLabel('Nombre del modelo').fill('openrouter/free')
  await page.getByLabel('Nombre del modelo').press('Enter')
  await page.waitForTimeout(150)
  st = await chatState(page)
  check('con clave, dirección (se completa con https y sin barra final) y modelo, contesta', st.via === 'openai' && st.settings.customBase === 'openrouter.ai/api/v1/' && st.settings.models.custom === 'openrouter/free', JSON.stringify(st.settings))
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  check('el encabezado dice «Otra IA» y el modelo que escribiste', (await page.locator('.chat-name').textContent()) === 'Otra IA' && (await page.locator('.chat-status').innerText()).includes('openrouter/free'))
  free.openai.length = 0
  free.openaiNext = () => ({ text: 'Hola desde otro servicio.' })
  await sayIt(page, 'hola')
  await waitIdle(page)
  const o = free.openai[0]
  check('la consulta va a la dirección elegida, con su clave y su modelo', o.url === 'https://openrouter.ai/api/v1/chat/completions' && o.headers.authorization === 'Bearer sk-or-v1-cualquiera-0123456789' && o.body.model === 'openrouter/free', JSON.stringify({ u: o.url, m: o.body.model }))

  // ── Recargar: todo se recuerda ──
  await waitSaved(page)
  await page.waitForTimeout(700)
  await page.reload()
  await page.waitForSelector('.world[data-ready]', { state: 'attached' })
  await page.waitForTimeout(600)
  st = await page.evaluate(() => { const s = window.__posits.chat.getState(); return { via: s.via, provider: s.provider, keys: s.keys } })
  check('al recargar se recuerdan el servicio elegido y las claves de cada uno', st.via === 'openai' && st.provider === 'custom' && st.keys.gemini && st.keys.groq && st.keys.custom && !st.keys.claude, JSON.stringify(st))

  // ── Olvidar claves ──
  await openChat(page, false)
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Olvidar clave' }).click()
  check('«Olvidar clave» borra solo la de ese servicio', (await chatState(page)).via === 'local' && (await page.evaluate(() => localStorage.getItem('posits:key:custom'))) === null && (await page.evaluate(() => localStorage.getItem('posits:key:groq'))) !== null)
  await page.getByRole('radio', { name: /^Gemini/ }).click()
  check('volver a Gemini reactiva su clave guardada', (await chatState(page)).via === 'gemini')
  // «recordar»: apagarlo deja las claves solo en esta pestaña
  await page.getByRole('switch', { name: /Recordar las claves en este aparato/ }).uncheck()
  check('sin «Recordar», las claves salen del aparato y quedan solo en la pestaña', (await page.evaluate(() => localStorage.getItem('posits:key:gemini'))) === null && (await page.evaluate(() => sessionStorage.getItem('posits:key:gemini'))) === 'AIzaSyD-ejemplo0123456789abcdefghijklmno' && (await chatState(page)).via === 'gemini')
  await ctx.close()
}

// ───────────────────────────── Celular: IA gratuita ─────────────────────────────

async function freeAiPhone(browser, url) {
  console.log('\n▶ Celular (390×844) · IA gratuita')
  const free = {}
  const { ctx, page } = await openApp(browser, url, IPHONE, { free })
  const tap = async (loc) => {
    await loc.scrollIntoViewIfNeeded() // los ajustes se recorren con el dedo: el botón puede estar más abajo
    const b = await loc.boundingBox()
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(150)
  }
  const fb = await page.locator('.mascot-figure').boundingBox()
  await page.touchscreen.tap(fb.x + fb.width / 2, fb.y + fb.height / 2)
  await page.waitForSelector('.chat')
  await page.waitForTimeout(400)
  await tap(page.getByRole('button', { name: 'Conecta', exact: false }).or(page.getByRole('button', { name: 'Ajustes', exact: true })).first())
  await page.waitForSelector('.chat-providers')
  const c = await page.locator('.chat').boundingBox()
  const grid = await page.locator('.chat-providers').boundingBox()
  check('en el celular los servicios se ven en una cuadrícula que cabe en la hoja, sin desbordar', inside(grid, 390, 844, 4) && inside(c, 390, 844, 4) && !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), JSON.stringify({ grid, c }))
  const small = await page.evaluate(() => [...document.querySelectorAll('.chat-page-settings button, .chat-page-settings input[type="text"], .chat-page-settings input[type="password"], .chat-page-settings a.chat-btn')].filter((e) => e.checkVisibility() && e.getBoundingClientRect().width > 0).map((e) => ({ n: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h < 38))
  check('todos los botones y campos de los ajustes se tocan cómodo (≥ 38 px de alto)', small.length === 0, JSON.stringify(small))
  await shot(page, 'chat-cel-05-gratis-ajustes')
  await page.locator('.chat-key-form input').fill(KEY_GEMINI)
  await tap(page.getByRole('button', { name: 'Guardar clave' }))
  await page.waitForTimeout(150)
  check('la clave se guarda con el dedo y se pasa a Gemini', (await chatState(page)).via === 'gemini')
  free.geminiNext = () => ({ text: 'ok' })
  await tap(page.getByRole('button', { name: 'Probar conexión' }))
  await page.waitForSelector('.chat-test-result[data-status="ok"]')
  check('«Probar conexión» con el dedo funciona y el resultado cabe', inside(await page.locator('.chat-test-result').boundingBox(), 390, 844, 2))
  await tap(page.getByRole('button', { name: 'Ajustes', exact: true }))
  await tap(page.getByRole('button', { name: 'Entendido, seguir' }))
  free.geminiNext = () => ({ text: PROPOSAL })
  await tap(page.locator('[data-chat-input]'))
  await page.locator('[data-chat-input]').fill('Ordena y numera mi lista')
  await tap(page.locator('.chat-round-send'))
  await waitIdle(page)
  await page.waitForSelector('.proposal')
  check('la respuesta de Gemini llega en el celular y su propuesta cabe en la hoja', inside(await page.locator('.proposal').boundingBox(), 390, 844, 2) && !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)))
  await shot(page, 'chat-cel-06-gemini-propuesta')
  await ctx.close()

  for (const [w, h] of [[360, 740], [320, 568]]) {
    const { ctx: c2, page: p2 } = await openApp(browser, url, { ...IPHONE, viewport: { width: w, height: h } }, { free: {} })
    const f = await p2.locator('.mascot-figure').boundingBox()
    await p2.touchscreen.tap(f.x + f.width / 2, f.y + f.height / 2)
    await p2.waitForSelector('.chat')
    await p2.waitForTimeout(400)
    await p2.getByRole('button', { name: 'Ajustes', exact: true }).tap()
    await p2.waitForSelector('.chat-providers')
    const ok = await p2.evaluate(() => {
      const box = document.querySelector('.chat').getBoundingClientRect()
      const wide = [...document.querySelectorAll('.chat-page-settings *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > box.right + 1 }).map((e) => e.className || e.tagName)
      return { wide: wide.slice(0, 4), overflow: document.documentElement.scrollWidth > innerWidth }
    })
    check(`${w} px: los ajustes de la IA gratuita caben a lo ancho`, ok.wide.length === 0 && !ok.overflow, JSON.stringify(ok))
    if (w === 320) await p2.screenshot({ path: require('./lib.cjs').OUT + '/chat-cel-320-gratis.png' })
    await c2.close()
  }
}

// ───────────────────────────── Enlace de prueba: solo Claude ─────────────────────────────

async function freeAiInHost(browser, url) {
  console.log('\n▶ Enlace de prueba de claude.ai · las IA gratuitas no se ofrecen (el visor no deja salir a otros sitios)')
  const { ctx, page } = await openApp(browser, url, DESKTOP, { init: [SAMPLE_SCRIPT] })
  await openChat(page, false)
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  check('en los ajustes no hay para elegir servicios ni claves, y explica dónde se usan las IA gratuitas', (await page.locator('.chat-providers').count()) === 0 && (await page.locator('.chat-key-form').count()) === 0 && (await page.locator('.chat-help').first().innerText()).includes('página pública'))
  await ctx.close()
}

// ───────────────────────────── Celular ─────────────────────────────

async function phone(browser, url) {
  console.log('\n▶ Celular (390×844, toques reales)')
  const api = {}
  const { ctx, page } = await openApp(browser, url, IPHONE, { api, storage: { 'posits:claude': JSON.stringify({ model: 'claude-sonnet-5-5', shareNotes: true, consented: true, speak: false, remember: true }), 'posits:claude:key': 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789' } })
  const tap = async (loc) => {
    const b = await loc.boundingBox()
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(150)
  }
  const m = page.locator('.mascot')
  const fb = await page.locator('.mascot-figure').boundingBox()
  await page.touchscreen.tap(fb.x + fb.width / 2, fb.y + fb.height / 2)
  await page.waitForSelector('.chat')
  await page.waitForTimeout(400)

  const c = await page.locator('.chat').boundingBox()
  const top = await page.locator('.topbar').boundingBox()
  check('la conversación se abre como una hoja que ocupa casi todo el ancho, bajo la barra de arriba', inside(c, 390, 844, 4) && c.width >= 370 && c.y >= top.y + top.height, JSON.stringify({ c, top }))
  check('la mascota se esconde mientras la hoja está abierta (no cabe)', (await m.evaluate((el) => getComputedStyle(el).visibility)) === 'hidden')
  check('en el celular no se abre el teclado solo (hay que tocar el campo)', !(await page.evaluate(() => document.activeElement === document.querySelector('[data-chat-input]'))))
  const st0 = await chatState(page)
  check('usa la clave guardada y el modelo elegido (Sonnet)', st0.via === 'api' && st0.settings.model === 'claude-sonnet-5-5' && (await page.locator('.chat-status').innerText()).includes('Claude Sonnet 5.5'))
  check('ya había dicho que sí al consentimiento: no vuelve a preguntar', (await page.locator('.chat-consent').count()) === 0)
  await shot(page, 'chat-cel-01-vacio')

  // botones táctiles de tamaño cómodo
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.chat button, .chat textarea')].map((e) => { const r = e.getBoundingClientRect(); return { n: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) } }).filter((x) => x.w > 0))
  check('todos los botones del panel miden al menos 38 px de alto', sizes.every((s) => s.h >= 38), JSON.stringify(sizes.filter((s) => s.h < 38)))

  // escribir y enviar con toques
  await tap(page.locator('[data-chat-input]'))
  await page.keyboard.type('Ordena y numera mi lista')
  check('en el celular Enter baja de renglón (no envía)', (await (async () => { await page.keyboard.press('Enter'); return (await page.locator('[data-chat-input]').inputValue()).includes('\n') })()))
  await page.locator('[data-chat-input]').fill('Ordena y numera mi lista')
  api.next = () => ({ text: PROPOSAL })
  await tap(page.locator('.chat-round-send'))
  await waitIdle(page)
  await page.waitForSelector('.proposal')
  check('la respuesta llega y la propuesta cabe en la hoja', inside(await page.locator('.proposal').boundingBox(), 390, 844, 2) && (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
  check('la petición usó el modelo Sonnet con nivel de esfuerzo medio', api.calls[0].body.model === 'claude-sonnet-5-5' && api.calls[0].body.output_config?.effort === 'medium')
  await shot(page, 'chat-cel-02-propuesta')
  await tap(page.getByRole('button', { name: 'Aplicar' }))
  await page.waitForTimeout(500)
  check('«Aplicar» con el dedo cambia el posit', JSON.stringify(await tasks(page)) === JSON.stringify(ORDERED), JSON.stringify(await tasks(page)))
  await shot(page, 'chat-cel-03-aplicada')
  await tap(page.getByRole('button', { name: 'Deshacer' }))
  await page.waitForTimeout(400)
  check('«Deshacer» con el dedo lo restaura', JSON.stringify(await tasks(page)) === JSON.stringify(ORIGINAL))

  // ajustes con el dedo
  await tap(page.getByRole('button', { name: 'Ajustes', exact: true }))
  check('los ajustes caben y se pueden recorrer con el dedo', (await page.locator('.chat-page-settings').evaluate((el) => el.scrollHeight > el.clientHeight)) && inside(await page.locator('.chat').boundingBox(), 390, 844, 4))
  await shot(page, 'chat-cel-04-ajustes')
  await tap(page.getByRole('button', { name: 'Ajustes', exact: true }))

  // cerrar y volver a ver a la mascota
  await tap(page.getByRole('button', { name: 'Cerrar la conversación' }))
  await page.waitForTimeout(250)
  check('al cerrar la hoja, la mascota vuelve a verse', (await page.locator('.chat').count()) === 0 && (await m.evaluate((el) => getComputedStyle(el).visibility)) === 'visible')

  // pantallas angostas
  await ctx.close()
  for (const [w, h] of [[360, 740], [320, 568]]) {
    const { ctx: c2, page: p2 } = await openApp(browser, url, { ...IPHONE, viewport: { width: w, height: h } })
    const f = await p2.locator('.mascot-figure').boundingBox()
    await p2.touchscreen.tap(f.x + f.width / 2, f.y + f.height / 2)
    await p2.waitForSelector('.chat')
    await p2.waitForTimeout(400)
    const cb = await p2.locator('.chat').boundingBox()
    const tb = await p2.locator('.topbar').boundingBox()
    const ta = await p2.locator('[data-chat-input]').boundingBox()
    check(`${w} px: la hoja cabe, queda bajo la barra de arriba y el campo de escribir se ve`, inside(cb, w, h, 2) && cb.y >= tb.y + tb.height - 1 && inside(ta, w, h, 2) && !(await p2.evaluate(() => document.documentElement.scrollWidth > innerWidth)))
    if (w === 320) await p2.screenshot({ path: require('./lib.cjs').OUT + '/chat-cel-320.png' })
    await c2.close()
  }
}

// ───────────────────────────── main ─────────────────────────────

;(async () => {
  const server = await startPreview()
  const browser = await chromium.launch()
  try {
    await simple(browser, server.url)
    await withKey(browser, server.url)
    await withAccount(browser, server.url)
    await freeAi(browser, server.url)
    await freeAiInHost(browser, server.url)
    await phone(browser, server.url)
    await freeAiPhone(browser, server.url)
  } finally {
    await browser.close()
    server.stop()
  }
  check('sin errores ni avisos inesperados en la consola', consoleErrors.length === 0, consoleErrors.join(' | '))
  process.exit(finish())
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
