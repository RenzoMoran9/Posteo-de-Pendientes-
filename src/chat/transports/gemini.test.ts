import { describe, expect, it } from 'vitest'
import { ChatError, type ChatErrorCode } from '../errors'
import { buildSystem, buildTurns } from '../prompt'
import { GEMINI_BASE, GEMINI_MAX_TOKENS, geminiErrorCode, makeGeminiTransport } from './gemini'
import type { AskRequest } from './types'

const enc = new TextEncoder()

/** Una respuesta en streaming como la de `streamGenerateContent?alt=sse`: un `data:` con un JSON por trozo. */
function stream(chunks: unknown[], status = 200): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\r\n\r\n`).join('')
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(body))
        c.close()
      },
    }),
    // Google contesta «text/event-stream» incluso cuando falla (con un JSON dentro)
    { status, headers: { 'content-type': 'text/event-stream' } },
  )
}

const part = (text: string, finishReason?: string, extra: Record<string, unknown> = {}) => ({
  candidates: [{ content: { role: 'model', parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }],
  ...extra,
})

/** El cuerpo de error que manda Google no va dentro de `data:`: es un JSON suelto. */
const rawError = (status: number, message: string, apiStatus = 'INVALID_ARGUMENT', reason?: string): Response =>
  new Response(JSON.stringify({ error: { code: status, message, status: apiStatus, ...(reason ? { details: [{ reason }] } : {}) } }), {
    status,
    headers: { 'content-type': 'text/event-stream' },
  })

interface Seen {
  url: string
  headers: Record<string, string>
  body: {
    systemInstruction: { parts: Array<{ text: string }> }
    contents: Array<{ role: string; parts: Array<{ text: string }> }>
    generationConfig: { maxOutputTokens: number }
  }
}

function harness(respond: (seen: Seen) => Response | Promise<Response>, key: string | null = 'AIzaSyEjemplo-de-clave-0123456789') {
  const seen: Seen[] = []
  const transport = makeGeminiTransport({
    getKey: () => key,
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
  system: buildSystem({ kind: 'other', engine: 'Gemini' }),
  turns: buildTurns([{ role: 'user', text: 'Hola' }, { role: 'assistant', text: 'Buenas' }], '¿Qué hago primero?', 'tablero'),
  model: 'gemini-3.8-flash',
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

describe('makeGeminiTransport · la petición', () => {
  it('llama a streamGenerateContent con la clave en el encabezado (no en la dirección)', async () => {
    const { transport, seen } = harness(() => stream([part('Hola', 'STOP')]))
    await transport.ask(req())
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe(`${GEMINI_BASE}/models/gemini-3.8-flash:streamGenerateContent?alt=sse`)
    expect(seen[0].url).not.toContain('key=')
    expect(seen[0].headers['x-goog-api-key']).toBe('AIzaSyEjemplo-de-clave-0123456789')
    expect(seen[0].headers['content-type']).toBe('application/json')
  })

  it('manda las instrucciones como systemInstruction y la conversación con los papeles user / model', async () => {
    const { transport, seen } = harness(() => stream([part('Hola', 'STOP')]))
    const r = req()
    await transport.ask(r)
    const b = seen[0].body
    expect(b.systemInstruction.parts[0].text).toBe(r.system)
    expect(b.systemInstruction.parts[0].text).toContain('funcionas con Gemini')
    expect(b.contents.map((c) => c.role)).toEqual(['user', 'model', 'user'])
    expect(b.contents[0].parts[0].text).toBe('Hola')
    expect(b.contents[2].parts[0].text).toContain('<tablero>')
    expect(b.generationConfig.maxOutputTokens).toBe(GEMINI_MAX_TOKENS)
  })

  it('no manda temperatura ni ajustes de «pensar» (cada modelo tiene los suyos y Google recomienda dejarlos)', async () => {
    const { transport, seen } = harness(() => stream([part('Hola', 'STOP')]))
    await transport.ask(req())
    expect(JSON.stringify(seen[0].body)).not.toMatch(/temperature|thinking/i)
  })

  it('acepta el nombre del modelo con «models/» delante y lo escapa en la dirección', async () => {
    const { transport, seen } = harness(() => stream([part('Hola', 'STOP')]))
    await transport.ask(req({ model: 'models/gemini-2.5-flash' }))
    expect(seen[0].url).toContain('/models/gemini-2.5-flash:streamGenerateContent')
  })

  it('sin clave no llama a nadie y pide pegarla', async () => {
    const { transport, seen } = harness(() => stream([]), null)
    expect(await code(transport.ask(req()))).toBe('no_access')
    expect(seen).toHaveLength(0)
  })
})

describe('makeGeminiTransport · la respuesta', () => {
  it('va entregando TODO el texto escrito hasta ahora (no solo lo nuevo) y lo devuelve completo', async () => {
    const { transport } = harness(() => stream([part('Hola'), part(', ¿qué '), part('tal?', 'STOP')]))
    const seenTexts: string[] = []
    const out = await transport.ask(req({ onText: (t) => seenTexts.push(t) }))
    expect(seenTexts).toEqual(['Hola', 'Hola, ¿qué ', 'Hola, ¿qué tal?'])
    expect(out).toEqual({ text: 'Hola, ¿qué tal?', truncated: false })
  })

  it('une los varios pedazos («parts») de un mismo trozo y se salta los pensamientos (thought)', async () => {
    const { transport } = harness(() =>
      stream([
        { candidates: [{ content: { parts: [{ text: 'razonando…', thought: true }, { text: 'Uno' }, { text: ' y dos' }] } }] },
        part('.', 'STOP'),
      ]),
    )
    const out = await transport.ask(req())
    expect(out.text).toBe('Uno y dos.')
  })

  it('un trozo sin texto (solo el cierre o el conteo de tokens) no rompe nada', async () => {
    const { transport } = harness(() => stream([part('Hola'), { candidates: [{ finishReason: 'STOP' }], usageMetadata: { totalTokenCount: 12 } }]))
    expect((await transport.ask(req())).text).toBe('Hola')
  })

  it('avisa cuando la respuesta se cortó por el largo (MAX_TOKENS)', async () => {
    const { transport } = harness(() => stream([part('Va a ser muy larga', 'MAX_TOKENS')]))
    expect(await transport.ask(req())).toEqual({ text: 'Va a ser muy larga', truncated: true })
  })

  it('si el límite de largo se gastó en «pensar» y no hay respuesta, lo explica como «demasiado texto»', async () => {
    const { transport } = harness(() => stream([{ candidates: [{ finishReason: 'MAX_TOKENS' }] }]))
    expect(await code(transport.ask(req()))).toBe('too_long')
  })

  it('una respuesta vacía es un error «empty»', async () => {
    const { transport } = harness(() => stream([{ candidates: [{ finishReason: 'STOP' }] }]))
    expect(await code(transport.ask(req()))).toBe('empty')
  })

  it('un bloqueo de seguridad (o del mensaje) es «refused», y conserva lo que alcanzó a escribir', async () => {
    const a = harness(() => stream([{ promptFeedback: { blockReason: 'SAFETY' } }]))
    expect(await code(a.transport.ask(req()))).toBe('refused')
    const b = harness(() => stream([{ candidates: [{ finishReason: 'SAFETY' }] }]))
    expect(await code(b.transport.ask(req()))).toBe('refused')
    const c = harness(() => stream([part('Te cuento', 'STOP', { promptFeedback: { blockReason: 'OTHER' } })]))
    try {
      await c.transport.ask(req())
      throw new Error('debía fallar')
    } catch (e) {
      expect((e as ChatError).code).toBe('refused')
      expect((e as ChatError).partial).toBe('Te cuento')
    }
  })

  it('ignora un trozo que no se entiende como JSON', async () => {
    const body = 'data: {esto no es json\r\n\r\ndata: ' + JSON.stringify(part('Bien', 'STOP')) + '\r\n\r\n'
    const { transport } = harness(() => new Response(body, { status: 200 }))
    expect((await transport.ask(req())).text).toBe('Bien')
  })
})

describe('makeGeminiTransport · los errores', () => {
  it('clave inválida (400 API_KEY_INVALID) → auth', async () => {
    const { transport } = harness(() => rawError(400, 'API key not valid. Please pass a valid API key.', 'INVALID_ARGUMENT', 'API_KEY_INVALID'))
    expect(await code(transport.ask(req()))).toBe('auth')
  })

  it('sin identidad (403) → auth', async () => {
    const { transport } = harness(() => rawError(403, "Method doesn't allow unregistered callers", 'PERMISSION_DENIED'))
    expect(await code(transport.ask(req()))).toBe('auth')
  })

  it('país no permitido → region', async () => {
    const { transport } = harness(() => rawError(400, 'User location is not supported for the API use.', 'FAILED_PRECONDITION'))
    expect(await code(transport.ask(req()))).toBe('region')
  })

  it('modelo que no existe (404) → model', async () => {
    const { transport } = harness(() => rawError(404, 'models/gemini-9 is not found for API version v1beta, or is not supported for generateContent.', 'NOT_FOUND'))
    expect(await code(transport.ask(req()))).toBe('model')
  })

  it('cuota agotada (429 RESOURCE_EXHAUSTED) → rate_limit', async () => {
    const { transport } = harness(() => rawError(429, 'You exceeded your current quota', 'RESOURCE_EXHAUSTED'))
    expect(await code(transport.ask(req()))).toBe('rate_limit')
  })

  it('saturación o caída (500, 503) → overloaded', async () => {
    for (const st of [500, 503]) {
      const { transport } = harness(() => rawError(st, 'The model is overloaded.', 'UNAVAILABLE'))
      expect(await code(transport.ask(req()))).toBe('overloaded')
    }
  })

  it('demasiado texto → too_long', async () => {
    const { transport } = harness(() => rawError(400, 'The input token count (2000000) exceeds the maximum number of tokens allowed (1048576).'))
    expect(await code(transport.ask(req()))).toBe('too_long')
  })

  it('un error raro queda como unknown y trae lo que dijo Google, recortado', async () => {
    const { transport } = harness(() => rawError(400, 'Algo inesperado con tu petición'))
    try {
      await transport.ask(req())
      throw new Error('debía fallar')
    } catch (e) {
      expect((e as ChatError).code).toBe('unknown')
      expect((e as ChatError).message).toContain('Google dijo: Algo inesperado con tu petición')
    }
  })

  it('un error cuyo cuerpo no es JSON no se rompe', async () => {
    const { transport } = harness(() => new Response('<html>Bad gateway</html>', { status: 502 }))
    expect(await code(transport.ask(req()))).toBe('overloaded')
  })

  it('sin conexión (fetch falla) → network', async () => {
    const t = makeGeminiTransport({
      getKey: () => 'AIzaSy-clave',
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    expect(await code(t.ask(req()))).toBe('network')
  })

  it('detenido por la persona → cancelled, antes de empezar o a mitad de la respuesta', async () => {
    const early = new AbortController()
    const t1 = makeGeminiTransport({
      getKey: () => 'AIzaSy-clave',
      fetch: async (_u, init) => {
        early.abort()
        const sig = init?.signal
        if (sig?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
        return stream([])
      },
    })
    expect(await code(t1.ask(req({ signal: early.signal })))).toBe('cancelled')

    const ctl = new AbortController()
    const t2 = makeGeminiTransport({
      getKey: () => 'AIzaSy-clave',
      fetch: async () =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(enc.encode(`data: ${JSON.stringify(part('Empecé a contes'))}\r\n\r\n`))
            },
            pull() {
              ctl.abort()
              throw Object.assign(new Error('aborted'), { name: 'AbortError' })
            },
          }),
          { status: 200 },
        ),
    })
    try {
      await t2.ask(req({ signal: ctl.signal }))
      throw new Error('debía fallar')
    } catch (e) {
      expect((e as ChatError).code).toBe('cancelled')
      expect((e as ChatError).partial).toBe('Empecé a contes')
    }
  })
})

describe('geminiErrorCode', () => {
  const body = (message: string, reason?: string) => ({ error: { message, ...(reason ? { details: [{ reason }] } : {}) } })

  it('la razón API_KEY_INVALID manda sobre el estado', () => {
    expect(geminiErrorCode(400, body('x', 'API_KEY_INVALID')).code).toBe('auth')
  })

  it('un modelo que no sirve para generar (400 con «model … not supported») es model', () => {
    expect(geminiErrorCode(400, body('Model gemini-x is not supported for generateContent')).code).toBe('model')
  })

  it('sin cuerpo entendible, decide el estado HTTP', () => {
    expect(geminiErrorCode(401, null).code).toBe('auth')
    expect(geminiErrorCode(429, null).code).toBe('rate_limit')
    expect(geminiErrorCode(504, null).code).toBe('overloaded')
    expect(geminiErrorCode(418, null).code).toBe('unknown')
  })
})
