/**
 * Letras manuscritas para los posits (todas con licencia libre y autoalojadas: se ven igual en PC y celular).
 * Cada posit guarda solo el `id`; aquí se traduce a la fuente y a su "ajuste de tamaño": cada letra tiene
 * una altura de minúscula distinta, y con el mismo tamaño en píxeles unas se verían diminutas y otras enormes.
 */
export interface NoteFont {
  id: string
  /** Nombre del instrumento con el que se «escribe» (el que sale en el estuche y en el selector de letra). */
  name: string
  /** Qué instrumento se dibuja en el estuche (ver src/ui/PenArt.tsx). */
  pen: PenKind
  /** Lista de fuentes CSS (con respaldo por si aún no carga). */
  stack: string
  /** Multiplica el tamaño base para que todas las letras se vean del mismo tamaño que «Pluma». */
  scale: number
}

export type PenKind = 'fountain' | 'ballpoint' | 'pencil' | 'fineliner' | 'brush' | 'felt' | 'mechanical' | 'chisel'

const fallback = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive"

/**
 * Cada tipo de letra es un instrumento de escritura: la pluma estilográfica escribe con trazo fluido, el lápiz con
 * letra de cuaderno, el marcador grueso con trazo pesado… Se eligen en el estuche de la barra de abajo.
 */
export const NOTE_FONTS: readonly NoteFont[] = [
  { id: 'kalam', name: 'Pluma', pen: 'fountain', stack: `'Kalam', ${fallback}`, scale: 1 },
  { id: 'caveat', name: 'Bolígrafo', pen: 'ballpoint', stack: `'Caveat', ${fallback}`, scale: 1.3 },
  { id: 'patrick', name: 'Lápiz', pen: 'pencil', stack: `'Patrick Hand', ${fallback}`, scale: 1.08 },
  { id: 'architects', name: 'Punta fina', pen: 'fineliner', stack: `'Architects Daughter', ${fallback}`, scale: 1.04 },
  { id: 'gochi', name: 'Pincel', pen: 'brush', stack: `'Gochi Hand', ${fallback}`, scale: 1.02 },
  { id: 'covered', name: 'Marcador', pen: 'felt', stack: `'Covered By Your Grace', ${fallback}`, scale: 1.08 },
  { id: 'altura', name: 'Portaminas', pen: 'mechanical', stack: `'Just Another Hand', ${fallback}`, scale: 1.25 },
  { id: 'marker', name: 'Marcador grueso', pen: 'chisel', stack: `'Permanent Marker', ${fallback}`, scale: 0.86 },
]

export const DEFAULT_FONT_ID = NOTE_FONTS[0].id

/** Tamaño de letra de un posit con la fuente por defecto (en unidades del tablero). */
export const BASE_NOTE_SIZE = 22

/** La fuente con ese id; si no existe (o no hay), la de siempre. */
export function fontById(id: string | null | undefined): NoteFont {
  return NOTE_FONTS.find((f) => f.id === id) ?? NOTE_FONTS[0]
}
