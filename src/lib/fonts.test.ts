import { describe, expect, it } from 'vitest'
import { BASE_NOTE_SIZE, DEFAULT_FONT_ID, NOTE_FONTS, fontById } from './fonts'

describe('letras de los posits', () => {
  it('hay varias, con id y nombre únicos', () => {
    expect(NOTE_FONTS.length).toBeGreaterThanOrEqual(6)
    expect(new Set(NOTE_FONTS.map((f) => f.id)).size).toBe(NOTE_FONTS.length)
    expect(new Set(NOTE_FONTS.map((f) => f.name)).size).toBe(NOTE_FONTS.length)
  })

  it('cada letra es un instrumento de escritura distinto (para dibujarlo en el estuche)', () => {
    expect(new Set(NOTE_FONTS.map((f) => f.pen)).size).toBe(NOTE_FONTS.length)
    expect(NOTE_FONTS.map((f) => f.name)).toEqual(['Pluma', 'Bolígrafo', 'Lápiz', 'Punta fina', 'Pincel', 'Marcador', 'Portaminas', 'Marcador grueso'])
  })

  it('la primera es la de siempre (Kalam) y es la de respaldo', () => {
    expect(DEFAULT_FONT_ID).toBe('kalam')
    expect(fontById(undefined).id).toBe('kalam')
    expect(fontById(null).id).toBe('kalam')
    expect(fontById('no-existe').id).toBe('kalam')
    expect(fontById('caveat').stack).toContain('Caveat')
  })

  it('cada letra trae una lista de respaldo y un ajuste de tamaño razonable', () => {
    for (const f of NOTE_FONTS) {
      expect(f.stack, f.id).toContain('cursive')
      expect(f.scale, f.id).toBeGreaterThan(0.7)
      expect(f.scale, f.id).toBeLessThan(1.6)
      const px = BASE_NOTE_SIZE * f.scale
      expect(px, f.id).toBeGreaterThan(16)
      expect(px, f.id).toBeLessThan(34)
    }
  })
})
