import { describe, expect, it } from 'vitest'
import { cloudShape, hashString, rngFrom } from './cloud'

describe('cloudShape', () => {
  it('es determinista: el mismo texto da siempre la misma nube', () => {
    const a = cloudShape(240, 90, hashString('Hola'))
    const b = cloudShape(240, 90, hashString('Hola'))
    expect(a).toEqual(b)
    expect(cloudShape(240, 90, hashString('Otra cosa')).d).not.toBe(a.d)
  })

  it('es un contorno cerrado, sin valores raros', () => {
    const { d } = cloudShape(200, 70, 5)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d).not.toMatch(/NaN|Infinity|undefined/)
  })

  it('los bultos rodean el rectángulo: los puntos de paso quedan dentro de la caja', () => {
    for (const [w, h] of [
      [120, 50],
      [260, 130],
      [90, 44],
    ] as const) {
      const { d } = cloudShape(w, h, 3)
      // los puntos finales de cada curva (los dos últimos números de cada «C»)
      const ends = [...d.matchAll(/C[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ ([-\d.]+) ([-\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
      expect(ends.length).toBeGreaterThan(6)
      for (const [x, y] of ends) {
        expect(x).toBeGreaterThanOrEqual(-0.5)
        expect(x).toBeLessThanOrEqual(w + 0.5)
        expect(y).toBeGreaterThanOrEqual(-0.5)
        expect(y).toBeLessThanOrEqual(h + 0.5)
      }
    }
  })

  it('más grande = más bultos', () => {
    const count = (w: number, h: number) => (cloudShape(w, h, 1).d.match(/C/g) ?? []).length
    expect(count(300, 120)).toBeGreaterThan(count(120, 50))
  })

  it('la cola son tres bolitas que bajan hacia Chispa, cada vez más chicas', () => {
    const r = cloudShape(240, 80, 2, 'right')
    expect(r.tail).toHaveLength(3)
    const [a, b, c] = r.tail
    expect(a[1]).toBeGreaterThan(80 - 2)
    expect(b[1]).toBeGreaterThan(a[1])
    expect(c[1]).toBeGreaterThan(b[1])
    expect(a[2]).toBeGreaterThan(b[2])
    expect(b[2]).toBeGreaterThan(c[2])
    expect(b[0]).toBeGreaterThan(a[0]) // hacia la derecha
    const l = cloudShape(240, 80, 2, 'left')
    expect(l.tail[1][0]).toBeLessThan(l.tail[0][0]) // hacia la izquierda
  })

  it('aguanta cajas diminutas sin romperse', () => {
    expect(() => cloudShape(10, 10, 1)).not.toThrow()
    expect(cloudShape(10, 10, 1).d).not.toMatch(/NaN/)
  })
})

describe('rngFrom / hashString', () => {
  it('da números entre 0 y 1 y repite la secuencia con la misma semilla', () => {
    const a = rngFrom(42)
    const b = rngFrom(42)
    for (let i = 0; i < 20; i++) {
      const v = a()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      expect(b()).toBe(v)
    }
    expect(hashString('a')).not.toBe(hashString('b'))
  })
})
