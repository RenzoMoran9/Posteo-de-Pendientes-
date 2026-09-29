import type { PersistedState } from '../store/types'
import { nameOfColor } from '../lib/palette'
import { fingerprint, isDone, itemText, listsOf, looseLines, taskCount } from './docOps'

/**
 * La «foto» del tablero que se le manda a Claude con cada mensaje: qué posits hay, qué pendientes tienen y cuáles
 * están hechos. Cada posit recibe un alias corto (n1, n2…) en el orden en que se leen en la hoja, y sus listas y
 * renglones se numeran, para que las propuestas de Claude puedan señalar «el renglón 3 de la lista 1 del posit n2»
 * sin depender de ids largos. La huella (`fp`) de cada posit sirve para saber después si cambió.
 */

export interface SnapNote {
  alias: string
  id: string
  /** Huella del posit en el momento de la foto (ver `fingerprint`). */
  fp: string
}

/** Lo mínimo de la foto que hace falta para revisar y aplicar una propuesta (se guarda junto a ella). */
export interface SnapNotes {
  /** alias → posit (solo los que Claude puede ver). */
  notes: Record<string, SnapNote>
}

export interface Snapshot extends SnapNotes {
  /** El texto que lee Claude. */
  text: string
  boardName: string
  totals: { notes: number; open: number; done: number }
}

export interface SnapshotOptions {
  /** ¿Puede Claude leer el contenido de los posits? Con `false` solo recibe los conteos. */
  share?: boolean
  /** El posit que la persona tiene seleccionado (va primero si hay que recortar). */
  selectedId?: string | null
  /** Tope aproximado del texto (en caracteres): lo que sobra se resume en una línea por posit. */
  maxChars?: number
  now?: Date
}

const DEFAULT_MAX_CHARS = 14_000
const MAX_ITEMS = 40
const MAX_LINES = 5
const MAX_ITEM_CHARS = 200
const MAX_NOTES = 80

type BoardState = Pick<PersistedState, 'boards' | 'boardOrder' | 'activeBoardId' | 'notes'>

const cut = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t)

/** «martes 29 de septiembre de 2026, 14:35» (para que Claude entienda «hoy», «mañana» y las fechas límite). */
export function dateLine(now: Date): string {
  try {
    const d = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)
    const t = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
    return `${d}, ${t}`
  } catch {
    return now.toISOString().slice(0, 16).replace('T', ' ')
  }
}

function openOf(doc: PersistedState['notes'][string]['doc']): number {
  const c = taskCount(doc)
  return c.total - c.done
}

/** El orden en que se lee la hoja: de arriba hacia abajo por filas y, en cada fila, de izquierda a derecha. */
function readingOrder<T extends { x: number; y: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => Math.round(a.y / 120) - Math.round(b.y / 120) || a.x - b.x)
}

function noteBlock(alias: string, n: PersistedState['notes'][string]): string {
  const lines: string[] = []
  const { total, done } = taskCount(n.doc)
  const head = total ? ` · ${done} de ${total} pendientes hechos` : ''
  lines.push(`[${alias}] posit ${nameOfColor(n.color)}${head}`)
  const loose = looseLines(n.doc)
  loose.slice(0, MAX_LINES).forEach((t) => lines.push(`  texto: ${cut(t, MAX_ITEM_CHARS)}`))
  if (loose.length > MAX_LINES) lines.push(`  (${loose.length - MAX_LINES} líneas de texto más)`)
  for (const l of listsOf(n.doc)) {
    lines.push(`  lista ${l.no} (${l.kind === 'tasks' ? 'pendientes' : 'viñetas'}):`)
    l.items.slice(0, MAX_ITEMS).forEach((it, i) => {
      const mark = l.kind === 'tasks' ? (isDone(it) ? '[x] ' : '[ ] ') : '• '
      lines.push(`    ${i + 1}. ${mark}${cut(itemText(it) || '(vacío)', MAX_ITEM_CHARS)}`)
    })
    if (l.items.length > MAX_ITEMS) lines.push(`    (${l.items.length - MAX_ITEMS} renglones más)`)
  }
  if (lines.length === 1 && !loose.length) lines.push('  (vacío)')
  return lines.join('\n')
}

const summaryLine = (alias: string, n: PersistedState['notes'][string]): string => {
  const { total, done } = taskCount(n.doc)
  const title = looseLines(n.doc)[0] ?? ''
  return `[${alias}] posit ${nameOfColor(n.color)} «${cut(title, 40)}»${total ? ` · ${done} de ${total} pendientes hechos` : ''} (contenido omitido por espacio)`
}

export function buildSnapshot(s: BoardState, opts: SnapshotOptions = {}): Snapshot {
  const share = opts.share !== false
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS
  const board = s.boards[s.activeBoardId]
  const boardName = board?.name ?? 'Mi tablero'
  const mine = readingOrder(Object.values(s.notes).filter((n) => n.boardId === s.activeBoardId))
  const aliasOf = new Map(mine.map((n, i) => [n.id, `n${i + 1}`]))

  let done = 0
  let open = 0
  for (const n of mine) {
    const c = taskCount(n.doc)
    done += c.done
    open += c.total - c.done
  }

  const head: string[] = [`Hoy es ${dateLine(opts.now ?? new Date())}.`]
  head.push(`Tablero activo: «${boardName}» — ${mine.length} posits, ${open} pendientes abiertos y ${done} hechos.`)
  const others = s.boardOrder
    .filter((id) => id !== s.activeBoardId && s.boards[id])
    .map((id) => {
      const inBoard = Object.values(s.notes).filter((n) => n.boardId === id)
      return `«${s.boards[id].name}» (${inBoard.reduce((sum, n) => sum + openOf(n.doc), 0)} pendientes abiertos)`
    })
  if (others.length) head.push(`Otros tableros (solo sus nombres; no puedes verlos ni cambiarlos): ${others.join(', ')}.`)

  const notes: Record<string, SnapNote> = {}
  if (!share) {
    head.push('La persona no permitió que leas el contenido de sus posits: si necesitas ver algo, pídele que te lo cuente o que lo active en ajustes.')
    return { text: head.join('\n'), notes, boardName, totals: { notes: mine.length, open, done } }
  }
  if (!mine.length) head.push('El tablero está vacío.')

  // Si no cabe todo, primero van el posit elegido y los que tienen más pendientes abiertos; el resto, en una línea.
  const priority = [...mine].sort((a, b) => {
    if (a.id === opts.selectedId) return -1
    if (b.id === opts.selectedId) return 1
    return openOf(b.doc) - openOf(a.doc) || b.updatedAt - a.updatedAt
  })
  const shown = priority.slice(0, MAX_NOTES)
  let budget = maxChars - head.join('\n').length - shown.reduce((sum, n) => sum + summaryLine(aliasOf.get(n.id)!, n).length + 1, 0)
  const full = new Set<string>()
  for (const n of shown) {
    const alias = aliasOf.get(n.id)!
    const extra = noteBlock(alias, n).length - summaryLine(alias, n).length
    if (extra > budget && full.size > 0) continue
    full.add(n.id)
    budget -= extra
  }

  const visible = new Set(shown.map((n) => n.id))
  const blocks: string[] = []
  let omitted = 0
  for (const n of mine) {
    if (!visible.has(n.id)) continue
    const alias = aliasOf.get(n.id)!
    notes[alias] = { alias, id: n.id, fp: fingerprint(n.doc) }
    if (full.has(n.id)) {
      blocks.push(noteBlock(alias, n))
    } else {
      blocks.push(summaryLine(alias, n))
      omitted += 1
    }
  }
  if (mine.length > shown.length) head.push(`Hay ${mine.length - shown.length} posits más que no se muestran (tablero muy grande).`)
  if (omitted) head.push(`Por espacio, ${omitted} posits solo aparecen resumidos: no propongas cambios sobre ellos.`)
  return { text: [...head, '', ...blocks].join('\n'), notes, boardName, totals: { notes: mine.length, open, done } }
}

/** ¿El posit de este alias sigue igual que en la foto? (sin contar las casillas marcadas). */
export function unchanged(snap: SnapNotes, alias: string, doc: Parameters<typeof fingerprint>[0]): boolean {
  const n = snap.notes[alias]
  return !!n && n.fp === fingerprint(doc)
}
