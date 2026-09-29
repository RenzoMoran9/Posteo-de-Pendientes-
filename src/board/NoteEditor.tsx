import { useEffect } from 'react'
import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { store } from '../store/store'
import { keepCaretVisible } from './caret'
import { registerEditor } from './editors'
import { noteExtensions } from './extensions'

interface Props {
  id: string
  initialDoc: JSONContent | null
  editing: boolean
}

export function NoteEditor({ id, initialDoc, editing }: Props) {
  const editor = useEditor({
    extensions: noteExtensions,
    content: initialDoc ?? undefined,
    editable: false,
    editorProps: {
      attributes: {
        class: 'note-text',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Texto del posit',
        spellcheck: 'true',
        autocapitalize: 'sentences',
        autocorrect: 'on',
      },
    },
    onUpdate: ({ editor: ed }) => store.getState().setDoc(id, ed.getJSON()),
    onBlur: () => store.getState().stopEditing(id),
    onSelectionUpdate: () => keepCaretVisible(),
  })

  useEffect(() => (editor ? registerEditor(id, editor) : undefined), [editor, id])

  useEffect(() => {
    if (!editor) return
    if (!editing) {
      if (editor.isEditable) editor.setEditable(false)
      return
    }
    if (!editor.isEditable) editor.setEditable(true)

    const focusNow = () => {
      if (editor.isDestroyed || editor.isFocused) return
      if (store.getState().editingId !== id) return
      editor.commands.focus('end')
    }
    // Primer intento inmediato (dentro del toque, para iOS); luego reintentos por si el foco no "pega".
    focusNow()
    const timers = [60, 180, 400].map((ms) => setTimeout(focusNow, ms))
    return () => timers.forEach(clearTimeout)
  }, [editing, editor, id])

  return <EditorContent editor={editor} className="note-content" />
}
