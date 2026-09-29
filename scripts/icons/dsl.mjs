// Lenguaje pequeño para describir los íconos en un lienzo de 64 × 64.
// Cada función devuelve una "forma"; sketch.mjs la convierte en trazo a mano.
//
// Opciones de cualquier forma:
//   f:   color de relleno (clave de palette.mjs; 'ink' = color de la tinta)
//   s:   línea: 'i' tinta (por defecto) · 't' fina · 'k' gruesa · 'w' brillo blanco · 'W' blanco firme
//        'n' sin línea · o una clave de color para una línea de color
//   off: 0 = el relleno queda exactamente dentro de la línea (por defecto se corre un poco, como marcador)
//   amp: multiplica el temblor · over: cuánto se pasa el trazo al cerrar la figura

export const E = (cx, cy, rx, ry, o = {}) => ({ t: 'ell', cx, cy, rx, ry, ...o })
export const C = (cx, cy, r, o = {}) => E(cx, cy, r, r, o)
/** Arco de elipse abierto; ángulos en grados (0 = derecha, 90 = abajo). */
export const Arc = (cx, cy, r, a0, a1, o = {}) => ({ t: 'ell', cx, cy, rx: r, ry: o.ry ?? r, a0, a1, ...o })
export const Poly = (pts, o = {}) => ({ t: 'poly', pts, closed: true, ...o })
export const Line = (pts, o = {}) => ({ t: 'poly', pts, closed: false, ...o })
export const RPoly = (pts, r, o = {}) => ({ t: 'rpoly', pts, r, closed: true, ...o })
export const RR = (x, y, w, h, r, o = {}) =>
  RPoly(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    r,
    o,
  )
/** Figura cerrada y suave por unos puntos; `[x, y, 'c']` marca una esquina. */
export const Blob = (pts, o = {}) => ({ t: 'smooth', pts, closed: true, ...o })
/** Curva abierta suave por unos puntos. */
export const Curve = (pts, o = {}) => ({ t: 'smooth', pts, closed: false, ...o })
export const Dot = (x, y, r = 1.8, o = {}) => ({ t: 'ell', cx: x, cy: y, rx: r, ry: r, f: 'ink', s: 'n', off: 0, over: 0, ...o })

/** Punto sobre una circunferencia (grados; 0 = derecha, 90 = abajo). */
export const pol = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)]

/** Rayitos alrededor de un centro. */
export function rays(cx, cy, r1, r2, n, a0 = -90, o = {}) {
  return Array.from({ length: n }, (_, i) => Line([pol(cx, cy, r1, a0 + (360 / n) * i), pol(cx, cy, r2, a0 + (360 / n) * i)], o))
}

/** Estrella de n puntas. */
export function star(cx, cy, R, r, n = 5, a0 = -90, o = {}) {
  const pts = []
  for (let i = 0; i < n * 2; i++) pts.push(pol(cx, cy, i % 2 === 0 ? R : r, a0 + (180 / n) * i))
  return Poly(pts, o)
}

/** Destello de cuatro puntas (como los de las láminas de referencia). */
export const sparkle = (cx, cy, R, o = {}) => star(cx, cy, R, R * 0.32, 4, -90, { f: 'yellow', ...o })

/** Palomita. */
export const check = (x, y, s = 1, o = {}) =>
  Line(
    [
      [x - 8 * s, y + 0.5 * s],
      [x - 2.5 * s, y + 6.5 * s],
      [x + 9 * s, y - 7 * s],
    ],
    o,
  )

/** Equis. */
export const cross = (x, y, s = 1, o = {}) => [
  Line(
    [
      [x - 7 * s, y - 7 * s],
      [x + 7 * s, y + 7 * s],
    ],
    o,
  ),
  Line(
    [
      [x + 7 * s, y - 7 * s],
      [x - 7 * s, y + 7 * s],
    ],
    o,
  ),
]

/** Signo de exclamación (línea + punto). */
export const bang = (x, y0, y1, o = {}) => [Line([[x, y0], [x, y1]], { s: 'k', ...o }), Dot(x, y1 + 6.5, 2.4, o.dot ?? {})]

/** Gira un punto alrededor de (cx, cy). */
export function rot(p, cx, cy, deg) {
  const a = (deg * Math.PI) / 180
  const dx = p[0] - cx
  const dy = p[1] - cy
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]
}

/** Gira una lista de puntos. */
export const rotAll = (pts, cx, cy, deg) => pts.map((p) => (p.length > 2 ? [...rot(p, cx, cy, deg), p[2]] : rot(p, cx, cy, deg)))

/**
 * Inclina y coloca un grupo de formas dibujadas "de pie" alrededor de (0, 0):
 * las gira `deg` grados (a la derecha) y las mueve a (tx, ty).
 */
export function place(shapes, deg, tx, ty) {
  const list = (Array.isArray(shapes) ? shapes : [shapes]).flat(Infinity)
  const m = (p) => {
    const q = rot([p[0], p[1]], 0, 0, deg)
    return p.length > 2 ? [q[0] + tx, q[1] + ty, p[2]] : [q[0] + tx, q[1] + ty]
  }
  return list.map((s) => {
    if (s.t === 'ell') {
      const [cx, cy] = m([s.cx, s.cy])
      return { ...s, cx, cy, rot: (s.rot || 0) + deg }
    }
    return { ...s, pts: s.pts.map(m) }
  })
}

/** Franja de anillo (arcoíris, etc.) entre dos radios y dos ángulos. */
export function band(cx, cy, r1, r2, a0, a1, o = {}) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 18))
  const pts = []
  for (let i = 0; i <= n; i++) pts.push([...pol(cx, cy, r2, a0 + ((a1 - a0) * i) / n), ...(i === 0 || i === n ? ['c'] : [])])
  for (let i = n; i >= 0; i--) pts.push([...pol(cx, cy, r1, a0 + ((a1 - a0) * i) / n), ...(i === 0 || i === n ? ['c'] : [])])
  return Blob(pts, o)
}

/** Interpolación lineal entre dos puntos. */
export const mixPt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Corazón centrado en (cx, cy), de ancho `w`. */
export function heart(cx, cy, w, o = {}) {
  const k = w / 48
  const P = (x, y, c) => [cx + (x - 32) * k, cy + (y - 32) * k, ...(c ? ['c'] : [])]
  return Blob(
    [P(32, 56, 1), P(17, 43), P(8, 31), P(9, 19), P(19, 12), P(27, 15), P(32, 22, 1), P(37, 15), P(45, 12), P(55, 19), P(56, 31), P(47, 43)],
    o,
  )
}

/** "S/" (soles) como dos trazos de tinta. */
export function soles(cx, cy, s = 1, o = {}) {
  const P = (x, y) => [cx + x * s, cy + y * s]
  return [
    Curve([P(4, -13), P(0, -15), P(-5, -12), P(-4, -6), P(1, -1), P(4, 5), P(0, 11), P(-6, 11)], { s: 'k', ...o }),
    Line([P(9, -19), P(-8, 18)], { s: 'i', ...o }),
  ]
}
