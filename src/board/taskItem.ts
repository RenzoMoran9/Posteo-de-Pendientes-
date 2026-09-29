import { TaskItem } from '@tiptap/extension-list'
import type { Node as PMNode } from '@tiptap/pm/model'
import { seeded } from '../lib/seed'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Casilla dibujada a mano: un cuadrado medio chueco y una palomita de un solo trazo. */
function buildCheckbox(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'task-box')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const frame = document.createElementNS(SVG_NS, 'path')
  frame.setAttribute('class', 'task-box-frame')
  frame.setAttribute('d', 'M4.6 4.3 C9.2 3.7 15 4 19.6 4.2 C20 9 19.8 14.6 19.7 19.6 C14.6 20.1 9.2 19.8 4.3 19.9 C4 14.8 4.2 9.2 4.6 4.3 Z')
  const tick = document.createElementNS(SVG_NS, 'path')
  tick.setAttribute('class', 'task-box-tick')
  tick.setAttribute('d', 'M6 12.8 C7.6 14.2 9.2 15.8 10.5 17.5 C12.7 13.6 15.5 9.4 19 5.2')
  svg.append(frame, tick)
  return svg
}

interface Line {
  x1: number
  x2: number
  y: number
}

/**
 * Líneas reales del texto (una por renglón visual), medidas en el espacio del propio pendiente.
 * Se usa cada nodo de texto por separado: `getClientRects` del contenedor devolvería
 * cajas de párrafo enteras, no renglones.
 */
function measureLines(content: HTMLElement, body: HTMLElement): Line[] {
  const bodyRect = body.getBoundingClientRect()
  // El tablero puede estar con zoom: pasamos de píxeles de pantalla a unidades del posit.
  const sx = body.offsetWidth ? bodyRect.width / body.offsetWidth : 1
  const sy = body.offsetHeight ? bodyRect.height / body.offsetHeight : sx

  const boxes: Array<{ l: number; r: number; t: number; b: number }> = []
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!(n as Text).data.trim()) continue
    range.selectNodeContents(n)
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 0.5 || r.height < 0.5) continue
      const mid = (r.top + r.bottom) / 2
      const same = boxes.find((b) => Math.abs((b.t + b.b) / 2 - mid) < r.height * 0.45)
      if (same) {
        same.l = Math.min(same.l, r.left)
        same.r = Math.max(same.r, r.right)
        same.t = Math.min(same.t, r.top)
        same.b = Math.max(same.b, r.bottom)
      } else {
        boxes.push({ l: r.left, r: r.right, t: r.top, b: r.bottom })
      }
    }
  }
  boxes.sort((a, b) => a.t - b.t)

  // Altura a la que va el trazo: la mitad de las minúsculas (línea base menos media altura de la "x"),
  // calculada con las métricas de la letra real; así vale para cualquier fuente.
  const cs = getComputedStyle(content)
  const m = fontMetrics(cs)

  return boxes.map((b) => {
    const boxTop = (b.t - bodyRect.top) / sy
    const boxH = (b.b - b.t) / sy
    const y = m ? boxTop + m.ascent - m.xHeight * 0.5 : boxTop + boxH * 0.52
    return { x1: (b.l - bodyRect.left) / sx, x2: (b.r - bodyRect.left) / sx, y }
  })
}

let metricsCtx: CanvasRenderingContext2D | null | undefined
const metricsCache = new Map<string, { ascent: number; xHeight: number } | null>()

/** Ascenso de la fuente y altura de la "x", en píxeles del posit (sin zoom). */
function fontMetrics(cs: CSSStyleDeclaration): { ascent: number; xHeight: number } | null {
  if (!cs.fontSize || !cs.fontFamily) return null // elemento ya fuera de la página
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const cached = metricsCache.get(font)
  if (cached !== undefined) return cached
  if (metricsCtx === undefined) metricsCtx = document.createElement('canvas').getContext('2d')
  let result: { ascent: number; xHeight: number } | null = null
  if (metricsCtx) {
    metricsCtx.font = font
    const t = metricsCtx.measureText('x')
    if (t.fontBoundingBoxAscent > 0 && t.actualBoundingBoxAscent > 0) {
      result = { ascent: t.fontBoundingBoxAscent, xHeight: t.actualBoundingBoxAscent }
    }
  }
  // No se guarda si la fuente aún no carga (las métricas saldrían de la fuente de reemplazo).
  try {
    if (document.fonts?.check(font)) metricsCache.set(font, result)
  } catch {
    /* fuente no interpretable: se usa la estimación */
  }
  return result
}

function pencilPath(cls: string, d: string): SVGPathElement {
  const p = document.createElementNS(SVG_NS, 'path')
  p.setAttribute('class', cls)
  p.setAttribute('d', d)
  return p
}

/**
 * Pendiente con casilla dibujada a mano y tachado de lápiz.
 *
 * Diferencias con el `TaskItem` de TipTap:
 *  - la casilla se puede marcar aunque el posit no esté en modo escritura
 *    (así se palomean pendientes desde el celular sin abrir el teclado);
 *  - al marcar, un trazo de lápiz recorre cada renglón (medido sobre el texto real);
 *  - no hay animación al cargar un pendiente que ya estaba marcado.
 */
export const PencilTaskItem = TaskItem.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current: PMNode = node

      const li = document.createElement('li')
      li.className = 'task-item'
      li.dataset.type = 'taskItem'

      const label = document.createElement('label')
      label.className = 'task-check'
      label.contentEditable = 'false'
      label.setAttribute('data-no-drag', '')
      const input = document.createElement('input')
      input.type = 'checkbox'
      label.append(input, buildCheckbox())

      const body = document.createElement('div')
      body.className = 'task-body'
      const content = document.createElement('div')
      content.className = 'task-content'
      const strike = document.createElementNS(SVG_NS, 'svg')
      strike.setAttribute('class', 'task-strike')
      strike.setAttribute('aria-hidden', 'true')
      strike.setAttribute('focusable', 'false')
      body.append(content, strike)
      li.append(label, body)

      const sync = (n: PMNode) => {
        const checked = !!n.attrs.checked
        li.dataset.checked = String(checked)
        input.checked = checked
        const text = n.textContent.trim() || 'pendiente vacío'
        input.setAttribute('aria-label', checked ? `Desmarcar: ${text}` : `Marcar como hecho: ${text}`)
      }
      sync(node)

      // ── trazo de lápiz ──
      let raf = 0
      let destroyed = false
      const draw = (animate: boolean) => {
        if (destroyed || !li.isConnected) return
        strike.replaceChildren()
        if (!current.attrs.checked) return
        const lines = measureLines(content, body)
        if (lines.length === 0) return

        const w = body.offsetWidth
        const h = body.offsetHeight
        strike.setAttribute('viewBox', `0 0 ${w} ${h}`)

        const scale = parseFloat(getComputedStyle(li).getPropertyValue('--anim-scale')) || 1
        const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
        const doAnimate = animate && !reduce
        const seed = current.textContent
        let clock = 0
        const paths: Array<{ el: SVGPathElement; dur: number; delay: number }> = []

        lines.forEach((ln, i) => {
          const wob = (k: number) => seeded(seed, i * 11 + k) - 0.5
          const x1 = ln.x1 - 3
          const x2 = ln.x2 + 5
          const span = x2 - x1
          const y = ln.y
          const main = pencilPath(
            'main',
            `M${x1} ${y + wob(0) * 2.4} C${x1 + span * 0.3} ${y - 1.6 + wob(1) * 2.4}, ${x1 + span * 0.66} ${y + 1.7 + wob(2) * 2.4}, ${x2} ${y - 0.4 + wob(3) * 2.4}`,
          )
          const second = pencilPath(
            'second',
            `M${x1 + 5} ${y + 2.4 + wob(4)} C${x1 + span * 0.35} ${y + 0.6 + wob(5) * 1.6}, ${x1 + span * 0.7} ${y + 3 + wob(6) * 1.6}, ${x2 - 4} ${y + 1.4 + wob(7)}`,
          )
          strike.append(main, second)
          const dur = Math.min(0.62, Math.max(0.24, span / 560)) * scale
          paths.push({ el: main, dur, delay: clock })
          paths.push({ el: second, dur: dur * 0.9, delay: clock + 0.1 * scale })
          clock += dur + 0.04 * scale
        })

        for (const p of paths) {
          const len = Math.ceil(p.el.getTotalLength()) + 2
          p.el.style.strokeDasharray = `${len} ${len}`
          p.el.style.strokeDashoffset = doAnimate ? String(len) : '0'
          p.el.style.transition = 'none'
        }
        if (!doAnimate) return
        void strike.getBoundingClientRect() // fija el estado inicial antes de animar
        for (const p of paths) {
          p.el.style.transition = `stroke-dashoffset ${p.dur}s cubic-bezier(0.3, 0.1, 0.4, 1) ${p.delay}s`
          p.el.style.strokeDashoffset = '0'
        }
      }
      const drawSoon = (animate: boolean) => {
        if (destroyed) return
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => draw(animate))
      }

      // Cambios que mueven o alargan los renglones: tamaño del posit, texto editado, letra que termina de cargar.
      const resizeObserver = new ResizeObserver(() => drawSoon(false))
      resizeObserver.observe(body)
      const mutationObserver = new MutationObserver(() => drawSoon(false))
      mutationObserver.observe(content, { childList: true, subtree: true, characterData: true })
      void document.fonts?.ready.then(() => drawSoon(false))
      // una letra que se elige después (y carga en ese momento) también mueve los renglones
      const onFontsLoaded = () => drawSoon(false)
      document.fonts?.addEventListener?.('loadingdone', onFontsLoaded)
      if (node.attrs.checked) drawSoon(false)

      input.addEventListener('mousedown', (e) => e.preventDefault()) // no roba el foco al escribir
      input.addEventListener('change', () => {
        const checked = input.checked
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (typeof pos !== 'number') {
          input.checked = !checked
          return
        }
        // Se guarda igual con el posit cerrado: un cambio de estado no necesita el teclado.
        const { view } = editor
        const attrs = view.state.doc.nodeAt(pos)?.attrs
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...attrs, checked }))
        if (checked) {
          try {
            navigator.vibrate?.(8)
          } catch {
            /* algunos navegadores lo bloquean: no importa */
          }
        }
      })

      return {
        dom: li,
        contentDOM: content,
        update: (updated: PMNode) => {
          if (updated.type !== current.type) return false
          const was = !!current.attrs.checked
          const now = !!updated.attrs.checked
          const textChanged = updated.textContent !== current.textContent
          current = updated
          sync(updated)
          if (!was && now) drawSoon(true)
          else if (was && !now) strike.replaceChildren()
          else if (now && textChanged) drawSoon(false)
          return true
        },
        // Lo que ocurre fuera del texto (casilla, trazo, atributos) no es una edición del documento.
        ignoreMutation: (m: { target: Node; type: string }) => m.type !== 'selection' && !content.contains(m.target),
        destroy: () => {
          destroyed = true
          cancelAnimationFrame(raf)
          resizeObserver.disconnect()
          mutationObserver.disconnect()
          document.fonts?.removeEventListener?.('loadingdone', onFontsLoaded)
        },
      }
    }
  },
})
