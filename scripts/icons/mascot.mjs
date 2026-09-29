// Dibuja a la mascota (Chispa) con el mismo generador de trazo a mano que los íconos:
//   node scripts/icons/mascot.mjs   →   src/mascot/art.generated.ts
//
// Es un dibujo propio (no el logo ni la mascota de nadie): un bicho redondo color coral con una chispa en la
// cabeza. Se dibuja en un lienzo de 64 × 64 y se parte en piezas para poder moverlas por separado:
//   back (patas y brazos) · body (cuerpo) · spark (chispa) · face (mejillas, ojos, bocas) · fx (zzz, fiesta, aviso)
// El volumen (aspecto 3D de juguete) lo ponen los degradados y las capas con perspectiva de src/mascot/.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Arc, Blob, C, Curve, Dot, E, Line, bang, sparkle, star } from './dsl.mjs'
import { Warp, compileShape, hashString } from './sketch.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')

/** Claves de relleno que entiende src/mascot/MascotArt.tsx (las que empiezan por «m» son degradados). */
const FILLS = new Set(['body', 'foot', 'arm', 'eye', 'spark', 'gloss', 'blush', 'char', 'red', 'white', 'pink', 'sky', 'yellow', 'ink', ''])
const STROKES = new Set(['i', 't', 'k', 'w', 'W', 'n'])

const BODY = [
  [32, 22],
  [43, 24],
  [51, 31],
  [55, 42],
  [52, 52],
  [43, 57.5],
  [32, 59],
  [21, 57.5],
  [12, 52],
  [9, 42],
  [13, 31],
  [21, 24],
]

const eye = (cx) => [
  E(cx, 38, 6.4, 7.4, { f: 'eye', off: 0 }),
]
const pupil = (cx) => [
  C(cx + 0.6, 39, 3.7, { f: 'ink', s: 'n', off: 0, over: 0 }),
  C(cx + 1.9, 37.2, 1.25, { f: 'white', s: 'n', off: 0, over: 0 }),
  C(cx - 0.9, 40.9, 0.65, { f: 'white', s: 'n', off: 0, over: 0 }),
]

export const PARTS = {
  // Detrás del cuerpo: se ven asomar por los lados y por abajo.
  back: {
    footL: E(22, 58.6, 6.8, 3.9, { f: 'foot' }),
    footR: E(42, 58.6, 6.8, 3.9, { f: 'foot' }),
    armL: E(4.5, 44.5, 7.2, 3.9, { f: 'arm', rot: 28 }),
    armR: E(59.5, 44.5, 7.2, 3.9, { f: 'arm', rot: -28 }),
  },
  body: {
    body: Blob(BODY, { f: 'body' }),
    gloss: E(21.5, 31.5, 5.4, 2.7, { f: 'gloss', s: 'n', off: 0, rot: -38 }),
    shine: Curve(
      [
        [15, 35],
        [15.4, 30],
        [19.6, 26.2],
      ],
      { s: 'w' },
    ),
  },
  spark: {
    stalk: Curve(
      [
        [31, 23.5],
        [30, 18.5],
        [33.2, 14.6],
      ],
      { s: 'k' },
    ),
    star: star(34.4, 8.4, 10.4, 4.5, 4, -90, { f: 'spark' }),
  },
  face: {
    cheekL: E(18.6, 48.6, 3.9, 2.5, { f: 'blush', s: 'n', off: 0 }),
    cheekR: E(45.4, 48.6, 3.9, 2.5, { f: 'blush', s: 'n', off: 0 }),
    eyeL: eye(24),
    eyeR: eye(40),
    pupilL: pupil(24),
    pupilR: pupil(40),
    eyesHappy: [Arc(24, 40.5, 5.7, 200, 340, { s: 'k' }), Arc(40, 40.5, 5.7, 200, 340, { s: 'k' })],
    eyesSleep: [Arc(24, 37.5, 5.7, 20, 160, { s: 'k' }), Arc(40, 37.5, 5.7, 20, 160, { s: 'k' })],
    mouthSmile: Arc(32, 45.4, 5.2, 28, 152, { s: 'k' }),
    mouthGrin: [
      Blob(
        [
          [25.8, 45.6, 'c'],
          [27.6, 50.4],
          [32, 52.6],
          [36.4, 50.4],
          [38.2, 45.6, 'c'],
        ],
        { f: 'char' },
      ),
      E(32, 50.6, 3.1, 1.6, { f: 'red', s: 'n', off: 0 }),
    ],
    mouthO: E(32, 48.6, 2.9, 3.7, { f: 'char' }),
    mouthFlat: Line(
      [
        [28.5, 47.6],
        [35.5, 47.6],
      ],
      { s: 'k' },
    ),
    mouthHm: Curve(
      [
        [27.8, 47.6],
        [31, 49],
        [34, 46.8],
        [36.6, 47.8],
      ],
      { s: 'k' },
    ),
  },
  fx: {
    zzz: [
      Line(
        [
          [46, 17],
          [54, 17],
          [46, 26],
          [54, 26],
        ],
        { s: 'k' },
      ),
      Line(
        [
          [56, 6],
          [61, 6],
          [56, 12],
          [61, 12],
        ],
        { s: 'i' },
      ),
    ],
    party: [
      sparkle(6, 14, 6.6, { f: 'pink', s: 't' }),
      sparkle(58, 22, 7.4, { f: 'sky', s: 't' }),
      sparkle(53, 3, 5, { f: 'yellow', s: 't' }),
      sparkle(4, 35, 4.4, { f: 'yellow', s: 't' }),
      Dot(12, 4, 1.4),
      Dot(46, 1.5, 1.4),
    ],
    alert: bang(53, 5, 15),
  },
}

const flatten = (v) => (Array.isArray(v) ? v.flatMap(flatten) : [v])

const warp = new Warp(hashString('mascota'))
const problems = []
const out = {}
for (const [layer, parts] of Object.entries(PARTS)) {
  out[layer] = {}
  for (const [name, spec] of Object.entries(parts)) {
    out[layer][name] = flatten(spec).map((shape, i) => {
      const c = compileShape(shape, hashString(`mascota:${layer}:${name}:${i}`), warp)
      if (!FILLS.has(c.f)) problems.push(`${layer}.${name}: relleno desconocido «${c.f}»`)
      if (!STROKES.has(c.s)) problems.push(`${layer}.${name}: línea desconocida «${c.s}»`)
      if (/NaN|Infinity/.test(c.d)) problems.push(`${layer}.${name}: el trazo tiene valores no válidos`)
      return [c.d, c.f, c.s, c.o]
    })
  }
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const header = `// Generado por scripts/icons/mascot.mjs (npm run icons). No editar a mano: cambia el dibujo en ese archivo.\n`
const ts =
  header +
  `\n/** [trazo, relleno, línea, ¿relleno corrido?] */\nexport type MascotShape = readonly [d: string, fill: string, stroke: string, offset: 0 | 1]\n` +
  `\nexport const MASCOT_ART = ${JSON.stringify(out, null, 2)} as const satisfies Record<string, Record<string, readonly MascotShape[]>>\n`

fs.mkdirSync(path.join(root, 'src/mascot'), { recursive: true })
fs.writeFileSync(path.join(root, 'src/mascot/art.generated.ts'), ts)
console.log(`mascota → src/mascot/art.generated.ts (${(Buffer.byteLength(ts) / 1024).toFixed(1)} KB)`)
