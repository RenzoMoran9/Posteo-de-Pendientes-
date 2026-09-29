import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Check, Copy, List, ListChecks, Minus, Plus, RotateCcw, RotateCw, Smile, Trash, Type } from 'lucide-react'
import { revealNote, rotateSticker } from '../board/actions'
import { endEditing } from '../board/editors'
import { toggleBullets, toggleTasks } from '../board/listCommands'
import { useEditorOf, useListFlags } from '../hooks/useActiveEditor'
import { scaleRange } from '../lib/geometry'
import { NOTE_SCALE, STICKER_LIMITS, noteScale, store, useStore } from '../store/store'
import { FormatPanel } from './FormatPanel'

/** No robar el foco al editor: así el teclado del celular no se cierra al tocar estos botones. */
const keepFocus = (e: SyntheticEvent) => e.preventDefault()

/** Cambia el tamaño de un ícono desde su centro (más cómodo con el dedo que el tirador). */
function resizeSticker(id: string, factor: number): void {
  const s = store.getState()
  const st = s.stickers[id]
  if (!st) return
  const size = Math.min(STICKER_LIMITS.max, Math.max(STICKER_LIMITS.min, Math.round(st.size * factor)))
  const grow = size - st.size
  s.patchSticker(id, { size, x: st.x - grow / 2, y: st.y - grow / 2 })
}

/** Agranda o achica un posit entero (papel, letra e íconos pegados): la misma escala que da la esquina, pero con un toque. */
function scaleNote(id: string, factor: number): void {
  const s = store.getState()
  const n = s.notes[id]
  if (!n) return
  const range = scaleRange(n.w, NOTE_SCALE)
  const k = Math.min(range.max, Math.max(range.min, noteScale(n) * factor))
  if (Math.abs(k - noteScale(n)) < 1e-6) return
  s.resizeNote(id, { scale: k })
  if (factor > 1) revealNote(id) // más grande, puede quedar bajo las barras
}

/**
 * Acciones de lo seleccionado (encima del estuche).
 * Posit: Duplicar · más pequeño · más grande · Letra · Borrar. Escribiendo: «Listo» + viñetas + pendientes + ícono + letra/estilo + borrar.
 * Ícono pegado: Duplicar · más pequeño · más grande · girar a la izquierda · girar a la derecha · Borrar.
 */
export function ContextBar() {
  const selectedId = useStore((s) => s.selectedId)
  const stickerId = useStore((s) => s.selectedStickerId)
  const editingId = useStore((s) => s.editingId)
  const textPanel = useStore((s) => s.iconPanel?.mode === 'text')
  const editor = useEditorOf(editingId)
  const { bullets, tasks } = useListFlags(editor)
  const [formatOpen, setFormatOpen] = useState(false)
  const editing = editingId !== null

  // La letra y el estilo se cierran al tocar fuera, al terminar de escribir o al cambiar de selección.
  useEffect(() => {
    if (!formatOpen) return
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest('[data-format-panel], [data-format-btn]')) setFormatOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setFormatOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [formatOpen])
  useEffect(() => setFormatOpen(false), [editing, selectedId, stickerId])

  const formatBtn = (
    <button
      type="button"
      className="ctx-btn"
      aria-pressed={formatOpen}
      aria-label="Letra y estilo del texto"
      title="Letra y estilo"
      data-format-btn
      onClick={() => {
        store.getState().closeIcons()
        setFormatOpen((o) => !o)
      }}
    >
      <Type aria-hidden="true" />
      <span className="ctx-label">Letra</span>
    </button>
  )

  if (stickerId) {
    return (
      <div
        className="ctx hand-box is-sticker"
        role="toolbar"
        aria-label="Acciones del ícono"
        onMouseDown={keepFocus}
        onPointerDown={keepFocus}
      >
        <button type="button" className="ctx-btn" aria-label="Duplicar ícono" onClick={() => store.getState().duplicateSticker(stickerId)}>
          <Copy aria-hidden="true" />
          <span className="ctx-label">Duplicar</span>
        </button>
        <button type="button" className="ctx-btn" aria-label="Ícono más pequeño" title="Más pequeño (−)" onClick={() => resizeSticker(stickerId, 1 / 1.25)}>
          <Minus aria-hidden="true" />
        </button>
        <button type="button" className="ctx-btn" aria-label="Ícono más grande" title="Más grande (+)" onClick={() => resizeSticker(stickerId, 1.25)}>
          <Plus aria-hidden="true" />
        </button>
        <button type="button" className="ctx-btn" aria-label="Girar a la izquierda" title="Girar a la izquierda ( [ )" onClick={() => rotateSticker(stickerId, -1)}>
          <RotateCcw aria-hidden="true" />
        </button>
        <button type="button" className="ctx-btn" aria-label="Girar a la derecha" title="Girar a la derecha ( ] )" onClick={() => rotateSticker(stickerId, 1)}>
          <RotateCw aria-hidden="true" />
        </button>
        <button type="button" className="ctx-btn is-danger" aria-label="Borrar ícono" onClick={() => store.getState().deleteSticker(stickerId)}>
          <Trash aria-hidden="true" />
          <span className="ctx-label">Borrar</span>
        </button>
      </div>
    )
  }

  if (!selectedId) return null

  return (
    <div
      className={`ctx hand-box${editing ? ' is-editing' : ' is-note'}`}
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
            className="ctx-btn"
            aria-pressed={textPanel}
            aria-label="Poner un ícono en el texto"
            title="Ícono en el texto"
            data-icon-panel
            onClick={() => {
              const s = store.getState()
              if (s.iconPanel?.mode === 'text') s.closeIcons()
              else s.openIcons({ mode: 'text', noteId: selectedId })
            }}
          >
            <Smile aria-hidden="true" />
            <span className="ctx-label">Ícono</span>
          </button>
          {formatBtn}
          <button
            type="button"
            className="ctx-btn is-danger ctx-trash"
            aria-label="Borrar posit"
            title="Borrar posit"
            onClick={() => store.getState().deleteNote(selectedId)}
          >
            <Trash aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <button type="button" className="ctx-btn" aria-label="Duplicar posit" onClick={() => store.getState().duplicateNote(selectedId)}>
            <Copy aria-hidden="true" />
            <span className="ctx-label">Duplicar</span>
          </button>
          <button type="button" className="ctx-btn" aria-label="Posit más pequeño" title="Achicar el posit (todo: papel, letra e íconos)" onClick={() => scaleNote(selectedId, 1 / 1.15)}>
            <Minus aria-hidden="true" />
          </button>
          <button type="button" className="ctx-btn" aria-label="Posit más grande" title="Agrandar el posit (todo: papel, letra e íconos)" onClick={() => scaleNote(selectedId, 1.15)}>
            <Plus aria-hidden="true" />
          </button>
          {formatBtn}
          <button type="button" className="ctx-btn is-danger" aria-label="Borrar posit" onClick={() => store.getState().deleteNote(selectedId)}>
            <Trash aria-hidden="true" />
            <span className="ctx-label">Borrar</span>
          </button>
        </>
      )}
      {formatOpen && <FormatPanel noteId={selectedId} editor={editor} editing={editing} />}
    </div>
  )
}
