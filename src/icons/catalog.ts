import { ICON_CATEGORIES, RAW_ICONS, type RawIcon } from './data.generated'

export type { RawIcon }

export interface IconCategory {
  id: string
  name: string
}

export const CATEGORIES: readonly IconCategory[] = ICON_CATEGORIES
export const ICONS: readonly RawIcon[] = RAW_ICONS

const byId = new Map<string, RawIcon>(RAW_ICONS.map((i) => [i.id, i]))

export const getIcon = (id: string): RawIcon | undefined => byId.get(id)

/** Minúsculas y sin acentos: «Camión» y «camion» se buscan igual. */
export const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

interface Entry {
  icon: RawIcon
  /** Nombre completo sin acentos ni mayúsculas. */
  full: string
  name: string[]
  tags: string[]
}

const entries: Entry[] = RAW_ICONS.map((icon) => ({
  icon,
  full: fold(icon.name).trim(),
  name: fold(icon.name)
    .split(/[^a-z0-9]+/)
    .filter(Boolean),
  tags: fold(icon.tags)
    .split(/\s+/)
    .filter(Boolean),
}))

/**
 * Busca íconos por nombre y palabras clave (sin importar acentos ni mayúsculas).
 * Cada palabra escrita debe aparecer (al principio de una palabra del nombre o de las claves);
 * salen primero los que coinciden con el nombre (y, entre esos, el nombre más corto: «Reloj» antes que
 * «Reloj de arena»). Sin texto, devuelve los de la categoría (o todos).
 */
export function searchIcons(query: string, category: string | null = null): RawIcon[] {
  const words = fold(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (words.length === 0) return category ? RAW_ICONS.filter((i) => i.cat === category) : [...RAW_ICONS]

  const whole = words.join(' ')
  const hits: Array<{ icon: RawIcon; score: number; len: number; order: number }> = []
  entries.forEach((e, order) => {
    let score = 0
    for (const w of words) {
      if (e.name.some((t) => t.startsWith(w))) score += 3
      else if (e.tags.some((t) => t.startsWith(w))) score += 2
      else if (e.name.some((t) => t.includes(w)) || e.tags.some((t) => t.includes(w))) score += 1
      else return
    }
    if (e.full === whole) score += 4
    hits.push({ icon: e.icon, score, len: e.full.length, order })
  })
  hits.sort((a, b) => b.score - a.score || a.len - b.len || a.order - b.order)
  return hits.map((h) => h.icon)
}
