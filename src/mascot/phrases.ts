import type { Mood } from './mascotStore'

/**
 * Lo que dice la mascota en sus nubes. Son frases escritas a mano (aquí no hay IA ni nada que se envíe fuera: la conversación de verdad con Claude está en src/chat): cada clave es un
 * tema o un suceso y tiene varias versiones para que no se repita. `{n}`, `{done}`, `{total}` y `{u}`
 * se reemplazan con números reales. Sin emojis: se ven distinto en cada aparato.
 */
export interface Pool {
  mood: Mood
  lines: readonly string[]
}

export const PHRASES = {
  // ── según lo que escribes ──
  stress: {
    mood: 'think',
    lines: [
      'Respira hondo. Un pendiente a la vez y llegamos.',
      'Se nota la carga. Elige el más pequeño y empieza por ahí.',
      'Estoy contigo. Parte lo grande en pasos chiquitos.',
      'Un descansito de un minuto también cuenta como avance.',
    ],
  },
  urgent: {
    mood: 'surprised',
    lines: [
      '¿Urgente? Yo lo pondría arriba y bien a la vista.',
      'Eso huele a prioridad. Lo primero es lo primero.',
      'Urgente anotado. Cuando lo termines, tacha con lápiz y celebramos.',
      'Lo urgente primero. Tú puedes con esto.',
    ],
  },
  shout: {
    mood: 'surprised',
    lines: ['¡Uy, qué grito! Debe de ser importante.', 'Con mayúsculas se nota la urgencia. Te escucho.'],
  },
  today: {
    mood: 'think',
    lines: [
      'Para hoy, entonces. ¿Lo dejamos con casilla para tacharlo?',
      'Lo de hoy conviene tenerlo a la vista. ¡Vamos!',
      'Hoy se cierra. Yo vigilo mientras avanzas.',
    ],
  },
  tomorrow: {
    mood: 'idle',
    lines: ['Mañana también cuenta. Ya quedó anotado.', 'Dejarlo escrito hoy es media batalla ganada para mañana.'],
  },
  week: {
    mood: 'idle',
    lines: ['Con fecha en la semana es más difícil olvidarlo.', 'Anotado para esta semana. Revísalo al empezar el día.'],
  },
  time: {
    mood: 'think',
    lines: ['Hora anotada. Ponle una sirena si no puedes olvidarla.', 'Ojo con esa hora. Yo también la tengo presente.'],
  },
  money: {
    mood: 'think',
    lines: [
      'Con montos, mejor revisar dos veces las cifras.',
      'Cifras a la vista. Verifica el total antes de firmar.',
      'Hay dinero de por medio: anota también quién autoriza.',
    ],
  },
  docs: {
    mood: 'think',
    lines: [
      'Expediente en marcha. Un posit por etapa se lee mejor.',
      'Documentos: ¿falta alguna firma o algún visto bueno?',
      'Trámite anotado. Apunta la fecha límite junto al nombre.',
      'Si lo que sigue depende de otra área, deja escrito a quién esperas.',
    ],
  },
  health: {
    mood: 'think',
    lines: [
      'Insumos médicos: ¿ya confirmaste stock y fecha de entrega?',
      'Esto es para el hospital. Que quede claro quién lo recibe.',
      'Lo de salud no espera. Anota cantidad y responsable.',
    ],
  },
  call: {
    mood: 'idle',
    lines: ['Llamada pendiente. Anota nombre y número junto a la casilla.', 'Cuando llames, tacha con lápiz. Se siente bien.'],
  },
  mail: {
    mood: 'idle',
    lines: ['Correo pendiente. Al enviarlo, ¡a tachar!', 'Antes de enviar, ¿revisaste destinatario y adjunto?'],
  },
  meeting: {
    mood: 'idle',
    lines: ['¿Reunión? Apunta hora y lugar arriba, bien grande.', 'Coordinar es medio trabajo. ¿Ya avisaste a todos?'],
  },
  question: {
    mood: 'think',
    lines: ['Buena pregunta. Déjala como pendiente y búscala luego.', 'Si dudas, anótalo: la respuesta suele aparecer al escribirlo.'],
  },
  long: {
    mood: 'think',
    lines: ['Este posit ya está largo. ¿Lo partimos en dos?', 'Mucho texto en un solo posit. Uno por tema se lee mejor.'],
  },
  lines: {
    mood: 'think',
    lines: ['Estas líneas parecen pendientes. «Pendientes» les pone casilla.', '¿Las convierto en lista? Con «Pendientes» se pueden tachar.'],
  },
  empty: {
    mood: 'idle',
    lines: ['Posit en blanco. ¿Qué tienes en mente?', 'Aquí cabe una idea. ¡Escríbela antes de que se escape!'],
  },

  // ── sucesos ──
  done_first: { mood: 'happy', lines: ['¡Uno menos!', '¡Primer tachón! Así se empieza.', 'Bien. ¡Ese ya está!'] },
  done_some: {
    mood: 'happy',
    lines: ['Van {done} de {total}. Sigue así.', '{done} de {total}: ¡buen ritmo!', 'Ya casi: {done} de {total}.'],
  },
  done_day: {
    mood: 'happy',
    lines: ['Hoy llevas {n} pendientes tachados. ¡Qué día!', '{n} tachados hoy. Se nota el empuje.', 'Ya son {n} hoy. ¡Sigue así!'],
  },
  done_note: {
    mood: 'happy',
    lines: ['¡Posit completo! Eso merece un descanso.', '¡Todo tachado! Qué orden.', 'Lista terminada. ¡Aplausos!'],
  },
  done_board: {
    mood: 'happy',
    lines: ['¡Tablero limpio! Hoy sí que rendiste.', 'Nada pendiente. Respira y disfruta el momento.'],
  },
  welcome: {
    mood: 'happy',
    lines: ['¡Hola! Soy la mascota de Claude. Miro lo que escribes y te doy una mano. Tócame y hablamos de tus pendientes.'],
  },
  wake: { mood: 'surprised', lines: ['¡Uy! Me dormí un ratito. ¿Seguimos?', 'Ya desperté. ¿Qué toca ahora?'] },
  nudge: {
    mood: 'idle',
    lines: ['Llevas un buen rato. Estira los hombros un minuto.', 'Buen momento para tomar agua.'],
  },
  topics: {
    mood: 'think',
    lines: ['Veo {n} posits de {topic}. ¿Los ponemos juntos?', 'Se repite mucho: {topic} ({n} posits). Quizá merece su propio rincón.'],
  },
  poke_tip: {
    mood: 'think',
    lines: [
      'Tip: arrastra un ícono sobre un posit y se le pega.',
      'Tip: la perilla de arriba gira el ícono; con Mayús va de 15° en 15°.',
      'Tip: toca una casilla sin abrir el posit y se tacha.',
      'Tip: «Ver todo» encuadra el tablero completo.',
      'Tip: cada posit puede tener su propia letra manuscrita.',
      'Tip: la tecla I abre los íconos.',
    ],
  },
  poke_cheer: {
    mood: 'happy',
    lines: [
      'Vas muy bien. Un pendiente menos y sonríes más.',
      '¡Aquí estoy! ¿Tachamos algo juntos?',
      'Recuerda tomar agua.',
      'Cada tachón cuenta. ¡Ánimo!',
      'Si algo se complica, divídelo en pasos.',
    ],
  },
} as const satisfies Record<string, Pool>

export type PhraseKey = keyof typeof PHRASES

export const GREETINGS = {
  morning: 'Buenos días.',
  afternoon: 'Buenas tardes.',
  night: 'Buenas noches.',
} as const

/** Reemplaza `{clave}` por su valor. */
export function fill(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
