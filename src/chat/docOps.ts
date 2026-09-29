import type { JSONContent } from '@tiptap/core'
import { getIcon } from '../icons/catalog'

/**
 * Operaciones puras sobre el documento de un posit (el JSON de TipTap): no tocan la pantalla ni el almacén, solo
 * devuelven el documento nuevo. Con ellas la conversación con Claude ordena, numera, agrega y marca renglones.
 * Un posit tiene párrafos sueltos y listas (`taskList` de pendientes con casilla, `bulletList` de viñetas); las
 * listas se numeran 1, 2, 3… en el orden en que aparecen, y los renglones de cada lista también.
 */

export type ListKind = 'tasks' | 'bullets'

export interface ListRef {
  kind: ListKind
  /** Posición del nodo de la lista dentro de `doc.content`. */
  at: number
  /** Número de la lista (1 = la primera del posit). */
  no: number
  items: JSONContent[]
}

export const MAX_TEXT = 300

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Todo el texto de un nodo (los íconos entre corchetes: «[ícono: Sirena]»). */
export function textOf(node: JSONContent | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return ' '
  if (node.type === 'inlineIcon') return `[ícono: ${getIcon(String(node.attrs?.icon ?? ''))?.name ?? 'dibujo'}]`
  return (node.content ?? []).map(textOf).join('')
}

export const itemText = (item: JSONContent): string => textOf(item).replace(/\s+/g, ' ').trim()

export const isDone = (item: JSONContent): boolean => item.type === 'taskItem' && !!item.attrs?.checked

export function listsOf(doc: JSONContent | null | undefined): ListRef[] {
  const out: ListRef[] = []
  ;(doc?.content ?? []).forEach((n, at) => {
    if (n.type === 'taskList' || n.type === 'bulletList') {
      out.push({ kind: n.type === 'taskList' ? 'tasks' : 'bullets', at, no: out.length + 1, items: n.content ?? [] })
    }
  })
  return out
}

/** Los párrafos sueltos (fuera de listas) con texto. */
export function looseLines(doc: JSONContent | null | undefined): string[] {
  return (doc?.content ?? [])
    .filter((n) => n.type === 'paragraph' || n.type === 'heading')
    .map((n) => textOf(n).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Primer renglón con texto: sirve de nombre del posit. */
export function noteTitle(doc: JSONContent | null | undefined, max = 34): string {
  const first = looseLines(doc)[0] ?? listsOf(doc).flatMap((l) => l.items.map(itemText)).find(Boolean) ?? ''
  if (!first) return 'sin título'
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first
}

/** Cuántos pendientes tiene y cuántos están hechos. */
export function taskCount(doc: JSONContent | null | undefined): { total: number; done: number } {
  let total = 0
  let done = 0
  for (const l of listsOf(doc)) {
    if (l.kind !== 'tasks') continue
    total += l.items.length
    done += l.items.filter(isDone).length
  }
  return { total, done }
}

function djb2(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/**
 * Huella de la estructura y el texto del posit. No cuenta las casillas marcadas: marcar o desmarcar un pendiente
 * mientras Claude contesta no vuelve vieja su propuesta, pero agregar, quitar o cambiar renglones sí.
 */
export function fingerprint(doc: JSONContent | null | undefined): string {
  return djb2(JSON.stringify(doc ?? null, (k, v: unknown) => (k === 'checked' ? undefined : v)))
}

const paragraph = (text: string): JSONContent => {
  const t = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)
  return t ? { type: 'paragraph', content: [{ type: 'text', text: t }] } : { type: 'paragraph' }
}

export function makeItem(kind: ListKind, text: string, checked = false): JSONContent {
  return kind === 'tasks'
    ? { type: 'taskItem', attrs: { checked }, content: [paragraph(text)] }
    : { type: 'listItem', content: [paragraph(text)] }
}

const makeList = (kind: ListKind, texts: string[]): JSONContent => ({
  type: kind === 'tasks' ? 'taskList' : 'bulletList',
  content: texts.map((t) => makeItem(kind, t)),
})

/** Documento de un posit nuevo: un título y, debajo, pendientes, viñetas o líneas de texto. */
export function buildDoc(title: string, items: string[], kind: 'tasks' | 'bullets' | 'text'): JSONContent {
  const content: JSONContent[] = []
  if (title.trim()) content.push(paragraph(title))
  if (items.length) {
    if (kind === 'text') content.push(...items.map(paragraph))
    else content.push(makeList(kind, items))
  }
  if (!content.length) content.push({ type: 'paragraph' })
  return { type: 'doc', content }
}

const withList = (doc: JSONContent, at: number, items: JSONContent[]): JSONContent => {
  const content = [...(doc.content ?? [])]
  content[at] = { ...content[at], content: items }
  return { ...doc, content }
}

/**
 * Reordena los renglones de una lista. `order` dice qué renglón (por su número actual, desde 1) va primero, segundo…
 * Si nombra solo algunos, esos van arriba y los demás siguen detrás en su orden de siempre. Devuelve `null` si repite
 * un número o alguno no existe.
 */
export function reorderList(doc: JSONContent, listNo: number, order: number[]): JSONContent | null {
  const list = listsOf(doc)[listNo - 1]
  if (!list) return null
  const n = list.items.length
  const seen = new Set<number>()
  for (const o of order) {
    if (!Number.isInteger(o) || o < 1 || o > n || seen.has(o)) return null
    seen.add(o)
  }
  const full = [...order]
  for (let i = 1; i <= n; i++) if (!seen.has(i)) full.push(i)
  return withList(doc, list.at, full.map((o) => list.items[o - 1]))
}

const NUMBERED = /^\s*(?:\d{1,3}\s*[.)\-:]|[a-z]\s*\))\s+/i

/** Le quita a un renglón el número que ya tenía escrito («2. », «3) »). */
function stripNumber(item: JSONContent): JSONContent {
  const paragraphs = item.content ?? []
  const p = paragraphs[0]
  const first = p?.content?.[0]
  if (!p || first?.type !== 'text' || !first.text || !NUMBERED.test(first.text)) return item
  const text = first.text.replace(NUMBERED, '')
  const inline = [...(p.content ?? [])]
  if (text) inline[0] = { ...first, text }
  else inline.shift()
  const np: JSONContent = inline.length ? { ...p, content: inline } : { type: 'paragraph' }
  return { ...item, content: [np, ...paragraphs.slice(1)] }
}

function prefixItem(item: JSONContent, prefix: string): JSONContent {
  const paragraphs = item.content?.length ? item.content : [{ type: 'paragraph' } as JSONContent]
  const p = paragraphs[0]
  const inline = [...(p.content ?? [])]
  const first = inline[0]
  if (first?.type === 'text') inline[0] = { ...first, text: prefix + (first.text ?? '') }
  else inline.unshift({ type: 'text', text: prefix.trimEnd() + (inline.length ? ' ' : '') })
  return { ...item, content: [{ ...p, content: inline }, ...paragraphs.slice(1)] }
}

/** Antepone «1. », «2. »… a los renglones de una lista (si ya tenían número, lo cambia). */
export function numberList(doc: JSONContent, listNo: number, start = 1): JSONContent | null {
  const list = listsOf(doc)[listNo - 1]
  if (!list) return null
  return withList(
    doc,
    list.at,
    list.items.map((it, i) => prefixItem(stripNumber(it), `${start + i}. `)),
  )
}

/** Agrega renglones al final de una lista; sin `listNo`, a la primera lista de ese tipo (o crea una al final). */
export function addItems(doc: JSONContent | null, listNo: number | null, texts: string[], kind: ListKind = 'tasks'): JSONContent | null {
  const base: JSONContent = doc ? clone(doc) : { type: 'doc', content: [] }
  const clean = texts.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (!clean.length) return null
  const lists = listsOf(base)
  const target = listNo !== null ? lists[listNo - 1] : lists.find((l) => l.kind === kind)
  if (listNo !== null && !target) return null
  if (!target) {
    // un posit vacío tiene un párrafo en blanco: la lista nueva lo reemplaza
    const blocks = base.content ?? []
    const blank = blocks.length === 1 && blocks[0].type === 'paragraph' && !textOf(blocks[0]).trim()
    return { ...base, type: 'doc', content: [...(blank ? [] : blocks), makeList(kind, clean)] }
  }
  return withList(base, target.at, [...target.items, ...clean.map((t) => makeItem(target.kind, t))])
}

/** Marca o desmarca pendientes (por su número dentro de la lista). Devuelve `null` si la lista no es de pendientes. */
export function setDone(doc: JSONContent, listNo: number, nums: number[], done: boolean): JSONContent | null {
  const list = listsOf(doc)[listNo - 1]
  if (!list || list.kind !== 'tasks') return null
  const set = new Set(nums)
  if ([...set].some((k) => !Number.isInteger(k) || k < 1 || k > list.items.length)) return null
  return withList(
    doc,
    list.at,
    list.items.map((it, i) => (set.has(i + 1) ? { ...it, attrs: { ...it.attrs, checked: done } } : it)),
  )
}

/** ¿Se puede reescribir este renglón sin perder nada? (solo texto liso: sin íconos ni negritas). */
export function isPlainItem(item: JSONContent): boolean {
  const inline = item.content?.[0]?.content ?? []
  return inline.every((n) => n.type === 'text' && !n.marks?.length)
}

/** Cambia el texto de un renglón. Devuelve `null` si no existe o si tiene íconos o formato que se perderían. */
export function editItemText(doc: JSONContent, listNo: number, num: number, text: string): JSONContent | null {
  const list = listsOf(doc)[listNo - 1]
  const item = list?.items[num - 1]
  const t = text.replace(/\s+/g, ' ').trim()
  if (!list || !item || !t || !isPlainItem(item)) return null
  const rest = (item.content ?? []).slice(1)
  const next: JSONContent = { ...item, content: [paragraph(t), ...rest] }
  return withList(
    doc,
    list.at,
    list.items.map((it, i) => (i === num - 1 ? next : it)),
  )
}
