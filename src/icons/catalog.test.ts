import { describe, expect, it } from 'vitest'
import { CATEGORIES, ICONS, fold, getIcon, searchIcons } from './catalog'
import { ICON_COLORS } from './data.generated'
import { iconMarkup } from './markup'

const ids = (list: ReadonlyArray<{ id: string }>) => list.map((i) => i.id)

describe('catálogo de íconos', () => {
  it('trae un buen surtido y cada ícono es válido', () => {
    expect(ICONS.length).toBeGreaterThanOrEqual(100)
    expect(new Set(ids(ICONS)).size).toBe(ICONS.length)
    for (const icon of ICONS) {
      expect(icon.name.length, icon.id).toBeGreaterThan(1)
      expect(icon.tags.split(/\s+/).length, icon.id).toBeGreaterThanOrEqual(3)
      expect(CATEGORIES.some((c) => c.id === icon.cat), icon.id).toBe(true)
      expect(icon.shapes.length, icon.id).toBeGreaterThan(0)
      for (const [d, fill, stroke] of icon.shapes) {
        expect(d.startsWith('M'), icon.id).toBe(true)
        expect(/NaN|undefined|Infinity/.test(d), icon.id).toBe(false)
        if (fill) expect(ICON_COLORS[fill], `${icon.id}: relleno ${fill}`).toBeDefined()
        if (stroke.length > 1) expect(ICON_COLORS[stroke], `${icon.id}: línea ${stroke}`).toBeDefined()
      }
    }
  })

  it('cada categoría tiene íconos suficientes', () => {
    for (const c of CATEGORIES) expect(ICONS.filter((i) => i.cat === c.id).length, c.id).toBeGreaterThanOrEqual(10)
  })

  it('las categorías pensadas para el trabajo están: urgente, hoy y compras', () => {
    const cats = CATEGORIES.map((c) => c.id)
    expect(cats).toEqual(expect.arrayContaining(['urgente', 'hoy', 'compras', 'salud']))
    expect(ICONS.filter((i) => i.cat === 'urgente').length).toBeGreaterThanOrEqual(15)
  })

  it('getIcon encuentra por id y devuelve undefined si no existe', () => {
    expect(getIcon('fuego')?.name).toBe('Fuego')
    expect(getIcon('no-existe')).toBeUndefined()
  })
})

describe('buscador', () => {
  it('ignora mayúsculas y acentos', () => {
    expect(fold('Camión ÁÉÍÓÚ ñ')).toBe('camion aeiou n')
    expect(ids(searchIcons('camion'))).toContain('camion')
    expect(ids(searchIcons('CAMIÓN'))).toContain('camion')
  })

  it('«urgente» encuentra las versiones de urgente', () => {
    const found = ids(searchIcons('urgente'))
    for (const id of ['sirena', 'fuego', 'rayo', 'despertador', 'bandera_roja', 'muy_urgente']) expect(found).toContain(id)
  })

  it('«hoy» y «pago» devuelven algo útil', () => {
    expect(ids(searchIcons('hoy'))).toEqual(expect.arrayContaining(['sol', 'calendario_hoy']))
    expect(ids(searchIcons('pago'))).toEqual(expect.arrayContaining(['soles', 'factura']))
  })

  it('las coincidencias con el nombre salen primero', () => {
    expect(ids(searchIcons('fuego'))[0]).toBe('fuego')
    expect(ids(searchIcons('reloj'))[0]).toBe('reloj')
  })

  it('varias palabras deben cumplirse todas', () => {
    const found = ids(searchIcons('orden compra'))
    expect(found[0]).toBe('orden_compra')
    expect(searchIcons('fuego zzzz')).toHaveLength(0)
  })

  it('sin texto devuelve la categoría (o todo) y sin resultados devuelve vacío', () => {
    expect(searchIcons('', 'salud').every((i) => i.cat === 'salud')).toBe(true)
    expect(searchIcons('')).toHaveLength(ICONS.length)
    expect(searchIcons('xqzw')).toEqual([])
  })

  it('un mismo ícono no sale dos veces', () => {
    const found = ids(searchIcons('reloj tiempo hora'))
    expect(new Set(found).size).toBe(found.length)
  })
})

describe('dibujo (SVG)', () => {
  it('cada ícono se dibuja como un SVG con sus trazos', () => {
    for (const icon of ICONS) {
      const svg = iconMarkup(icon.id)
      expect(svg.startsWith('<svg'), icon.id).toBe(true)
      expect(svg.includes('viewBox="0 0 64 64"'), icon.id).toBe(true)
      expect((svg.match(/<path/g) ?? []).length, icon.id).toBeGreaterThanOrEqual(icon.shapes.length)
    }
  })

  it('un ícono que no existe no dibuja nada (y no falla)', () => {
    expect(iconMarkup('no-existe')).toBe('')
  })

  it('los rellenos llevan color y se corren un poco; el color «tinta» toma el de donde se pegue', () => {
    const svg = iconMarkup('sirena')
    expect(svg).toContain('fill="#EE5B54"')
    expect(svg).toContain('translate(1.5 1.2)')
    expect(iconMarkup('despertador')).toContain('f-ink')
    expect(iconMarkup('estetoscopio')).toContain('stroke="#4A8CE0"') // línea de color
  })
})
