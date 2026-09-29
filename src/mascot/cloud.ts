/**
 * Contorno de la nube de comentarios, dibujado "a mano": una hilera de bultitos redondos alrededor de un
 * rectángulo, cada uno un poco distinto. Se calcula para el tamaño real del texto (medido en pantalla),
 * así que sirve para nubes de cualquier largo. Es determinista: el mismo texto da siempre la misma nube.
 */

export interface CloudShape {
  /** Trazo del contorno (coordenadas dentro de w × h). */
  d: string
  /** Bolitas que unen la nube con Chispa: [cx, cy, rx, ry]. */
  tail: ReadonlyArray<readonly [number, number, number, number]>
}

/** Generador pseudoaleatorio pequeño (mulberry32). */
export function rngFrom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const f = (n: number): string => String(Math.round(n * 10) / 10)

/**
 * `w` × `h` es la caja de la nube completa (los bultos quedan dentro de ella). `rb` es el radio de un bulto.
 * `side` dice de qué lado sale la cola de bolitas (hacia Chispa).
 */
export function cloudShape(w: number, h: number, seed: number, side: 'left' | 'right' = 'right', rb = 8.5): CloudShape {
  const rnd = rngFrom(seed)
  const x0 = rb
  const y0 = rb
  const x1 = Math.max(x0 + rb * 2, w - rb)
  const y1 = Math.max(y0 + rb * 2, h - rb)

  // Vértices: las cuatro esquinas y, en cada lado, puntos repartidos casi parejos.
  type P = [number, number]
  const pts: P[] = []
  const edge = (a: P, b: P) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(1, Math.round(len / (rb * 2.25)))
    for (let i = 0; i < n; i++) {
      const t = i === 0 ? 0 : (i + (rnd() - 0.5) * 0.28) / n
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  edge([x0, y0], [x1, y0])
  edge([x1, y0], [x1, y1])
  edge([x1, y1], [x0, y1])
  edge([x0, y1], [x0, y0])

  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    // normal hacia afuera (el recorrido va en el sentido de las agujas del reloj)
    const nx = dy / len
    const ny = -dx / len
    const bulge = len * (0.6 + (rnd() - 0.5) * 0.16)
    const skew = (rnd() - 0.5) * 0.12 * len
    const c1x = a[0] + nx * bulge + (dx / len) * skew
    const c1y = a[1] + ny * bulge + (dy / len) * skew
    const c2x = b[0] + nx * bulge + (dx / len) * skew
    const c2y = b[1] + ny * bulge + (dy / len) * skew
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(b[0])} ${f(b[1])}`
  }
  d += 'Z'

  const sgn = side === 'right' ? 1 : -1
  const base = side === 'right' ? w - 30 : 30
  const tail: Array<readonly [number, number, number, number]> = [
    [base, h + 5, 5.6, 5.2],
    [base + sgn * 8, h + 17, 4.2, 3.9],
    [base + sgn * 13, h + 27, 2.9, 2.7],
  ]
  return { d, tail }
}
