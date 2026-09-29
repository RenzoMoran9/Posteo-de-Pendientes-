import { useEffect } from 'react'
import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { store } from '../store/store'
import { keepCaretVisible } from './caret'
import { registerEditor } from './editors'

/**
 * Etapa 1: solo texto libre (párrafos). Las viñetas y los pendientes con casilla
 * se activan en la Etapa 2, y la negrita/cursiva/subrayado en la Etapa 3.
 */
const extensions = [
  StarterKit.configure({
    blockquote: false,
    bold: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    dropcursor: false,
    gapcursor: false,
    heading: false,
    horizontalRule: false,
    italic: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    strike: false,
    trailingNode: false,
    underline: false,
  }),
  Placeholder.configure({ placeholder: 'Escribe aquí…', showOnlyWhenEditable: false }),
]

interface Props {
  id: string
  initialDoc: JSONContent | null
  editing: boolean
}

export function NoteEditor({ id, initialDoc, editing }: Props) {
  const editor = useEditor({
    extensions,
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
