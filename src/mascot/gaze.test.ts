import { describe, expect, it } from 'vitest'
import { CLAWD, FIGURE_H, FIGURE_W, FLOOR_Y, armCenterX, eyeRoom, legCenters } from './clawd'
import { GAZE, isDoubleBlink, lookAt, nextBlinkDelay } from './gaze'

const eye = { x: 500, y: 400 }
const straight = { ex: 0, ey: 0, rx: 0, ry: 0 }

describe('lookAt', () => {
  it('sin nada que mirar, mira al frente', () => {
    expect(lookAt(eye, null)).toEqual(straight)
    expect(lookAt(eye, { x: 500, y: 400 })).toEqual(straight)
  })

  it('los ojos van hacia el punto y el cuerpo gira hacia ese lado', () => {
    const left = lookAt(eye, { x: 100, y: 400 })
    expect(left.ex).toBeLessThan(0)
    expect(left.ry).toBeLessThan(0)
    const right = lookAt(eye, { x: 900, y: 400 })
    expect(right.ex).toBeGreaterThan(0)
    expect(right.ry).toBeGreaterThan(0)
    const up = lookAt(eye, { x: 500, y: 0 })
    expect(up.ey).toBeLessThan(0)
    expect(up.rx).toBeGreaterThan(0) // arriba = la cara se inclina hacia atrás
    const down = lookAt(eye, { x: 500, y: 800 })
    expect(down.ey).toBeGreaterThan(0)
    expect(down.rx).toBeLessThan(0)
  })

  it('nunca pasa de sus máximos, por lejos que esté el punto', () => {
    const far = lookAt(eye, { x: 50_000, y: -50_000 })
    expect(Math.abs(far.ex)).toBeLessThanOrEqual(GAZE.eyeX + 1e-9)
    expect(Math.abs(far.ey)).toBeLessThanOrEqual(GAZE.eyeY + 1e-9)
    expect(Math.abs(far.ry)).toBeLessThanOrEqual(GAZE.tiltY)
    expect(Math.abs(far.rx)).toBeLessThanOrEqual(GAZE.tiltX)
  })

  it('cerca del ojo mueve poco los ojos (mira «de frente»)', () => {
    const near = lookAt(eye, { x: 530, y: 400 })
    const far = lookAt(eye, { x: 900, y: 400 })
    expect(near.ex).toBeGreaterThan(0)
    expect(near.ex).toBeLessThan(far.ex)
  })

  it('el ojo no se sale de la cara aunque mire lo más lejos posible', () => {
    const room = eyeRoom()
    expect(room.x).toBeGreaterThan(0)
    expect(room.y).toBeGreaterThan(0)
    for (const target of [
      { x: 9000, y: 400 },
      { x: -9000, y: 400 },
      { x: 500, y: -9000 },
      { x: 500, y: 9000 },
    ]) {
      const l = lookAt(eye, target)
      expect(Math.abs(l.ex)).toBeLessThanOrEqual(room.x)
      expect(Math.abs(l.ey)).toBeLessThanOrEqual(room.y)
    }
  })
})

describe('el modelo 3D', () => {
  const { body, arm, leg, eye: e } = CLAWD

  it('las cuatro patas caen bajo el cuerpo, en dos parejas simétricas y sin tocarse', () => {
    const xs = legCenters()
    expect(xs).toHaveLength(4)
    expect(xs[0]).toBeCloseTo(-xs[3])
    expect(xs[1]).toBeCloseTo(-xs[2])
    for (let i = 1; i < 4; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(leg.w - 1e-9) // sin encimarse
    expect(xs[1] - xs[0]).toBeCloseTo(leg.w + leg.slit) // la rendija entre las dos de cada pareja
    expect(xs[2] - xs[1]).toBeCloseTo(leg.pair + leg.w)
    expect(xs[3] + leg.w / 2).toBeLessThan(body.w / 2) // no salen del cuerpo
  })

  it('los bracitos salen de los costados, a media altura del cuerpo', () => {
    expect(armCenterX(-1)).toBeCloseTo(-(body.w / 2 + arm.w / 2))
    expect(armCenterX(1)).toBeCloseTo(body.w / 2 + arm.w / 2)
    expect(arm.y - arm.h / 2).toBeGreaterThan(-body.h / 2)
    expect(arm.y + arm.h / 2).toBeLessThan(body.h / 2)
    expect(arm.d).toBeLessThanOrEqual(body.d)
  })

  it('los dos ojos caben en la cara, a los lados del centro y sobre la mitad de arriba', () => {
    expect(e.x - e.w / 2).toBeGreaterThan(0)
    expect(e.x + e.w / 2).toBeLessThan(body.w / 2)
    expect(e.y - e.h / 2).toBeGreaterThan(-body.h / 2)
    expect(e.y + e.h / 2).toBeLessThan(body.h / 2)
    expect(e.h).toBeCloseTo(e.w * 2) // son rectángulos «de dos cuadros»
  })

  it('la figura entera cabe en su caja (26,8 × 18,5 u en 27,6 u de ancho)', () => {
    expect(FIGURE_W).toBeCloseTo(26.8)
    expect(FIGURE_H).toBeCloseTo(18.5)
    expect(FLOOR_Y).toBeCloseTo(11.25)
    expect(FIGURE_W).toBeLessThan(27.6)
  })
})

describe('parpadeo', () => {
  it('espera entre 2,2 y 6 segundos', () => {
    expect(nextBlinkDelay(() => 0)).toBe(2200)
    expect(nextBlinkDelay(() => 0.999)).toBeLessThan(6000)
  })

  it('de cada cinco parpadeos, uno es doble (más o menos)', () => {
    expect(isDoubleBlink(() => 0.1)).toBe(true)
    expect(isDoubleBlink(() => 0.5)).toBe(false)
  })
})
