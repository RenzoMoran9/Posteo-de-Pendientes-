import { describe, expect, it } from 'vitest'
import { ChatError, type ChatErrorCode } from '../errors'
import { buildSystem, buildTurns } from '../prompt'
import { OPENAI_MAX_TOKENS, makeOpenAITransport, openaiErrorCode, stripThink, type OpenAIConfig } from './openai'
import type { AskRequest } from './types'

const enc = new TextEncoder()

const delta = (content: string, finish: string | null = null) => ({ choices: [{ index: 0, delta: { content }, finish_reason: finish }] })

/** Una respuesta en streaming estilo OpenAI: `data: {json}` por trozo y `data: [DONE]` al final. */
function stream(chunks: unknown[], done = true): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + (done ? 'data: [DONE]\n\n' : '')
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(body))
        c.close()
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  )
}

const err = (status: number, error: unknown): Response => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } })

interface Seen {
  url: string
  headers: Record<string, string>
  body: { model: string; stream: boolean; max_tokens: number; messages: Array<{ role: string; content: string }> }
}

const CONFIG: OpenAIConfig = { baseURL: 'https://api.groq.com/openai/v1', key: 'gsk_ejemplo0123456789012345', model: 'llama-3.3-70b-versatile' }

function harness(respond: (seen: Seen) => Response | Promise<Response>, cfg: OpenAIConfig | null = CONFIG) {
  const seen: Seen[] = []
  const transport = makeOpenAITransport({
    getConfig: () => cfg,
    fetch: async (url, init) => {
      const headers: Record<string, string> = {}
      new Headers(init?.headers as HeadersInit).forEach((v, k) => (headers[k.toLowerCase()] = v))
      const s = { url: String(url), headers, body: JSON.parse(String(init?.body ?? '{}')) } as Seen
      seen.push(s)
      return respond(s)
    },
  })
  return { transport, seen }
}

const req = (over: Partial<AskRequest> = {}): AskRequest => ({
  system: buildSystem({ kind: 'other', engine: 'Groq' }),
  turns: buildTurns([{ role: 'user', text: 'Hola' }, { role: 'assistant', text: 'Buenas' }], '¿Qué hago primero?', 'tablero'),
  model: 'ignorado: manda la configuración',
  signal: new AbortController().signal,
  onText: () => {},
  ...over,
})

async function code(p: Promise<unknown>): Promise<ChatErrorCode> {
  try {
    await p
  } catch (e) {
    if (e instanceof ChatError) return e.code
    throw e
  }
  throw new Error('debía fallar')
}

describe('makeOpenAITransport · la petición', () => {
  it('llama a <dirección>/chat/completions con la clave como «Bearer»', async () => {
    const { transport, seen } = harness(() => stream([delta('Hola', 'stop')]))
    await transport.ask(req())
    expect(seen[0].url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(seen[0].headers.authorization).toBe('Bearer gsk_ejemplo0123456789012345')
    expect(seen[0].headers['content-type']).toBe('application/json')
  })

  it('manda el modelo de la configuración, el streaming y las instrucciones como primer mensaje «system»', async () => {
    const { transport, seen } = harness(() => stream([delta('Hola', 'stop')]))
    const r = req()
    await transport.ask(r)
    const b = seen[0].body
    expect(b.model).toBe('llama-3.3-70b-versatile')
    expect(b.stream).toBe(true)
    expect(b.max_tokens).toBe(OPENAI_MAX_TOKENS)
    expect(b.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(b.messages[0].content).toBe(r.system)
    expect(b.messages[3].content).toContain('<tablero>')
  })

  it('quita la barra final de la dirección', async () => {
    const { transport, seen } = harness(() => stream([delta('Hola', 'stop')]), { ...CONFIG, baseURL: 'https://openrouter.ai/api/v1/' })
    await transport.ask(req())
    expect(seen[0].url).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('sin clave, dirección o modelo no llama a nadie y pide completarlo', async () => {
    for (const cfg of [null, { ...CONFIG, key: '' }, { ...CONFIG, baseURL: '' }, { ...CONFIG, model: '' }]) {
      const { transport, seen } = harness(() => stream([]), cfg)
      expect(await code(transport.ask(req()))).toBe('no_access')
      expect(seen).toHaveLength(0)
    }
  })
})

describe('makeOpenAITransport · la respuesta', () => {
  it('va entregando TODO el texto escrito hasta ahora y lo devuelve completo', async () => {
    const { transport } = harness(() => stream([delta('Hola'), delta(', ¿qué '), delta('tal?', 'stop')]))
    const seenTexts: string[] = []
    const out = await transport.ask(req({ onText: (t) => seenTexts.push(t) }))
    expect(seenTexts).toEqual(['Hola', 'Hola, ¿qué ', 'Hola, ¿qué tal?'])
    expect(out).toEqual({ text: 'Hola, ¿qué tal?', truncated: false })
  })

  it('el primer trozo con solo el papel (role) y los del final sin texto no rompen nada', async () => {
    const { transport } = harness(() =>
      stream([{ choices: [{ delta: { role: 'assistant', content: '' } }] }, delta('Listo'), { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { total_tokens: 9 } }]),
    )
    expect((await transport.ask(req())).text).toBe('Listo')
  })

  it('avisa cuando la respuesta se cortó por el largo (length)', async () => {
    const { transport } = harness(() => stream([delta('Muy larga', 'length')]))
    expect(await transport.ask(req())).toEqual({ text: 'Muy larga', truncated: true })
  })

  it('funciona aunque el servicio no mande el «[DONE]» final', async () => {
    const { transport } = harness(() => stream([delta('Sin cierre', 'stop')], false))
    expect((await transport.ask(req())).text).toBe('Sin cierre')
  })

  it('esconde el pensamiento entre <think>…</think> (también mientras llega) y deja solo la respuesta', async () => {
    const { transport } = harness(() => stream([delta('<think>Voy a razo'), delta('nar un poco</think>\n\nEmpieza por lo '), delta('urgente.', 'stop')]))
    const seenTexts: string[] = []
    const out = await transport.ask(req({ onText: (t) => seenTexts.push(t) }))
    expect(out.text).toBe('Empieza por lo urgente.')
    expect(seenTexts.every((t) => !t.includes('think') && !t.includes('razo'))).toBe(true)
  })

  it('un filtro de contenido sin texto es «refused»; una respuesta vacía, «empty»', async () => {
    const a = harness(() => stream([{ choices: [{ delta: {}, finish_reason: 'content_filter' }] }]))
    expect(await code(a.transport.ask(req()))).toBe('refused')
    const b = harness(() => stream([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]))
    expect(await code(b.transport.ask(req()))).toBe('empty')
  })

  it('un error que llega ya empezada la respuesta se explica (si no hay texto)', async () => {
    const a = harness(() => stream([{ error: { message: 'Rate limit reached for model', code: 'rate_limit_exceeded' } }]))
    expect(await code(a.transport.ask(req()))).toBe('rate_limit')
    const b = harness(() => stream([{ error: { message: 'Provider returned error', code: 503 } }]))
    expect(await code(b.transport.ask(req()))).toBe('overloaded')
  })
})

describe('makeOpenAITransport · los errores', () => {
  it('clave mala (401) o sin permiso (403) → auth', async () => {
    for (const st of [401, 403]) {
      const { transport } = harness(() => err(st, { message: 'Invalid API Key', type: 'invalid_request_error' }))
      expect(await code(transport.ask(req()))).toBe('auth')
    }
  })

  it('sin saldo (402, o «insufficient_quota») → credit', async () => {
    const a = harness(() => err(402, { message: 'Insufficient credits', code: 402 }))
    expect(await code(a.transport.ask(req()))).toBe('credit')
    const b = harness(() => err(429, { message: 'You exceeded your current quota, please check your plan and billing details.', code: 'insufficient_quota' }))
    expect(await code(b.transport.ask(req()))).toBe('credit')
  })

  it('modelo que no existe (404, «model_not_found», «No endpoints found») → model', async () => {
    const a = harness(() => err(404, { message: 'The model `llama-9` does not exist', code: 'model_not_found' }))
    expect(await code(a.transport.ask(req()))).toBe('model')
    const b = harness(() => err(404, { message: 'No endpoints found matching your data policy', code: 404 }))
    expect(await code(b.transport.ask(req()))).toBe('model')
    const c = harness(() => err(400, { message: 'The model `x` has been decommissioned and is no longer supported.', code: 'model_decommissioned' }))
    expect(await code(c.transport.ask(req()))).toBe('model')
  })

  it('demasiado texto (413, «Request too large») → too_long', async () => {
    const a = harness(() => err(413, { message: 'Request too large for model `llama-3.3-70b-versatile` on tokens per minute (TPM): Limit 12000, Requested 15000', type: 'tokens' }))
    expect(await code(a.transport.ask(req()))).toBe('too_long')
    const b = harness(() => err(400, { message: "This model's maximum context length is 8192 tokens." }))
    expect(await code(b.transport.ask(req()))).toBe('too_long')
  })

  it('límite de uso (429) → rate_limit', async () => {
    const { transport } = harness(() => err(429, { message: 'Rate limit reached for model `x` in organization on requests per day (RPD)', type: 'requests' }))
    expect(await code(transport.ask(req()))).toBe('rate_limit')
  })

  it('caída (5xx) → overloaded; país no permitido → region', async () => {
    const a = harness(() => err(503, { message: 'Service Unavailable' }))
    expect(await code(a.transport.ask(req()))).toBe('overloaded')
    const b = harness(() => err(403, { message: 'This model is not available in your region.' }))
    expect(await code(b.transport.ask(req()))).toBe('region')
  })

  it('un error raro queda como unknown con lo que dijo el servicio; un cuerpo que no es JSON no se rompe', async () => {
    const a = harness(() => err(400, { message: 'Parámetro raro: foo' }))
    try {
      await a.transport.ask(req())
      throw new Error('debía fallar')
    } catch (e) {
      expect((e as ChatError).code).toBe('unknown')
      expect((e as ChatError).message).toContain('el servicio dijo: Parámetro raro: foo')
    }
    const b = harness(() => new Response('upstream connect error', { status: 502 }))
    expect(await code(b.transport.ask(req()))).toBe('overloaded')
  })

  it('un error que viene como texto simple (`{"error":"…"}`) también se entiende', async () => {
    const { transport } = harness(() => new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 }))
    expect(await code(transport.ask(req()))).toBe('auth')
  })

  it('sin conexión → network, y detenido → cancelled', async () => {
    const t = makeOpenAITransport({
      getConfig: () => CONFIG,
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    expect(await code(t.ask(req()))).toBe('network')
    const ctl = new AbortController()
    const t2 = makeOpenAITransport({
      getConfig: () => CONFIG,
      fetch: async () => {
        ctl.abort()
        throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      },
    })
    expect(await code(t2.ask(req({ signal: ctl.signal })))).toBe('cancelled')
  })
})

describe('stripThink', () => {
  it('quita los bloques completos, esconde el que aún no se cierra y no toca el resto', () => {
    expect(stripThink('Hola')).toBe('Hola')
    expect(stripThink('<think>a</think>Hola')).toBe('Hola')
    expect(stripThink('<think>a</think>\n\nHola <think>b</think>mundo')).toBe('Hola mundo')
    expect(stripThink('Antes <think>razonando…')).toBe('Antes ')
    expect(stripThink('<think>razonando…')).toBe('')
  })
})

describe('openaiErrorCode', () => {
  it('sin cuerpo entendible, decide el estado HTTP', () => {
    expect(openaiErrorCode(401, null).code).toBe('auth')
    expect(openaiErrorCode(429, undefined).code).toBe('rate_limit')
    expect(openaiErrorCode(500, {}).code).toBe('overloaded')
    expect(openaiErrorCode(418, {}).code).toBe('unknown')
  })
})
