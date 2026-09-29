import { Arc, Blob, C, Curve, Dot, Line, Poly, RPoly, RR, mixPt, place, pol, rays, rot, sparkle } from '../dsl.mjs'

const cat = 'hoy'

/** Calendario: `mode` = 'hoy' (un día marcado), 'semana' (una fila marcada) o 'plano'. */
const calendar = (bandColor, mode) => () => {
  const cols = [14, 23, 32, 41, 50]
  const rows = [36, 44.5, 53]
  const dots = []
  rows.forEach((y, j) => {
    cols.forEach((x, i) => {
      if (j === 2 && i === 4) return
      if (mode === 'hoy' && j === 1 && i === 2) return
      dots.push(Dot(x, y, 1.35))
    })
  })
  return [
    RR(7, 11, 50, 46, 5, { f: 'white' }),
    ...(mode === 'semana' ? [RR(10.5, 38.5, 43, 12, 6, { f: 'yellow', s: 'red', off: 0 })] : []),
    RPoly(
      [
        [7, 27],
        [7, 11],
        [57, 11],
        [57, 27],
      ],
      [0, 5, 5, 0],
      { f: bandColor },
    ),
    Line([[19, 5], [19, 17]], { s: 'k' }),
    Line([[45, 5], [45, 17]], { s: 'k' }),
    ...dots,
    ...(mode === 'hoy' ? [C(32, 44.5, 6.6, { f: 'yellow', s: 'red', off: 0 }), Dot(32, 44.5, 2.3)] : []),
  ]
}

/** Sol asomando o poniéndose sobre el horizonte. */
const horizon = (sun) => () => [
  ...[-90, -135, -45, -160, -20].map((a) => Line([pol(32, 44, a === -90 || a === -135 || a === -45 ? 21 : 22, a), pol(32, 44, a === -90 || a === -135 || a === -45 ? 29 : 28, a)], { s: 'k' })),
  Blob(
    [
      [16, 44, 'c'],
      [18, 36],
      [24, 30.5],
      [32, 29],
      [40, 30.5],
      [46, 36],
      [48, 44, 'c'],
    ],
    { f: sun },
  ),
  Line([[3, 44], [61, 44]], { s: 'k' }),
  Line([[13, 52], [51, 52]], { s: 't' }),
  Line([[21, 59], [43, 59]], { s: 't' }),
]

/** Luna creciente: círculo grande menos otro círculo. */
function crescent() {
  const O = [31, 33]
  const R = 24
  const K = [43, 25]
  const r = 19
  const dx = K[0] - O[0]
  const dy = K[1] - O[1]
  const d = Math.hypot(dx, dy)
  const a = (R * R - r * r + d * d) / (2 * d)
  const h = Math.sqrt(R * R - a * a)
  const P = [O[0] + (a * dx) / d, O[1] + (a * dy) / d]
  const I1 = [P[0] + (h * dy) / d, P[1] - (h * dx) / d]
  const I2 = [P[0] - (h * dy) / d, P[1] + (h * dx) / d]
  const ang = (p, c) => (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI
  const norm = (x) => ((((x + 180) % 360) + 360) % 360) - 180
  const phi = ang(O, K) // desde K hacia O
  const away = phi // dirección "lejos de K" vista desde O
  let [t1, t2] = [I1, I2]
  if (norm(ang(t1, O) - away) > norm(ang(t2, O) - away)) [t1, t2] = [t2, t1]
  const d1 = norm(ang(t1, O) - away)
  const d2 = norm(ang(t2, O) - away)
  const outer = []
  for (let i = 1; i < 8; i++) outer.push(pol(O[0], O[1], R, away + d1 + ((d2 - d1) * i) / 8))
  // arco interior sobre el círculo recortado, de t2 a t1 (por el lado que mira a O)
  const e1 = norm(ang(t1, K) - phi)
  const e2 = norm(ang(t2, K) - phi)
  const inner = []
  for (let i = 1; i < 8; i++) inner.push(pol(K[0], K[1], r, phi + e2 + ((e1 - e2) * i) / 8))
  return [[...t1, 'c'], ...outer, [...t2, 'c'], ...inner]
}

export default [
  {
    id: 'sol',
    name: 'Sol (hoy)',
    cat,
    tags: 'hoy sol dia manana calor soleado dia de hoy',
    draw: () => [
      ...rays(32, 32, 20, 28.5, 8, -90, { s: 'k' }),
      C(32, 32, 13.5, { f: 'yellow' }),
      Arc(32, 32, 8.5, 195, 250, { s: 'w' }),
    ],
  },
  { id: 'calendario_hoy', name: 'Calendario de hoy', cat, tags: 'hoy calendario fecha dia hoy marcado agenda para hoy', draw: calendar('red', 'hoy') },
  { id: 'calendario', name: 'Calendario', cat, tags: 'calendario fecha mes dias agenda plazo', draw: calendar('blue', 'plano') },
  { id: 'calendario_semana', name: 'Esta semana', cat, tags: 'semana esta semana calendario semanal plazo proxima', draw: calendar('green', 'semana') },
  {
    id: 'reloj',
    name: 'Reloj',
    cat,
    tags: 'reloj hora tiempo horario cita hora exacta',
    draw: () => [
      C(32, 32, 26, { f: 'sky' }),
      C(32, 32, 20, { f: 'white', off: 0 }),
      ...rays(32, 32, 15.5, 18, 12, -90, { s: 't' }),
      Line([[32, 32], [32, 20]], { s: 'k' }),
      Line([[32, 32], [42, 37.5]], { s: 'k' }),
      Dot(32, 32, 2.5),
    ],
  },
  {
    id: 'cronometro',
    name: 'Cronómetro',
    cat,
    tags: 'cronometro tiempo cuenta regresiva plazo minutos rapido temporizador',
    draw: () => [
      RR(26, 3, 12, 6, 2, { f: 'dgray' }),
      Line([[32, 9], [32, 15]], { s: 'k' }),
      Poly(
        [
          [-4, -3.2],
          [4, -3.2],
          [4, 3.2],
          [-4, 3.2],
        ].map((p) => {
          const q = rot(p, 0, 0, 45)
          return [q[0] + 47.5, q[1] + 17.5]
        }),
        { f: 'dgray' },
      ),
      C(32, 37, 22, { f: 'white' }),
      Poly(
        [
          [32, 37],
          ...[-90, -70, -50, -30, -10, 10].map((a) => pol(32, 37, 16, a)),
        ],
        { f: 'red', s: 'n', off: 0 },
      ),
      ...rays(32, 37, 18, 20, 12, -90, { s: 't' }),
      Line([[32, 37], [42, 30]], { s: 'k' }),
      Dot(32, 37, 2.5),
    ],
  },
  { id: 'amanecer', name: 'Amanecer', cat, tags: 'amanecer manana buenos dias sol temprano madrugar inicio', draw: horizon('yellow') },
  { id: 'atardecer', name: 'Atardecer', cat, tags: 'atardecer tarde fin del dia puesta de sol cierre', draw: horizon('orange') },
  {
    id: 'luna',
    name: 'Luna',
    cat,
    tags: 'luna noche manana dormir tarde descansar',
    draw: () => [
      Blob(crescent(), { f: 'yellow' }),
      sparkle(50, 14, 6.5),
      sparkle(57, 33, 4.5, { f: 'sky' }),
      Dot(50, 55, 1.6),
    ],
  },
  {
    id: 'meta',
    name: 'Meta',
    cat,
    tags: 'meta bandera cuadros llegada objetivo terminar cierre entrega final',
    draw: () => {
      const q = [
        [19, 11],
        [55, 8],
        [55, 34],
        [19, 37],
      ]
      const at = (u, v) => mixPt(mixPt(q[0], q[1], u), mixPt(q[3], q[2], u), v)
      const squares = []
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          if ((i + j) % 2 === 0) squares.push(Poly([at(i / 4, j / 3), at((i + 1) / 4, j / 3), at((i + 1) / 4, (j + 1) / 3), at(i / 4, (j + 1) / 3)], { f: 'char', s: 'n', off: 0 }))
        }
      }
      return [
        RR(13, 8, 5, 53, 2, { f: 'tan' }),
        C(15.5, 7, 3.4, { f: 'yellow' }),
        Poly(q, { f: 'white', s: 'n', key: 'flag' }),
        ...squares,
        Poly(q, { key: 'flag' }),
      ]
    },
  },
  {
    id: 'diana',
    name: 'Objetivo',
    cat,
    tags: 'objetivo diana meta blanco enfoque prioridad centro',
    draw: () => [C(30, 34, 25, { f: 'white' }), C(30, 34, 18, { f: 'red' }), C(30, 34, 11, { f: 'white' }), C(30, 34, 4.6, { f: 'red' }), sparkle(55, 10, 6)],
  },
  {
    id: 'chincheta',
    name: 'Chincheta',
    cat,
    tags: 'chincheta fijar pin recordar importante clavar anclar',
    draw: () =>
      place(
        [
          Poly([[-2.6, -1], [2.6, -1], [0, 26]], { f: 'gray' }),
          RR(-12, -8, 24, 6, 3, { f: 'red' }),
          RPoly([[-5, -21], [5, -21], [7.5, -7], [-7.5, -7]], 1.5, { f: 'red' }),
          RR(-7, -27, 14, 6, 3, { f: 'red' }),
          Line([[-2.6, -18], [-3.8, -10]], { s: 'w' }),
        ],
        35,
        33,
        27,
      ),
  },
]
