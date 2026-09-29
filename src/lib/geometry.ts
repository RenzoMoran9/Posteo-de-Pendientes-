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

/** Ángulo equivalente en (−180, 180]: 190° → −170°, −180° → 180°. Nunca devuelve −0. */
export function normalizeAngle(deg: number): number {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180
  return (a === -180 ? 180 : a) + 0
}

/**
 * Siguiente ángulo "redondo" (múltiplo de `step`) en un sentido: desde 9° → 15° a la derecha o 0° a la izquierda.
 * Así los botones de girar siempre terminan derechos, aunque el ícono naciera un poco chueco.
 */
export function stepAngle(deg: number, dir: 1 | -1, step = 15): number {
  const k = deg / step
  const eps = 1e-6
  const n = dir > 0 ? Math.floor(k + eps) + 1 : Math.ceil(k - eps) - 1
  return normalizeAngle(n * step)
}

/**
 * Imán del giro con el dedo o el ratón: cerca de un múltiplo de 45° (0°, 45°, 90°…) se pega a él para poder
 * dejar el ícono derecho sin puntería; con `strict` (tecla Mayús) va de 15° en 15°; con `free` (Alt) no hay imán.
 */
export function snapTilt(deg: number, opts: { strict?: boolean; free?: boolean } = {}): number {
  if (opts.free) return deg
  if (opts.strict) return Math.round(deg / 15) * 15 + 0
  const n = Math.round(deg / 45) * 45 + 0
  return Math.abs(n - deg) <= 4 ? n : deg
}

/** Ángulo (en grados, 0° = derecha, positivo = hacia abajo) del vector que va de (cx, cy) a (px, py). */
export const angleTo = (cx: number, cy: number, px: number, py: number): number =>
  (Math.atan2(py - cy, px - cx) * 180) / Math.PI

/** Caja que ocupa en el tablero un ícono cuadrado de lado `size` girado `tilt`° sobre su centro. */
export function rotatedSquare(x: number, y: number, size: number, tilt: number): Rect {
  const r = (tilt * Math.PI) / 180
  const side = size * (Math.abs(Math.cos(r)) + Math.abs(Math.sin(r)))
  const cx = x + size / 2
  const cy = y + size / 2
  return { x: cx - side / 2, y: cy - side / 2, w: side, h: side }
}

/**
 * Por cuánto hay que multiplicar una caja de `w` × `h` para que su esquina de abajo a la derecha quede lo más cerca
 * posible del punto al que se arrastró (`dx`, `dy` más allá de la esquina): es la proyección del arrastre sobre la
 * diagonal de la caja. Así la esquina agranda o achica todo en diagonal, siempre con la misma forma.
 */
export function diagonalScale(w: number, h: number, dx: number, dy: number): number {
  const d2 = w * w + h * h
  return d2 > 0 ? 1 + (dx * w + dy * h) / d2 : 1
}

export interface ScaleLimits {
  /** Escala mínima y máxima, sea cual sea el ancho. */
  min: number
  max: number
  /** Ancho que se ve (ya escalado) por debajo / por encima del cual no se deja llegar. */
  minVisibleW: number
  maxVisibleW: number
}

/** Escalas permitidas de un posit cuyo papel mide `w` de ancho sin escalar. */
export function scaleRange(w: number, lim: ScaleLimits): { min: number; max: number } {
  const base = Math.max(1, w)
  return { min: Math.max(lim.min, lim.minVisibleW / base), max: Math.min(lim.max, lim.maxVisibleW / base) }
}

/**
 * Cuánto se corre un ícono pegado cuando el posit cambia de medidas (`before` → `after`, sin escalar): se queda a la
 * misma distancia del borde más cercano a su centro (el izquierdo o el derecho, el de arriba o el de abajo). Así uno
 * pegado en la esquina de abajo a la derecha sigue en esa esquina, y uno de arriba a la izquierda no se mueve.
 */
export function anchoredShift(
  center: { x: number; y: number },
  before: { w: number; h: number },
  after: { w: number; h: number },
): { dx: number; dy: number } {
  return {
    dx: center.x > before.w / 2 ? after.w - before.w : 0,
    dy: center.y > before.h / 2 ? after.h - before.h : 0,
  }
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

/**
 * Vista que deja `rect` (en el tablero) entero dentro del área libre de la pantalla (`size` menos lo que ocupan las
 * barras, `insets`, y `pad` de aire). Si ya se ve entero, devuelve la vista tal cual. Si cabe a este zoom, solo lo
 * desplaza lo justo; si no cabe, aleja el zoom (sin pasar de `minZ`; nunca lo acerca) dejando quieta la esquina de arriba
 * a la izquierda, y después lo desplaza. Cuando aun así no cabe, gana el borde de arriba a la izquierda.
 */
export function revealView(view: View, rect: Rect, size: { w: number; h: number }, insets: Insets, pad = 8, minZ = view.z): View {
  const availW = size.w - insets.left - insets.right - pad * 2
  const availH = size.h - insets.top - insets.bottom - pad * 2
  let base = view
  if (rect.w * view.z > availW || rect.h * view.z > availH) {
    const fit = Math.min(view.z, availW / Math.max(1, rect.w), availH / Math.max(1, rect.h))
    const z = clamp(fit, Math.min(minZ, view.z), view.z)
    if (z < view.z) base = zoomAround(view, rect.x * view.z + view.x, rect.y * view.z + view.y, z)
  }
  const { x, y, z } = base
  const left = insets.left + pad
  const right = size.w - insets.right - pad
  const top = insets.top + pad
  const bottom = size.h - insets.bottom - pad
  const x1 = rect.x * z + x
  const x2 = (rect.x + rect.w) * z + x
  const y1 = rect.y * z + y
  const y2 = (rect.y + rect.h) * z + y
  let dx = 0
  let dy = 0
  if (x2 > right) dx = right - x2
  if (x1 + dx < left) dx = left - x1
  if (y2 > bottom) dy = bottom - y2
  if (y1 + dy < top) dy = top - y1
  return { x: x + dx, y: y + dy, z }
}

