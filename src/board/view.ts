import { GRID, MAX_ZOOM, MIN_ZOOM, clamp, zoomAround, type Insets, type Rect, type View } from '../lib/geometry'

type Listener = () => void

/** Por debajo de este zoom se ocultan las líneas finas de la cuadrícula. */
const MINOR_FADE_START = 0.6
const MINOR_FADE_END = 0.42

/**
 * Posición y zoom del tablero. Escribe directo en el DOM (sin pasar por React)
 * para que arrastrar y pellizcar vaya a 60 fps incluso en un celular modesto.
 */
export class ViewController {
  private v: View = { x: 0, y: 0, z: 1 }
  private snap: View = { x: 0, y: 0, z: 1 }
  private board: HTMLElement | null = null
  private world: HTMLElement | null = null
  private listeners = new Set<Listener>()
  private anim = 0
  private lastZ = Number.NaN
  /** Espacio ocupado por las barras flotantes (arriba y abajo) y margen a los lados para que los tiradores se vean enteros. */
  private chrome: Insets = { top: 68, right: 24, bottom: 120, left: 24 }

  attach(board: HTMLElement, world: HTMLElement): void {
    this.board = board
    this.world = world
    this.lastZ = Number.NaN
    this.apply()
  }

  detach(): void {
    this.stopAnimation()
    this.board = null
    this.world = null
  }

  get(): View {
    return this.v
  }

  getSnapshot = (): View => this.snap

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  setChrome(insets: Partial<Insets>): void {
    this.chrome = { ...this.chrome, ...insets }
  }

  insets(): Insets {
    return this.chrome
  }

  rect(): { left: number; top: number; width: number; height: number } {
    const r = this.board?.getBoundingClientRect()
    if (r && r.width > 0) return { left: r.left, top: r.top, width: r.width, height: r.height }
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
  }

  set(next: Partial<View>): void {
    this.stopAnimation()
    this.v = {
      x: next.x ?? this.v.x,
      y: next.y ?? this.v.y,
      z: clamp(next.z ?? this.v.z, MIN_ZOOM, MAX_ZOOM),
    }
    this.apply()
  }

  panBy(dx: number, dy: number): void {
    this.set({ x: this.v.x + dx, y: this.v.y + dy })
  }

  /** Zoom dejando fijo el punto de la pantalla (coordenadas de cliente). */
  zoomAtClient(cx: number, cy: number, nextZ: number): void {
    const r = this.rect()
    this.set(zoomAround(this.v, cx - r.left, cy - r.top, nextZ))
  }

  screenToBoard(cx: number, cy: number): { x: number; y: number } {
    const r = this.rect()
    return { x: (cx - r.left - this.v.x) / this.v.z, y: (cy - r.top - this.v.y) / this.v.z }
  }

  /** Centro del área libre (sin las barras) en coordenadas del tablero. */
  visibleCenter(): { x: number; y: number } {
    const r = this.rect()
    const c = this.chrome
    const sx = c.left + (r.width - c.left - c.right) / 2
    const sy = c.top + (r.height - c.top - c.bottom) / 2
    return { x: (sx - this.v.x) / this.v.z, y: (sy - this.v.y) / this.v.z }
  }

  /** Desplaza lo justo para que `rect` (en coordenadas del tablero) quede dentro del área libre. */
  ensureVisible(rect: Rect, animate = true): void {
    const r = this.rect()
    const c = this.chrome
    const pad = 8
    const left = c.left + pad
    const right = r.width - c.right - pad
    const top = c.top + pad
    const bottom = r.height - c.bottom - pad
    const { x, y, z } = this.v
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
    if (!dx && !dy) return
    const target = { x: x + dx, y: y + dy, z }
    if (animate) this.animateTo(target, 320)
    else this.set(target)
  }

  animateTo(target: View, ms = 300): void {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.set(target)
      return
    }
    this.stopAnimation()
    const from = { ...this.v }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - t, 3)
      this.v = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        z: from.z + (target.z - from.z) * e,
      }
      this.apply()
      this.anim = t < 1 ? requestAnimationFrame(step) : 0
    }
    this.anim = requestAnimationFrame(step)
  }

  private stopAnimation(): void {
    if (this.anim) cancelAnimationFrame(this.anim)
    this.anim = 0
  }

  private apply(): void {
    const { x, y, z } = this.v
    const zoomChanged = z !== this.lastZ

    if (this.world) {
      this.world.style.transform = `translate(${x}px, ${y}px) scale(${z})`
      if (zoomChanged) {
        this.world.style.setProperty('--z', String(z))
        this.world.style.setProperty('--iz', String(1 / z))
      }
    }

    if (this.board) {
      const b = this.board.style
      b.backgroundPosition = `${x}px ${y}px`
      if (zoomChanged) {
        const minor = GRID * z
        const major = GRID * 5 * z
        b.backgroundSize = `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`
        const fade = clamp((z - MINOR_FADE_END) / (MINOR_FADE_START - MINOR_FADE_END), 0, 1)
        b.setProperty('--minor-a', fade.toFixed(2))
      }
    }

    this.lastZ = z
    this.snap = { x, y, z }
    this.listeners.forEach((fn) => fn())
  }
}

export const view = new ViewController()
