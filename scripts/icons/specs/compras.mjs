import { Arc, Blob, C, Curve, Dot, Line, Poly, RPoly, RR, check, place, rotAll, soles, sparkle } from '../dsl.mjs'

const cat = 'compras'

/** Hoja de papel con una esquina doblada arriba a la derecha. */
const sheet = () => [
  RPoly(
    [
      [12, 5],
      [40, 5],
      [52, 17],
      [52, 59],
      [12, 59],
    ],
    [2, 0, 0, 2, 2],
    { f: 'white' },
  ),
  Poly(
    [
      [40, 5],
      [40, 17],
      [52, 17],
    ],
    { f: 'gray' },
  ),
]

const textLines = (ys) => ys.map((y, i) => Line([[18, y], [i % 2 ? 40 : 46, y]], { s: 't' }))

const bill = (color, deg, dy, key) => {
  const pts = (list) => rotAll(list, 32, 32, deg).map((p) => [p[0], p[1] + dy])
  return [
    RPoly(pts([[4, 17], [60, 17], [60, 47], [4, 47]]), 3, { f: color, key }),
    RPoly(pts([[10, 22], [54, 22], [54, 42], [10, 42]]), 2, { s: 't', off: 0 }),
  ]
}

export default [
  {
    id: 'cotizacion',
    name: 'Cotización',
    cat,
    tags: 'cotizacion cotizar precio presupuesto proforma proveedor oferta cuanto cuesta',
    draw: () => [...sheet(), ...textLines([22, 29, 36]), C(44, 47, 11.5, { f: 'yellow' }), ...soles(44, 47, 0.42, { s: 'i' })],
  },
  {
    id: 'orden_compra',
    name: 'Orden de compra',
    cat,
    tags: 'orden de compra oc pedido aprobado compra autorizada emitir',
    draw: () => [...sheet(), ...textLines([22, 29, 36]), C(44, 47, 11.5, { f: 'green' }), check(44, 47.5, 0.9, { s: 'W' })],
  },
  {
    id: 'factura',
    name: 'Factura / boleta',
    cat,
    tags: 'factura boleta recibo comprobante pago cuenta ticket total',
    draw: () => [
      Poly(
        [
          [14, 4],
          [50, 4],
          [50, 58],
          [45, 53],
          [40, 58],
          [35, 53],
          [30, 58],
          [25, 53],
          [20, 58],
          [14, 53],
        ],
        { f: 'white' },
      ),
      ...[13, 20, 27, 34].map((y, i) => Line([[19, y], [[45, 38, 42, 34][i], y]], { s: 't' })),
      Line([[19, 44], [45, 44]], { s: 'k' }),
    ],
  },
  {
    id: 'expediente',
    name: 'Expediente',
    cat,
    tags: 'expediente carpeta documentos tramite archivo papeles folder',
    draw: () => [
      RPoly(
        [
          [5, 13],
          [24, 13],
          [29, 19],
          [59, 19],
          [59, 57],
          [5, 57],
        ],
        2.5,
        { f: 'blue' },
      ),
      RPoly(rotAll([[10, 10], [54, 10], [54, 44], [10, 44]], 32, 27, -3), 1.5, { f: 'white' }),
      Line([[16, 20], [44, 19]], { s: 't' }),
      Line([[16, 27], [40, 26]], { s: 't' }),
      RPoly(
        [
          [5, 27],
          [59, 27],
          [59, 57],
          [5, 57],
        ],
        3,
        { f: 'sky' },
      ),
      RR(22, 37, 20, 10, 2, { f: 'white', off: 0 }),
      Line([[26, 42], [38, 42]], { s: 't' }),
    ],
  },
  {
    id: 'archivador',
    name: 'Archivador',
    cat,
    tags: 'archivador archivo gabinete cajones ordenar guardar documentos',
    draw: () => [
      RR(12, 4, 40, 56, 4, { f: 'gray' }),
      Line([[12, 23], [52, 23]]),
      Line([[12, 42], [52, 42]]),
      ...[11, 30, 49].map((y) => RR(25, y, 14, 5, 2, { f: 'dgray' })),
    ],
  },
  {
    id: 'clip',
    name: 'Clip',
    cat,
    tags: 'clip adjunto adjuntar sujetar anexo papel',
    draw: () => {
      const pts = [
        [4, 14],
        [4, -13],
        [0, -18],
        [-4, -13],
        [-4, 17],
        [2, 26],
        [9, 17],
        [9, -17],
        [0, -25],
        [-9, -17],
        [-9, 10],
      ]
      return place([Curve(pts, { s: 'k', key: 'wire' }), Curve(pts, { s: 'gray', key: 'wire' })], 18, 32, 31)
    },
  },
  {
    id: 'sello',
    name: 'Sello',
    cat,
    tags: 'sello sellar aprobado firmar recibido timbre visto bueno',
    draw: () => [
      Line([[10, 53], [54, 53]], { s: 'red' }),
      Line([[16, 59], [48, 59]], { s: 'red' }),
      Blob(
        [
          [32, 4],
          [38, 8],
          [38, 14],
          [35, 18],
          [36, 27],
          [28, 27],
          [29, 18],
          [26, 14],
          [26, 8],
        ],
        { f: 'red' },
      ),
      RR(14, 27, 36, 10, 3, { f: 'brown' }),
      RR(12, 37, 40, 8, 2, { f: 'char' }),
    ],
  },
  {
    id: 'firma',
    name: 'Firma',
    cat,
    tags: 'firma firmar pluma boligrafo contrato conforme rubrica escribir',
    draw: () => [
      Curve(
        [
          [5, 54],
          [11, 46],
          [16, 56],
          [22, 46],
          [28, 55],
          [36, 50],
          [44, 53],
          [58, 48],
        ],
        { s: 'k' },
      ),
      ...place(
        [
          Poly([[-4.5, 8], [4.5, 8], [0, 21]], { f: 'tan' }),
          RR(-4.5, -26, 9, 35, 2, { f: 'blue' }),
          RR(-4.5, -26, 9, 7, 2, { f: 'dgray' }),
          Poly([[-1.5, 16.5], [1.5, 16.5], [0, 21]], { f: 'ink', s: 'n', off: 0 }),
        ],
        38,
        40,
        24,
      ),
    ],
  },
  {
    id: 'caja',
    name: 'Paquete',
    cat,
    tags: 'caja paquete envio entrega bulto encomienda pedido recibido',
    draw: () => [
      Poly([[6, 26], [38, 26], [38, 58], [6, 58]], { f: 'tan' }),
      Poly([[38, 26], [58, 16], [58, 48], [38, 58]], { f: 'brown' }),
      Poly([[6, 26], [26, 16], [58, 16], [38, 26]], { f: 'cream' }),
      Poly([[15, 26], [25, 26], [45, 16], [35, 16]], { f: 'orange', s: 't', off: 0 }),
      Poly([[15, 26], [25, 26], [25, 39], [15, 39]], { f: 'orange', s: 't', off: 0 }),
    ],
  },
  {
    id: 'camion',
    name: 'Camión de entrega',
    cat,
    tags: 'camion entrega envio despacho transporte llega proveedor reparto',
    draw: () => [
      RR(3, 12, 37, 34, 3, { f: 'white' }),
      ...[22, 29, 36].map((y) => Line([[9, y], [34, y]], { s: 't' })),
      RPoly(
        [
          [40, 22],
          [51, 22],
          [61, 35],
          [61, 47],
          [40, 47],
        ],
        2,
        { f: 'orange' },
      ),
      Poly([[44, 26], [50, 26], [56, 34], [44, 34]], { f: 'sky' }),
      C(15, 49, 7, { f: 'char' }),
      C(15, 49, 2.6, { f: 'gray', off: 0 }),
      C(49, 49, 7, { f: 'char' }),
      C(49, 49, 2.6, { f: 'gray', off: 0 }),
    ],
  },
  {
    id: 'carrito',
    name: 'Carrito de compras',
    cat,
    tags: 'carrito compras comprar tienda pedido adquirir supermercado',
    draw: () => [
      Line([[25, 44], [25, 49]], { s: 'k' }),
      Line([[46, 44], [46, 49]], { s: 'k' }),
      Line(
        [
          [3, 9],
          [11, 9],
          [20, 44],
          [52, 44],
        ],
        { s: 'k' },
      ),
      RPoly(
        [
          [13, 17],
          [60, 17],
          [54, 37],
          [19, 37],
        ],
        2.5,
        { f: 'orange' },
      ),
      Line([[26, 18], [28, 36]], { s: 't' }),
      Line([[37, 18], [37, 36]], { s: 't' }),
      Line([[48, 18], [46, 36]], { s: 't' }),
      C(25, 54, 5, { f: 'char' }),
      C(46, 54, 5, { f: 'char' }),
    ],
  },
  {
    id: 'calculadora',
    name: 'Calculadora',
    cat,
    tags: 'calculadora calcular cuentas numeros sumar total presupuesto costo',
    draw: () => {
      const keys = []
      ;[26, 34, 42, 50].forEach((y) => {
        ;[16, 28, 40].forEach((x, i) => keys.push(RR(x, y, 8.5, 6.5, 1.5, { f: i === 2 ? 'orange' : 'white', off: 0 })))
      })
      return [RR(11, 4, 42, 56, 5, { f: 'blue' }), RR(16, 9, 32, 13, 2, { f: 'cream', off: 0 }), Line([[34, 15.5], [43, 15.5]], { s: 'k' }), ...keys]
    },
  },
  {
    id: 'soles',
    name: 'Soles (S/)',
    cat,
    tags: 'soles dinero plata moneda pago costo precio monto efectivo',
    draw: () => [C(32, 32, 25, { f: 'yellow' }), C(32, 32, 19, { s: 't' }), ...soles(32, 32, 0.9), sparkle(54, 9, 5.5, { f: 'white' })],
  },
  {
    id: 'billete',
    name: 'Billetes',
    cat,
    tags: 'billete billetes dinero efectivo plata pago caja monto',
    draw: () => [
      ...bill('lime', 7, -1, 'b1'),
      ...bill('green', -5, 3, 'b2'),
      C(32, 34, 7, { f: 'yellow', off: 0 }),
      ...soles(32, 34, 0.28, { s: 't' }),
    ],
  },
  {
    id: 'alcancia',
    name: 'Alcancía',
    cat,
    tags: 'alcancia presupuesto ahorro fondos dinero disponible cerdito',
    draw: () => [
      Curve([[9, 33], [4, 32], [3, 27], [7, 25]], { s: 'k' }),
      RR(15, 48, 8, 10, 2, { f: 'pink' }),
      RR(36, 49, 8, 10, 2, { f: 'pink' }),
      Poly([[39, 22], [45, 13], [49, 25]], { f: 'pink' }),
      C(30, 8, 6, { f: 'yellow' }),
      Line([[30, 5], [30, 11]], { s: 't' }),
      C(31, 36, 23, { f: 'pink' }),
      C(55, 37, 5.5, { f: 'pink' }),
      Dot(54, 35, 1.1),
      Dot(54, 40, 1.1),
      Dot(44, 30, 1.9),
      Line([[23, 22], [37, 22]], { s: 'k' }),
    ],
  },
  {
    id: 'balanza',
    name: 'Balanza',
    cat,
    tags: 'balanza comparar comparacion precios cuadro comparativo justicia peso evaluar',
    draw: () => [
      RR(19, 55, 26, 5, 2, { f: 'dgray' }),
      Line([[32, 12], [32, 55]], { s: 'k' }),
      Line([[12, 19], [2, 36]], { s: 't' }),
      Line([[12, 19], [22, 36]], { s: 't' }),
      Line([[52, 7], [42, 26]], { s: 't' }),
      Line([[52, 7], [62, 26]], { s: 't' }),
      Line([[12, 19], [52, 7]], { s: 'k' }),
      C(32, 13, 4.2, { f: 'yellow' }),
      Blob([[2, 36, 'c'], [4, 43], [12, 46], [20, 43], [22, 36, 'c']], { f: 'yellow' }),
      Blob([[42, 26, 'c'], [44, 33], [52, 36], [60, 33], [62, 26, 'c']], { f: 'yellow' }),
    ],
  },
  {
    id: 'lupa',
    name: 'Lupa',
    cat,
    tags: 'lupa revisar buscar verificar detalle inspeccionar controlar',
    draw: () => [
      ...place([RR(-4.5, 0, 9, 26, 3, { f: 'brown' })], -45, 38, 38),
      C(26, 26, 17, { f: 'sky', s: 'n', key: 'lens' }),
      Arc(26, 26, 11, 200, 262, { s: 'w' }),
      C(26, 26, 17, { s: 'k', key: 'lens' }),
    ],
  },
  {
    id: 'lista',
    name: 'Lista de tareas',
    cat,
    tags: 'lista tareas pendientes checklist revisar verificar pasos cotejar',
    draw: () => [
      RR(10, 8, 44, 52, 4, { f: 'tan' }),
      RR(15, 14, 34, 41, 2, { f: 'white' }),
      RR(22, 3, 20, 9, 3, { f: 'dgray' }),
      ...[26, 36, 46].flatMap((y, i) => [
        RR(19, y - 3.5, 7, 7, 1.5, { s: 't' }),
        Line([[30, y], [45, y]], { s: 't' }),
        ...(i < 2 ? [Line([[19.5, y - 0.5], [22, y + 2.5], [27, y - 4.5]], { s: 'green' })] : []),
      ]),
    ],
  },
  {
    id: 'etiqueta',
    name: 'Etiqueta de precio',
    cat,
    tags: 'etiqueta precio oferta descuento costo tarifa marcar',
    draw: () => [
      RPoly(
        [
          [5, 32],
          [21, 14],
          [59, 14],
          [59, 50],
          [21, 50],
        ],
        3,
        { f: 'orange' },
      ),
      C(19, 32, 3.6, { f: 'cream' }),
      Curve([[19, 32], [11, 26], [9, 17], [15, 8]], { s: 'i' }),
      ...soles(41, 32, 0.6),
    ],
  },
  {
    id: 'almacen',
    name: 'Almacén',
    cat,
    tags: 'almacen deposito bodega stock inventario logistica recepcion',
    draw: () => [
      RR(7, 26, 50, 32, 2, { f: 'sky' }),
      RPoly(
        [
          [3, 29],
          [32, 8],
          [61, 29],
        ],
        2,
        { f: 'red' },
      ),
      RR(19, 36, 26, 22, 1.5, { f: 'gray' }),
      ...[42, 47, 52].map((y) => Line([[19, y], [45, y]], { s: 't' })),
    ],
  },
  {
    id: 'grafico',
    name: 'Gráfico',
    cat,
    tags: 'grafico barras reporte estadistica avance resultados informe datos',
    draw: () => [
      RR(14, 36, 10, 20, 1.5, { f: 'sky' }),
      RR(28, 24, 10, 32, 1.5, { f: 'green' }),
      RR(42, 12, 10, 44, 1.5, { f: 'orange' }),
      Line([[8, 6], [8, 57], [60, 57]], { s: 'k' }),
    ],
  },
  {
    id: 'maletin',
    name: 'Maletín',
    cat,
    tags: 'maletin trabajo oficina reunion viaje negocio visita',
    draw: () => [
      Curve([[24, 20], [24, 11], [40, 11], [40, 20]], { s: 'k' }),
      RR(6, 20, 52, 36, 5, { f: 'brown' }),
      Line([[6, 36], [58, 36]], { s: 't' }),
      RR(28, 32, 8, 9, 1.5, { f: 'yellow' }),
    ],
  },
]
