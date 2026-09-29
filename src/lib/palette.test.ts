import { describe, expect, it } from 'vitest'
import { seeded } from './seed'
import { INK_DARK, INK_LIGHT, PAPER_COLORS, TAPE_COLORS, contrast, inkFor, mix, pickTape } from './palette'

describe('paleta de papel', () => {
  it('tiene una paleta amplia y sin colores repetidos', () => {
    expect(PAPER_COLORS.length).toBeGreaterThanOrEqual(20)
    expect(new Set(PAPER_COLORS.map((c) => c.hex.toLowerCase())).size).toBe(PAPER_COLORS.length)
  })

  it('la tinta elegida se lee bien sobre cada color (contraste ≥ 4)', () => {
    for (const c of PAPER_COLORS) {
      const ink = inkFor(c.hex)
      expect(contrast(c.hex, ink), `${c.name} (${c.hex}) con tinta ${ink}`).toBeGreaterThanOrEqual(4)
    }
  })

  it('tinta oscura sobre papel claro y clara sobre papel oscuro', () => {
    expect(inkFor('#FFD95E')).toBe(INK_DARK)
    expect(inkFor('#FFFDF7')).toBe(INK_DARK)
    expect(inkFor('#34507F')).toBe(INK_LIGHT)
    expect(inkFor('#3B3F46')).toBe(INK_LIGHT)
  })
})

describe('mix', () => {
  it('mezcla en los extremos y a medias', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})

describe('cinta', () => {
  it('nunca se confunde con el papel', () => {
    for (const c of PAPER_COLORS) {
      for (let i = 0; i < TAPE_COLORS.length; i++) {
        const css = pickTape(i / TAPE_COLORS.length + 0.01, c.hex)
        const tape = TAPE_COLORS.find((t) => t.css === css)
        expect(tape).toBeDefined()
        // suficientemente distinta del papel (distancia RGB > 100), salvo que no exista ninguna opción
        const d = Math.hypot(
          parseInt(c.hex.slice(1, 3), 16) - parseInt((tape as { hex: string }).hex.slice(1, 3), 16),
          parseInt(c.hex.slice(3, 5), 16) - parseInt((tape as { hex: string }).hex.slice(3, 5), 16),
          parseInt(c.hex.slice(5, 7), 16) - parseInt((tape as { hex: string }).hex.slice(5, 7), 16),
        )
        expect(d, `${c.name} vs cinta ${(tape as { hex: string }).hex}`).toBeGreaterThan(100)
      }
    }
  })
})

describe('seeded', () => {
  it('es estable y está en [0, 1)', () => {
    const a = seeded('posit-1', 1)
    expect(seeded('posit-1', 1)).toBe(a)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(1)
  })
  it('cambia con la clave y con la sal', () => {
    expect(seeded('posit-1', 1)).not.toBe(seeded('posit-2', 1))
    expect(seeded('posit-1', 1)).not.toBe(seeded('posit-1', 2))
  })
})
