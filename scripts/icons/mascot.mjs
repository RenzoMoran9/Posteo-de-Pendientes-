// Dibuja los adornos que salen alrededor de la mascota con el mismo generador de trazo a mano que los íconos:
//   node scripts/icons/mascot.mjs   →   src/mascot/art.generated.ts
//
// El cuerpo de la mascota (bloques con luz y sombra) no es un dibujo: es un modelo 3D hecho con CSS en
// src/mascot/ClawdArt.tsx. Aquí solo se dibujan las «zzz» de cuando duerme, los destellos de cuando festeja y el
// «¡!» de cuando se sorprende, en un lienzo de 64 × 64 que cubre la caja de la mascota (la cabeza queda hacia y = 16).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Dot, Line, bang, sparkle } from './dsl.mjs'
import { Warp, compileShape, hashString } from './sketch.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')

/** Claves de relleno que entiende src/mascot/Fx.tsx. */
const FILLS = new Set(['pink', 'sky', 'yellow', 'ink', ''])
const STROKES = new Set(['i', 't', 'k', 'w', 'W', 'n'])

export const PARTS = {
  fx: {
    zzz: [
      Line(
        [
          [43, 5],
          [51, 5],
          [43, 13],
          [51, 13],
        ],
        { s: 'k' },
      ),
      Line(
        [
          [54, -4],
          [59, -4],
          [54, 2],
          [59, 2],
        ],
        { s: 'i' },
      ),
    ],
    party: [
      sparkle(7, 10, 6.6, { f: 'pink', s: 't' }),
      sparkle(57, 6, 7.4, { f: 'sky', s: 't' }),
      sparkle(32, -1, 5.2, { f: 'yellow', s: 't' }),
      sparkle(3, 30, 4.4, { f: 'yellow', s: 't' }),
      Dot(16, 1, 1.4),
      Dot(47, -3, 1.4),
    ],
    alert: bang(32, -5, 4),
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
