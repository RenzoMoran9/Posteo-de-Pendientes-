import { ChatError, type ChatErrorCode } from '../errors'
import type { AskRequest, AskResponse, Transport } from './types'
import { brief, isAbort, readErrorBody, readSSE } from './sse'

/**
 * La conexión con cualquier servicio «compatible con OpenAI» (Groq, OpenRouter y muchos otros hablan así): la app le
 * manda la conversación a `<dirección>/chat/completions` con la clave de la persona y va recibiendo el texto en streaming.
 * La clave solo sale hacia esa dirección.
 */

export const OPENAI_MAX_TOKENS = 4096

export interface OpenAIConfig {
  /** Dirección base del servicio, sin la barra final (por ejemplo `https://api.groq.com/openai/v1`). */
  baseURL: string
  key: string
  model: string
}

export interface OpenAIOptions {
  /** Qué servicio, con qué clave y qué modelo (se pregunta en cada mensaje: puede cambiar en los ajustes). `null` = falta algo. */
  getConfig: () => OpenAIConfig | null
  /** Para las pruebas: un `fetch` de mentira. */
  fetch?: typeof fetch
}

/** Los modelos que «piensan en voz alta» (Qwen, DeepSeek…) meten ese pensamiento entre <think>…</think>: no es parte de la respuesta. */
export function stripThink(text: string): string {
  const out = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const open = out.search(/<think>/i)
  return (open >= 0 ? out.slice(0, open) : out).replace(/^\s+/, '')
}

interface OpenAIErrorBody {
  error?: string | { message?: string; code?: string | number; type?: string }
  message?: string
  detail?: string
}

/** Los errores de la API (estado HTTP + lo que dice el cuerpo), en códigos de la app. */
export function openaiErrorCode(status: number, body: unknown): { code: ChatErrorCode; detail: string } {
  const b = (body ?? {}) as OpenAIErrorBody
  const err = typeof b.error === 'object' && b.error ? b.error : undefined
  const message = (typeof b.error === 'string' ? b.error : (err?.message ?? b.message ?? b.detail ?? '')).toString()
  const c = String(err?.code ?? err?.type ?? '')
  const detail = message ? brief(message) : ''
  if (status === 401) return { code: 'auth', detail }
  if (status === 402 || /insufficient[_ ](credits|funds|quota)|exceeded your current quota|credit balance|billing/i.test(`${message} ${c}`)) return { code: 'credit', detail }
  if (/(region|country|location|territor)/i.test(message) && /(not (available|supported)|unsupported|restricted|blocked)/i.test(message)) return { code: 'region', detail }
  if (status === 403) return { code: 'auth', detail }
  if (status === 404 || /model_not_found|model_decommissioned/i.test(c) || /(model|endpoint).*(not found|does not exist|not supported|decommissioned)|no endpoints found/i.test(message)) return { code: 'model', detail }
  if (status === 413 || /request too large|context[_ ]length|maximum context|too many tokens|reduce (your|the) (message|prompt|input)/i.test(message)) return { code: 'too_long', detail }
  if (status === 429) return { code: 'rate_limit', detail }
  if (status >= 500) return { code: 'overloaded', detail }
  return { code: 'unknown', detail }
}

export function makeOpenAITransport(opts: OpenAIOptions): Transport {
  return {
    id: 'openai',
    async ask(req: AskRequest): Promise<AskResponse> {
      const cfg = opts.getConfig()
      if (!cfg?.key || !cfg.baseURL || !cfg.model) throw new ChatError('no_access', 'Falta la clave o el modelo de esa IA. Complétalos en ⚙ Ajustes.')
      const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis)

      let raw = ''
      let res: Response
      try {
        res = await doFetch(`${cfg.baseURL.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
          body: JSON.stringify({
            model: cfg.model,
            stream: true,
            max_tokens: OPENAI_MAX_TOKENS,
            messages: [{ role: 'system', content: req.system }, ...req.turns.map((t) => ({ role: t.role, content: t.content }))],
          }),
          signal: req.signal,
        })
      } catch (e) {
        throw new ChatError(isAbort(e, req.signal) ? 'cancelled' : 'network')
      }

      if (!res.ok) {
        const { json, text } = await readErrorBody(res)
        const { code, detail } = openaiErrorCode(res.status, json)
        const shown = detail || (json ? '' : brief(text))
        throw new ChatError(code, code === 'unknown' && shown ? `Algo salió mal y no pude contestar (el servicio dijo: ${shown}).` : undefined)
      }

      let finish = ''
      let streamError: { code: ChatErrorCode; detail: string } | null = null
      try {
        await readSSE(res.body, (data) => {
          if (data.trim() === '[DONE]') return
          let chunk: { choices?: Array<{ delta?: { content?: string | null }; message?: { content?: string | null }; finish_reason?: string | null }>; error?: unknown }
          try {
            chunk = JSON.parse(data)
          } catch {
            return
          }
          if (chunk.error) {
            // un error que llega con la respuesta ya empezada: su «code» suele ser el estado HTTP (OpenRouter) o una etiqueta (Groq)
            const e = chunk.error as { code?: string | number; message?: string }
            const asStatus = typeof e.code === 'number' ? e.code : /rate[_ ]limit|too many requests|quota/i.test(`${e.code ?? ''} ${e.message ?? ''}`) ? 429 : 500
            streamError = openaiErrorCode(asStatus, { error: chunk.error })
            return
          }
          const choice = chunk.choices?.[0]
          const add = choice?.delta?.content ?? choice?.message?.content
          if (typeof add === 'string' && add) {
            raw += add
            const visible = stripThink(raw)
            if (visible) req.onText(visible)
          }
          if (choice?.finish_reason) finish = choice.finish_reason
        })
      } catch (e) {
        throw new ChatError(isAbort(e, req.signal) ? 'cancelled' : 'network', undefined, stripThink(raw) || undefined)
      }

      const text = stripThink(raw)
      if (streamError && !text.trim()) throw new ChatError((streamError as { code: ChatErrorCode }).code)
      if (!text.trim()) throw new ChatError(finish === 'content_filter' ? 'refused' : 'empty')
      return { text, truncated: finish === 'length' }
    },
  }
}
