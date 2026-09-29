import { afterEach, describe, expect, it } from 'vitest'
import { ChatError } from '../errors'
import { buildSystem, buildTurns } from '../prompt'
import { findSample, forgetSample, sampleTransport } from './sample'
import type { AskRequest } from './types'

type Host = { claude?: { use: (n: string) => Promise<unknown> } }
const g = globalThis as unknown as { window?: Host }

afterEach(() => {
  delete g.window
  forgetSample()
})

function request(over: Partial<AskRequest> = {}): AskRequest {
  return { system: buildSystem(), turns: buildTurns([], 'Hola', 'tablero'), model: 'claude-opus-5-5', signal: new AbortController().signal, onText: () => {}, ...over }
}

describe('findSample', () => {
  it('fuera del enlace de prueba (sin window.claude) no está disponible', async () => {
    expect(await findSample()).toBeNull()
    g.window = {}
    forgetSample()
    expect(await findSample()).toBeNull()
  })

  it('si la página no ofrece «sample», tampoco', async () => {
    g.window = { claude: { use: async () => null } }
    expect(await findSample()).toBeNull()
  })

  it('con window.claude.use("sample") devuelve la función, y lo recuerda', async () => {
    let calls = 0
    const fn = async () => ({ text: 'x', truncated: false })
    g.window = { claude: { use: async (n) => (calls++, n === 'sample' ? fn : null) } }
    expect(await findSample()).toBe(fn)
    expect(await findSample()).toBe(fn)
    expect(calls).toBe(1)
  })

  it('si `use` falla, no está disponible', async () => {
    g.window = { claude: { use: async () => Promise.reject(new Error('x')) } }
    expect(await findSample()).toBeNull()
  })
})

describe('sampleTransport.ask', () => {
  it('manda las instrucciones como primer turno, sin caché y con el nivel del modelo', async () => {
    let seen: { input: unknown; opts: Record<string, unknown> } | null = null
    g.window = {
      claude: {
        use: async () => async (input: unknown, opts: Record<string, unknown>) => {
          seen = { input, opts }
          ;(opts.onText as (u: { text: string; delta: string }) => void)({ text: 'Hola', delta: 'Hola' })
          return { text: 'Hola, ¿qué tal?', truncated: false }
        },
      },
    }
    const shown: string[] = []
    const req = request({ onText: (t) => shown.push(t), model: 'claude-haiku-4-5' })
    const r = await sampleTransport.ask(req)
    expect(r).toEqual({ text: 'Hola, ¿qué tal?', truncated: false })
    expect(shown).toEqual(['Hola'])
    const input = seen!.input as Array<{ role: string; content: string }>
    expect(input[0].role).toBe('user')
    expect(input[0].content).toContain('INSTRUCCIONES PERMANENTES')
    expect(input[0].content).toContain('Posteo de Pendientes')
    expect(input.at(-1)).toEqual(req.turns.at(-1))
    expect(seen!.opts.cache).toBe(false)
    expect(seen!.opts.modelTier).toBe('quick')
    expect(seen!.opts.signal).toBe(req.signal)
  })

  it('cada modelo pide su nivel', async () => {
    const tiers: unknown[] = []
    g.window = { claude: { use: async () => async (_i: unknown, o: { modelTier: unknown }) => (tiers.push(o.modelTier), { text: 'x', truncated: false }) } }
    for (const model of ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5'] as const) await sampleTransport.ask(request({ model }))
    expect(tiers).toEqual(['complex', 'default', 'quick'])
  })

  it('sin la capacidad, avisa que no hay acceso', async () => {
    await expect(sampleTransport.ask(request())).rejects.toMatchObject({ code: 'no_access' })
  })

  it('traduce los errores de la página a los de la app y conserva el texto parcial', async () => {
    const cases: Array<[string, string]> = [
      ['not_granted', 'no_access'],
      ['sampling_disabled', 'no_access'],
      ['rate_limited', 'rate_limit'],
      ['prompt_too_large', 'too_long'],
      ['refused', 'refused'],
      ['empty_completion', 'empty'],
      ['upstream_error', 'network'],
      ['cancelled', 'cancelled'],
      ['algo_nuevo', 'unknown'],
    ]
    for (const [from, to] of cases) {
      forgetSample()
      g.window = { claude: { use: async () => async () => Promise.reject({ code: from, message: 'x', text: 'parcial' }) } }
      const e = await sampleTransport.ask(request()).catch((x: unknown) => x)
      expect(e).toBeInstanceOf(ChatError)
      expect((e as ChatError).code).toBe(to)
      expect((e as ChatError).partial).toBe('parcial')
    }
  })
})
