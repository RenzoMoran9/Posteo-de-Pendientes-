import { GREETINGS, PHRASES, fill, type PhraseKey } from './phrases'
import type { Mood } from './mascotStore'
import { tagsOf, type NoteFacts, type Tag } from './analyze'

/** Algo que Chispa ofrece hacer con un toque (pintar el posit de rojo, pegarle un ícono). */
export interface Suggest {
  kind: 'paint' | 'icon'
  label: string
  hex?: string
  icon?: string
}

export interface Comment {
  /** De qué habla (para no repetirse). */
  key: string
  text: string
  mood: Mood
  suggest?: Suggest
}

export interface BrainOptions {
  now?: () => number
  rng?: () => number
}

/** Cada tema que se puede convertir en un ícono, y qué ícono ofrece. */
const ICON_FOR: Partial<Record<Tag, { icon: string; label: string; also?: string[] }>> = {
  urgent: { icon: 'sirena', label: 'Poner sirena', also: ['fuego', 'muy_urgente'] },
  today: { icon: 'calendario_hoy', label: 'Poner calendario de hoy', also: ['sol'] },
  tomorrow: { icon: 'calendario', label: 'Poner calendario' },
  money: { icon: 'soles', label: 'Poner soles', also: ['billete'] },
  docs: { icon: 'expediente', label: 'Poner expediente' },
  health: { icon: 'cruz', label: 'Poner cruz' },
  call: { icon: 'telefono', label: 'Poner teléfono' },
  mail: { icon: 'correo', label: 'Poner correo' },
  meeting: { icon: 'personas', label: 'Poner personas' },
}

/** Rojo de la paleta de papeles (src/lib/palette.ts). */
export const RED_PAPER = '#EF6A62'

/** Límites para no ser pesada: Chispa comenta pocas veces y siempre en una pausa. */
export const LIMITS = {
  /** Mínimo entre dos comentarios que ella empieza. */
  chatGapMs: 20_000,
  /** Mínimo entre dos celebraciones. */
  eventGapMs: 4_000,
  /** Como mucho tantos comentarios propios en esta ventana. */
  windowMs: 10 * 60_000,
  maxPerWindow: 8,
  /** Un mismo tema no vuelve a salir en tan poco tiempo (en general / en el mismo posit). */
  tagGapMs: 3 * 60_000,
  noteTagGapMs: 10 * 60_000,
  nudgeGapMs: 25 * 60_000,
} as const

export interface TypedInput {
  noteId: string
  /** El renglón donde se estaba escribiendo. */
  lastLine: string
  facts: NoteFacts
  /** Color del papel y los íconos que ya tiene pegados (para no ofrecer lo que ya hay). */
  color: string
  stickerIcons: readonly string[]
}

export interface DoneInput {
  done: number
  total: number
  /** Pendientes sin marcar en todo el tablero, y cuántos hay en total. */
  boardOpen: number
  boardTotal: number
  /** Cuántos pendientes se han marcado hoy (con este). */
  doneToday?: number
}

/** Temas que más se repiten en el tablero (para comentarlos al tocarla). */
export interface Topic {
  tag: Tag
  /** Cuántos posits hablan de eso. */
  n: number
}

/** Cómo se dice cada tema en «Veo 3 posits de …». */
export const TOPIC_LABEL: Partial<Record<Tag, string>> = {
  money: 'pagos y compras',
  docs: 'trámites y expedientes',
  health: 'insumos y salud',
  call: 'llamadas',
  mail: 'correos',
  meeting: 'reuniones',
  urgent: 'cosas urgentes',
}

/** Cada cuántos tachados en el día hay festejo especial. */
export const DAY_MILESTONES: readonly number[] = [3, 5, 8, 12, 20, 30]

export interface GreetInput {
  hour: number
  open: number
  urgent: number
  anyTasks: boolean
}

/**
 * El «cerebro» de Chispa: decide si hablar, de qué y cuándo. No toca la pantalla (eso lo hace watch.ts);
 * recibe lo que pasó y devuelve un comentario o nada. Reglas simples y transparentes, sin IA.
 * `now` y `rng` se pueden inyectar para probarlo.
 */
export class Brain {
  private now: () => number
  private rng: () => number
  private lastChat = -Infinity
  private lastEvent = -Infinity
  private lastNudge = -Infinity
  private spoke: number[] = []
  private byTag = new Map<string, number>()
  private byNoteTag = new Map<string, number>()
  private bags = new Map<string, number[]>()
  private lastPicked = new Map<string, number>()

  constructor(opts: BrainOptions = {}) {
    this.now = opts.now ?? Date.now
    this.rng = opts.rng ?? Math.random
  }

  reset(): void {
    this.lastChat = this.lastEvent = this.lastNudge = -Infinity
    this.spoke = []
    this.byTag.clear()
    this.byNoteTag.clear()
    this.bags.clear()
    this.lastPicked.clear()
  }

  // ───────────── elegir frase (sin repetir hasta agotarlas) ─────────────

  private pick(key: PhraseKey, vars: Record<string, string | number> = {}): { text: string; mood: Mood } {
    const pool = PHRASES[key]
    const n = pool.lines.length
    let bag = this.bags.get(key)
    if (!bag || bag.length === 0) {
      bag = Array.from({ length: n }, (_, i) => i)
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j], bag[i]]
      }
      // que la primera de la nueva vuelta no sea la última que salió
      if (n > 1 && bag[bag.length - 1] === this.lastPicked.get(key)) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]]
      this.bags.set(key, bag)
    }
    const i = bag.pop() as number
    this.lastPicked.set(key, i)
    return { text: fill(pool.lines[i], vars), mood: pool.mood }
  }

  private windowCount(): number {
    const t = this.now()
    this.spoke = this.spoke.filter((x) => t - x < LIMITS.windowMs)
    return this.spoke.length
  }

  private commit(kind: 'chat' | 'event'): void {
    const t = this.now()
    this.spoke.push(t)
    this.lastEvent = t
    if (kind === 'chat') this.lastChat = t
  }

  // ───────────── sucesos ─────────────

  /** El usuario hizo una pausa escribiendo en un posit. */
  onTyped(input: TypedInput): Comment | null {
    const t = this.now()
    if (t - this.lastChat < LIMITS.chatGapMs || this.windowCount() >= LIMITS.maxPerWindow) return null

    // Primero lo del renglón que se está escribiendo; si no dice nada, lo de todo el posit.
    const own = tagsOf(input.lastLine)
    const candidates: Array<Tag | 'long' | 'lines'> = own.length > 0 ? own : tagsOf(input.facts.text)
    if (own.length === 0) {
      if (input.facts.text.length > 320 || input.facts.lines.length > 9) candidates.push('long')
      else if (input.facts.plainLines >= 4 && input.facts.tasks === 0 && input.facts.bullets === 0) candidates.push('lines')
    }

    for (const tag of candidates) {
      const last = this.byTag.get(tag) ?? -Infinity
      const lastHere = this.byNoteTag.get(`${input.noteId}:${tag}`) ?? -Infinity
      if (t - last < LIMITS.tagGapMs || t - lastHere < LIMITS.noteTagGapMs) continue

      const { text, mood } = this.pick(tag)
      this.byTag.set(tag, t)
      this.byNoteTag.set(`${input.noteId}:${tag}`, t)
      this.commit('chat')
      return { key: tag, text, mood, suggest: this.suggestFor(tag, input) }
    }
    return null
  }

  private suggestFor(tag: string, input: TypedInput): Suggest | undefined {
    if (this.rng() > 0.6) return undefined
    if (tag === 'urgent' && input.color.toLowerCase() !== RED_PAPER.toLowerCase() && this.rng() < 0.5) {
      return { kind: 'paint', label: 'Pintar de rojo', hex: RED_PAPER }
    }
    const opt = ICON_FOR[tag as Tag]
    if (!opt) return undefined
    const has = (icon: string) => input.stickerIcons.includes(icon) || input.facts.icons.includes(icon)
    if (has(opt.icon) || (opt.also ?? []).some(has)) return undefined
    return { kind: 'icon', label: opt.label, icon: opt.icon }
  }

  /** Se marcó un pendiente. */
  onDone(input: DoneInput): Comment | null {
    const t = this.now()
    if (t - this.lastEvent < LIMITS.eventGapMs) return null
    let key: PhraseKey
    if (input.boardTotal > 0 && input.boardOpen === 0) key = 'done_board'
    else if (input.total > 0 && input.done >= input.total) key = 'done_note'
    else if (input.doneToday !== undefined && DAY_MILESTONES.includes(input.doneToday)) key = 'done_day'
    else if (input.done === 1) key = 'done_first'
    else if (this.rng() < 0.45) key = 'done_some'
    else return null
    const { text, mood } = this.pick(key, { done: input.done, total: input.total, n: input.doneToday ?? input.done })
    this.commit('event')
    return { key, text, mood }
  }

  /** Un posit se quedó en blanco un buen rato. */
  onEmptyNote(): Comment | null {
    const t = this.now()
    if (t - this.lastChat < LIMITS.chatGapMs || this.windowCount() >= LIMITS.maxPerWindow) return null
    const last = this.byTag.get('empty') ?? -Infinity
    if (t - last < LIMITS.tagGapMs) return null
    this.byTag.set('empty', t)
    const { text, mood } = this.pick('empty')
    this.commit('chat')
    return { key: 'empty', text, mood }
  }

  /** La primera vez que se abre la app. */
  onWelcome(): Comment {
    const { text, mood } = this.pick('welcome')
    this.commit('event')
    return { key: 'welcome', text, mood }
  }

  /** Al abrir la app: saludo según la hora y resumen de pendientes. */
  onGreet(input: GreetInput): Comment {
    const hi = input.hour < 12 ? GREETINGS.morning : input.hour < 19 ? GREETINGS.afternoon : GREETINGS.night
    let rest = ''
    if (input.open > 0) {
      rest = input.open === 1 ? ' Te queda 1 pendiente en este tablero.' : ` Tienes ${input.open} pendientes en este tablero.`
      if (input.urgent > 0) rest += input.urgent === 1 ? ' Uno suena urgente.' : ` ${input.urgent} suenan urgentes.`
    } else if (input.anyTasks) {
      rest = ' Todo al día. ¡Bien hecho!'
    } else {
      rest = ' ¿Qué anotamos hoy?'
    }
    this.commit('event')
    return { key: 'greet', text: hi + rest, mood: input.urgent > 0 ? 'think' : 'happy' }
  }

  /** Volvió tras un rato de sueño. */
  onWake(): Comment | null {
    if (this.now() - this.lastEvent < LIMITS.eventGapMs) return null
    const { text, mood } = this.pick('wake')
    this.commit('event')
    return { key: 'wake', text, mood }
  }

  /** Lleva mucho tiempo trabajando. */
  onNudge(): Comment | null {
    const t = this.now()
    if (t - this.lastNudge < LIMITS.nudgeGapMs || t - this.lastChat < LIMITS.chatGapMs) return null
    this.lastNudge = t
    const { text, mood } = this.pick('nudge')
    this.commit('chat')
    return { key: 'nudge', text, mood }
  }

  /** Le tocaron: siempre contesta (un consejo, ánimo o el resumen de pendientes). */
  onPoke(input: { open: number; urgent: number; topics?: readonly Topic[] }): Comment {
    const r = this.rng()
    let out: { text: string; mood: Mood }
    let key: string
    if (input.open > 0 && r < 0.3) {
      key = 'summary'
      const urgent = input.urgent > 0 ? ` ${input.urgent === 1 ? 'Uno suena urgente' : `${input.urgent} suenan urgentes`}.` : ''
      out = { text: `${input.open === 1 ? 'Te queda 1 pendiente' : `Te quedan ${input.open} pendientes`} en este tablero.${urgent}`, mood: input.urgent > 0 ? 'think' : 'idle' }
    } else if (r < 0.5 && input.topics?.some((t) => t.n >= 2 && TOPIC_LABEL[t.tag])) {
      key = 'topics'
      const top = input.topics.filter((t) => t.n >= 2 && TOPIC_LABEL[t.tag]).sort((a, b) => b.n - a.n)[0]
      out = this.pick('topics', { n: top.n, topic: TOPIC_LABEL[top.tag] as string })
    } else if (r < 0.65) {
      key = 'poke_tip'
      out = this.pick('poke_tip')
    } else {
      key = 'poke_cheer'
      out = this.pick('poke_cheer')
    }
    this.lastEvent = this.now()
    return { key, ...out }
  }
}
