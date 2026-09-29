import type { Editor } from '@tiptap/core'
import { Bold, Italic, Underline } from 'lucide-react'
import { useMarkFlags } from '../hooks/useActiveEditor'
import { NOTE_FONTS, fontById } from '../lib/fonts'
import { store, useStore } from '../store/store'

/**
 * Letra y estilo del texto. La letra se elige para todo el posit; negrita, cursiva y subrayado
 * (solo mientras se escribe) afectan al texto seleccionado o al que se escriba a continuación.
 */
export function FormatPanel({ noteId, editor, editing }: { noteId: string; editor: Editor | undefined; editing: boolean }) {
  const current = useStore((s) => fontById(s.notes[noteId]?.font).id)
  const { bold, italic, underline } = useMarkFlags(editor)

  return (
    <div className="fmt-pop hand-box" role="dialog" aria-label="Letra y estilo del texto" data-format-panel>
      {editing && editor && (
        <div className="fmt-marks" role="group" aria-label="Estilo del texto">
          <button
            type="button"
            className="fmt-mark"
            aria-pressed={bold}
            aria-label="Negrita"
            title="Negrita (Ctrl+B)"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold aria-hidden="true" />
          </button>
          <button
            type="button"
            className="fmt-mark"
            aria-pressed={italic}
            aria-label="Cursiva"
            title="Cursiva (Ctrl+I)"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic aria-hidden="true" />
          </button>
          <button
            type="button"
            className="fmt-mark"
            aria-pressed={underline}
            aria-label="Subrayado"
            title="Subrayado (Ctrl+U)"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <Underline aria-hidden="true" />
          </button>
        </div>
      )}

      <p className="palette-title">Letra del posit</p>
      <div className="fmt-fonts" role="radiogroup" aria-label="Letra del posit">
        {NOTE_FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={current === f.id}
            className="fmt-font"
            data-font-id={f.id}
            onClick={() => store.getState().patchNote(noteId, { font: f.id })}
          >
            <span className="fmt-sample" style={{ fontFamily: f.stack, fontSize: `${(21 * f.scale).toFixed(1)}px` }}>
              Reunión hoy
            </span>
            <span className="fmt-name">{f.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
