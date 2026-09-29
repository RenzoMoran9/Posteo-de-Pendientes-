import type { JSONContent } from '@tiptap/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { mascotStore } from '../mascot/mascotStore'
import { createDefaultState, createPositsStore, taskDoc } from '../store/store'
import type { PersistedState } from '../store/types'
import type { PlanIO } from './actions'
import { assistantName, createChatStore, type ChatState } from './chatStore'
import { ChatError } from './errors'
import { itemText, listsOf } from './docOps'
import type { AskRequest, AskResponse, Transport } from './transports/types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function world(): PersistedState {
  const base = createDefaultState(1000)
  const id = Object.keys(base.notes)[0]
  base.notes[id] = {
    ...base.notes[id],
    doc: taskDoc('Compras', [
      ['Cotizar guantes', false],
      ['Firmar acta urgente hoy', false],
      ['Enviar oficio', true],
    ]),
  }
  base.stickers = {}
  return base
}

/** Un IO sobre el almacén real del tablero, sin editores ni pantalla. */
function boardIO(board: ReturnType<typeof createPositsStore>): PlanIO {
  return {
    readDoc: (id) => board.getState().notes[id]?.doc,
    writeDoc: (id, doc: JSONContent) => board.getState().setDoc(id, doc),
    addNote: (doc, color) => board.getState().addNote({ doc, color }),
    removeNote: (id) => {
      board.getState().deleteNote(id)
      board.getState().dismissToast()
    },
    readColor: (id) => board.getState().notes[id]?.color,
    setColor: (id, hex) => board.getState().patchNote(id, { color: hex }),
  }
}

interface Fake extends Transport {
  requests: AskRequest[]
}

function fake(id: Transport['id'], reply: (req: AskRequest) => Promise<AskResponse> | AskResponse): Fake {
  const requests: AskRequest[] = []
  return {
    id,
    requests,
    async ask(req) {
      requests.push(req)
      return reply(req)
    },
  }
}

const ok = (text: string): AskResponse => ({ text, truncated: false })

function setup(opts: { sample?: Fake; api?: Fake; gemini?: Fake; openai?: Fake; sampleOk?: boolean; key?: boolean; host?: boolean } = {}) {
  const board = createPositsStore(world())
  const sample = opts.sample ?? fake('sample', () => ok('Hola'))
  const api = opts.api ?? fake('api', () => ok('Hola desde la API'))
  const gemini = opts.gemini ?? fake('gemini', () => ok('Hola desde Gemini'))
  const openai = opts.openai ?? fake('openai', () => ok('Hola desde Groq'))
  const chat = createChatStore({ board, io: boardIO(board), sample, api, gemini, openai, detectSample: async () => opts.sampleOk ?? true, insideHost: () => opts.host ?? false, persist: false })
  return { board, chat, sample, api, gemini, openai, get: (): ChatState => chat.getState(), noteId: Object.keys(board.getState().notes)[0] }
}

const texts = (board: ReturnType<typeof createPositsStore>, id: string): string[] => listsOf(board.getState().notes[id].doc)[0].items.map(itemText)

const PROPOSAL = `Te propongo poner primero lo urgente.\n\n<acciones>\n[{"do":"reorder","note":"n1","list":1,"order":[2,1,3]},{"do":"number","note":"n1","list":1}]\n</acciones>`

beforeEach(() => {
  mascotStore.setState({ mood: 'idle', talking: false, bubble: null, asleep: false })
})

describe('enviar un mensaje', () => {
  it('guarda el mensaje y la respuesta, y vuelve a estar libre', async () => {
    const t = setup({ sample: fake('sample', () => ok('¡Hola! ¿En qué te ayudo?')) })
    await t.get().detect()
    expect(t.get().via).toBe('sample')
    await t.get().send('  Hola ')
    const [u, a] = t.get().messages
    expect(u).toMatchObject({ role: 'user', text: 'Hola' })
    expect(a).toMatchObject({ role: 'assistant', text: '¡Hola! ¿En qué te ayudo?', via: 'sample', streaming: false })
    expect(a.note).toBeUndefined()
    expect(a.proposal).toBeUndefined()
    expect(t.get().status).toBe('idle')
  })

  it('le manda a Claude las instrucciones, la foto del tablero y el mensaje', async () => {
    const t = setup()
    await t.get().detect()
    await t.get().send('¿Qué hago primero?')
    const req = t.sample.requests[0]
    expect(req.system).toContain('Posteo de Pendientes')
    expect(req.turns).toHaveLength(1)
    expect(req.turns[0].content).toContain('<tablero>')
    expect(req.turns[0].content).toContain('[n1] posit')
    expect(req.turns[0].content).toContain('2. [ ] Firmar acta urgente hoy')
    expect(req.turns[0].content.endsWith('¿Qué hago primero?')).toBe(true)
    expect(req.model).toBe('claude-opus-5-5')
  })

  it('sin permiso para leer los posits, solo manda los conteos', async () => {
    const t = setup()
    await t.get().detect()
    t.get().patchSettings({ shareNotes: false })
    await t.get().send('Ayúdame')
    const content = t.sample.requests[0].turns[0].content
    expect(content).toContain('no permitió que leas el contenido')
    expect(content).not.toContain('Cotizar guantes')
  })

  it('ignora mensajes vacíos y no deja mandar dos a la vez', async () => {
    let release: (r: AskResponse) => void = () => {}
    const slow = fake('sample', () => new Promise<AskResponse>((r) => (release = r)))
    const t = setup({ sample: slow })
    await t.get().detect()
    await t.get().send('   ')
    expect(t.get().messages).toHaveLength(0)
    const first = t.get().send('uno')
    expect(t.get().status).toBe('waiting')
    await t.get().send('dos')
    expect(t.get().messages).toHaveLength(2)
    release(ok('listo'))
    await first
    expect(t.get().status).toBe('idle')
    expect(slow.requests).toHaveLength(1)
  })

  it('en la segunda pregunta manda lo anterior sin la foto vieja', async () => {
    const t = setup({ sample: fake('sample', () => ok('Respuesta')) })
    await t.get().detect()
    await t.get().send('Primera')
    await t.get().send('Segunda')
    const turns = t.sample.requests[1].turns
    expect(turns.map((x) => x.role)).toEqual(['user', 'assistant', 'user'])
    expect(turns[0].content).toBe('Primera')
    expect(turns[2].content).toContain('<tablero>')
  })
})

describe('la respuesta que va llegando', () => {
  it('se enseña mientras llega y no muestra el bloque de acciones', async () => {
    let step: () => void = () => {}
    const gate = new Promise<void>((r) => (step = r))
    const streaming = fake('sample', async (req) => {
      req.onText('Te propongo esto.')
      await sleep(40)
      req.onText('Te propongo esto.\n<accio')
      await gate
      return ok(PROPOSAL)
    })
    const t = setup({ sample: streaming })
    await t.get().detect()
    const p = t.get().send('ordena')
    await sleep(60)
    expect(t.get().status).toBe('streaming')
    expect(mascotStore.getState().talking).toBe(true)
    const mid = t.get().messages[1]
    expect(mid.streaming).toBe(true)
    expect(mid.text).toBe('Te propongo esto.')
    step()
    await p
    expect(t.get().messages[1].streaming).toBe(false)
    expect(mascotStore.getState().talking).toBe(false)
  })

  it('mientras piensa (sin texto todavía) la mascota está pensando', async () => {
    let release: (r: AskResponse) => void = () => {}
    const t = setup({ sample: fake('sample', () => new Promise<AskResponse>((r) => (release = r))) })
    await t.get().detect()
    const p = t.get().send('hola')
    expect(t.get().status).toBe('waiting')
    expect(mascotStore.getState().mood).toBe('think')
    release(ok('Hola'))
    await p
    expect(mascotStore.getState().mood).not.toBe('think')
  })
})

describe('propuestas de cambios', () => {
  it('la respuesta con <acciones> se vuelve una propuesta que espera al «Aplicar»', async () => {
    const t = setup({ sample: fake('sample', () => ok(PROPOSAL)) })
    await t.get().detect()
    await t.get().send('Ordena y numera mi lista')
    const m = t.get().messages[1]
    expect(m.text).toBe('Te propongo poner primero lo urgente.')
    expect(m.text).not.toContain('acciones')
    expect(m.proposal?.state).toBe('pending')
    expect(m.proposal?.items.map((i) => i.text)).toEqual(['Reordenar la lista 1 de «Compras» (3 renglones)', 'Numerar los 3 renglones de la lista 1 de «Compras»'])
    // todavía no se tocó el tablero
    expect(texts(t.board, t.noteId)[0]).toBe('Cotizar guantes')
  })

  it('«Aplicar» cambia el posit y «Deshacer» lo deja como estaba', async () => {
    const t = setup({ sample: fake('sample', () => ok(PROPOSAL)) })
    await t.get().detect()
    await t.get().send('Ordena y numera')
    const id = t.get().messages[1].id
    const before = JSON.stringify(t.board.getState().notes[t.noteId].doc)

    t.get().apply(id)
    expect(texts(t.board, t.noteId)).toEqual(['1. Firmar acta urgente hoy', '2. Cotizar guantes', '3. Enviar oficio'])
    expect(t.get().messages[1].proposal).toMatchObject({ state: 'applied', canUndo: true })
    expect(t.board.getState().selectedId).toBe(t.noteId)
    expect(mascotStore.getState().mood).toBe('happy')

    t.get().undo(id)
    expect(JSON.stringify(t.board.getState().notes[t.noteId].doc)).toBe(before)
    expect(t.get().messages[1].proposal).toMatchObject({ state: 'undone', canUndo: false })
  })

  it('«No, gracias» la descarta sin tocar nada, y no se aplica dos veces', async () => {
    const t = setup({ sample: fake('sample', () => ok(PROPOSAL)) })
    await t.get().detect()
    await t.get().send('Ordena')
    const id = t.get().messages[1].id
    t.get().dismiss(id)
    expect(t.get().messages[1].proposal?.state).toBe('dismissed')
    t.get().apply(id)
    expect(texts(t.board, t.noteId)[0]).toBe('Cotizar guantes')

    const t2 = setup({ sample: fake('sample', () => ok(PROPOSAL)) })
    await t2.get().detect()
    await t2.get().send('Ordena')
    const id2 = t2.get().messages[1].id
    t2.get().apply(id2)
    const once = JSON.stringify(t2.board.getState().notes[t2.noteId].doc)
    t2.get().apply(id2)
    expect(JSON.stringify(t2.board.getState().notes[t2.noteId].doc)).toBe(once)
  })

  it('si el posit cambió mientras tanto, no se aplica y se explica', async () => {
    const t = setup({ sample: fake('sample', () => ok(PROPOSAL)) })
    await t.get().detect()
    await t.get().send('Ordena')
    t.board.getState().setDoc(t.noteId, taskDoc('Compras', [['Otra cosa', false]]))
    t.get().apply(t.get().messages[1].id)
    expect(texts(t.board, t.noteId)).toEqual(['Otra cosa'])
    expect(t.get().messages[1].note?.text).toMatch(/cambió desde que hablamos/)
    expect(t.get().messages[1].proposal?.state).toBe('dismissed')
  })

  it('una propuesta con acciones inválidas avisa en vez de aplicarse', async () => {
    const t = setup({ sample: fake('sample', () => ok('Va.\n<acciones>[{"do":"reorder","note":"n7","list":1,"order":[1]}]</acciones>')) })
    await t.get().detect()
    await t.get().send('Ordena')
    const m = t.get().messages[1]
    expect(m.proposal).toBeUndefined()
    expect(m.note?.text).toMatch(/No pude preparar el cambio: No veo el posit n7/)
  })

  it('un bloque cortado a la mitad no se puede aplicar', async () => {
    const t = setup({ sample: fake('sample', () => ok('Va.\n<acciones>[{"do":"number","note":"n1"')) })
    await t.get().detect()
    await t.get().send('Numera')
    const m = t.get().messages[1]
    expect(m.text).toBe('Va.')
    expect(m.proposal).toBeUndefined()
    expect(m.note?.text).toMatch(/se cortó/)
  })

  it('crear un posit nuevo y deshacerlo lo quita', async () => {
    const reply = 'Te lo dejo en un posit.\n<acciones>[{"do":"add_note","title":"Plan de hoy","items":["Firmar acta","Enviar oficio"],"color":"Azul"}]</acciones>'
    const t = setup({ sample: fake('sample', () => ok(reply)) })
    await t.get().detect()
    await t.get().send('Hazme un plan')
    const id = t.get().messages[1].id
    expect(Object.keys(t.board.getState().notes)).toHaveLength(1)
    t.get().apply(id)
    const ids = Object.keys(t.board.getState().notes)
    expect(ids).toHaveLength(2)
    const created = t.board.getState().notes[ids.find((x) => x !== t.noteId)!]
    expect(created.color).toBe('#5BA4E6')
    expect(itemText(listsOf(created.doc)[0].items[0])).toBe('Firmar acta')
    expect(t.board.getState().toast).toBeNull()
    t.get().undo(id)
    expect(Object.keys(t.board.getState().notes)).toEqual([t.noteId])
  })

  it('en la conversación siguiente Claude sabe qué pasó con su propuesta', async () => {
    const t = setup({ sample: fake('sample', () => ok(PROPOSAL)) })
    await t.get().detect()
    await t.get().send('Ordena')
    t.get().apply(t.get().messages[1].id)
    await t.get().send('Gracias')
    const turns = t.sample.requests[1].turns
    expect(turns[1].content).toContain('[La persona aplicó tu propuesta.]')
  })
})

describe('conexiones', () => {
  it('sin cuenta de Claude ni clave, contesta con las respuestas sencillas (y sus propuestas se aplican igual)', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    expect(t.get().via).toBe('local')
    await t.get().send('Ordena mis pendientes')
    const m = t.get().messages[1]
    expect(m.via).toBe('local')
    expect(m.text).toMatch(/Te propongo ordenar «Compras»/)
    expect(t.sample.requests).toHaveLength(0)
    t.get().apply(m.id)
    expect(texts(t.board, t.noteId)).toEqual(['Firmar acta urgente hoy', 'Cotizar guantes', 'Enviar oficio'])
  })

  it('con clave propia usa la API', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    t.get().saveApiKey('  sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxx  ')
    expect(t.get().hasKey).toBe(true)
    expect(t.get().via).toBe('api')
    await t.get().send('Hola')
    expect(t.api.requests).toHaveLength(1)
    expect(t.get().messages[1]).toMatchObject({ via: 'api', text: 'Hola desde la API' })
    t.get().forgetApiKey()
    expect(t.get().via).toBe('local')
  })

  it('si la cuenta de Claude no da permiso, pasa a la clave propia (o al modo sencillo) sin repetir el intento', async () => {
    const denied = fake('sample', () => {
      throw new ChatError('no_access')
    })
    const t = setup({ sample: denied })
    await t.get().detect()
    t.get().saveApiKey('sk-ant-api03-yyyyyyyyyyyyyyyyyyyyyyyy')
    await t.get().send('Hola')
    expect(t.get().messages[1].via).toBe('api')
    await t.get().send('Otra vez')
    expect(denied.requests).toHaveLength(1)
    expect(t.api.requests).toHaveLength(2)

    const t2 = setup({ sample: fake('sample', () => { throw new ChatError('no_access') }) })
    await t2.get().detect()
    await t2.get().send('¿Qué tengo pendiente?')
    const m = t2.get().messages[1]
    expect(m.via).toBe('local')
    expect(m.note?.text).toMatch(/No hay permiso para usar Claude desde aquí/)
    expect(m.text).toMatch(/pendientes abiertos/)
  })
})

describe('errores y detener', () => {
  it('un error queda escrito en un aviso, con el texto que alcanzó a llegar', async () => {
    const t = setup({
      sample: fake('sample', (req) => {
        req.onText('Te cuento que…')
        throw new ChatError('rate_limit', undefined, 'Te cuento que…')
      }),
    })
    await t.get().detect()
    await t.get().send('Hola')
    const m = t.get().messages[1]
    expect(m.text).toBe('Te cuento que…')
    expect(m.streaming).toBe(false)
    expect(m.note).toEqual({ tone: 'error', text: expect.stringContaining('límite de uso') })
    expect(t.get().status).toBe('idle')
    expect(mascotStore.getState().talking).toBe(false)
  })

  it('un error raro no rompe la conversación', async () => {
    const t = setup({ sample: fake('sample', () => Promise.reject(new TypeError('boom'))) })
    await t.get().detect()
    await t.get().send('Hola')
    expect(t.get().messages[1].note).toEqual({ tone: 'error', text: expect.stringContaining('Algo salió mal') })
    await t.get().send('Otra')
    expect(t.get().messages).toHaveLength(4)
  })

  it('«Detener» corta la respuesta y deja lo escrito', async () => {
    const stoppable = fake('sample', (req) => {
      req.onText('Voy a empezar por')
      return new Promise<AskResponse>((_res, rej) => {
        req.signal.addEventListener('abort', () => rej(new ChatError('cancelled', undefined, 'Voy a empezar por')))
      })
    })
    const t = setup({ sample: stoppable })
    await t.get().detect()
    const p = t.get().send('Plan')
    await sleep(60)
    t.get().stop()
    await p
    const m = t.get().messages[1]
    expect(m.text).toBe('Voy a empezar por')
    expect(m.note).toEqual({ tone: 'info', text: 'Detenido.' })
    expect(t.get().status).toBe('idle')
  })

  it('borrar la conversación vacía todo', async () => {
    const t = setup({ sample: fake('sample', () => ok(PROPOSAL)) })
    await t.get().detect()
    await t.get().send('Ordena')
    t.get().clear()
    expect(t.get().messages).toEqual([])
    t.get().undo('cualquiera')
    expect(t.get().status).toBe('idle')
  })
})

describe('ajustes', () => {
  it('cambian el modelo y lo mandan en la siguiente consulta', async () => {
    const t = setup()
    await t.get().detect()
    t.get().patchSettings({ model: 'claude-haiku-4-5' })
    await t.get().send('Hola')
    expect(t.sample.requests[0].model).toBe('claude-haiku-4-5')
  })

  it('abrir y cerrar el panel, y pasar a los ajustes', () => {
    const t = setup()
    t.get().setOpen(true)
    expect(t.get().open).toBe(true)
    t.get().showSettings(true)
    expect(t.get().view).toBe('settings')
    t.get().toggle()
    expect(t.get().open).toBe(false)
    expect(t.get().view).toBe('chat')
  })
})

describe('IA gratuita: Gemini, Groq y otras', () => {
  const KEY_G = 'AIzaSyEjemplo-0123456789abcdefghijklmnopq'

  it('sin cuenta ni claves, contesta el modo sencillo; Gemini es el servicio que se ofrece por defecto', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    expect(t.get().via).toBe('local')
    expect(t.get().provider).toBe('gemini')
    expect(t.get().keys).toEqual({ claude: false, gemini: false, groq: false, custom: false })
  })

  it('al guardar la clave de Gemini, se queda con Gemini y contesta con él (con su modelo recomendado)', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    t.get().saveProviderKey('gemini', `  ${KEY_G} `)
    expect(t.get().keys.gemini).toBe(true)
    expect(t.get().settings.provider).toBe('gemini')
    expect(t.get().via).toBe('gemini')
    await t.get().send('¿Qué hago primero?')
    expect(t.gemini.requests).toHaveLength(1)
    expect(t.gemini.requests[0].model).toBe('gemini-3.8-flash')
    expect(t.sample.requests).toHaveLength(0)
    expect(t.api.requests).toHaveLength(0)
    const a = t.get().messages[1]
    expect(a).toMatchObject({ role: 'assistant', text: 'Hola desde Gemini', via: 'gemini', streaming: false })
  })

  it('no se hace pasar por Claude: las instrucciones dicen con qué modelo funciona', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    t.get().saveProviderKey('gemini', KEY_G)
    await t.get().send('Hola')
    const sys = t.gemini.requests[0].system
    expect(sys).toContain('funcionas con Gemini, modelo gemini-3.8-flash')
    expect(sys).not.toContain('Eres Claude')
    expect(sys).toContain('ayudar con SUS pendientes')
    // y a Claude sí se le dice que es Claude
    const c = setup({ sampleOk: true })
    await c.get().detect()
    await c.get().send('Hola')
    expect(c.sample.requests[0].system).toContain('Eres Claude')
  })

  it('el modelo elegido se usa en el siguiente mensaje, y vaciarlo devuelve el recomendado', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    t.get().saveProviderKey('gemini', KEY_G)
    t.get().setModel('gemini', ' gemini-2.5-flash ')
    expect(t.get().settings.models.gemini).toBe('gemini-2.5-flash')
    await t.get().send('uno')
    expect(t.gemini.requests[0].model).toBe('gemini-2.5-flash')
    t.get().setModel('gemini', '   ')
    expect(t.get().settings.models.gemini).toBeUndefined()
    await t.get().send('dos')
    expect(t.gemini.requests[1].model).toBe('gemini-3.8-flash')
  })

  it('Groq usa la conexión «compatible con OpenAI» y su modelo recomendado', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    t.get().saveProviderKey('groq', 'gsk_0123456789abcdefghijklmnop')
    expect(t.get().via).toBe('openai')
    expect(t.get().provider).toBe('groq')
    await t.get().send('Hola')
    expect(t.openai.requests[0].model).toBe('llama-3.3-70b-versatile')
    expect(t.openai.requests[0].system).toContain('funcionas con Groq')
    expect(t.get().messages[1]).toMatchObject({ text: 'Hola desde Groq', via: 'openai' })
  })

  it('«otra IA»: hace falta clave, dirección válida y modelo; con todo, contesta', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    t.get().saveProviderKey('custom', 'sk-or-v1-loquesea')
    expect(t.get().via).toBe('local') // falta la dirección y el modelo
    t.get().setCustomBase('http://ejemplo.com/v1')
    t.get().setModel('custom', 'openrouter/free')
    expect(t.get().via).toBe('local') // http sin https
    t.get().setCustomBase('openrouter.ai/api/v1')
    expect(t.get().via).toBe('openai')
    await t.get().send('Hola')
    expect(t.openai.requests[0].model).toBe('openrouter/free')
  })

  it('elegir un servicio sin clave deja el modo sencillo (aunque otro tenga clave), y volver a elegir el que la tiene lo reactiva', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    t.get().saveProviderKey('gemini', KEY_G)
    t.get().setProvider('groq')
    expect(t.get().via).toBe('local')
    t.get().setProvider('gemini')
    expect(t.get().via).toBe('gemini')
  })

  it('quien ya usaba su clave de Claude sigue con ella; y si luego agrega una gratuita, se pasa a esa', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    t.get().saveApiKey('sk-ant-api03-0123456789abcdefghij')
    expect(t.get().via).toBe('api')
    expect(t.get().hasKey).toBe(true)
    t.get().saveProviderKey('gemini', KEY_G)
    expect(t.get().via).toBe('gemini')
    t.get().setProvider('claude')
    expect(t.get().via).toBe('api')
    t.get().forgetApiKey()
    expect(t.get().hasKey).toBe(false)
    expect(t.get().via).toBe('local')
  })

  it('dentro del enlace de prueba de claude.ai solo vale la cuenta de Claude: las claves gratuitas no se usan', async () => {
    const t = setup({ sampleOk: false, host: true })
    await t.get().detect()
    t.get().saveProviderKey('gemini', KEY_G)
    expect(t.get().via).toBe('local')
    const ok = setup({ sampleOk: true, host: true })
    await ok.get().detect()
    ok.get().saveProviderKey('gemini', KEY_G)
    expect(ok.get().via).toBe('sample')
  })

  it('olvidar una clave la borra y vuelve al modo sencillo', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    t.get().saveProviderKey('gemini', KEY_G)
    t.get().forgetProviderKey('gemini')
    expect(t.get().keys.gemini).toBe(false)
    expect(t.get().via).toBe('local')
  })

  it('un error del servicio se explica en el mensaje; si trae su propio texto (con lo que dijo el servicio), se muestra ese', async () => {
    const t = setup({
      sampleOk: false,
      gemini: fake('gemini', () => {
        throw new ChatError('rate_limit')
      }),
    })
    await t.get().detect()
    t.get().saveProviderKey('gemini', KEY_G)
    await t.get().send('Hola')
    expect(t.get().messages[1].note).toMatchObject({ tone: 'error', text: expect.stringContaining('límite de uso') })
    const u = setup({
      sampleOk: false,
      gemini: fake('gemini', () => {
        throw new ChatError('unknown', 'Algo salió mal (Google dijo: cuota).')
      }),
    })
    await u.get().detect()
    u.get().saveProviderKey('gemini', KEY_G)
    await u.get().send('Hola')
    expect(u.get().messages[1].note?.text).toBe('Algo salió mal (Google dijo: cuota).')
  })

  it('un cambio en los ajustes borra el resultado de la última prueba', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    t.get().saveProviderKey('gemini', KEY_G)
    await t.get().testConnection()
    expect(t.get().test.status).toBe('ok')
    t.get().setModel('gemini', 'gemini-2.5-flash')
    expect(t.get().test).toEqual({ status: 'idle', message: '' })
  })
})

describe('probar la conexión', () => {
  const KEY_G = 'AIzaSyEjemplo-0123456789abcdefghijklmnopq'

  it('manda un mensajito mínimo (sin el tablero) y dice qué modelo contestó', async () => {
    const t = setup({ sampleOk: false, gemini: fake('gemini', () => ok('ok')) })
    await t.get().detect()
    t.get().saveProviderKey('gemini', KEY_G)
    await t.get().testConnection()
    expect(t.get().test.status).toBe('ok')
    expect(t.get().test.message).toContain('Gemini (gemini-3.8-flash)')
    const req = t.gemini.requests[0]
    expect(req.turns).toEqual([{ role: 'user', content: 'Hola' }])
    expect(req.system).toContain('Responde solo con la palabra')
    expect(t.get().messages).toHaveLength(0) // no ensucia la conversación
  })

  it('si falla, explica por qué (clave mala, sin conexión…)', async () => {
    const t = setup({
      sampleOk: false,
      gemini: fake('gemini', () => {
        throw new ChatError('auth')
      }),
    })
    await t.get().detect()
    t.get().saveProviderKey('gemini', KEY_G)
    await t.get().testConnection()
    expect(t.get().test).toEqual({ status: 'error', message: expect.stringContaining('La clave no es válida') })
  })

  it('sin clave guardada, pide pegarla primero (y no llama a nadie)', async () => {
    const t = setup({ sampleOk: false })
    await t.get().detect()
    await t.get().testConnection()
    expect(t.get().test).toEqual({ status: 'error', message: 'Primero pega la clave y guárdala.' })
    expect(t.gemini.requests).toHaveLength(0)
  })

  it('no permite dos pruebas a la vez', async () => {
    let release: (r: AskResponse) => void = () => {}
    const slow = fake('gemini', () => new Promise<AskResponse>((r) => (release = r)))
    const t = setup({ sampleOk: false, gemini: slow })
    await t.get().detect()
    t.get().saveProviderKey('gemini', KEY_G)
    const first = t.get().testConnection()
    expect(t.get().test.status).toBe('running')
    await t.get().testConnection()
    release(ok('ok'))
    await first
    expect(slow.requests).toHaveLength(1)
  })
})

describe('assistantName', () => {
  it('Claude cuando contesta Claude, el nombre del servicio cuando es otro, y «Asistente» en modo sencillo', () => {
    expect(assistantName('sample', 'gemini')).toBe('Claude')
    expect(assistantName('api', 'claude')).toBe('Claude')
    expect(assistantName('gemini', 'gemini')).toBe('Gemini')
    expect(assistantName('openai', 'groq')).toBe('Groq')
    expect(assistantName('openai', 'custom')).toBe('Otra IA')
    expect(assistantName('local', 'gemini')).toBe('Asistente')
  })
})

