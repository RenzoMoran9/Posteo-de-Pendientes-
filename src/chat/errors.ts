/** Por qué falló una conversación con la IA (Claude, Gemini o la que sea), en términos que la persona entiende. */
export type ChatErrorCode =
  | 'no_access' // no hay permiso para usar la IA desde aquí (cuenta) o falta la clave
  | 'auth' // la clave no es válida o no tiene permiso
  | 'credit' // la cuenta de la clave no tiene saldo
  | 'rate_limit' // demasiadas peticiones o límite de uso
  | 'overloaded' // la IA está saturada o falló un momento
  | 'network' // no hubo conexión
  | 'too_long' // el tablero o la conversación no caben
  | 'refused' // la IA no quiso contestar eso
  | 'empty' // no escribió nada
  | 'model' // el modelo elegido no existe o no está disponible con esa clave
  | 'region' // el servicio no está disponible en el país o la región de la persona
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
  no_access: 'No tengo permiso para usar la IA desde aquí. Autoriza el uso cuando te lo pida, o pega tu propia clave en ⚙ Ajustes.',
  auth: 'La clave no es válida o no tiene permiso. Revísala en ⚙ Ajustes.',
  credit: 'La cuenta de esa clave no tiene saldo. Recárgalo en la página del servicio o usa otra clave (o una IA gratuita, en ⚙ Ajustes).',
  rate_limit: 'Llegaste al límite de uso por ahora (mensajes por minuto o por día). Espera un momento y vuelve a intentarlo, o prueba otra IA en ⚙ Ajustes.',
  overloaded: 'La IA está saturada en este momento. Vuelve a intentarlo en unos segundos.',
  network: 'No pude conectarme con la IA. Revisa tu internet y vuelve a intentarlo.',
  too_long: 'Hay demasiado texto para una sola consulta. Borra la conversación, prueba con menos posits o apaga «Dejar que la IA lea mis posits» en ⚙ Ajustes.',
  refused: 'La IA no quiso contestar eso. Prueba a preguntarlo de otra manera.',
  empty: 'La IA no escribió nada. Vuelve a intentarlo o pregúntalo de otra manera.',
  model: 'Ese modelo no existe o no está disponible con tu clave. Elige otro en ⚙ Ajustes.',
  region: 'Ese servicio no está disponible en tu país o región. Prueba con otra IA en ⚙ Ajustes.',
  cancelled: 'Detenido.',
  unknown: 'Algo salió mal y no pude contestar. Vuelve a intentarlo.',
}

export const explain = (code: ChatErrorCode): string => TEXT[code]

/** Errores de los que conviene avisar con un mensaje aparte del texto parcial. */
export const isCancel = (e: unknown): e is ChatError => e instanceof ChatError && e.code === 'cancelled'
