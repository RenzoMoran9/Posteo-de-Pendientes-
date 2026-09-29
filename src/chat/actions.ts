import type { JSONContent } from '@tiptap/core'
import { fold } from '../icons/catalog'
import { PAPER_COLORS, nameOfColor } from '../lib/palette'
import type { PersistedState } from '../store/types'
import { unchanged, type SnapNotes } from './context'
import { MAX_TEXT, addItems, buildDoc, clone, editItemText, itemText, listsOf, noteTitle, numberList, reorderList, setDone } from './docOps'

/**
 * Lo que Claude puede proponer y cómo se revisa. La respuesta trae una lista de acciones en JSON (protocol.ts);
 * aquí se leen con desconfianza (cada campo se valida, los alias tienen que existir en la foto del tablero y el
 * posit no debe haber cambiado), se convierten en un plan con descripción en español, y solo si la persona pulsa
 * «Aplicar» se ejecutan. Todo se puede deshacer.
 */

export type NewKind = 'tasks' | 'bullets' | 'text'

export type Action =
  | { do: 'reorder'; note: string; list: number; order: number[] }
  | { do: 'number'; note: string; list: number; start: number }
  | { do: 'add_note'; title: string; items: string[]; kind: NewKind; color?: string }
  | { do: 'add_items'; note: string; list: number | null; items: string[]; kind: 'tasks' | 'bullets' }
  | { do: 'set_done'; note: string; list: number; items: number[]; done: boolean }
  | { do: 'edit_item'; note: string; list: number; item: number; text: string }
  | { do: 'set_color'; note: string; color: string }

export const MAX_ACTIONS = 8
const MAX_ITEMS = 40

// ───────────── lectura desconfiada ─────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const int = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isInteger(v)) return v
  if (typeof v === 'string' && /^\d{1,4}$/.test(v.trim())) return Number(v)
  return null
}

const ints = (v: unknown): number[] | null => {
  if (!Array.isArray(v) || v.length > 200) return null
  const out = v.map(int)
  return out.every((n): n is number => n !== null) ? out : null
}

const strs = (v: unknown): string[] | null => {
  if (!Array.isArray(v)) return null
  const out = v.filter((s): s is string => typeof s === 'string').map((s) => s.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT))
  return out.filter(Boolean).slice(0, MAX_ITEMS)
}

const alias = (v: unknown): string | null => {
  const m = typeof v === 'string' ? /^\s*n?(\d{1,3})\s*$/i.exec(v) : null
  return m ? `n${Number(m[1])}` : null
}

/** El color por su nombre («Rojo», «cielo») o su valor. Devuelve el `hex` de la paleta o `null`. */
export function colorByName(name: string): string | null {
  const key = fold(name.trim())
  const hit = PAPER_COLORS.find((c) => fold(c.name) === key || c.hex.toLowerCase() === key)
  return hit ? hit.hex : null
}

/** Convierte una acción cruda en una acción válida, o dice qué le falta (en español). */
export function readAction(v: unknown): Action | string {
  if (!isObj(v)) return 'Una acción no tenía el formato correcto.'
  const kind = String(v.do ?? '')
  switch (kind) {
    case 'reorder': {
      const note = alias(v.note)
      const list = int(v.list ?? 1)
      const order = ints(v.order)
      if (!note || !list || !order || !order.length) return 'Falta el posit, la lista o el orden para reordenar.'
      return { do: 'reorder', note, list, order }
    }
    case 'number': {
      const note = alias(v.note)
      const list = int(v.list ?? 1)
      const start = int(v.start ?? 1)
      if (!note || !list || start === null || start < 0) return 'Falta el posit o la lista para numerar.'
      return { do: 'number', note, list, start }
    }
    case 'add_note': {
      const items = strs(v.items ?? []) ?? []
      const title = typeof v.title === 'string' ? v.title.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
      const k = v.kind === 'bullets' || v.kind === 'text' ? v.kind : 'tasks'
      if (!title && !items.length) return 'El posit nuevo no tenía título ni renglones.'
      const color = typeof v.color === 'string' ? v.color : undefined
      if (color && !colorByName(color)) return `No conozco el color «${color}».`
      return { do: 'add_note', title, items, kind: k, color }
    }
    case 'add_items': {
      const note = alias(v.note)
      const items = strs(v.items)
      const list = v.list === undefined || v.list === null ? null : int(v.list)
      if (!note || !items || !items.length || (v.list != null && !list)) return 'Falta el posit o los renglones para agregar.'
      return { do: 'add_items', note, list, items, kind: v.kind === 'bullets' ? 'bullets' : 'tasks' }
    }
    case 'set_done': {
      const note = alias(v.note)
      const list = int(v.list ?? 1)
      const items = ints(v.items)
      if (!note || !list || !items || !items.length || typeof v.done !== 'boolean') return 'Falta el posit, los renglones o si van hechos.'
      return { do: 'set_done', note, list, items, done: v.done }
    }
    case 'edit_item': {
      const note = alias(v.note)
      const list = int(v.list ?? 1)
      const item = int(v.item)
      const text = typeof v.text === 'string' ? v.text.trim() : ''
      if (!note || !list || !item || !text) return 'Falta el posit, el renglón o el texto nuevo.'
      return { do: 'edit_item', note, list, item, text: text.slice(0, MAX_TEXT) }
    }
    case 'set_color': {
      const note = alias(v.note)
      const color = typeof v.color === 'string' ? v.color : ''
      if (!note || !colorByName(color)) return `Falta el posit o no conozco el color «${color}».`
      return { do: 'set_color', note, color }
    }
    default:
      return `No sé hacer «${kind || '?'}».`
  }
}

// ───────────── el plan ─────────────

export interface DocStep {
  kind: 'doc'
  noteId: string
  before: JSONContent | null
  after: JSONContent
}
export interface CreateStep {
  kind: 'create'
  doc: JSONContent
  color?: string
}
export interface ColorStep {
  kind: 'color'
  noteId: string
  before: string
  after: string
}
export type Step = DocStep | CreateStep | ColorStep

export interface PlanItem {
  text: string
  /** Renglones de vista previa (cómo queda, qué se agrega…). */
  detail: string[]
}

export interface Plan {
  steps: Step[]
  items: PlanItem[]
  /** Lo que no se pudo entender o no se puede aplicar, dicho para la persona. */
  problems: string[]
}

type BoardState = Pick<PersistedState, 'activeBoardId' | 'notes'>

const quote = (t: string): string => `«${t}»`
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
const more = (list: string[], max: number): string[] => (list.length > max ? [...list.slice(0, max), `… y ${list.length - max} más`] : list)

/**
 * Revisa las acciones contra la foto del tablero (`snap`) y el estado actual (`state`) y arma el plan.
 * Cada acción mala se descarta con un aviso; las buenas siguen. Varias acciones sobre un mismo posit se encadenan.
 */
export function planActions(raw: unknown[], snap: SnapNotes, state: BoardState): Plan {
  const items: PlanItem[] = []
  const problems: string[] = []
  const creates: CreateStep[] = []
  const colors = new Map<string, ColorStep>()

  interface Work {
    noteId: string
    before: JSONContent | null
    doc: JSONContent | null
  }
  const work = new Map<string, Work>()
  const titleOf = new Map<string, string>()

  /** Abre el posit de un alias para trabajarlo; si no se puede, devuelve el motivo. */
  const open = (a: string): Work | string => {
    const cached = work.get(a)
    if (cached) return cached
    const sn = snap.notes[a]
    if (!sn) return `No veo el posit ${a} en el tablero.`
    const note = state.notes[sn.id]
    if (!note || note.boardId !== state.activeBoardId) return `El posit ${a} ya no está en el tablero.`
    if (!unchanged(snap, a, note.doc)) return `El posit ${quote(noteTitle(note.doc))} cambió desde que hablamos: pídeme de nuevo el cambio.`
    const w: Work = { noteId: note.id, before: note.doc ? clone(note.doc) : null, doc: note.doc ? clone(note.doc) : null }
    work.set(a, w)
    titleOf.set(a, noteTitle(note.doc))
    return w
  }

  const list = raw.slice(0, MAX_ACTIONS)
  if (raw.length > MAX_ACTIONS) problems.push(`Eran demasiadas acciones: solo reviso las primeras ${MAX_ACTIONS}.`)

  for (const r of list) {
    const a = readAction(r)
    if (typeof a === 'string') {
      problems.push(a)
      continue
    }

    if (a.do === 'add_note') {
      const doc = buildDoc(a.title, a.items, a.kind)
      creates.push({ kind: 'create', doc, color: a.color ? colorByName(a.color)! : undefined })
      const what = a.kind === 'tasks' ? plural(a.items.length, 'pendiente', 'pendientes') : a.kind === 'bullets' ? plural(a.items.length, 'viñeta', 'viñetas') : plural(a.items.length, 'línea', 'líneas')
      items.push({ text: `Crear un posit nuevo ${quote(a.title || 'sin título')}${a.items.length ? ` con ${what}` : ''}`, detail: more(a.items, 6) })
      continue
    }

    const w = open(a.note)
    if (typeof w === 'string') {
      problems.push(w)
      continue
    }
    const name = quote(titleOf.get(a.note) ?? '')
    const cur = w.doc ?? { type: 'doc', content: [] }

    if (a.do === 'set_color') {
      const sn = snap.notes[a.note]
      const note = state.notes[sn.id]
      const hex = colorByName(a.color)!
      const prev = colors.get(sn.id)?.before ?? note.color
      colors.set(sn.id, { kind: 'color', noteId: sn.id, before: prev, after: hex })
      items.push({ text: `Pintar el posit ${name} de ${nameOfColor(hex)}`, detail: [] })
      continue
    }

    let next: JSONContent | null = null
    let entry: PlanItem | null = null
    const lst = a.list === null ? null : listsOf(cur)[a.list - 1]
    const texts = lst ? lst.items.map(itemText) : []

    switch (a.do) {
      case 'reorder': {
        if (!lst) {
          problems.push(`El posit ${name} no tiene una lista ${a.list}.`)
          break
        }
        next = reorderList(cur, a.list, a.order)
        if (!next) {
          problems.push(`El orden que propuse para ${name} no es válido (números repetidos o fuera de la lista).`)
          break
        }
        entry = { text: `Reordenar la lista ${a.list} de ${name} (${plural(texts.length, 'renglón', 'renglones')})`, detail: more(listsOf(next)[a.list - 1].items.map((it, i) => `${i + 1}. ${itemText(it)}`), 6) }
        break
      }
      case 'number': {
        if (!lst) {
          problems.push(`El posit ${name} no tiene una lista ${a.list}.`)
          break
        }
        next = numberList(cur, a.list, a.start)
        if (!next) break
        entry = { text: `Numerar los ${plural(texts.length, 'renglón', 'renglones')} de la lista ${a.list} de ${name}`, detail: more(listsOf(next)[a.list - 1].items.map(itemText), 3) }
        break
      }
      case 'add_items': {
        if (a.list !== null && !lst) {
          problems.push(`El posit ${name} no tiene una lista ${a.list}.`)
          break
        }
        next = addItems(cur, a.list, a.items, a.kind)
        if (!next) break
        entry = { text: `Agregar ${plural(a.items.length, 'renglón', 'renglones')} a ${name}`, detail: more(a.items, 6) }
        break
      }
      case 'set_done': {
        if (!lst || lst.kind !== 'tasks') {
          problems.push(`La lista ${a.list} de ${name} no es de pendientes con casilla.`)
          break
        }
        next = setDone(cur, a.list, a.items, a.done)
        if (!next) {
          problems.push(`Algún número de pendiente de ${name} no existe.`)
          break
        }
        const names = [...new Set(a.items)].map((n) => texts[n - 1])
        entry = { text: `${a.done ? 'Marcar como hechos' : 'Desmarcar'} ${plural(names.length, 'pendiente', 'pendientes')} de ${name}`, detail: more(names, 4) }
        break
      }
      case 'edit_item': {
        if (!lst) {
          problems.push(`El posit ${name} no tiene una lista ${a.list}.`)
          break
        }
        next = editItemText(cur, a.list, a.item, a.text)
        if (!next) {
          problems.push(`No pude cambiar el renglón ${a.item} de ${name} (no existe o tiene íconos o formato que se perderían).`)
          break
        }
        entry = { text: `Cambiar un renglón de ${name}`, detail: [`antes: ${texts[a.item - 1]}`, `ahora: ${a.text}`] }
        break
      }
    }
    if (next && entry) {
      w.doc = next
      items.push(entry)
    }
  }

  const steps: Step[] = []
  for (const w of work.values()) {
    if (w.doc && JSON.stringify(w.doc) !== JSON.stringify(w.before)) steps.push({ kind: 'doc', noteId: w.noteId, before: w.before, after: w.doc })
  }
  steps.push(...colors.values(), ...creates)
  // si al final un posit quedó igual (por ejemplo, ya estaba numerado), no hay nada que aplicar de esa acción
  return { steps, items, problems }
}

// ───────────── aplicar y deshacer ─────────────

/** Lo que la ejecución necesita de la app (así se prueba sin navegador). */
export interface PlanIO {
  /** El documento del posit; `undefined` si el posit ya no existe. */
  readDoc(id: string): JSONContent | null | undefined
  writeDoc(id: string, doc: JSONContent): void
  addNote(doc: JSONContent, color?: string): string
  removeNote(id: string): void
  readColor(id: string): string | undefined
  setColor(id: string, hex: string): void
}

export interface UndoResult {
  restored: number
  /** Cambios que no se deshicieron porque la persona tocó ese posit después. */
  skipped: number
}

export interface Applied {
  created: string[]
  undo(): UndoResult
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function applyPlan(plan: Plan, io: PlanIO): Applied {
  const undos: Array<() => boolean> = []
  const created: string[] = []
  for (const step of plan.steps) {
    if (step.kind === 'doc') {
      if (io.readDoc(step.noteId) === undefined) continue
      io.writeDoc(step.noteId, step.after)
      const written = clone(io.readDoc(step.noteId) ?? null)
      undos.push(() => {
        if (io.readDoc(step.noteId) === undefined || !same(io.readDoc(step.noteId), written)) return false
        io.writeDoc(step.noteId, step.before ?? { type: 'doc', content: [{ type: 'paragraph' }] })
        return true
      })
    } else if (step.kind === 'create') {
      const id = io.addNote(step.doc, step.color)
      created.push(id)
      const written = clone(io.readDoc(id) ?? null)
      undos.push(() => {
        if (io.readDoc(id) === undefined || !same(io.readDoc(id), written)) return false
        io.removeNote(id)
        return true
      })
    } else {
      if (io.readColor(step.noteId) === undefined) continue
      io.setColor(step.noteId, step.after)
      undos.push(() => {
        if (io.readColor(step.noteId) !== step.after) return false
        io.setColor(step.noteId, step.before)
        return true
      })
    }
  }
  return {
    created,
    undo() {
      let restored = 0
      let skipped = 0
      for (const u of [...undos].reverse()) (u() ? restored++ : skipped++)
      return { restored, skipped }
    },
  }
}
