/**
 * Cómo viajan las propuestas de cambios dentro de la respuesta de Claude: al final del mensaje, entre las marcas
 * `<acciones>` y `</acciones>`, va una lista JSON. La persona lee el texto sin ese bloque; la app lo lee aparte,
 * lo revisa (actions.ts) y solo lo aplica si la persona pulsa «Aplicar».
 */

export const OPEN = '<acciones>'
export const CLOSE = '</acciones>'

export interface Reply {
  /** Lo que se le muestra a la persona (sin el bloque). */
  text: string
  /** Contenido de cada bloque `<acciones>` completo. */
  blocks: string[]
  /** Hubo un bloque que empezó y no se cerró (la respuesta se cortó). */
  cut: boolean
}

/** Separa la respuesta en texto legible y bloques de acciones. */
export function splitReply(full: string): Reply {
  const blocks: string[] = []
  let text = full.replace(/<acciones>([\s\S]*?)<\/acciones>/gi, (_m, body: string) => {
    blocks.push(body)
    return ''
  })
  let cut = false
  const open = text.search(/<acciones>/i)
  if (open >= 0) {
    cut = true
    text = text.slice(0, open)
  }
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), blocks, cut }
}

/** Mientras la respuesta llega a pedazos: el texto hasta donde empieza el bloque (que no se le enseña a nadie). */
export function visibleWhileStreaming(partial: string): string {
  const lower = partial.toLowerCase()
  const at = lower.indexOf('<acciones')
  if (at >= 0) return partial.slice(0, at).trimEnd()
  // «<», «<ac», «<accion»… al final: puede ser el comienzo de la marca; se espera a ver
  const lt = partial.lastIndexOf('<')
  if (lt >= 0 && OPEN.startsWith(lower.slice(lt)) && lower.length - lt < OPEN.length) return partial.slice(0, lt).trimEnd()
  return partial
}

const FENCE = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i

/** Lee los bloques: acepta una lista, un objeto suelto, comas de más y vallas de código. */
export function parseBlocks(blocks: string[]): { actions: unknown[]; error?: string } {
  const actions: unknown[] = []
  for (const raw of blocks) {
    let body = raw.trim()
    const fenced = FENCE.exec(body)
    if (fenced) body = fenced[1]
    if (!body) continue
    let value: unknown
    try {
      value = JSON.parse(body)
    } catch {
      try {
        value = JSON.parse(body.replace(/,\s*([\]}])/g, '$1'))
      } catch {
        return { actions, error: 'No pude leer la propuesta (el formato no era válido).' }
      }
    }
    if (Array.isArray(value)) actions.push(...value)
    else if (value && typeof value === 'object') actions.push(value)
  }
  return { actions }
}
