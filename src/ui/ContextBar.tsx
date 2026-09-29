import type { SyntheticEvent } from 'react'
import { Check, Copy, Trash } from 'lucide-react'
import { endEditing } from '../board/editors'
import { store, useStore } from '../store/store'

/** No robar el foco al editor: así el teclado del celular no se cierra al tocar estos botones. */
const keepFocus = (e: SyntheticEvent) => e.preventDefault()

/** Acciones del posit seleccionado: aparece encima del estuche. */
export function ContextBar() {
  const selectedId = useStore((s) => s.selectedId)
  const editing = useStore((s) => s.editingId !== null)
  if (!selectedId) return null

  return (
    <div
      className="ctx hand-box"
      role="toolbar"
      aria-label="Acciones del posit"
      onMouseDown={keepFocus}
      onPointerDown={keepFocus}
    >
      {editing && (
        <button type="button" className="ctx-btn is-primary" onClick={endEditing}>
          <Check aria-hidden="true" />
          <span>Listo</span>
        </button>
      )}
      <button type="button" className="ctx-btn" onClick={() => store.getState().duplicateNote(selectedId)}>
        <Copy aria-hidden="true" />
        <span>Duplicar</span>
      </button>
      <button type="button" className="ctx-btn is-danger" onClick={() => store.getState().deleteNote(selectedId)}>
        <Trash aria-hidden="true" />
        <span>Borrar</span>
      </button>
    </div>
  )
}
