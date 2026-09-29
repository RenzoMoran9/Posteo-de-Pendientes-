import type { Turn } from '../prompt'
import type { ModelId } from '../settings'

export type TransportId = 'sample' | 'api' | 'local'

export interface AskRequest {
  /** Instrucciones permanentes. */
  system: string
  /** La conversación: empieza y termina con un turno de la persona. */
  turns: Turn[]
  model: ModelId
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
  id: 'sample' | 'api'
  ask(req: AskRequest): Promise<AskResponse>
}
