import { store } from '../store/store'
import { getEditor } from './editors'
import { view } from './view'

let raf = 0

/**
 * Mientras se escribe, mantiene el cursor a la vista: si el teclado tapa la línea
 * actual (o se sale por un borde), desplaza el tablero lo justo.
 */
export function keepCaretVisible(): void {
  if (raf) cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    raf = 0
    const id = store.getState().editingId
    if (!id) return
    const ed = getEditor(id)
    if (!ed || !ed.isFocused) return

    let c: { top: number; bottom: number; left: number; right: number }
    try {
      c = ed.view.coordsAtPos(ed.state.selection.head)
    } catch {
      return
    }

    const r = view.rect()
    const ins = view.insets()
    const margin = 14
    const top = r.top + ins.top + margin
    const bottom = r.top + r.height - ins.bottom - margin
    const left = r.left + ins.left + margin
    const right = r.left + r.width - ins.right - margin

    let dy = 0
    let dx = 0
    if (c.bottom > bottom) dy = bottom - c.bottom
    else if (c.top < top) dy = top - c.top
    if (c.right > right) dx = right - c.right
    else if (c.left < left) dx = left - c.left
    if (dx || dy) view.panBy(dx, dy)
  })
}
