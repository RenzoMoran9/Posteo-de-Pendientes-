import { Blob, C, Curve, Dot, Line, Poly, RPoly, RR, heart, place } from '../dsl.mjs'

const cat = 'salud'

/** Cruz de brazos gruesos centrada en (cx, cy): `s` de punta a punta, `a` de grosor. */
export const plus = (cx, cy, s, a, o = {}) => {
  const h = s / 2
  const t = a / 2
  return RPoly(
    [
      [cx - t, cy - h],
      [cx + t, cy - h],
      [cx + t, cy - t],
      [cx + h, cy - t],
      [cx + h, cy + t],
      [cx + t, cy + t],
      [cx + t, cy + h],
      [cx - t, cy + h],
      [cx - t, cy + t],
      [cx - h, cy + t],
      [cx - h, cy - t],
      [cx - t, cy - t],
    ],
    1.5,
    o,
  )
}

/** Manguera de color con borde de tinta (dos trazos iguales, uno encima del otro). */
const hose = (pts, color, key) => [Curve(pts, { s: 'k', key }), Curve(pts, { s: color, key })]

export default [
  {
    id: 'cruz',
    name: 'Cruz médica',
    cat,
    tags: 'cruz medica salud hospital clinica medico atencion enfermeria',
    draw: () => [RR(6, 6, 52, 52, 10, { f: 'white' }), plus(32, 32, 34, 13, { f: 'red' })],
  },
  {
    id: 'jeringa',
    name: 'Jeringa',
    cat,
    tags: 'jeringa inyeccion vacuna insumo medico aguja inyectable suministro',
    draw: () =>
      place(
        [
          Line([[0, 17], [0, 30]], { s: 'k' }),
          RR(-3.5, 12, 7, 6, 1, { f: 'gray' }),
          RR(-6.5, -16, 13, 29, 2, { f: 'white', s: 'n', key: 'bar' }),
          RR(-5.2, -1, 10.4, 12, 1, { f: 'sky', s: 'n', off: 0 }),
          ...[-11, -5, 1].map((y) => Line([[-6.5, y], [-2.5, y]], { s: 't' })),
          RR(-6.5, -16, 13, 29, 2, { key: 'bar' }),
          RR(-10.5, -18.5, 21, 3.5, 1.5, { f: 'dgray' }),
          Line([[0, -19], [0, -27]], { s: 'k' }),
          RR(-8, -31, 16, 4, 2, { f: 'dgray' }),
        ],
        45,
        32,
        32,
      ),
  },
  {
    id: 'pastilla',
    name: 'Pastillas',
    cat,
    tags: 'pastilla capsula medicamento medicina tableta farmaco dosis receta',
    draw: () => [
      ...place(
        [
          RPoly([[-22, -9], [0, -9], [0, 9], [-22, 9]], [9, 0, 0, 9], { f: 'red' }),
          RPoly([[0, -9], [22, -9], [22, 9], [0, 9]], [0, 9, 9, 0], { f: 'white' }),
          Line([[-17, -4.5], [-8, -4.5]], { s: 'w' }),
        ],
        -38,
        33,
        22,
      ),
      C(16, 49, 8.5, { f: 'white' }),
      Line([[9.5, 49], [22.5, 49]], { s: 't' }),
      C(45, 50, 7.5, { f: 'yellow' }),
      Line([[41, 46], [47, 44.5]], { s: 'w' }),
    ],
  },
  {
    id: 'frasco',
    name: 'Frasco',
    cat,
    tags: 'frasco medicamento jarabe botella farmacia medicina envase suero',
    draw: () => [
      RR(15, 15, 34, 45, 6, { f: 'orange' }),
      RR(15, 27, 34, 24, 1.5, { f: 'white', off: 0 }),
      plus(32, 39, 14, 5.2, { f: 'red', off: 0 }),
      RR(19, 3, 26, 12, 3, { f: 'white' }),
      Line([[25, 5], [25, 13]], { s: 't' }),
      Line([[32, 5], [32, 13]], { s: 't' }),
      Line([[39, 5], [39, 13]], { s: 't' }),
    ],
  },
  {
    id: 'estetoscopio',
    name: 'Estetoscopio',
    cat,
    tags: 'estetoscopio doctor medico revision consulta auscultar salud',
    draw: () => [
      ...hose([[15, 11], [15, 27], [23, 38], [32, 40]], 'blue', 'l'),
      ...hose([[49, 11], [49, 27], [41, 38], [32, 40]], 'blue', 'r'),
      ...hose([[32, 40], [32, 50], [40, 57], [50, 53]], 'blue', 'd'),
      C(15, 8, 3.6, { f: 'gray' }),
      C(49, 8, 3.6, { f: 'gray' }),
      C(32, 40, 3.2, { f: 'dgray' }),
      C(52, 47, 9, { f: 'gray' }),
      C(52, 47, 4.4, { f: 'dgray', off: 0 }),
    ],
  },
  {
    id: 'termometro',
    name: 'Termómetro',
    cat,
    tags: 'termometro fiebre temperatura salud calor control',
    draw: () =>
      place(
        [
          RR(-5.5, -30, 11, 44, 5.5, { f: 'white' }),
          C(0, 20, 10, { f: 'red' }),
          RR(-2, -8, 4, 28, 2, { f: 'red', s: 'n', off: 0 }),
          ...[-24, -16, -8, 0].map((y, i) => Line([[5.5, y], [i % 2 ? 9 : 11, y]], { s: 't' })),
        ],
        28,
        33,
        31,
      ),
  },
  {
    id: 'mascarilla',
    name: 'Mascarilla',
    cat,
    tags: 'mascarilla barbijo proteccion higiene insumo bioseguridad tapaboca',
    draw: () => [
      Curve([[10, 27], [3, 27], [3, 40], [11, 43]], { s: 'k' }),
      Curve([[54, 27], [61, 27], [61, 40], [53, 43]], { s: 'k' }),
      RPoly([[9, 19], [55, 19], [53, 45], [32, 54], [11, 45]], 6, { f: 'sky' }),
      Line([[13, 28], [51, 28]], { s: 't' }),
      Line([[14, 35], [50, 35]], { s: 't' }),
      Line([[18, 42], [46, 42]], { s: 't' }),
    ],
  },
  {
    id: 'corazon_pulso',
    name: 'Latido',
    cat,
    tags: 'corazon pulso latido cardio electrocardiograma vida ritmo salud',
    draw: () => [heart(32, 31, 52, { f: 'red' }), Line([[9, 33], [22, 33], [27, 23], [33, 45], [38, 31], [55, 31]], { s: 'W' })],
  },
  {
    id: 'microscopio',
    name: 'Microscopio',
    cat,
    tags: 'microscopio laboratorio analisis muestras ciencia examen',
    draw: () => [
      RR(10, 54, 44, 6, 2, { f: 'dgray' }),
      ...hose([[35, 13], [48, 22], [49, 40], [38, 50]], 'blue', 'arm'),
      ...place(
        [
          RR(-3, 12, 6, 7, 1, { f: 'gray' }),
          RR(-6, -22, 12, 34, 2, { f: 'blue' }),
          RR(-4, -29, 8, 8, 1.5, { f: 'dgray' }),
        ],
        18,
        27,
        27,
      ),
      RR(13, 47, 25, 4, 1.5, { f: 'dgray' }),
    ],
  },
  {
    id: 'tubos_ensayo',
    name: 'Tubos de ensayo',
    cat,
    tags: 'tubos ensayo laboratorio muestra quimica analisis reactivo examen',
    draw: () => {
      const pts = [[-6, -24, 'c'], [-6, 9], [-3.5, 16], [0, 18], [3.5, 16], [6, 9], [6, -24, 'c']]
      const liquid = [[-6, -1, 'c'], [-6, 9], [-3.5, 16], [0, 18], [3.5, 16], [6, 9], [6, -1, 'c']]
      const tube = (col, k) => [
        Blob(pts, { f: 'white', s: 'n', key: k }),
        Blob(liquid, { f: col, s: 'n', off: 0 }),
        Blob(pts, { key: k }),
        Line([[-8.5, -24], [8.5, -24]], { s: 'k' }),
      ]
      return [...place(tube('green', 'ta'), -16, 22, 33), ...place(tube('pink', 'tb'), 14, 43, 34), C(20, 34, 1.6, { f: 'white', off: 0 }), C(45, 36, 1.6, { f: 'white', off: 0 })]
    },
  },
  {
    id: 'bolsa_suero',
    name: 'Suero',
    cat,
    tags: 'suero bolsa via intravenosa gotero hidratacion paciente infusion',
    draw: () => {
      const bag = [[15, 10], [49, 10], [49, 44], [43, 52], [21, 52], [15, 44]]
      return [
        Line([[32, 3], [32, 10]], { s: 'k' }),
        RPoly(bag, 6, { f: 'white', s: 'n', key: 'bag' }),
        RPoly([[17, 26], [47, 26], [47, 44], [42, 50], [22, 50], [17, 44]], 4, { f: 'sky', s: 'n', off: 0 }),
        RPoly(bag, 6, { key: 'bag' }),
        Line([[17, 26], [47, 26]], { s: 't' }),
        Line([[22, 17], [42, 17]], { s: 't' }),
        Line([[32, 52], [32, 55]], { s: 'k' }),
        Blob([[32, 56, 'c'], [35, 60], [32, 63.5], [29, 60]], { f: 'sky' }),
      ]
    },
  },
  {
    id: 'botiquin',
    name: 'Botiquín',
    cat,
    tags: 'botiquin primeros auxilios emergencia kit medico maletin salud',
    draw: () => [
      Curve([[22, 19], [22, 10], [42, 10], [42, 19]], { s: 'k' }),
      RR(6, 18, 52, 40, 6, { f: 'red' }),
      plus(32, 38, 24, 8.5, { f: 'white', off: 0 }),
      Line([[11, 25], [11, 33]], { s: 'w' }),
    ],
  },
  {
    id: 'monitor_ecg',
    name: 'Monitor de signos',
    cat,
    tags: 'monitor signos vitales electrocardiograma equipo medico pantalla uci ecg',
    draw: () => [
      RR(27, 44, 10, 10, 1.5, { f: 'gray' }),
      RR(18, 53, 28, 5, 2, { f: 'dgray' }),
      RR(4, 6, 56, 39, 5, { f: 'char' }),
      RR(9, 11, 46, 29, 2, { f: 'teal', off: 0 }),
      Line([[12, 27], [22, 27], [26, 18], [31, 36], [35, 22], [38, 27], [52, 27]], { s: 'W' }),
      Dot(50, 16, 1.4, { f: 'white' }),
    ],
  },
]
