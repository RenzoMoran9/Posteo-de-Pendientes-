import { ChatError, type ChatErrorCode } from '../errors'
import { withInstructionsTurn } from '../prompt'
import { modelById } from '../settings'
import type { AskRequest, AskResponse, Transport } from './types'

/**
 * La conexión «sin clave»: dentro del enlace de prueba (una página de claude.ai), la propia página puede pedirle
 * respuestas a Claude con la cuenta de quien la abre (`claude.use('sample')`). La persona autoriza una vez y lo que se
 * gasta sale de su plan. Fuera de ese enlace (la página pública) no existe y esta conexión no está disponible.
 */

interface SampleUpdate {
  text: string
  delta: string
}

type SampleFn = (
  input: string | Array<{ role: 'user' | 'assistant'; content: string }>,
  options?: { onText?: (u: SampleUpdate) => void; signal?: AbortSignal; modelTier?: 'quick' | 'default' | 'complex'; cache?: boolean },
) => Promise<{ text: string; truncated: boolean }>

interface ClaudeHost {
  use?: (name: string) => Promise<unknown>
}

const hostOf = (): ClaudeHost | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { claude?: ClaudeHost }).claude)

let cached: Promise<SampleFn | null> | undefined

/** ¿Está disponible? Resuelve `null` fuera del enlace de prueba (no hay `window.claude`). */
export function findSample(): Promise<SampleFn | null> {
  cached ??= (async () => {
    const host = hostOf()
    if (!host || typeof host.use !== 'function') return null
    try {
      const fn = await host.use('sample')
      return typeof fn === 'function' ? (fn as SampleFn) : null
    } catch {
      return null
    }
  })()
  return cached
}

/** Para las pruebas: olvida lo que ya averiguó. */
export const forgetSample = (): void => {
  cached = undefined
}

const CODES: Record<string, ChatErrorCode> = {
  not_granted: 'no_access',
  sampling_disabled: 'no_access',
  not_declared: 'no_access',
  capability_disabled: 'no_access',
  capability_removed: 'no_access',
  session_expired: 'no_access',
  rate_limited: 'rate_limit',
  cancelled: 'cancelled',
  prompt_too_large: 'too_long',
  refused: 'refused',
  empty_completion: 'empty',
  upstream_error: 'network',
}

export const sampleTransport: Transport = {
  id: 'sample',
  async ask(req: AskRequest): Promise<AskResponse> {
    const sample = await findSample()
    if (!sample) throw new ChatError('no_access')
    try {
      const out = await sample(withInstructionsTurn(req.system, req.turns), {
        cache: false, // en una conversación cada mensaje debe preguntarse de nuevo
        signal: req.signal,
        modelTier: modelById(req.model).tier,
        onText: ({ text }) => req.onText(text),
      })
      return { text: out.text, truncated: out.truncated }
    } catch (e) {
      const err = e as { code?: string; text?: string } | null
      throw new ChatError(CODES[err?.code ?? ''] ?? 'unknown', undefined, typeof err?.text === 'string' ? err.text : undefined)
    }
  },
}
