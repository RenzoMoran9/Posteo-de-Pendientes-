import { describe, expect, it } from 'vitest'
import { ChatError } from '../errors'
import { buildSystem, buildTurns } from '../prompt'
import { codeForStatus, effortFor, makeApiTransport, MAX_TOKENS } from './api'
import type { AskRequest } from './types'

const enc = new TextEncoder()

/** Un flujo de eventos como el que devuelve la API de mensajes con `stream: true`. */
function sse(deltas: string[], stop: string = 'end_turn'): Response {
  const events: Array<[string, unknown]> = [
    ['message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', content: [], model: 'claude-opus-5-5', stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ...deltas.map((t): [string, unknown] => ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }]),
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 20 } }],
    ['message_stop', { type: 'message_stop' }],
  ]
  const body = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('')
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

const errorResponse = (status: number, message: string): Response =>
  new Response(JSON.stringify({ type: 'error', error: { type: 'x', message } }), { status, headers: { 'content-type': 'application/json' } })

interface Seen {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

function harness(respond: (seen: Seen) => Response | Promise<Response>, key: string | null = 'sk-ant-api03-test') {
  const seen: Seen[] = []
  const transport = makeApiTransport({
    getKey: () => key,
    maxRetries: 0,
    fetch: async (url, init) => {
      const headers: Record<string, string> = {}
      new Headers(init?.headers as HeadersInit).forEach((v, k) => (headers[k.toLowerCase()] = v))
      const s = { url: String(url), headers, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> }
      seen.push(s)
      return respond(s)
    },
  })
  return { transport, seen }
}

const req = (over: Partial<AskRequest> = {}): AskRequest => ({ system: buildSystem(), turns: buildTurns([], 'Hola', 'tablero'), model: 'claude-opus-5-5', signal: new AbortController().signal, onText: () => {}, ...over })

describe('makeApiTransport', () => {
  it('manda la petición correcta a la API de mensajes y devuelve lo que se va escribiendo', async () => {
    const { transport, seen } = harness(() => sse(['Hola', ', ¿qué ', 'tal?']))
    const shown: string[] = []
    const r = await transport.ask(req({ onText: (t) => shown.push(t) }))
    expect(r).toEqual({ text: 'Hola, ¿qué tal?', truncated: false })
    expect(shown.at(-1)).toBe('Hola, ¿qué tal?')
    expect(shown.length).toBeGreaterThanOrEqual(2)
    expect(shown[0].length).toBeLessThan(shown.at(-1)!.length) // llegó por pedazos

    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe('https://api.anthropic.com/v1/messages')
    expect(seen[0].headers['x-api-key']).toBe('sk-ant-api03-test')
    expect(seen[0].headers['anthropic-version']).toBe('2023-06-01')
    expect(seen[0].body).toMatchObject({ model: 'claude-opus-5-5', max_tokens: MAX_TOKENS, stream: true, output_config: { effort: 'medium' } })
    expect(String(seen[0].body.system)).toContain('Posteo de Pendientes')
    expect(seen[0].body.messages).toEqual([{ role: 'user', content: expect.stringContaining('<tablero>') }])
    // no manda «thinking» (Opus 5.5 siempre piensa y no admite apagarlo)
    expect(seen[0].body).not.toHaveProperty('thinking')
  })

  it('con Haiku no pide nivel de esfuerzo (no lo admite)', async () => {
    const { transport, seen } = harness(() => sse(['ok']))
    await transport.ask(req({ model: 'claude-haiku-4-5' }))
    expect(seen[0].body.model).toBe('claude-haiku-4-5')
    expect(seen[0].body).not.toHaveProperty('output_config')
    expect(effortFor('claude-haiku-4-5')).toBeUndefined()
    expect(effortFor('claude-sonnet-5-5')).toBe('medium')
  })

  it('avisa si la respuesta se cortó por el límite', async () => {
    const { transport } = harness(() => sse(['Muy largo…'], 'max_tokens'))
    expect(await transport.ask(req())).toEqual({ text: 'Muy largo…', truncated: true })
  })

  it('un rechazo de Claude se avisa como tal', async () => {
    const { transport } = harness(() => sse(['No puedo'], 'refusal'))
    await expect(transport.ask(req())).rejects.toMatchObject({ code: 'refused' })
  })

  it('sin clave no llama a nadie', async () => {
    const { transport, seen } = harness(() => sse(['x']), null)
    await expect(transport.ask(req())).rejects.toMatchObject({ code: 'no_access' })
    expect(seen).toHaveLength(0)
  })

  it('traduce los errores de la API', async () => {
    const cases: Array<[number, string, string]> = [
      [401, 'invalid x-api-key', 'auth'],
      [403, 'forbidden', 'auth'],
      [429, 'rate limit', 'rate_limit'],
      [529, 'Overloaded', 'overloaded'],
      [500, 'internal', 'overloaded'],
      [400, 'Your credit balance is too low to access the Anthropic API', 'credit'],
      [400, 'prompt is too long: 300000 tokens > 200000 maximum', 'too_long'],
      [413, 'request too large', 'too_long'],
      [400, 'otra cosa', 'unknown'],
    ]
    for (const [status, message, code] of cases) {
      const { transport } = harness(() => errorResponse(status, message))
      const e = await transport.ask(req()).catch((x: unknown) => x)
      expect(e).toBeInstanceOf(ChatError)
      expect((e as ChatError).code).toBe(code)
    }
  })

  it('sin internet, avisa de la conexión', async () => {
    const transport = makeApiTransport({ getKey: () => 'k', maxRetries: 0, fetch: async () => Promise.reject(new TypeError('Failed to fetch')) })
    await expect(transport.ask(req())).rejects.toMatchObject({ code: 'network' })
  })

  it('al detenerla, queda como cancelada y conserva lo escrito', async () => {
    const ctl = new AbortController()
    const transport = makeApiTransport({
      getKey: () => 'k',
      maxRetries: 0,
      fetch: async (_u, init) => {
        const signal = init?.signal as AbortSignal
        const start = enc.encode(
          `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', content: [], model: 'x', stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } })}\n\n` +
            `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n` +
            `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Voy a empezar' } })}\n\n`,
        )
        return new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(start)
              signal.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError')))
            },
          }),
          { status: 200, headers: { 'content-type': 'text/event-stream' } },
        )
      },
    })
    const p = transport.ask(req({ signal: ctl.signal, onText: () => setTimeout(() => ctl.abort(), 5) }))
    const e = (await p.catch((x: unknown) => x)) as ChatError
    expect(e).toBeInstanceOf(ChatError)
    expect(e.code).toBe('cancelled')
    expect(e.partial).toBe('Voy a empezar')
  })
})

describe('codeForStatus', () => {
  it('cubre los casos comunes', () => {
    expect(codeForStatus(undefined, '')).toBe('unknown')
    expect(codeForStatus(404, 'model: not found')).toBe('unknown')
    expect(codeForStatus(503, '')).toBe('overloaded')
  })
})
