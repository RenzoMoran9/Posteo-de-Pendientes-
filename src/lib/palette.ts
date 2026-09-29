export interface PaperColor {
  name: string
  hex: string
}

/** Paleta amplia de papel (la de los posits): se abre chiquita desde el botón de la paleta del estuche. */
export const PAPER_COLORS: PaperColor[] = [
  { name: 'Amarillo', hex: '#FFD95E' },
  { name: 'Naranja', hex: '#FFA65C' },
  { name: 'Rojo', hex: '#EF6A62' },
  { name: 'Cielo', hex: '#8ECDF5' },
  { name: 'Azul', hex: '#5BA4E6' },
  { name: 'Verde', hex: '#6CC070' },
  { name: 'Gris', hex: '#E4E1DA' },
  { name: 'Kraft', hex: '#DDBE92' },
  { name: 'Marino', hex: '#34507F' },
  { name: 'Carbón', hex: '#3B3F46' },
  { name: 'Bosque', hex: '#2F6F55' },
  { name: 'Café', hex: '#7C563B' },
  { name: 'Vino', hex: '#8E3E5A' },
  { name: 'Mostaza', hex: '#F2B84B' },
  { name: 'Lima', hex: '#C9E86A' },
  { name: 'Menta', hex: '#A3E6BE' },
  { name: 'Turquesa', hex: '#62D2C8' },
  { name: 'Crema', hex: '#FFF0C7' },
  { name: 'Blanco', hex: '#FFFDF7' },
  { name: 'Coral', hex: '#FF8A78' },
  { name: 'Rosa', hex: '#FFA9C8' },
  { name: 'Fucsia', hex: '#E879B0' },
  { name: 'Lila', hex: '#CDB4F6' },
  { name: 'Morado', hex: '#A78BDF' },
]

export const DEFAULT_COLOR = PAPER_COLORS[0].hex

export const INK_DARK = '#2b2723'
export const INK_LIGHT = '#fffaf0'

/** Cintas adhesivas de taller (semitransparentes): color visible (`css`) y su base opaca (`hex`). */
export const TAPE_COLORS = [
  { css: 'rgb(226 204 152 / 0.9)', hex: '#E2CC98' }, // cinta de enmascarar
  { css: 'rgb(95 150 215 / 0.84)', hex: '#5F96D7' }, // azul de pintor
  { css: 'rgb(170 178 186 / 0.9)', hex: '#AAB2BA' }, // ducto plateado
  { css: 'rgb(240 137 45 / 0.86)', hex: '#F0892D' }, // naranja de seguridad
  { css: 'rgb(122 138 78 / 0.9)', hex: '#7A8A4E' }, // oliva
  { css: 'rgb(206 74 66 / 0.86)', hex: '#CE4A42' }, // rojo eléctrico
  { css: 'rgb(48 54 61 / 0.9)', hex: '#30363D' }, // negra
]

export function nameOfColor(hex: string): string {
  return PAPER_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? 'Personalizado'
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [255, 255, 255]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: [number, number, number]): string {
  const p = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${p(r)}${p(g)}${p(b)}`
}

const channel = (c: number): number => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** Luminancia relativa (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Razón de contraste (WCAG) entre dos colores: de 1 a 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/** Tinta que mejor se lee sobre el color de papel dado. */
export function inkFor(hex: string): string {
  return contrast(hex, INK_DARK) >= contrast(hex, INK_LIGHT) ? INK_DARK : INK_LIGHT
}

/** Mezcla `hex` con `other`; t=0 devuelve `hex`, t=1 devuelve `other`. */
export function mix(hex: string, other: string, t: number): string {
  const a = parseHex(hex)
  const b = parseHex(other)
  return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
}

export const darken = (hex: string, t: number): string => mix(hex, '#1a1410', t)
export const lighten = (hex: string, t: number): string => mix(hex, '#ffffff', t)

function distance(a: string, b: string): number {
  const [r1, g1, b1] = parseHex(a)
  const [r2, g2, b2] = parseHex(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

/**
 * Cinta para un posit: sale de `seed01` (estable por posit) pero se salta las que
 * se confundirían con el papel (cinta amarilla sobre posit amarillo, etc.).
 */
export function pickTape(seed01: number, noteHex: string): string {
  const n = TAPE_COLORS.length
  const start = Math.floor(seed01 * n) % n
  for (let i = 0; i < n; i++) {
    const t = TAPE_COLORS[(start + i) % n]
    if (distance(noteHex, t.hex) > 100) return t.css
  }
  return TAPE_COLORS[start].css
}
