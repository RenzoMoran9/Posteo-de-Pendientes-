export interface View {
  /** Desplazamiento del tablero en píxeles de pantalla. */
  x: number
  y: number
  /** Zoom (1 = 100 %). */
  z: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

/** Lado de un cuadro de la cuadrícula del cuaderno, en unidades del tablero. */
export const GRID = 24
export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 3

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

/** Imán suave: si `v` está a menos de `tol` de un múltiplo de `step`, se pega a él. */
export function magnet(v: number, step: number, tol: number): number {
  const n = Math.round(v / step) * step
  return Math.abs(n - v) <= tol ? n : v
}

/** Cambia el zoom dejando fijo el punto (px, py) de la pantalla. */
export function zoomAround(view: View, px: number, py: number, nextZ: number): View {
  const z = clamp(nextZ, MIN_ZOOM, MAX_ZOOM)
  const bx = (px - view.x) / view.z
  const by = (py - view.y) / view.z
  return { x: px - bx * z, y: py - by * z, z }
}

export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const r of rects) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w)
    y2 = Math.max(y2, r.y + r.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/**
 * Hueco libre más cercano a (x, y) donde quepa un posit de w×h sin tapar a otros
 * (deja `gap` de aire entre posits). Si el tablero está tan lleno que no hay hueco,
 * devuelve el punto original desplazado en cascada.
 */
export function findFreeSpot(
  rects: Rect[],
  x: number,
  y: number,
  w: number,
  h: number,
  step = GRID,
  gap = 12,
): { x: number; y: number } {
  const fits = (px: number, py: number) =>
    rects.every(
      (r) => px + w + gap <= r.x || px >= r.x + r.w + gap || py + h + gap <= r.y || py >= r.y + r.h + gap,
    )
  if (fits(x, y)) return { x, y }

  // Anillos cuadrados cada vez más lejanos; en cada uno se elige el candidato más cercano.
  for (let ring = 1; ring <= 40; ring++) {
    let best: { x: number; y: number; d: number } | null = null
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue
        const px = x + dx * step
        const py = y + dy * step
        if (!fits(px, py)) continue
        const d = dx * dx + dy * dy
        if (!best || d < best.d) best = { x: px, y: py, d }
      }
    }
    if (best) return { x: best.x, y: best.y }
  }
  return { x: x + step, y: y + step }
}

/** Vista que deja `bounds` completo y centrado dentro del área libre de pantalla. */
export function fitView(bounds: Rect, size: { w: number; h: number }, insets: Insets, maxZ = 1): View {
  const availW = Math.max(1, size.w - insets.left - insets.right)
  const availH = Math.max(1, size.h - insets.top - insets.bottom)
  const z = clamp(Math.min(availW / Math.max(1, bounds.w), availH / Math.max(1, bounds.h)), MIN_ZOOM, maxZ)
  const cx = bounds.x + bounds.w / 2
  const cy = bounds.y + bounds.h / 2
  return {
    z,
    x: insets.left + availW / 2 - cx * z,
    y: insets.top + availH / 2 - cy * z,
  }
}
