import { Blob, C, Curve, Dot, Line, Poly, RPoly, RR, check, cross, place, pol, star } from '../dsl.mjs'
import { flag } from './urgente.mjs'

const cat = 'estado'

const gear = () => {
  const pts = []
  for (let i = 0; i < 8; i++) {
    const a = i * 45 - 90
    pts.push(pol(32, 32, 17.5, a - 14), pol(32, 32, 24.5, a - 9), pol(32, 32, 24.5, a + 9), pol(32, 32, 17.5, a + 14))
  }
  return pts
}

const starPts = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => pol(cx, cy, i % 2 === 0 ? R : r, -90 + 36 * i))

export default [
  {
    id: 'listo',
    name: 'Listo',
    cat,
    tags: 'listo hecho completado ok terminado correcto aprobado si check',
    draw: () => [C(32, 32, 25, { f: 'green' }), check(32, 33, 1.55, { s: 'W' })],
  },
  {
    id: 'cancelado',
    name: 'Cancelado',
    cat,
    tags: 'cancelado no rechazado error anulado eliminar equis cerrar rechazo',
    draw: () => [C(32, 32, 25, { f: 'red' }), ...cross(32, 32, 1.5, { s: 'W' })],
  },
  {
    id: 'duda',
    name: 'Duda',
    cat,
    tags: 'duda pregunta consultar interrogante pendiente de aclarar por definir',
    draw: () => [
      C(32, 32, 25, { f: 'purple' }),
      Curve([[22, 24], [24, 15], [32, 12], [40, 15], [41, 24], [36, 30], [32, 34], [32, 39]], { s: 'W' }),
      Dot(32, 49, 3.2, { f: 'white' }),
    ],
  },
  {
    id: 'pausa',
    name: 'En pausa',
    cat,
    tags: 'pausa detenido esperando en espera suspendido congelado stand by',
    draw: () => [C(32, 32, 25, { f: 'sky' }), RR(20, 19, 8.5, 26, 2, { f: 'white', off: 0 }), RR(35.5, 19, 8.5, 26, 2, { f: 'white', off: 0 })],
  },
  {
    id: 'bloqueado',
    name: 'Bloqueado',
    cat,
    tags: 'bloqueado candado cerrado seguro privado restringido trabado confidencial',
    draw: () => {
      const sh = [[20, 32], [20, 21], [24, 13], [32, 10.5], [40, 13], [44, 21], [44, 32]]
      return [
        Curve(sh, { s: 'k', key: 'sh' }),
        Curve(sh, { s: 'gray', key: 'sh' }),
        RR(11, 30, 42, 29, 5, { f: 'yellow' }),
        C(32, 42, 4.2, { f: 'char', off: 0 }),
        Poly([[30, 44], [34, 44], [35.5, 52], [28.5, 52]], { f: 'char', s: 'n', off: 0 }),
      ]
    },
  },
  {
    id: 'llave',
    name: 'Llave',
    cat,
    tags: 'llave acceso clave abrir permiso autorizacion seguridad',
    draw: () =>
      place(
        [
          RR(14, -3, 5.5, 8.5, 1.5, { f: 'yellow' }),
          RR(22, -3, 5.5, 6, 1.5, { f: 'yellow' }),
          RR(-4, -3, 32, 6.5, 3, { f: 'yellow' }),
          C(-15, 0, 13, { f: 'yellow' }),
          C(-15, 0, 4.8, { f: 'cream', off: 0 }),
        ],
        -32,
        34,
        32,
      ),
  },
  {
    id: 'aprobado',
    name: 'Aprobado',
    cat,
    tags: 'aprobado visto bueno sello conforme calidad certificado autorizado vb',
    draw: () => {
      const seal = star(32, 29, 26, 22, 14, -90, {})
      const ck = [[-8, 0.5], [-2.5, 6.5], [9, -7]].map(([x, y]) => [32 + x, 30 + y])
      return [
        Poly([[22, 47], [15, 63], [24, 58.5], [29, 63], [31, 48]], { f: 'green' }),
        Poly([[42, 47], [49, 63], [40, 58.5], [35, 63], [33, 48]], { f: 'green' }),
        { ...seal, f: 'green' },
        C(32, 29, 16, { f: 'white', off: 0 }),
        Line(ck, { s: 'k', key: 'ck' }),
        Line(ck, { s: 'green', key: 'ck' }),
      ]
    },
  },
  {
    id: 'ojo',
    name: 'Revisar',
    cat,
    tags: 'ojo revisar mirar vigilar supervisar ver seguimiento observar atento',
    draw: () => [
      Blob([[4, 32, 'c'], [16, 20], [32, 15.5], [48, 20], [60, 32, 'c'], [48, 44], [32, 48.5], [16, 44]], { f: 'white' }),
      C(32, 32, 11.5, { f: 'blue' }),
      Dot(32, 32, 5.2),
      Dot(35.5, 28.5, 2.1, { f: 'white' }),
      Line([[20, 12], [17, 6]], { s: 't' }),
      Line([[32, 9], [32, 3]], { s: 't' }),
      Line([[44, 12], [47, 6]], { s: 't' }),
    ],
  },
  {
    id: 'estrella',
    name: 'Estrella',
    cat,
    tags: 'estrella importante favorito destacado prioridad excelente calificacion',
    draw: () => [RPoly(starPts(32, 34, 28, 12.5), 2.4, { f: 'yellow' }), Line([[22, 24], [29, 14]], { s: 'w' })],
  },
  {
    id: 'pulgar_arriba',
    name: 'Bien',
    cat,
    tags: 'bien pulgar arriba ok me gusta aprobado excelente conforme gracias',
    draw: () => [
      Blob(
        [
          [19, 30, 'c'],
          [27, 27],
          [31, 18],
          [33, 9],
          [38, 6],
          [43, 10],
          [43, 18],
          [41, 25],
          [52, 25],
          [58, 29],
          [58, 35],
          [56, 38],
          [58, 43],
          [55, 48],
          [53, 51],
          [54, 55],
          [48, 59],
          [19, 57, 'c'],
        ],
        { f: 'skin' },
      ),
      Line([[42, 38], [55, 38]], { s: 't' }),
      Line([[42, 45.5], [53, 45.5]], { s: 't' }),
      RR(5, 28, 14, 32, 3, { f: 'blue' }),
    ],
  },
  {
    id: 'engranaje',
    name: 'En proceso',
    cat,
    tags: 'engranaje proceso en curso configuracion ajustes trabajando gestion tramite',
    draw: () => [RPoly(gear(), 2, { f: 'gray' }), C(32, 32, 8.5, { f: 'cream', off: 0 })],
  },
  { id: 'bandera_amarilla', name: 'Bandera amarilla', cat, tags: 'bandera amarilla cuidado atencion seguimiento media revisar', draw: flag('yellow') },
  { id: 'bandera_verde', name: 'Bandera verde', cat, tags: 'bandera verde ok listo sin problema conforme aprobado', draw: flag('green') },
  {
    id: 'nota',
    name: 'Nota',
    cat,
    tags: 'nota posit recordatorio apunte papel anotacion sticky',
    draw: () => [
      RPoly([[8, 8], [56, 8], [56, 40], [40, 56], [8, 56]], [2, 2, 0, 0, 2], { f: 'yellow' }),
      Poly([[56, 40], [40, 40], [40, 56]], { f: 'orange' }),
      Line([[15, 22], [48, 22]], { s: 't' }),
      Line([[15, 31], [48, 31]], { s: 't' }),
      Line([[15, 40], [32, 40]], { s: 't' }),
      RR(21, 3, 22, 9, 1, { f: 'sky', s: 't' }),
    ],
  },
]
