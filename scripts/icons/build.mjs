// Genera los íconos a mano: node scripts/icons/build.mjs
//   → src/icons/data.generated.ts   (lo que usa la app; se sube al repositorio)
//   → scripts/icons/out/icons.json  (para la hoja de revisión; no se sube)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES, ICON_COLORS } from './palette.mjs'
import { Warp, compileShape, hashString } from './sketch.mjs'
import { SPECS } from './specs/index.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')

const flatten = (v) => (Array.isArray(v) ? v.flatMap(flatten) : [v])
const STROKES = new Set(['i', 't', 'k', 'w', 'W', 'n'])

const problems = []
const seen = new Set()
const icons = SPECS.map((spec) => {
  const fail = (msg) => problems.push(`${spec.id}: ${msg}`)
  if (seen.has(spec.id)) fail('id repetido')
  seen.add(spec.id)
  if (!CATEGORIES.some((c) => c.id === spec.cat)) fail(`categoría desconocida «${spec.cat}»`)
  if (!spec.name || !spec.tags) fail('falta nombre o palabras clave')

  const warp = new Warp(hashString(spec.id))
  const shapes = flatten(spec.draw()).map((shape, i) => {
    const out = compileShape(shape, hashString(`${spec.id}:${shape.key ?? i}`), warp)
    if (out.f && !ICON_COLORS[out.f]) fail(`color de relleno desconocido «${out.f}»`)
    if (!STROKES.has(out.s) && !ICON_COLORS[out.s]) fail(`línea desconocida «${out.s}»`)
    if (/NaN|Infinity/.test(out.d)) fail('el trazo tiene valores no válidos')
    return [out.d, out.f, out.s, out.o]
  })
  return { id: spec.id, name: spec.name, cat: spec.cat, tags: spec.tags, shapes }
})

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const header = `// Generado por scripts/icons/build.mjs (npm run icons). No editar a mano: cambia los dibujos en scripts/icons/specs.\n`
const ts =
  header +
  `\nexport const ICON_COLORS: Readonly<Record<string, string>> = ${JSON.stringify(ICON_COLORS, null, 2)}\n` +
  `\nexport const ICON_CATEGORIES: ReadonlyArray<{ id: string; name: string }> = ${JSON.stringify(CATEGORIES)}\n` +
  `\n/** [trazo, relleno, línea, ¿relleno corrido?] */\nexport type RawShape = readonly [d: string, fill: string, stroke: string, offset: 0 | 1]\n` +
  `\nexport interface RawIcon {\n  id: string\n  name: string\n  cat: string\n  tags: string\n  shapes: readonly RawShape[]\n}\n` +
  `\nexport const RAW_ICONS: readonly RawIcon[] = [\n${icons.map((i) => `  ${JSON.stringify(i)},`).join('\n')}\n]\n`

fs.mkdirSync(path.join(root, 'src/icons'), { recursive: true })
fs.writeFileSync(path.join(root, 'src/icons/data.generated.ts'), ts)
fs.mkdirSync(path.join(here, 'out'), { recursive: true })
fs.writeFileSync(path.join(here, 'out/icons.json'), JSON.stringify({ colors: ICON_COLORS, categories: CATEGORIES, icons }))

const bytes = Buffer.byteLength(ts)
console.log(`${icons.length} íconos → src/icons/data.generated.ts (${(bytes / 1024).toFixed(1)} KB)`)
