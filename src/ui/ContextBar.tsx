import type { SyntheticEvent } from 'react'
import { Check, Copy, List, ListChecks, Trash } from 'lucide-react'
import { endEditing } from '../board/editors'
import { toggleBullets, toggleTasks } from '../board/listCommands'
import { useEditorOf, useListFlags } from '../hooks/useActiveEditor'
import { store, useStore } from '../store/store'

/** No robar el foco al editor: así el teclado del celular no se cierra al tocar estos botones. */
const keepFocus = (e: SyntheticEvent) => e.preventDefault()

/**
 * Acciones del posit seleccionado (encima del estuche).
 * Al escribir, la barra pasa a ser la de edición: «Listo» + viñetas + pendientes + borrar.
 */
export function ContextBar() {
  const selectedId = useStore((s) => s.selectedId)
  const editingId = useStore((s) => s.editingId)
  const editor = useEditorOf(editingId)
  const { bullets, tasks } = useListFlags(editor)
  if (!selectedId) return null
  const editing = editingId !== null

  return (
    <div
      className={`ctx hand-box${editing ? ' is-editing' : ''}`}
      role="toolbar"
      aria-label={editing ? 'Escribiendo en el posit' : 'Acciones del posit'}
      onMouseDown={keepFocus}
      onPointerDown={keepFocus}
    >
      {editing ? (
        <>
          <button type="button" className="ctx-btn is-primary" onClick={endEditing}>
            <Check aria-hidden="true" />
            <span className="ctx-label">Listo</span>
          </button>
          <button
            type="button"
            className="ctx-btn"
            aria-pressed={bullets}
            aria-label="Viñetas"
            title="Viñetas (Ctrl+Mayús+8)"
            onClick={() => editor && toggleBullets(editor)}
          >
            <List aria-hidden="true" />
            <span className="ctx-label">Viñetas</span>
          </button>
          <button
            type="button"
            className="ctx-btn"
            aria-pressed={tasks}
            aria-label="Lista de pendientes"
            title="Lista de pendientes (Ctrl+Mayús+9)"
            onClick={() => editor && toggleTasks(editor)}
          >
            <ListChecks aria-hidden="true" />
            <span className="ctx-label">Pendientes</span>
          </button>
          <button
            type="button"
            className="ctx-btn is-danger"
            aria-label="Borrar posit"
            title="Borrar posit"
            onClick={() => store.getState().deleteNote(selectedId)}
          >
            <Trash aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <button type="button" className="ctx-btn" onClick={() => store.getState().duplicateNote(selectedId)}>
            <Copy aria-hidden="true" />
            <span className="ctx-label">Duplicar</span>
          </button>
          <button type="button" className="ctx-btn is-danger" onClick={() => store.getState().deleteNote(selectedId)}>
            <Trash aria-hidden="true" />
            <span className="ctx-label">Borrar</span>
          </button>
        </>
      )}
    </div>
  )
}
