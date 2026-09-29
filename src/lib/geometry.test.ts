import { describe, expect, it } from 'vitest'
import {
  GRID,
  MAX_ZOOM,
  MIN_ZOOM,
  angleTo,
  boundsOf,
  clamp,
  findFreeSpot,
  fitView,
  magnet,
  normalizeAngle,
  rotatedSquare,
  snapTilt,
  stepAngle,
  zoomAround,
  type Rect,
} from './geometry'

describe('magnet', () => {
  it('pega al múltiplo cercano', () => {
    expect(magnet(50, GRID, 9)).toBe(48)
    expect(magnet(44, GRID, 9)).toBe(48)
  })
  it('no toca lo que queda lejos de la cuadrícula', () => {
    expect(magnet(60, GRID, 9)).toBe(60)
  })
})

describe('zoomAround', () => {
  it('deja fijo el punto bajo el cursor', () => {
    const view = { x: 130, y: -40, z: 1.3 }
    const p = { x: 420, y: 310 }
    const before = { x: (p.x - view.x) / view.z, y: (p.y - view.y) / view.z }
    const next = zoomAround(view, p.x, p.y, 2.2)
    const after = { x: (p.x - next.x) / next.z, y: (p.y - next.y) / next.z }
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
    expect(next.z).toBe(2.2)
  })
  it('respeta los límites de zoom', () => {
    expect(zoomAround({ x: 0, y: 0, z: 1 }, 0, 0, 99).z).toBe(MAX_ZOOM)
    expect(zoomAround({ x: 0, y: 0, z: 1 }, 0, 0, 0.001).z).toBe(MIN_ZOOM)
  })
})

describe('boundsOf y fitView', () => {
  const rects: Rect[] = [
    { x: -100, y: -50, w: 200, h: 100 },
    { x: 300, y: 200, w: 100, h: 100 },
  ]
  it('calcula el rectángulo que contiene a todos', () => {
    expect(boundsOf(rects)).toEqual({ x: -100, y: -50, w: 500, h: 350 })
    expect(boundsOf([])).toBeNull()
  })
  it('centra el contenido en el área libre y no pasa del zoom máximo pedido', () => {
    const bounds = boundsOf(rects) as Rect
    const insets = { top: 60, right: 10, bottom: 100, left: 10 }
    const v = fitView(bounds, { w: 800, h: 600 }, insets, 1)
    expect(v.z).toBeLessThanOrEqual(1)
    const cx = (bounds.x + bounds.w / 2) * v.z + v.x
    const cy = (bounds.y + bounds.h / 2) * v.z + v.y
    expect(cx).toBeCloseTo(10 + (800 - 20) / 2, 6)
    expect(cy).toBeCloseTo(60 + (600 - 160) / 2, 6)
  })
  it('aleja lo necesario para que todo quepa', () => {
    const v = fitView({ x: 0, y: 0, w: 2000, h: 1000 }, { w: 400, h: 800 }, { top: 0, right: 0, bottom: 0, left: 0 }, 1)
    expect(v.z).toBeCloseTo(0.2, 6)
  })
})

describe('findFreeSpot', () => {
  const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

  it('usa el punto ideal si está libre', () => {
    expect(findFreeSpot([], 10, 20, 240, 216)).toEqual({ x: 10, y: 20 })
  })
  it('busca el hueco más cercano sin tapar a nadie', () => {
    const taken: Rect[] = [{ x: 0, y: 0, w: 264, h: 258 }]
    const spot = findFreeSpot(taken, 12, -12, 240, 216)
    expect(overlaps({ x: spot.x, y: spot.y, w: 240, h: 216 }, taken[0])).toBe(false)
    // y queda cerca: a una distancia del orden del propio posit, no en el otro extremo del tablero
    expect(Math.hypot(spot.x - 12, spot.y + 12)).toBeLessThan(400)
  })
  it('esquiva varios posits a la vez', () => {
    const taken: Rect[] = [
      { x: 0, y: 0, w: 240, h: 216 },
      { x: 252, y: 0, w: 240, h: 216 },
      { x: 0, y: 228, w: 240, h: 216 },
    ]
    const spot = findFreeSpot(taken, 0, 0, 240, 216)
    for (const t of taken) expect(overlaps({ x: spot.x, y: spot.y, w: 240, h: 216 }, t)).toBe(false)
  })
})

describe('clamp', () => {
  it('limita por ambos lados', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-5, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })
})

describe('giro de íconos', () => {
  it('normalizeAngle deja el ángulo entre −180° (sin incluir) y 180°', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(190)).toBe(-170)
    expect(normalizeAngle(-190)).toBe(170)
    expect(normalizeAngle(360)).toBe(0)
    expect(normalizeAngle(-180)).toBe(180)
    expect(normalizeAngle(180)).toBe(180)
    expect(normalizeAngle(725)).toBe(5)
    expect(Object.is(normalizeAngle(-360), 0)).toBe(true)
  })

  it('stepAngle salta al siguiente múltiplo de 15° en el sentido pedido', () => {
    expect(stepAngle(9, 1)).toBe(15)
    expect(stepAngle(9, -1)).toBe(0)
    expect(stepAngle(15, 1)).toBe(30)
    expect(stepAngle(15, -1)).toBe(0)
    expect(stepAngle(0, 1)).toBe(15)
    expect(stepAngle(0, -1)).toBe(-15)
    expect(stepAngle(-9, 1)).toBe(0)
    expect(stepAngle(-9, -1)).toBe(-15)
    expect(stepAngle(165, 1)).toBe(180)
    expect(stepAngle(180, 1)).toBe(-165)
    expect(stepAngle(-165, -1)).toBe(180)
  })

  it('stepAngle no se atora por decimales: 14.9999999° cuenta como 15°', () => {
    expect(stepAngle(14.9999999, 1)).toBe(30)
    expect(stepAngle(30.0000001, -1)).toBe(15)
  })

  it('veinticuatro toques a la derecha dan la vuelta completa', () => {
    let a = 0
    for (let i = 0; i < 24; i++) a = stepAngle(a, 1)
    expect(a).toBe(0)
  })

  it('snapTilt se pega a 0°, 45°, 90°… cuando se pasa cerca', () => {
    expect(snapTilt(2)).toBe(0)
    expect(snapTilt(-3.5)).toBe(0)
    expect(snapTilt(88)).toBe(90)
    expect(snapTilt(47)).toBe(45)
    expect(snapTilt(-133)).toBe(-135)
    expect(snapTilt(20)).toBe(20)
    expect(snapTilt(60.5)).toBe(60.5)
  })

  it('snapTilt con Mayús va de 15° en 15°, y con Alt es libre', () => {
    expect(snapTilt(20, { strict: true })).toBe(15)
    expect(snapTilt(23, { strict: true })).toBe(30)
    expect(snapTilt(2, { free: true })).toBe(2)
  })

  it('angleTo mide desde el centro: derecha 0°, abajo 90°, izquierda 180°, arriba −90°', () => {
    expect(angleTo(0, 0, 10, 0)).toBeCloseTo(0, 9)
    expect(angleTo(0, 0, 0, 10)).toBeCloseTo(90, 9)
    expect(Math.abs(angleTo(0, 0, -10, 0))).toBeCloseTo(180, 9)
    expect(angleTo(5, 5, 5, -5)).toBeCloseTo(-90, 9)
  })

  it('rotatedSquare: sin giro es el mismo cuadro; a 45° crece √2 desde su centro', () => {
    expect(rotatedSquare(10, 20, 50, 0)).toEqual({ x: 10, y: 20, w: 50, h: 50 })
    const r = rotatedSquare(10, 20, 50, 45)
    expect(r.w).toBeCloseTo(50 * Math.SQRT2, 9)
    expect(r.x + r.w / 2).toBeCloseTo(35, 9)
    expect(r.y + r.h / 2).toBeCloseTo(45, 9)
    const q = rotatedSquare(10, 20, 50, 90)
    expect(q.w).toBeCloseTo(50, 9)
  })
})
