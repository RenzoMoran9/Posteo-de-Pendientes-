import type { Editor } from '@tiptap/core'
import { store } from '../store/store'

const editors = new Map<string, Editor>()

export function registerEditor(id: string, editor: Editor): () => void {
  editors.set(id, editor)
  return () => {
    if (editors.get(id) === editor) editors.delete(id)
  }
}

export const getEditor = (id: string): Editor | undefined => editors.get(id)

/**
 * Pone el posit en modo escritura. Todo lo que abre el teclado del celular
 * ocurre aquí, de forma síncrona, dentro del gesto del usuario (iOS lo exige).
 */
export function beginEditing(id: string, at?: { x: number; y: number }): void {
  store.getState().startEditing(id)
  const ed = editors.get(id)
  if (!ed) return
  ed.setEditable(true)
  if (at) {
    const hit = ed.view.posAtCoords({ left: at.x, top: at.y })
    if (hit) {
      ed.chain().focus().setTextSelection(hit.pos).run()
      return
    }
  }
  ed.commands.focus('end')
}

/** Cierra el teclado y deja el posit solo seleccionado. */
export function endEditing(): void {
  const s = store.getState()
  const id = s.editingId
  if (id) editors.get(id)?.commands.blur()
  s.stopEditing()
  const a = document.activeElement
  if (a instanceof HTMLElement && a !== document.body) a.blur()
}
