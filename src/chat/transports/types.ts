import type { Turn } from '../prompt'

export type TransportId = 'sample' | 'api' | 'gemini' | 'openai' | 'local'

export interface AskRequest {
  /** Instrucciones permanentes. */
  system: string
  /** La conversación: empieza y termina con un turno de la persona. */
  turns: Turn[]
  /** El modelo que se pide (cada conexión tiene los suyos: `claude-…`, `gemini-…`, `llama-…`). */
  model: string
  signal: AbortSignal
  /** Se llama con TODO el texto escrito hasta ahora (no solo lo nuevo). */
  onText(text: string): void
}

export interface AskResponse {
  text: string
  /** La respuesta se cortó por el límite de largo. */
  truncated: boolean
}

export interface Transport {
  id: 'sample' | 'api' | 'gemini' | 'openai'
  ask(req: AskRequest): Promise<AskResponse>
}
