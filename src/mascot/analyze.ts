import type { JSONContent } from '@tiptap/core'
import { fold } from '../icons/catalog'

/**
 * Lo que la mascota "entiende" de un posit. Todo es local y por reglas: mira las palabras que escribes
 * (sin importar tildes ni mayúsculas) y cuenta pendientes; no envía nada a ninguna parte.
 */
export type Tag =
  | 'stress'
  | 'urgent'
  | 'shout'
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'time'
  | 'money'
  | 'docs'
  | 'health'
  | 'call'
  | 'mail'
  | 'meeting'
  | 'question'

export interface NoteFacts {
  /** Todo el texto del posit, un renglón por línea. */
  text: string
  lines: string[]
  /** Pendientes con casilla y cuántos están hechos. */
  tasks: number
  done: number
  /** Renglones de viñeta. */
  bullets: number
  /** Renglones de texto suelto (fuera de listas). */
  plainLines: number
  /** Íconos metidos dentro del texto. */
  icons: string[]
}

interface Walk {
  lines: string[]
  tasks: number
  done: number
  bullets: number
  plainLines: number
  icons: string[]
}

function textOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return ' '
  return (node.content ?? []).map(textOf).join('')
}

function walk(node: JSONContent, inList: boolean, out: Walk): void {
  switch (node.type) {
    case 'taskItem':
      out.tasks += 1
      if (node.attrs?.checked) out.done += 1
      inList = true
      break
    case 'listItem':
      out.bullets += 1
      inList = true
      break
    case 'paragraph':
    case 'heading': {
      const t = textOf(node).trim()
      if (t) {
        out.lines.push(t)
        if (!inList) out.plainLines += 1
      }
      for (const child of node.content ?? []) if (child.type === 'inlineIcon') out.icons.push(String(child.attrs?.icon ?? ''))
      return
    }
    default:
      break
  }
  for (const child of node.content ?? []) walk(child, inList, out)
}

export function factsOf(doc: JSONContent | null | undefined): NoteFacts {
  const out: Walk = { lines: [], tasks: 0, done: 0, bullets: 0, plainLines: 0, icons: [] }
  if (doc) walk(doc, false, out)
  return { text: out.lines.join('\n'), ...out }
}

/** Cada regla se prueba sobre el texto sin tildes ni mayúsculas. Sin «lookbehind» (no existe en iPhone viejos). */
const RULES: ReadonlyArray<readonly [Tag, RegExp]> = [
  ['stress', /no llego|agotad|cansad|estres|abrumad|no puedo|dificil|mucho trabajo|saturad|harto|me rindo|no doy mas/],
  ['urgent', /urgent|inmediat|cuanto antes|\basap\b|critic|prioridad|ultimo dia|vence|vencimiento|\bplazo|sin falta|ahora mismo|ya mismo|no puede esperar/],
  ['today', /\bhoy\b|esta tarde|esta manana|esta noche|antes de las|al cierre|al mediodia/],
  ['tomorrow', /\bmanana\b|pasado manana/],
  ['week', /esta semana|fin de semana|fin de mes|proxima semana|\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/],
  ['time', /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(am|pm|h|hs|hrs)\b|\ba las \d/],
  ['money', /\bs\/|\bsoles\b|\bmonto|presupuesto|\bpago\b|pagar|factura|cotiz|proforma|orden de compra|\boc\b|precio|costo|cheque|deposito|saldo|\d[.,]\d{3}\b/],
  ['docs', /licitacion|adjudicacion|contrato|\btdr\b|terminos de referencia|\bbases\b|\bacta\b|expediente|\bsiga\b|\bseace\b|requerimiento|conformidad|proveedor|adenda|visto bueno|\bfirma|\bsello/],
  ['health', /paciente|hospital|quirofano|farmacia|medicament|insumo|material medico|equipo medico|laboratorio|emergencia|\buci\b|reactivo|jeringa|mascarilla|\bstock\b|almacen/],
  ['call', /llamar|llamada|\bllamo\b|telefon|contestar/],
  ['mail', /correo|e-?mail|\bmail\b|enviar|responder|adjunt|oficio|\bcarta\b|\bmemo\b/],
  ['meeting', /reunion|\bjunta\b|\bcita\b|comite|coordinar|videollamada|\bzoom\b|agendar/],
]

/** Etiquetas de un texto, de la más importante a la menos. */
export function tagsOf(text: string): Tag[] {
  const tags: Tag[] = []
  const letters = text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '')
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, '')
  const shouting = letters.length >= 6 && upper.length / letters.length >= 0.8
  const folded = fold(text)
  const has = (re: RegExp) => re.test(folded)

  for (const [tag, re] of RULES) {
    if (tag === 'tomorrow') {
      // «esta mañana» es de hoy, no de mañana
      const rest = folded.replace(/esta manana/g, ' ')
      if (re.test(rest)) tags.push(tag)
      continue
    }
    if (has(re)) tags.push(tag)
  }
  if (text.includes('?') || text.includes('¿')) tags.push('question')
  if (shouting) tags.push('shout')

  const order: Tag[] = ['stress', 'urgent', 'shout', 'today', 'tomorrow', 'week', 'time', 'money', 'docs', 'health', 'call', 'mail', 'meeting', 'question']
  return tags.sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/** Pendientes sin marcar de un posit, y cuáles suenan urgentes (por sus palabras). */
export function openTasksOf(doc: JSONContent | null | undefined): { open: number; urgent: number } {
  let open = 0
  let urgent = 0
  const visit = (n: JSONContent) => {
    if (n.type === 'taskItem') {
      if (!n.attrs?.checked) {
        open += 1
        const tags = tagsOf(textOf(n))
        if (tags.includes('urgent') || tags.includes('today') || tags.includes('shout')) urgent += 1
      }
      return
    }
    for (const c of n.content ?? []) visit(c)
  }
  if (doc) visit(doc)
  return { open, urgent }
}
