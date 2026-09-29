import { describe, expect, it } from 'vitest'
import { GAZE, isDoubleBlink, lookAt, nextBlinkDelay } from './gaze'

const eye = { x: 500, y: 400 }

describe('lookAt', () => {
  it('sin nada que mirar, mira al frente', () => {
    expect(lookAt(eye, null)).toEqual({ px: 0, py: 0, fx: 0, fy: 0, rx: 0, ry: 0 })
    expect(lookAt(eye, { x: 500, y: 400 })).toEqual({ px: 0, py: 0, fx: 0, fy: 0, rx: 0, ry: 0 })
  })

  it('las pupilas van hacia el punto y el cuerpo gira hacia ese lado', () => {
    const left = lookAt(eye, { x: 100, y: 400 })
    expect(left.px).toBeLessThan(0)
    expect(left.ry).toBeLessThan(0)
    const right = lookAt(eye, { x: 900, y: 400 })
    expect(right.px).toBeGreaterThan(0)
    expect(right.ry).toBeGreaterThan(0)
    const up = lookAt(eye, { x: 500, y: 0 })
    expect(up.py).toBeLessThan(0)
    expect(up.rx).toBeGreaterThan(0) // arriba = la cara se inclina hacia atrás
    const down = lookAt(eye, { x: 500, y: 800 })
    expect(down.py).toBeGreaterThan(0)
    expect(down.rx).toBeLessThan(0)
  })

  it('nunca pasa de sus máximos, por lejos que esté el punto', () => {
    const far = lookAt(eye, { x: 50_000, y: -50_000 })
    expect((far.px / GAZE.pupilX) ** 2 + (far.py / GAZE.pupilY) ** 2).toBeLessThanOrEqual(1 + 1e-9)
    expect(Math.hypot(far.fx, far.fy)).toBeLessThanOrEqual(GAZE.face + 1e-9)
    expect(Math.abs(far.ry)).toBeLessThanOrEqual(GAZE.tiltY)
    expect(Math.abs(far.rx)).toBeLessThanOrEqual(GAZE.tiltX)
  })

  it('cerca del ojo mueve poco las pupilas (mira «de frente»)', () => {
    const near = lookAt(eye, { x: 530, y: 400 })
    const far = lookAt(eye, { x: 900, y: 400 })
    expect(near.px).toBeGreaterThan(0)
    expect(near.px).toBeLessThan(far.px)
  })

  it('la pupila no se sale del ojo (6,4 × 7,4 con pupila de 3,7)', () => {
    expect(GAZE.pupilX).toBeLessThan(6.4 - 3.7)
    expect(GAZE.pupilY).toBeLessThan(7.4 - 3.7)
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
