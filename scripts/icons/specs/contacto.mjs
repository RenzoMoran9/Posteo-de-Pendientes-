import { Arc, Blob, C, Curve, Dot, E, Line, Poly, RPoly, RR, place } from '../dsl.mjs'

const cat = 'contacto'

export default [
  {
    id: 'correo',
    name: 'Correo',
    cat,
    tags: 'correo email mail carta sobre mensaje enviar bandeja gmail',
    draw: () => [
      RR(4, 14, 56, 38, 4, { f: 'white' }),
      Line([[5, 16], [32, 36], [59, 16]]),
      Line([[5, 50], [25, 32]], { s: 't' }),
      Line([[59, 50], [39, 32]], { s: 't' }),
      C(32, 37.5, 4.6, { f: 'red' }),
    ],
  },
  {
    id: 'telefono',
    name: 'Llamar',
    cat,
    tags: 'telefono llamar llamada anexo comunicarse contactar proveedor',
    draw: () => {
      // auricular clásico (auricular arriba a la izquierda, micrófono abajo a la derecha)
      const m = ([x, y, c]) => [8 + x * 2.2, 8 + y * 2.2, ...(c ? [c] : [])]
      const handset = [
        [3, 4, 'c'],
        [4, 3],
        [7.5, 3],
        [8.5, 4],
        [9.1, 7.6],
        [8.8, 8.6],
        [6.6, 10.8, 'c'],
        [9.4, 14.6],
        [13.2, 17.4, 'c'],
        [15.4, 15.2],
        [16.4, 14.9],
        [20, 15.5],
        [21, 16.5],
        [21, 20],
        [20, 21],
        [12, 20.5],
        [6, 16.5],
        [3, 10],
      ].map(m)
      return [
        Blob(handset, { f: 'red' }),
        Curve([[19, 27], [17, 22], [19, 18]], { s: 'w' }),
        Arc(42, 27, 9, -85, -5, { s: 'k' }),
        Arc(42, 27, 16, -85, -5, { s: 'k' }),
      ]
    },
  },
  {
    id: 'celular',
    name: 'Celular',
    cat,
    tags: 'celular movil telefono smartphone whatsapp mensaje llamada',
    draw: () => [
      RR(17, 3, 30, 58, 6, { f: 'char' }),
      RR(21, 10, 22, 40, 2, { f: 'sky', off: 0 }),
      RPoly([[24, 16], [40, 16], [40, 27], [33, 27], [29, 31], [29, 27], [24, 27]], 1.5, { f: 'white', off: 0 }),
      Line([[27, 21.5], [37, 21.5]], { s: 't' }),
      C(32, 55.5, 2.4, { f: 'gray', off: 0 }),
    ],
  },
  {
    id: 'chat',
    name: 'Mensaje',
    cat,
    tags: 'mensaje chat conversacion comentario nota responder consulta hablar',
    draw: () => [
      RPoly([[5, 9], [59, 9], [59, 42], [31, 42], [17, 54], [19, 42], [5, 42]], 5, { f: 'sky' }),
      Dot(20, 25.5, 2.8),
      Dot(32, 25.5, 2.8),
      Dot(44, 25.5, 2.8),
    ],
  },
  {
    id: 'personas',
    name: 'Reunión',
    cat,
    tags: 'reunion personas equipo comite grupo junta cita coordinacion area',
    draw: () => [
      Blob([[29, 58, 'c'], [31, 45], [42, 39], [53, 45], [55, 58, 'c']], { f: 'green' }),
      C(42, 25, 8, { f: 'skin' }),
      Blob([[7, 60, 'c'], [9, 46], [21, 40], [33, 46], [35, 60, 'c']], { f: 'blue' }),
      C(21, 27, 9.5, { f: 'skin' }),
    ],
  },
  {
    id: 'persona',
    name: 'Persona',
    cat,
    tags: 'persona proveedor contacto usuario cliente responsable jefe perfil',
    draw: () => [
      Blob([[9, 59, 'c'], [11, 45], [20, 38], [32, 36], [44, 38], [53, 45], [55, 59, 'c']], { f: 'blue' }),
      Line([[25, 37], [32, 46], [39, 37]], { s: 't' }),
      C(32, 21, 12.5, { f: 'skin', s: 'n', key: 'head' }),
      Blob([[19.6, 20, 'c'], [20.5, 12], [26, 8], [32, 7], [38, 8], [43.5, 12], [44.4, 20, 'c'], [39, 14.5], [32, 13.5], [25, 14.5]], { f: 'brown', s: 'n', off: 0 }),
      C(32, 21, 12.5, { key: 'head' }),
    ],
  },
  {
    id: 'avion_papel',
    name: 'Enviado',
    cat,
    tags: 'enviado enviar avion de papel mensaje despachado remitir mandar',
    draw: () => [
      Poly([[4, 28], [60, 6], [29, 37]], { f: 'white' }),
      Poly([[29, 37], [60, 6], [38, 58]], { f: 'sky' }),
      Line([[29, 37], [24, 50]], { s: 't' }),
    ],
  },
  {
    id: 'buzon',
    name: 'Buzón',
    cat,
    tags: 'buzon correo bandeja recibido carta mesa de partes entrada',
    draw: () => [
      RR(28, 46, 8, 15, 1.5, { f: 'brown' }),
      Line([[52, 33], [52, 15]], { s: 'k' }),
      Poly([[52, 15], [61, 18.5], [52, 22]], { f: 'red' }),
      Blob([[10, 52, 'c'], [10, 30], [16, 19], [30, 14], [44, 19], [50, 30], [50, 52, 'c']], { f: 'blue' }),
      RR(19, 31, 22, 4.5, 2, { f: 'char', off: 0 }),
      Line([[10, 43], [50, 43]], { s: 't' }),
    ],
  },
  {
    id: 'agenda',
    name: 'Agenda',
    cat,
    tags: 'agenda libreta cuaderno notas apuntes libro de actas registro',
    draw: () => [
      RR(13, 4, 42, 56, 4, { f: 'blue' }),
      Line([[47, 4], [47, 60]], { s: 'orange' }),
      RR(21, 12, 22, 15, 2, { f: 'cream', off: 0 }),
      Line([[25, 17.5], [39, 17.5]], { s: 't' }),
      Line([[25, 22.5], [35, 22.5]], { s: 't' }),
      ...[13, 24, 35, 46].map((y) => Line([[7, y], [19, y]], { s: 'k' })),
    ],
  },
  {
    id: 'videollamada',
    name: 'Videollamada',
    cat,
    tags: 'videollamada reunion virtual camara zoom meet llamada video',
    draw: () => [
      RR(4, 17, 40, 32, 5, { f: 'char' }),
      RR(8, 21, 32, 24, 3, { f: 'sky', off: 0 }),
      C(24, 30, 5, { f: 'skin', off: 0 }),
      Blob([[15, 45, 'c'], [16, 38.5], [24, 36], [32, 38.5], [33, 45, 'c']], { f: 'blue', off: 0, s: 'n' }),
      RPoly([[44, 29], [61, 18], [61, 48], [44, 37]], 2, { f: 'dgray' }),
      Dot(10.5, 24, 1.4, { f: 'red' }),
    ],
  },
  {
    id: 'tarjeta',
    name: 'Tarjeta de contacto',
    cat,
    tags: 'tarjeta contacto presentacion proveedor datos telefono direccion',
    draw: () => [
      RR(5, 14, 54, 36, 3, { f: 'white' }),
      C(19, 28, 6, { f: 'skin', off: 0 }),
      Blob([[10, 44, 'c'], [11, 37.5], [19, 35], [27, 37.5], [28, 44, 'c']], { f: 'blue', off: 0 }),
      Line([[34, 24], [52, 24]], { s: 'k' }),
      Line([[34, 31], [50, 31]], { s: 't' }),
      Line([[34, 37], [46, 37]], { s: 't' }),
    ],
  },
]
