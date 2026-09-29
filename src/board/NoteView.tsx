import { memo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BASE_NOTE_SIZE, fontById } from '../lib/fonts'
import { darken, inkFor, lighten, pickTape } from '../lib/palette'
import { seeded } from '../lib/seed'
import { useStore } from '../store/store'
import { NoteEditor } from './NoteEditor'
import { StickerView } from './StickerView'

const cx = (...parts: Array<string | false | undefined>): string => parts.filter(Boolean).join(' ')

/**
 * Un posit realista: papel de color con esquina doblada, cinta adhesiva y sombra suave.
 * Todo lo "aleatorio" (inclinación y color de la cinta) sale del id, así que se ve
 * igual en la PC y en el celular.
 */
export const NoteView = memo(function NoteView({ id }: { id: string }) {
  const note = useStore((s) => s.notes[id])
  const selected = useStore((s) => s.selectedId === id)
  const editing = useStore((s) => s.editingId === id)
  // Íconos pegados a este posit (de atrás hacia adelante). Se mueven, cambian de tamaño y se borran con él.
  const stickerIds = useStore(
    useShallow((s) =>
      Object.values(s.stickers)
        .filter((st) => st.noteId === id)
        .sort((a, b) => a.z - b.z)
        .map((st) => st.id),
    ),
  )
  const [fresh] = useState(() => (note ? Date.now() - note.createdAt < 900 : false))

  if (!note) return null

  const font = fontById(note.font)
  const style = {
    transform: `translate(${note.x}px, ${note.y}px)`,
    width: note.w,
    zIndex: note.z,
    '--note-color': note.color,
    '--note-ink': inkFor(note.color),
    '--note-font': font.stack,
    '--note-size': `${(BASE_NOTE_SIZE * font.scale).toFixed(1)}px`,
    '--note-min-h': `${note.h}px`,
    '--note-back-a': lighten(note.color, 0.6),
    '--note-back-b': darken(note.color, 0.1),
    '--tape-rot': `${((seeded(id, 1) - 0.5) * 7).toFixed(2)}deg`,
    '--tape-color': pickTape(seeded(id, 2), note.color),
    '--tape-x': `${((seeded(id, 3) - 0.5) * 26).toFixed(1)}%`,
  } as CSSProperties

  return (
    <div
      className={cx('note', selected && 'is-selected', editing && 'is-editing', fresh && 'is-fresh')}
      data-note-id={id}
      style={style}
      role="group"
      aria-label="Posit"
    >
      <div className="note-visual">
        <div className="paper">
          <div className="paper-grip" data-drag-zone />
          <NoteEditor id={id} initialDoc={note.doc} editing={editing} />
        </div>
        <div className="fold-wrap" aria-hidden="true">
          <div className="fold" />
        </div>
        <div className="tape" data-drag-zone aria-hidden="true" />
      </div>
      <div className="note-grip" data-drag-zone aria-hidden="true" />
      <div className="note-stickers">
        {stickerIds.map((sid) => (
          <StickerView key={sid} id={sid} />
        ))}
      </div>
      {selected && <div className="selection-ring" aria-hidden="true" />}
      {selected && <div className="resize-handle" data-resize="both" aria-hidden="true" />}
      {selected && <div className="resize-handle" data-resize="x" aria-hidden="true" />}
      {selected && <div className="resize-handle" data-resize="y" aria-hidden="true" />}
    </div>
  )
})
