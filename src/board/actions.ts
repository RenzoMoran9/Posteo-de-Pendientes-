import type { JSONContent } from '@tiptap/core'
import { boundsOf, findFreeSpot, fitView, rotatedSquare, stepAngle, type Rect } from '../lib/geometry'
import { NOTE_DEFAULTS, STICKER_DEFAULTS, noteScale, stickersOfNote, store } from '../store/store'
import { insertIconInNote } from './editors'
import { kbdProxy } from './kbd'
import { view } from './view'

let viewTimer: ReturnType<typeof setTimeout> | undefined

/** Guarda el zoom/posición del tablero activo (con una pausa, para no escribir en cada fotograma). */
export function persistViewSoon(): void {
  if (viewTimer) clearTimeout(viewTimer)
  viewTimer = setTimeout(() => {
    const s = store.getState()
    s.setView(s.activeBoardId, { ...view.get() })
  }, 300)
}

/**
 * "＋": pega un posit nuevo cerca del centro de lo que se ve, en el hueco libre más cercano
 * (para que el tablero quede ordenado), y desplaza el tablero si hace falta para mostrarlo.
 */
export function addNoteAtCenter(): void {
  kbdProxy.prime()
  const { w, h } = NOTE_DEFAULTS
  const c = view.visibleCenter()
  const id = store.getState().addNote({
    x: c.x - w / 2,
    y: c.y - h / 2,
    w,
    h,
    edit: true,
    avoid: measuredRects(),
  })
  const n = store.getState().notes[id]
  if (n) {
    view.ensureVisible({ x: n.x, y: n.y, w: n.w, h: n.h })
    persistViewSoon()
  }
}

/**
 * Un posit que nace con el texto ya escrito (lo crea la conversación con Claude): cerca del centro de lo que se ve,
 * en el hueco libre más cercano y sin abrir el teclado.
 */
export function addNoteWithContent(doc: JSONContent, color?: string): string {
  const { w, h } = NOTE_DEFAULTS
  const c = view.visibleCenter()
  const id = store.getState().addNote({ x: c.x - w / 2, y: c.y - h / 2, w, h, doc, color, avoid: measuredRects() })
  const n = store.getState().notes[id]
  if (n) {
    view.ensureVisible({ x: n.x, y: n.y, w: n.w, h: n.h })
    persistViewSoon()
  }
  return id
}

let revealTimer: ReturnType<typeof setTimeout> | undefined
let revealOff: (() => void) | undefined

/** Anula un «traer a la vista» que estuviera esperando: lo que haga la persona con el dedo o el ratón manda. */
export function cancelReveal(): void {
  if (revealTimer) clearTimeout(revealTimer)
  revealTimer = undefined
  revealOff?.()
  revealOff = undefined
}

/** Lo que ocupa en pantalla la mascota (o su mascotita, si está escondida), si se ve. */
function mascotBox(): DOMRect | null {
  const r = document.querySelector<HTMLElement>('.mascot-figure, .mascot-peek')?.getBoundingClientRect()
  return r && r.width > 0 && r.height > 0 ? r : null
}

/** Lo más que se aleja el zoom para traer un posit entero a la vista (más allá, se deja el zoom como está). */
const REVEAL_MIN_ZOOM = 0.75

/**
 * Al elegir un posit, lo trae a la vista completo (con el tirador de la esquina, que sobresale) por encima de las barras
 * y de la mascota: la barra de acciones aparece justo con la selección y, si el posit quedaba abajo, tapaba el tirador
 * y no se podía agarrar. Espera un momento a que la barra aparezca y la mascota dé su saltito para saber cuánto tapan,
 * y cualquier toque o clic que la persona haga mientras tanto lo cancela.
 */
export function revealNote(id: string): void {
  cancelReveal()
  const off = () => cancelReveal()
  document.addEventListener('pointerdown', off, { capture: true, once: true })
  revealOff = () => document.removeEventListener('pointerdown', off, true)
  revealTimer = setTimeout(() => {
    revealTimer = undefined
    revealOff?.()
    revealOff = undefined
    const el = document.querySelector<HTMLElement>(`[data-note-id="${id}"]`)
    if (!el || store.getState().selectedId !== id) return
    const z = view.get().z
    const r = el.getBoundingClientRect()
    const at = view.screenToBoard(r.left, r.top)
    const reach = 32 // el tirador de la esquina sobresale del posit (en píxeles de pantalla)
    const rect = { x: at.x, y: at.y, w: (r.width + reach) / z, h: (r.height + reach) / z }
    // La mascota también puede quedar sobre el tirador: si la esquina cae a su lado, se sube un poco más.
    const m = mascotBox()
    const board = view.rect()
    const overMascot = m !== null && r.right + reach > m.left && r.right - reach < m.right
    const bottom = overMascot ? Math.max(view.insets().bottom, board.height - (m.top - board.top) + 6) : undefined
    // si el posit no cabe entero, se aleja un poco el zoom para verlo completo y poder alcanzar su esquina
    view.ensureVisible(rect, true, bottom === undefined ? undefined : { bottom }, REVEAL_MIN_ZOOM)
    persistViewSoon()
  }, 380)
}

/** Doble clic en el fondo: el posit nace justo donde se hizo clic. */
export function addNoteAtClient(cx: number, cy: number): void {
  kbdProxy.prime()
  const p = view.screenToBoard(cx, cy)
  store.getState().addNote({ x: p.x - NOTE_DEFAULTS.w / 2, y: p.y - NOTE_DEFAULTS.h / 2, edit: true, exact: true })
}

/** Rectángulos reales de los posits, como se ven (con su escala; el alto real puede ser mayor que el guardado si el texto crece). */
function measuredRects(): Rect[] {
  const s = store.getState()
  const z = view.get().z
  return Object.values(s.notes)
    .filter((n) => n.boardId === s.activeBoardId)
    .map((n) => {
      const k = noteScale(n)
      const el = document.querySelector<HTMLElement>(`[data-note-id="${n.id}"]`)
      const realH = el ? el.getBoundingClientRect().height / z : n.h * k
      return { x: n.x, y: n.y, w: n.w * k, h: Math.max(n.h * k, realH) }
    })
}

/** Rectángulos de los íconos sueltos del tablero activo (lo que ocupan ya girados). */
function looseStickerRects(): Rect[] {
  const s = store.getState()
  return Object.values(s.stickers)
    .filter((st) => st.boardId === s.activeBoardId && st.noteId === null)
    .map((st) => rotatedSquare(st.x, st.y, st.size, st.tilt))
}

/**
 * Gira un ícono al siguiente ángulo "redondo" (de 15° en 15°) hacia la derecha (`1`) o la izquierda (`-1`).
 * Aunque el ícono esté chueco (los íconos nuevos nacen un poco inclinados), en un toque o dos queda derecho.
 */
export function rotateSticker(id: string, dir: 1 | -1): void {
  const st = store.getState().stickers[id]
  if (!st) return
  store.getState().patchSticker(id, { tilt: stepAngle(st.tilt, dir) })
}

/**
 * El sitio del ícono número `k` (0, 1, 2…) pegado a un posit de ancho `noteW`: en la esquina superior derecha,
 * y los siguientes a su izquierda en fila, como pegatinas (cuando ya no caben, otra fila).
 */
export function cornerSlot(noteW: number, k: number, size: number = STICKER_DEFAULTS.size): { x: number; y: number } {
  const step = size * 0.82
  const perRow = Math.max(1, Math.floor((noteW + size * 0.28) / step))
  return { x: noteW - size * 0.72 - (k % perRow) * step, y: -size * 0.3 + Math.floor(k / perRow) * step }
}

/**
 * Pega un ícono desde el panel. Con un posit seleccionado (o un ícono suyo), va a su esquina superior derecha
 * (y los siguientes a su izquierda, como pegatinas en fila); sin posit, cae suelto en la hoja, en el hueco libre
 * más cercano al centro de lo que se ve. Después se arrastra a donde se quiera.
 */
export function addStickerFromPanel(icon: string): string {
  const s = store.getState()
  const size = STICKER_DEFAULTS.size
  // «El posit de turno»: el seleccionado o, si hay un ícono pegado seleccionado, el posit al que pertenece
  // (así se pueden pegar varios seguidos al mismo posit sin volver a seleccionarlo).
  const sel = s.selectedStickerId ? s.stickers[s.selectedStickerId] : undefined
  const note = s.selectedId ? s.notes[s.selectedId] : sel?.noteId ? s.notes[sel.noteId] : undefined

  if (note) {
    const { x, y } = cornerSlot(note.w, stickersOfNote(s, note.id).length, size)
    const id = s.addSticker({ icon, noteId: note.id, x, y, size })
    const k = noteScale(note)
    view.ensureVisible({ x: note.x + x * k, y: note.y + y * k, w: size * k, h: size * k })
    persistViewSoon()
    return id
  }

  const c = view.visibleCenter()
  const spot = findFreeSpot([...measuredRects(), ...looseStickerRects()], c.x - size / 2, c.y - size / 2, size, size, 12, 10)
  const id = s.addSticker({ icon, x: spot.x, y: spot.y, size })
  view.ensureVisible({ x: spot.x, y: spot.y, w: size, h: size })
  persistViewSoon()
  return id
}

/** Un toque en un ícono del panel: lo pega donde toca según cómo se abrió el panel (en el texto o en el tablero). */
export function pickIcon(icon: string): void {
  const s = store.getState()
  const panel = s.iconPanel
  s.rememberIcon(icon)
  if (panel?.mode === 'text') insertIconInNote(panel.noteId, icon)
  else addStickerFromPanel(icon)
  store.getState().closeIcons()
}

/** Rectángulos (en el tablero) de todos los íconos del tablero activo: sueltos y pegados (los pegados pueden sobresalir del posit). */
function allStickerRects(): Rect[] {
  const s = store.getState()
  return Object.values(s.stickers)
    .filter((st) => st.boardId === s.activeBoardId)
    .flatMap((st) => {
      const parent = st.noteId ? s.notes[st.noteId] : undefined
      if (st.noteId && !parent) return []
      const k = parent ? noteScale(parent) : 1
      return [rotatedSquare((parent ? parent.x : 0) + st.x * k, (parent ? parent.y : 0) + st.y * k, st.size * k, st.tilt)]
    })
}

/** "Ver todo": encuadra todos los posits y todos los íconos (así ninguno queda tapado por las barras). */
export function fitAll(animate = true): void {
  const r = view.rect()
  const b = boundsOf([...measuredRects(), ...allStickerRects()])
  const ins = view.insets()
  let target
  if (b) {
    target = fitView(b, { w: r.width, h: r.height }, ins, 1)
  } else {
    target = { x: ins.left + (r.width - ins.left - ins.right) / 2, y: ins.top + (r.height - ins.top - ins.bottom) / 2, z: 1 }
  }
  if (animate) view.animateTo(target)
  else view.set(target)
  persistViewSoon()
}

export function zoomBy(factor: number): void {
  const r = view.rect()
  view.zoomAtClient(r.left + r.width / 2, r.top + r.height / 2, view.get().z * factor)
  persistViewSoon()
}

export function resetZoom(): void {
  const r = view.rect()
  const c = view.visibleCenter()
  const ins = view.insets()
  const cx = ins.left + (r.width - ins.left - ins.right) / 2
  const cy = ins.top + (r.height - ins.top - ins.bottom) / 2
  view.animateTo({ z: 1, x: cx - c.x, y: cy - c.y })
  persistViewSoon()
}
