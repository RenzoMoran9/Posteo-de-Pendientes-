import { describe, expect, it } from 'vitest'
import { GRID, MAX_ZOOM, MIN_ZOOM, boundsOf, clamp, findFreeSpot, fitView, magnet, zoomAround, type Rect } from './geometry'

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
