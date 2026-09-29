/**
 * Número estable en [0, 1) derivado de un texto.
 * Sirve para variaciones "al azar" (inclinación de la cinta, color de la cinta…)
 * que deben verse igual en la PC y en el celular, y no cambiar entre recargas.
 */
export function seeded(key: string, salt = 0): number {
  let h = (2166136261 ^ salt) >>> 0
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}
