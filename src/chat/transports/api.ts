import type { ClientOptions } from '@anthropic-ai/sdk'
import { ChatError, type ChatErrorCode } from '../errors'
import type { AskRequest, AskResponse, Transport } from './types'

/**
 * La conexión con la clave propia: la app le habla directamente a la API de Anthropic desde el navegador (la clave
 * solo sale hacia api.anthropic.com). El SDK se carga al primer mensaje, no al abrir la página.
 */

export const MAX_TOKENS = 16_000

/** Qué tanto piensa cada modelo: el más chico no admite ese ajuste. */
export function effortFor(model: string): 'medium' | undefined {
  return model === 'claude-haiku-4-5' ? undefined : 'medium'
}

/** Los estados HTTP de la API, en códigos de la app. */
export function codeForStatus(status: number | undefined, message: string): ChatErrorCode {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status === 413) return 'too_long'
  if (status === 400) {
    if (/credit balance|billing|plans & billing/i.test(message)) return 'credit'
    if (/too long|too many tokens|exceed/i.test(message)) return 'too_long'
    return 'unknown'
  }
  if (status !== undefined && status >= 500) return 'overloaded'
  return 'unknown'
}

export interface ApiOptions {
  getKey: () => string | null
  /** Para las pruebas: un `fetch` de mentira. */
  fetch?: ClientOptions['fetch']
  baseURL?: string
  /** Cuántas veces reintenta el SDK ante una falla pasajera (por defecto 1). */
  maxRetries?: number
}

export function makeApiTransport(opts: ApiOptions): Transport {
  return {
    id: 'api',
    async ask(req: AskRequest): Promise<AskResponse> {
      const key = opts.getKey()
      if (!key) throw new ChatError('no_access', 'Falta la clave. Pégala en ⚙ Ajustes.')
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: opts.maxRetries ?? 1, fetch: opts.fetch, baseURL: opts.baseURL })
      let text = ''
      try {
        const effort = effortFor(req.model)
        const stream = client.messages.stream(
          {
            model: req.model,
            max_tokens: MAX_TOKENS,
            system: req.system,
            messages: req.turns.map((t) => ({ role: t.role, content: t.content })),
            ...(effort ? { output_config: { effort } } : {}),
          },
          { signal: req.signal },
        )
        stream.on('text', (_delta, snapshot) => {
          text = snapshot
          req.onText(snapshot)
        })
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') throw new ChatError('refused', undefined, text || undefined)
        const full = final.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
        if (!full.trim()) throw new ChatError('empty')
        return { text: full, truncated: final.stop_reason === 'max_tokens' }
      } catch (e) {
        if (e instanceof ChatError) throw e
        if (req.signal.aborted || e instanceof Anthropic.APIUserAbortError) throw new ChatError('cancelled', undefined, text || undefined)
        if (e instanceof Anthropic.APIConnectionError) throw new ChatError('network', undefined, text || undefined)
        if (e instanceof Anthropic.APIError) throw new ChatError(codeForStatus(e.status, e.message), undefined, text || undefined)
        throw new ChatError('unknown', undefined, text || undefined)
      }
    },
  }
}
