import { boundsOf, fitView, type Rect } from '../lib/geometry'
import { NOTE_DEFAULTS, store } from '../store/store'
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

/** Doble clic en el fondo: el posit nace justo donde se hizo clic. */
export function addNoteAtClient(cx: number, cy: number): void {
  kbdProxy.prime()
  const p = view.screenToBoard(cx, cy)
  store.getState().addNote({ x: p.x - NOTE_DEFAULTS.w / 2, y: p.y - NOTE_DEFAULTS.h / 2, edit: true, exact: true })
}

/** Rectángulos reales de los posits (el alto real puede ser mayor que el guardado si el texto crece). */
function measuredRects(): Rect[] {
  const s = store.getState()
  const z = view.get().z
  return Object.values(s.notes)
    .filter((n) => n.boardId === s.activeBoardId)
    .map((n) => {
      const el = document.querySelector<HTMLElement>(`[data-note-id="${n.id}"]`)
      const realH = el ? el.getBoundingClientRect().height / z : n.h
      return { x: n.x, y: n.y, w: n.w, h: Math.max(n.h, realH) }
    })
}

/** "Ver todo": encuadra todos los posits del tablero. */
export function fitAll(animate = true): void {
  const r = view.rect()
  const b = boundsOf(measuredRects())
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
