// Convierte formas geométricas simples en trazos "a mano".
//
// Cada forma se traduce a curvas Bézier y luego se "tiembla" un poco: una deformación suave común a todo
// el ícono (así las piezas que se tocan siguen tocándose) más una irregularidad propia de cada pieza y un
// pequeño "empalme" donde el trazo cierra la figura, como cuando se dibuja de un solo trazo con marcador.
// Todo es determinista (sale del id del ícono): el resultado es siempre el mismo.

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const mul = (a, k) => [a[0] * k, a[1] * k]
const len = (a) => Math.hypot(a[0], a[1])
const unit = (a) => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rngFrom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smooth = (t) => t * t * (3 - 2 * t)

/** Campo de deformación suave (ruido de valores en una malla): mismo punto → mismo desplazamiento. */
export class Warp {
  constructor(seed, { cell = 17, amp = 0.85 } = {}) {
    const r = rngFrom(seed)
    this.cell = cell
    this.amp = amp
    this.grid = Array.from({ length: 64 }, () => [r() * 2 - 1, r() * 2 - 1])
  }
  at(p) {
    const gx = p[0] / this.cell
    const gy = p[1] / this.cell
    const x0 = Math.floor(gx)
    const y0 = Math.floor(gy)
    const fx = smooth(gx - x0)
    const fy = smooth(gy - y0)
    const v = (i, j) => this.grid[(((j % 8) + 8) % 8) * 8 + (((i % 8) + 8) % 8)]
    const a = v(x0, y0)
    const b = v(x0 + 1, y0)
    const c = v(x0, y0 + 1)
    const d = v(x0 + 1, y0 + 1)
    const mixv = (k) => {
      const top = a[k] + (b[k] - a[k]) * fx
      const bot = c[k] + (d[k] - c[k]) * fx
      return (top + (bot - top) * fy) * this.amp
    }
    return [mixv(0), mixv(1)]
  }
}

// ───────────────────────── geometría → Bézier ─────────────────────────
// Un camino: { start:[x,y], segs:[{c1,c2,p}], loop:boolean }  (loop = figura cerrada que se dibuja "de un trazo")

const line = (a, b) => ({ c1: lerp(a, b, 1 / 3), c2: lerp(a, b, 2 / 3), p: b })

function ellipsePath(s, rng) {
  const rot = ((s.rot || 0) * Math.PI) / 180
  let a0 = s.a0 ?? 0
  let a1 = s.a1 ?? 360
  const full = Math.abs(a1 - a0) >= 359.9
  if (full) {
    if (s.a0 === undefined) a0 = rng() * 360
    a1 = a0 + 360
  }
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90 - 1e-6))
  const step = ((a1 - a0) * Math.PI) / 180 / n
  const t0 = (a0 * Math.PI) / 180
  const map = (u, v) => {
    const x = u * s.rx
    const y = v * s.ry
    return [s.cx + x * Math.cos(rot) - y * Math.sin(rot), s.cy + x * Math.sin(rot) + y * Math.cos(rot)]
  }
  const k = (4 / 3) * Math.tan(step / 4)
  const segs = []
  for (let i = 0; i < n; i++) {
    const th1 = t0 + step * i
    const th2 = th1 + step
    const c1 = map(Math.cos(th1) - k * Math.sin(th1), Math.sin(th1) + k * Math.cos(th1))
    const c2 = map(Math.cos(th2) + k * Math.sin(th2), Math.sin(th2) - k * Math.cos(th2))
    segs.push({ c1, c2, p: map(Math.cos(th2), Math.sin(th2)) })
  }
  return { start: map(Math.cos(t0), Math.sin(t0)), segs, loop: full }
}

function polyPath(s) {
  const pts = s.pts
  const segs = []
  for (let i = 1; i < pts.length; i++) segs.push(line(pts[i - 1], pts[i]))
  if (s.closed) segs.push(line(pts[pts.length - 1], pts[0]))
  return { start: pts[0], segs, loop: !!s.closed }
}

function rpolyPath(s) {
  const pts = s.pts
  const n = pts.length
  const rad = (i) => (Array.isArray(s.r) ? s.r[i] : s.r) ?? 0
  const closed = !!s.closed
  const around = (i) => {
    const v = pts[i]
    const prev = pts[(i - 1 + n) % n]
    const next = pts[(i + 1) % n]
    const interior = closed || (i > 0 && i < n - 1)
    if (!interior) return { v, a: v, b: v, d: 0 }
    const din = unit(sub(v, prev))
    const dout = unit(sub(next, v))
    const d = Math.min(rad(i), len(sub(v, prev)) / 2, len(sub(next, v)) / 2)
    return { v, a: sub(v, mul(din, d)), b: add(v, mul(dout, d)), d }
  }
  const info = pts.map((_, i) => around(i))
  const segs = []
  let cur = info[0].b
  const start = cur
  const corner = (c) => {
    if (c.d > 0) {
      segs.push({ c1: lerp(c.a, c.v, 0.55), c2: lerp(c.b, c.v, 0.55), p: c.b })
      cur = c.b
    }
  }
  for (let i = 1; i < n; i++) {
    segs.push(line(cur, info[i].a))
    cur = info[i].a
    corner(info[i])
  }
  if (closed) {
    segs.push(line(cur, info[0].a))
    cur = info[0].a
    corner(info[0])
  }
  return { start: closed ? start : pts[0], segs, loop: closed }
}

/** Curva suave por unos puntos (Catmull-Rom); un punto con `'c'` como tercer valor es una esquina. */
function smoothPath(s) {
  const P = s.pts.map((p) => [p[0], p[1]])
  const corner = s.pts.map((p) => p[2] === 'c')
  const n = P.length
  const closed = !!s.closed
  const idx = (i) => (closed ? (i + n) % n : clamp(i, 0, n - 1))
  const segs = []
  const count = closed ? n : n - 1
  const tangents = (i) => {
    // [entrada, salida] en el punto i
    const open = !closed && (i === 0 || i === n - 1)
    if (corner[i] || open) {
      const inn = i === 0 && !closed ? sub(P[1], P[0]) : sub(P[i], P[idx(i - 1)])
      const out = i === n - 1 && !closed ? sub(P[i], P[n - 2]) : sub(P[idx(i + 1)], P[i])
      return [inn, out]
    }
    const t = mul(sub(P[idx(i + 1)], P[idx(i - 1)]), 0.5)
    return [t, t]
  }
  for (let i = 0; i < count; i++) {
    const j = idx(i + 1)
    const out = tangents(i)[1]
    const inn = tangents(j)[0]
    segs.push({ c1: add(P[i], mul(out, 1 / 3)), c2: sub(P[j], mul(inn, 1 / 3)), p: P[j] })
  }
  return { start: P[0], segs, loop: closed }
}

// ───────────────────────── temblor ─────────────────────────

const JITTER = 0.3
const SEAM = 0.75

function sizeOf(path) {
  const xs = [path.start[0]]
  const ys = [path.start[1]]
  for (const s of path.segs) {
    xs.push(s.p[0])
    ys.push(s.p[1])
  }
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

/** Subcurva [0, τ] de un Bézier cúbico (de Casteljau). */
function head(p0, s, tau) {
  const a = lerp(p0, s.c1, tau)
  const b = lerp(s.c1, s.c2, tau)
  const c = lerp(s.c2, s.p, tau)
  const d = lerp(a, b, tau)
  const e = lerp(b, c, tau)
  const f = lerp(d, e, tau)
  return { c1: a, c2: d, p: f }
}

function roughen(path, warp, rng, amp, over) {
  const w = (p) => warp.at(p)
  const j = (a) => [(rng() * 2 - 1) * a, (rng() * 2 - 1) * a]
  const jit = JITTER * amp
  const anchors = [path.start, ...path.segs.map((s) => s.p)]
  const disp = anchors.map((p) => add(w(p), j(jit * 0.7)))
  // cierre del trazo: el último punto no cae exactamente donde empezó
  const mm = path.loop ? j(SEAM * amp) : [0, 0]
  if (path.loop) disp[disp.length - 1] = add(disp[0], mm)

  const start = add(path.start, disp[0])
  const segs = path.segs.map((s, i) => {
    const d0 = disp[i]
    const d1 = disp[i + 1]
    const h1 = add(add(d0, mul(sub(w(s.c1), w(anchors[i])), 0.7)), j(jit))
    const h2 = add(add(d1, mul(sub(w(s.c2), w(anchors[i + 1])), 0.7)), j(jit))
    return { c1: add(s.c1, h1), c2: add(s.c2, h2), p: add(s.p, d1) }
  })

  if (path.loop && over > 0 && segs.length) {
    const first = segs[0]
    const firstLen = len(sub(first.p, start)) || 1
    const tau = clamp(over / firstLen, 0.05, 0.55)
    const sub0 = head(start, first, tau)
    const t = mm
    segs.push({ c1: add(sub0.c1, t), c2: add(sub0.c2, t), p: add(sub0.p, t) })
  }
  return { start, segs }
}

const fmt = (n) => {
  let s = (Math.round(n * 10) / 10).toString()
  if (s === '-0') s = '0'
  return s.replace(/^(-?)0\./, '$1.')
}

const joinNums = (nums) => {
  let out = ''
  for (const n of nums) {
    const t = fmt(n)
    out += out && !t.startsWith('-') ? ` ${t}` : t
  }
  return out
}

export function toPathData(path) {
  let d = `M${joinNums(path.start)}`
  let cur = path.start
  for (const s of path.segs) {
    const rel = [s.c1[0] - cur[0], s.c1[1] - cur[1], s.c2[0] - cur[0], s.c2[1] - cur[1], s.p[0] - cur[0], s.p[1] - cur[1]]
    d += `c${joinNums(rel)}`
    cur = s.p
  }
  return d
}

/**
 * Forma → datos de trazo. `s` (descriptor de la forma) admite:
 *   f: color de relleno · s: estilo de línea · off: 0 = relleno sin desplazar · amp: temblor · over: empalme (unidades)
 */
export function compileShape(s, seed, warp) {
  const rng = rngFrom(seed)
  let path
  if (s.t === 'ell') path = ellipsePath(s, rng)
  else if (s.t === 'poly') path = polyPath(s)
  else if (s.t === 'rpoly') path = rpolyPath(s)
  else if (s.t === 'smooth') path = smoothPath(s)
  else throw new Error(`forma desconocida: ${s.t}`)

  const size = sizeOf(path)
  const amp = (s.amp ?? 1) * clamp(size / 34, 0.3, 1.2)
  const over = s.over ?? (s.t === 'ell' ? Math.max(1.5, size * 0.09) : 2.4)
  const rough = roughen(path, warp, rng, amp, over)
  return {
    d: toPathData(rough),
    f: s.f ?? '',
    s: s.s ?? 'i',
    o: s.off === 0 ? 0 : 1,
  }
}
