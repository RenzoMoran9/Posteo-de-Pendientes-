import { getIcon } from './catalog'
import { ICON_COLORS } from './data.generated'

/** Cuánto se corre el relleno respecto al contorno (como cuando el marcador se pasa de la raya). Igual que scripts/icons/render.mjs. */
const FILL_DX = 1.5
const FILL_DY = 1.2

const cache = new Map<string, string>()

/**
 * El dibujo de un ícono como texto SVG. Se usa igual en el tablero, en el panel y dentro del texto de un
 * posit (allí no hay React), y se guarda en memoria para no rehacerlo. Los estilos de línea están en icons.css.
 */
export function iconMarkup(id: string): string {
  const hit = cache.get(id)
  if (hit !== undefined) return hit
  const icon = getIcon(id)
  let out = ''
  if (icon) {
    let body = ''
    for (const [d, fill, stroke, shifted] of icon.shapes) {
      if (fill) {
        const color = fill === 'ink' ? '' : ` fill="${ICON_COLORS[fill]}"`
        body += `<path class="f${fill === 'ink' ? ' f-ink' : ''}"${color}${shifted ? ` transform="translate(${FILL_DX} ${FILL_DY})"` : ''} d="${d}"/>`
      }
      if (stroke !== 'n') {
        // una letra suelta = estilo de tinta (i, t, k, w, W); una palabra = línea de ese color
        const named = stroke.length > 1 ? ICON_COLORS[stroke] : undefined
        body += `<path class="s s-${named ? 'c' : stroke}"${named ? ` stroke="${named}"` : ''} d="${d}"/>`
      }
    }
    out = `<svg class="ic" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${body}</svg>`
  }
  cache.set(id, out)
  return out
}
