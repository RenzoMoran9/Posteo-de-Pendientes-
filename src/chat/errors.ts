/** Por qué falló una conversación con Claude, en términos que la persona entiende. */
export type ChatErrorCode =
  | 'no_access' // no hay permiso para usar Claude desde aquí (cuenta) o falta la clave
  | 'auth' // la clave no es válida o no tiene permiso
  | 'credit' // la cuenta de la clave no tiene saldo
  | 'rate_limit' // demasiadas peticiones o límite de uso
  | 'overloaded' // Claude está saturado o falló un momento
  | 'network' // no hubo conexión
  | 'too_long' // el tablero o la conversación no caben
  | 'refused' // Claude no quiso contestar eso
  | 'empty' // no escribió nada
  | 'cancelled' // la persona lo detuvo
  | 'unknown'

export class ChatError extends Error {
  readonly code: ChatErrorCode
  /** Lo que alcanzó a escribir antes de fallar (se puede dejar en pantalla). */
  readonly partial?: string

  constructor(code: ChatErrorCode, message?: string, partial?: string) {
    super(message ?? explain(code))
    this.name = 'ChatError'
    this.code = code
    this.partial = partial
  }
}

const TEXT: Record<ChatErrorCode, string> = {
  no_access: 'No tengo permiso para usar Claude desde aquí. Autoriza el uso cuando te lo pida, o pega tu propia clave en ⚙ Ajustes.',
  auth: 'La clave no es válida o no tiene permiso. Revísala en ⚙ Ajustes.',
  credit: 'La cuenta de esa clave no tiene saldo. Recárgalo en la consola de Anthropic o usa otra clave.',
  rate_limit: 'Hay demasiadas peticiones o llegaste a tu límite de uso. Espera un momento y vuelve a intentarlo.',
  overloaded: 'Claude está saturado en este momento. Vuelve a intentarlo en unos segundos.',
  network: 'No pude conectarme con Claude. Revisa tu internet y vuelve a intentarlo.',
  too_long: 'Hay demasiado texto para una sola consulta. Borra la conversación o prueba con menos posits.',
  refused: 'Claude no quiso contestar eso. Prueba a preguntarlo de otra manera.',
  empty: 'Claude no escribió nada. Vuelve a intentarlo o pregúntalo de otra manera.',
  cancelled: 'Detenido.',
  unknown: 'Algo salió mal y no pude contestar. Vuelve a intentarlo.',
}

export const explain = (code: ChatErrorCode): string => TEXT[code]

/** Errores de los que conviene avisar con un mensaje aparte del texto parcial. */
export const isCancel = (e: unknown): e is ChatError => e instanceof ChatError && e.code === 'cancelled'
