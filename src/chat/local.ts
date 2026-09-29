import type { JSONContent } from '@tiptap/core'
import { fold } from '../icons/catalog'
import { tagsOf, type Tag } from '../mascot/analyze'
import type { PersistedState } from '../store/types'
import type { Snapshot } from './context'
import { isDone, itemText, listsOf, noteTitle, taskCount } from './docOps'

/**
 * La respuesta «sencilla», sin conexión a una IA: unas cuantas órdenes que se entienden por sus palabras (resumen,
 * qué hacer primero, ordenar por urgencia, numerar). No es inteligencia artificial: sirve para no quedarse sin nada
 * cuando no hay cuenta ni clave, y usa las mismas acciones (y el mismo «Aplicar») que las propuestas de Claude.
 */

export interface LocalReply {
  text: string
  /** Acciones en el mismo formato que las de Claude (se revisan igual antes de aplicarse). */
  actions: unknown[]
}

type BoardState = Pick<PersistedState, 'activeBoardId' | 'notes'>

/** Qué tanto pesa cada señal del texto para decidir qué va primero. */
const WEIGHT: Partial<Record<Tag, number>> = { urgent: 6, today: 5, shout: 4, tomorrow: 3, time: 2, meeting: 1.5, week: 1.5, money: 1, docs: 1, health: 1, call: 0.5, mail: 0.5 }

export function urgencyOf(text: string): number {
  return tagsOf(text).reduce((sum, t) => sum + (WEIGHT[t] ?? 0), 0)
}

interface OpenTask {
  alias: string
  noteTitle: string
  list: number
  num: number
  text: string
  score: number
}

function openTasks(snap: Snapshot, state: BoardState): OpenTask[] {
  const out: OpenTask[] = []
  for (const [alias, sn] of Object.entries(snap.notes)) {
    const doc = state.notes[sn.id]?.doc
    const title = noteTitle(doc)
    for (const l of listsOf(doc)) {
      if (l.kind !== 'tasks') continue
      l.items.forEach((it, i) => {
        if (isDone(it)) return
        const text = itemText(it)
        out.push({ alias, noteTitle: title, list: l.no, num: i + 1, text, score: urgencyOf(text) })
      })
    }
  }
  return out
}

/** Los pendientes abiertos de mayor a menor urgencia (a igual urgencia, en el orden en que están). */
const byUrgency = (tasks: OpenTask[]): OpenTask[] => tasks.map((t, i) => ({ t, i })).sort((a, b) => b.t.score - a.t.score || a.i - b.i).map((x) => x.t)

const has = (folded: string, re: RegExp): boolean => re.test(folded)

const HELP = 'Ahora no estoy conectado a una IA, así que solo entiendo órdenes sencillas: «¿qué tengo pendiente?», «¿qué hago primero?», «ordena por urgencia» y «numera». Para conversar de verdad, conecta una IA en ⚙ Ajustes.'

/** El posit sobre el que se pide algo: el elegido (si tiene pendientes) o el que tiene más pendientes abiertos. */
function targetNote(snap: Snapshot, state: BoardState, selectedId: string | null | undefined): { alias: string; doc: JSONContent | null } | null {
  let best: { alias: string; doc: JSONContent | null; open: number } | null = null
  for (const [alias, sn] of Object.entries(snap.notes)) {
    const doc = state.notes[sn.id]?.doc ?? null
    const c = taskCount(doc)
    const open = c.total - c.done
    if (sn.id === selectedId && c.total > 0) return { alias, doc }
    if (c.total > 0 && (!best || open > best.open)) best = { alias, doc, open }
  }
  return best ? { alias: best.alias, doc: best.doc } : null
}

export function localReply(user: string, snap: Snapshot, state: BoardState, selectedId?: string | null): LocalReply {
  const q = fold(user)
  const none = (text: string): LocalReply => ({ text, actions: [] })

  if (has(q, /^\s*(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|ey)\b/)) {
    return none('¡Hola! Soy la mascota de Claude. Ahora estoy sin conexión a una IA, pero puedo resumirte tus pendientes, decirte qué hacer primero, ordenarlos por urgencia o numerarlos.')
  }
  if (has(q, /\b(gracias|genial|perfecto|excelente|buenisimo)\b/)) return none('¡De nada! Aquí sigo por si necesitas ordenar algo más.')
  if (!Object.keys(snap.notes).length) {
    return none(snap.totals.notes ? 'No tengo permiso para leer tus posits (lo puedes cambiar en ⚙ Ajustes), así que no puedo ayudarte con ellos.' : 'Tu tablero está vacío: escribe un posit con tus pendientes y te ayudo a ordenarlos.')
  }

  const tasks = openTasks(snap, state)

  if (has(q, /\b(ordena|ordenar|organiza|organizar|acomoda|acomodar|prioriza|priorizar)\b/) && !has(q, /\bprimero\b/)) {
    const target = targetNote(snap, state, selectedId)
    const list = target ? listsOf(target.doc).find((l) => l.kind === 'tasks') : undefined
    if (!target || !list) return none('No encuentro una lista de pendientes para ordenar. Escribe tus pendientes con casillas en un posit y lo intento.')
    const scored = list.items.map((it, i) => ({ i: i + 1, done: isDone(it), score: urgencyOf(itemText(it)) }))
    const order = scored
      .map((x, k) => ({ ...x, k }))
      .sort((a, b) => Number(a.done) - Number(b.done) || b.score - a.score || a.k - b.k)
      .map((x) => x.i)
    if (order.every((n, k) => n === k + 1)) return none('Esa lista ya está en un buen orden: lo urgente arriba y lo hecho al final.')
    return {
      text: `Te propongo ordenar «${noteTitle(target.doc)}»: primero lo que suena urgente o para hoy, luego lo que tiene fecha cercana, y al final lo ya hecho. Si quieres otro criterio, conecta una IA en ⚙ Ajustes y lo hablamos.`,
      actions: [{ do: 'reorder', note: target.alias, list: list.no, order }],
    }
  }

  if (has(q, /\b(enumera|enumerar|numera|numerar|numeracion|enumeralos|numeralos)\b/)) {
    const target = targetNote(snap, state, selectedId)
    const list = target ? listsOf(target.doc)[0] : undefined
    if (!target || !list) return none('No encuentro una lista para numerar.')
    return { text: `Te propongo numerar los ${list.items.length} renglones de «${noteTitle(target.doc)}».`, actions: [{ do: 'number', note: target.alias, list: list.no }] }
  }

  if (has(q, /\b(primero|prioridad|prioridades|urgente|urgentes|empiezo|ahora)\b/)) {
    if (!tasks.length) return none('No veo pendientes por hacer: ¡todo está al día!')
    const top = byUrgency(tasks).slice(0, 3)
    const lines = top.map((t, i) => `${i + 1}. ${t.text} (${t.noteTitle})`)
    const why = top[0].score > 0 ? 'Van primero los que suenan urgentes o para hoy.' : 'Ninguno dice explícitamente que sea urgente; te muestro los primeros.'
    return none(`${why}\n${lines.join('\n')}`)
  }

  if (has(q, /(pendiente|resumen|como voy|como estoy|que tengo|cuantos|mi dia|estado|falta)/)) {
    const open = tasks.length
    if (!open) return none(`No tienes pendientes abiertos en ${snap.totals.notes} posits. ¡Buen trabajo!`)
    const top = byUrgency(tasks).slice(0, 3)
    const urgent = tasks.filter((t) => t.score >= 4).length
    return none(
      `Tienes ${open} ${open === 1 ? 'pendiente abierto' : 'pendientes abiertos'} en ${snap.totals.notes} posits y ${snap.totals.done} ${snap.totals.done === 1 ? 'hecho' : 'hechos'}${urgent ? `; ${urgent} suenan urgentes` : ''}. Lo primero que yo haría:\n${top.map((t, i) => `${i + 1}. ${t.text} (${t.noteTitle})`).join('\n')}`,
    )
  }

  return none(HELP)
}
