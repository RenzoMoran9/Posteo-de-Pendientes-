import { Arc, Blob, C, Curve, Dot, E, Line, Poly, RPoly, RR, bang, pol, rays, rot, sparkle, star } from '../dsl.mjs'

const cat = 'urgente'

/** Bandera de un color (roja = urgente, amarilla = cuidado, verde = todo bien). */
export const flag = (color) => () => [
  RR(13, 9, 5, 52, 2, { f: 'tan' }),
  C(15.5, 8, 3.4, { f: 'yellow' }),
  Blob(
    [
      [18, 13, 'c'],
      [27, 9],
      [38, 15],
      [51, 11, 'c'],
      [51, 34, 'c'],
      [38, 38],
      [27, 32],
      [18, 36, 'c'],
    ],
    { f: color },
  ),
  Curve(
    [
      [22, 18],
      [28, 15.5],
      [34, 19.5],
    ],
    { s: 'w' },
  ),
]

/** Semáforo con una luz encendida (prioridad alta / media / baja). */
const semaforo = (on) => () => {
  const lights = [
    ['red', 16],
    ['yellow', 32],
    ['green', 48],
  ]
  return [
    Line([[32, 59], [32, 63]], { s: 'k' }),
    RR(19, 3, 26, 57, 7, { f: 'char' }),
    ...lights.flatMap(([col, y]) => [
      C(32, y, 7.6, { f: col === on ? col : 'dgray', off: 0 }),
      ...(col === on ? [Arc(32, y, 4.4, 200, 260, { s: 'w' })] : []),
    ]),
  ]
}

const cintaPrecaucion = () => {
  const cx = 32
  const cy = 32
  const ang = -28
  const L = 29
  const W = 9
  const P = (u, v) => rot([cx + u, cy + v], cx, cy, ang)
  const band = [P(-L, -W), P(L, -W), P(L, W), P(-L, W)]
  const stripes = []
  for (let u = -27; u < L - 8; u += 13) stripes.push(Poly([P(u, -W), P(u + 6.5, -W), P(u + 13.5, W), P(u + 7, W)], { f: 'char', s: 'n', off: 0, key: `st${u}` }))
  return [
    Poly(band, { f: 'yellow', s: 'n', key: 'band' }),
    ...stripes,
    Poly(band, { key: 'band' }),
  ]
}

export default [
  {
    id: 'sirena',
    name: 'Sirena',
    cat,
    tags: 'urgente alarma alerta emergencia luz policia aviso sirena',
    draw: () => [
      ...[-90, -135, -45].map((a) => Line([pol(32, 44, 21, a), pol(32, 44, 29, a)], { s: 'k' })),
      ...[-160, -20].map((a) => Line([pol(32, 44, 22, a), pol(32, 44, 28, a)], { s: 'k' })),
      Blob(
        [
          [15, 44, 'c'],
          [17.3, 35.5],
          [23.5, 29.3],
          [32, 27],
          [40.5, 29.3],
          [46.7, 35.5],
          [49, 44, 'c'],
        ],
        { f: 'red' },
      ),
      Curve(
        [
          [22, 39],
          [24, 34],
          [28.5, 31],
        ],
        { s: 'w' },
      ),
      RR(10, 44, 44, 9, 3, { f: 'char' }),
      RR(15, 53, 34, 5, 2, { f: 'dgray' }),
    ],
  },
  {
    id: 'fuego',
    name: 'Fuego',
    cat,
    tags: 'urgente fuego llama caliente ya prioridad quema incendio',
    draw: () => [
      Blob(
        [
          [34, 4, 'c'],
          [43, 17],
          [50, 29],
          [52, 41],
          [46, 52],
          [33, 58],
          [20, 54],
          [12, 44],
          [13, 33],
          [18, 24, 'c'],
          [23, 33],
          [27, 20],
        ],
        { f: 'orange' },
      ),
      Blob(
        [
          [32, 29, 'c'],
          [39, 39],
          [41, 47],
          [36, 54],
          [29, 55],
          [24, 50],
          [24, 43],
          [28, 37],
        ],
        { f: 'yellow' },
      ),
    ],
  },
  {
    id: 'rayo',
    name: 'Rayo',
    cat,
    tags: 'urgente rapido rayo energia ya ahora inmediato electricidad',
    draw: () => [
      Poly(
        [
          [33, 3],
          [13, 36],
          [28, 36],
          [22, 61],
          [51, 26],
          [35, 26],
          [44, 3],
        ],
        { f: 'yellow' },
      ),
      Line(
        [
          [37, 9],
          [25, 29],
        ],
        { s: 'w' },
      ),
      sparkle(53, 12, 5.5),
      sparkle(11, 52, 4.5),
    ],
  },
  {
    id: 'atencion',
    name: '¡Atención!',
    cat,
    tags: 'urgente atencion exclamacion alerta importante aviso cuidado',
    draw: () => [
      C(32, 32, 25, { f: 'red' }),
      Line(
        [
          [32, 15],
          [32, 34],
        ],
        { s: 'W' },
      ),
      Dot(32, 44.5, 3.2, { f: 'white' }),
    ],
  },
  {
    id: 'advertencia',
    name: 'Advertencia',
    cat,
    tags: 'advertencia cuidado peligro precaucion triangulo urgente',
    draw: () => [
      RPoly(
        [
          [32, 6],
          [60, 54],
          [4, 54],
        ],
        5,
        { f: 'yellow' },
      ),
      ...bang(32, 23, 37),
    ],
  },
  {
    id: 'despertador',
    name: 'Despertador',
    cat,
    tags: 'despertador alarma hora plazo vence urgente reloj suena',
    draw: () => [
      ...[195, 225, 255].map((a) => Line([pol(15, 14, 13, a), pol(15, 14, 17, a)], { s: 't' })),
      ...[285, 315, 345].map((a) => Line([pol(49, 14, 13, a), pol(49, 14, 17, a)], { s: 't' })),
      Line([[17, 53], [12, 61]], { s: 'k' }),
      Line([[47, 53], [52, 61]], { s: 'k' }),
      C(15, 14, 8.5, { f: 'red' }),
      C(49, 14, 8.5, { f: 'red' }),
      C(32, 36, 21, { f: 'cream' }),
      C(32, 36, 16.5, { s: 't' }),
      ...rays(32, 36, 12, 14.5, 4, -90, { s: 't' }),
      Line([[32, 36], [32, 25]], { s: 'k' }),
      Line([[32, 36], [40, 40.5]], { s: 'k' }),
      Dot(32, 36, 2.4),
    ],
  },
  {
    id: 'reloj_arena',
    name: 'Reloj de arena',
    cat,
    tags: 'reloj arena tiempo plazo esperando pendiente espera',
    draw: () => [
      Poly(
        [
          [16, 12],
          [48, 12],
          [48, 20],
          [36, 32],
          [48, 44],
          [48, 52],
          [16, 52],
          [16, 44],
          [28, 32],
          [16, 20],
        ],
        { f: 'white', key: 'glass' },
      ),
      Poly(
        [
          [20, 15.5],
          [44, 15.5],
          [44, 19.5],
          [34, 29],
          [30, 29],
          [20, 19.5],
        ],
        { f: 'yellow', s: 'n', off: 0 },
      ),
      Poly(
        [
          [19.5, 49],
          [44.5, 49],
          [44.5, 44.5],
          [37, 38],
          [27, 38],
          [19.5, 44.5],
        ],
        { f: 'yellow', s: 'n', off: 0 },
      ),
      Line([[32, 30], [32, 41]], { s: 't' }),
      Poly(
        [
          [16, 12],
          [48, 12],
          [48, 20],
          [36, 32],
          [48, 44],
          [48, 52],
          [16, 52],
          [16, 44],
          [28, 32],
          [16, 20],
        ],
        { key: 'glass' },
      ),
      RR(10, 5, 44, 7, 2.5, { f: 'brown' }),
      RR(10, 52, 44, 7, 2.5, { f: 'brown' }),
    ],
  },
  { id: 'bandera_roja', name: 'Bandera roja', cat, tags: 'bandera roja urgente prioridad alta importante marca', draw: flag('red') },
  {
    id: 'megafono',
    name: 'Megáfono',
    cat,
    tags: 'megafono aviso anunciar avisar urgente comunicar anuncio',
    draw: () => [
      Poly(
        [
          [13, 40],
          [22, 43],
          [19, 56],
          [10, 53],
        ],
        { f: 'dgray' },
      ),
      RR(2, 27, 7, 12, 2, { f: 'dgray' }),
      RPoly(
        [
          [7, 28],
          [34, 13],
          [34, 47],
          [7, 38],
        ],
        2.5,
        { f: 'orange' },
      ),
      E(36, 30, 5, 17, { f: 'yellow' }),
      Arc(41, 30, 13, -42, 42, { s: 'k' }),
      Arc(41, 30, 20, -38, 38, { s: 'k' }),
    ],
  },
  {
    id: 'bomba',
    name: 'Bomba de tiempo',
    cat,
    tags: 'bomba explota tiempo urgente plazo ultimo minuto explosion',
    draw: () => [
      C(29, 40, 19, { f: 'char' }),
      Arc(29, 40, 13, 195, 255, { s: 'w' }),
      RR(23, 14, 13, 9, 2, { f: 'dgray' }),
      Curve(
        [
          [30, 14],
          [31, 9],
          [37, 6],
          [43, 9],
        ],
        { s: 'k' },
      ),
      sparkle(49, 8, 7.5),
    ],
  },
  {
    id: 'ambulancia',
    name: 'Ambulancia',
    cat,
    tags: 'ambulancia emergencia urgente hospital traslado paciente',
    draw: () => [
      Line([[15, 8], [13, 4]], { s: 'k' }),
      Line([[31, 8], [33, 4]], { s: 'k' }),
      RR(17, 8, 14, 7, 2, { f: 'red' }),
      RPoly(
        [
          [4, 14],
          [38, 14],
          [38, 24],
          [51, 24],
          [60, 36],
          [60, 49],
          [4, 49],
        ],
        3,
        { f: 'white' },
      ),
      Poly(
        [
          [43, 28],
          [49, 28],
          [55, 36],
          [43, 36],
        ],
        { f: 'sky' },
      ),
      Poly(
        [
          [17, 18],
          [23, 18],
          [23, 24],
          [29, 24],
          [29, 30],
          [23, 30],
          [23, 36],
          [17, 36],
          [17, 30],
          [11, 30],
          [11, 24],
          [17, 24],
        ],
        { f: 'red', off: 0 },
      ),
      Line([[4, 42], [60, 42]], { s: 't' }),
      C(17, 50, 7, { f: 'char' }),
      C(17, 50, 2.6, { f: 'gray', off: 0 }),
      C(48, 50, 7, { f: 'char' }),
      C(48, 50, 2.6, { f: 'gray', off: 0 }),
    ],
  },
  {
    id: 'cara_alarma',
    name: '¡Ay, no!',
    cat,
    tags: 'cara susto estres alarma urgente preocupado ay no panico',
    draw: () => [
      C(30, 34, 24, { f: 'yellow' }),
      E(21, 28, 6, 7.5, { f: 'white', off: 0 }),
      E(39, 28, 6, 7.5, { f: 'white', off: 0 }),
      Dot(22.5, 29.5, 2.6),
      Dot(37.5, 29.5, 2.6),
      Line([[13, 17], [21, 14]], { s: 'k' }),
      Line([[47, 17], [39, 14]], { s: 'k' }),
      E(30, 47, 6.5, 7.5, { f: 'char', off: 0 }),
      Blob(
        [
          [54, 12, 'c'],
          [59, 20],
          [56, 27],
          [50, 25],
          [49, 19],
        ],
        { f: 'sky' },
      ),
    ],
  },
  {
    id: 'campana',
    name: 'Campana',
    cat,
    tags: 'campana aviso alerta recordatorio timbre notificacion',
    draw: () => [
      Line([[6, 20], [9, 26]], { s: 'k' }),
      Line([[58, 20], [55, 26]], { s: 'k' }),
      Line([[2, 32], [6, 34]], { s: 'k' }),
      Line([[62, 32], [58, 34]], { s: 'k' }),
      C(32, 55, 5, { f: 'brown' }),
      Blob(
        [
          [32, 8],
          [41, 13],
          [45, 24],
          [46, 35],
          [52, 44, 'c'],
          [52, 49, 'c'],
          [12, 49, 'c'],
          [12, 44, 'c'],
          [18, 35],
          [19, 24],
          [23, 13],
        ],
        { f: 'yellow' },
      ),
      C(32, 7, 3.4, { f: 'orange' }),
      Curve(
        [
          [24, 20],
          [23.5, 28],
          [21.5, 36],
        ],
        { s: 'w' },
      ),
    ],
  },
  { id: 'semaforo_rojo', name: 'Semáforo rojo', cat, tags: 'semaforo rojo prioridad alta urgente detener alto', draw: semaforo('red') },
  { id: 'semaforo_amarillo', name: 'Semáforo amarillo', cat, tags: 'semaforo amarillo prioridad media cuidado precaucion', draw: semaforo('yellow') },
  { id: 'semaforo_verde', name: 'Semáforo verde', cat, tags: 'semaforo verde prioridad baja tranquilo ok libre', draw: semaforo('green') },
  { id: 'cinta_precaucion', name: 'Cinta de precaución', cat, tags: 'cinta precaucion peligro cuidado obra advertencia', draw: cintaPrecaucion },
  {
    id: 'cohete',
    name: 'Cohete',
    cat,
    tags: 'cohete rapido urgente lanzar despegar ya veloz proyecto inicio',
    draw: () => [
      Blob(
        [
          [27, 50, 'c'],
          [32, 62],
          [37, 50, 'c'],
        ],
        { f: 'orange' },
      ),
      Blob(
        [
          [29.5, 50, 'c'],
          [32, 57],
          [34.5, 50, 'c'],
        ],
        { f: 'yellow', off: 0 },
      ),
      Poly(
        [
          [21, 33],
          [11, 49],
          [21, 46],
        ],
        { f: 'red' },
      ),
      Poly(
        [
          [43, 33],
          [53, 49],
          [43, 46],
        ],
        { f: 'red' },
      ),
      Blob(
        [
          [32, 3, 'c'],
          [40, 11],
          [44, 26],
          [43, 46, 'c'],
          [21, 46, 'c'],
          [20, 26],
          [24, 11],
        ],
        { f: 'white' },
      ),
      Blob(
        [
          [32, 3, 'c'],
          [37.5, 8.5],
          [40, 16, 'c'],
          [24, 16, 'c'],
          [26.5, 8.5],
        ],
        { f: 'red', off: 0 },
      ),
      C(32, 28, 6, { f: 'sky' }),
      RR(26, 46, 12, 5, 1.5, { f: 'dgray' }),
    ],
  },
  {
    id: 'muy_urgente',
    name: '¡¡¡Muy urgente!!!',
    cat,
    tags: 'muy urgente exclamacion importante critico maximo prioridad triple',
    draw: () =>
      [14, 32, 50].flatMap((x) => [
        RPoly(
          [
            [x - 5, 6],
            [x + 5, 6],
            [x + 3, 40],
            [x - 3, 40],
          ],
          2,
          { f: 'red' },
        ),
        C(x, 51, 4.6, { f: 'red' }),
      ]),
  },
]
