import { ChatError, type ChatErrorCode } from '../errors'
import type { AskRequest, AskResponse, Transport } from './types'
import { brief, isAbort, readErrorBody, readSSE } from './sse'

/**
 * La conexión gratuita con Gemini, de Google: la app le habla directamente a la API desde el navegador con la clave
 * que la persona sacó gratis en Google AI Studio (la clave solo sale hacia generativelanguage.googleapis.com).
 * Es la API «generateContent» con la respuesta en streaming (`alt=sse`): se manda la conversación y las instrucciones
 * (`systemInstruction`) y van llegando trozos de texto. Con el plan gratuito, Google puede usar lo que se envía para mejorar
 * sus productos (ver src/chat/providers.ts).
 */

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/** Tope de la respuesta: los modelos de Gemini 3 «piensan» y ese pensamiento también cuenta, así que se deja holgado. */
export const GEMINI_MAX_TOKENS = 8192

export interface GeminiOptions {
  getKey: () => string | null
  /** Para las pruebas: un `fetch` de mentira. */
  fetch?: typeof fetch
  baseURL?: string
}

interface GeminiError {
  error?: { code?: number; message?: string; status?: string; details?: Array<{ reason?: string }> }
}

/** Los errores de la API (estado HTTP + lo que dice el cuerpo), en códigos de la app. */
export function geminiErrorCode(status: number, body: unknown): { code: ChatErrorCode; detail: string } {
  const e = (body as GeminiError | null)?.error
  const message = e?.message ?? ''
  const reason = e?.details?.find((d) => d.reason)?.reason ?? ''
  const detail = message ? brief(message) : ''
  if (reason === 'API_KEY_INVALID' || /api key not valid|api key expired|invalid api key/i.test(message)) return { code: 'auth', detail }
  if (/location is not supported|not available in your (country|region)/i.test(message)) return { code: 'region', detail }
  if (status === 401 || status === 403) return { code: 'auth', detail }
  if (status === 404) return { code: 'model', detail }
  if (status === 429) return { code: 'rate_limit', detail }
  if (status === 413) return { code: 'too_long', detail }
  if (status >= 500) return { code: 'overloaded', detail }
  if (status === 400) {
    if (/token count|too long|exceeds the maximum|too many tokens/i.test(message)) return { code: 'too_long', detail }
    if (/model/i.test(message) && /(not found|not supported|unknown|invalid)/i.test(message)) return { code: 'model', detail }
    if (/billing|free tier is not available|precondition/i.test(message)) return { code: 'credit', detail }
  }
  return { code: 'unknown', detail }
}

const ROLE = { user: 'user', assistant: 'model' } as const

export function makeGeminiTransport(opts: GeminiOptions): Transport {
  return {
    id: 'gemini',
    async ask(req: AskRequest): Promise<AskResponse> {
      const key = opts.getKey()
      if (!key) throw new ChatError('no_access', 'Falta la clave de Gemini. Pégala en ⚙ Ajustes.')
      const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis)
      const model = req.model.replace(/^models\//, '').trim()
      const url = `${opts.baseURL ?? GEMINI_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`

      let text = ''
      let res: Response
      try {
        res = await doFetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: req.turns.map((t) => ({ role: ROLE[t.role], parts: [{ text: t.content }] })),
            generationConfig: { maxOutputTokens: GEMINI_MAX_TOKENS },
          }),
          signal: req.signal,
        })
      } catch (e) {
        throw new ChatError(isAbort(e, req.signal) ? 'cancelled' : 'network')
      }

      if (!res.ok) {
        const { json, text: raw } = await readErrorBody(res)
        const { code, detail } = geminiErrorCode(res.status, json)
        const shown = detail || (json ? '' : brief(raw))
        throw new ChatError(code, code === 'unknown' && shown ? `Algo salió mal y no pude contestar (Google dijo: ${shown}).` : undefined)
      }

      let finish = ''
      let blocked = ''
      try {
        await readSSE(res.body, (data) => {
          let chunk: {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>
            promptFeedback?: { blockReason?: string }
          }
          try {
            chunk = JSON.parse(data)
          } catch {
            return // un trozo que no se entiende: se ignora
          }
          if (chunk.promptFeedback?.blockReason) blocked = chunk.promptFeedback.blockReason
          const cand = chunk.candidates?.[0]
          if (cand?.finishReason) finish = cand.finishReason
          const add = (cand?.content?.parts ?? []).map((p) => (p.thought ? '' : (p.text ?? ''))).join('')
          if (add) {
            text += add
            req.onText(text)
          }
        })
      } catch (e) {
        throw new ChatError(isAbort(e, req.signal) ? 'cancelled' : 'network', undefined, text || undefined)
      }

      if (blocked || (!text.trim() && /SAFETY|PROHIBITED|BLOCKLIST|RECITATION|SPII/.test(finish))) throw new ChatError('refused', undefined, text || undefined)
      if (!text.trim()) throw new ChatError(finish === 'MAX_TOKENS' ? 'too_long' : 'empty')
      return { text, truncated: finish === 'MAX_TOKENS' }
    },
  }
}
