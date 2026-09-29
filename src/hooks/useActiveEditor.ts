import { useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import { getEditor, subscribeEditors } from '../board/editors'

/** El editor del posit indicado (undefined mientras aún no existe). */
export function useEditorOf(id: string | null): Editor | undefined {
  return useSyncExternalStore(
    subscribeEditors,
    () => (id ? getEditor(id) : undefined),
    () => undefined,
  )
}

/** Qué lista tiene el cursor, para marcar los botones. La "foto" es una cadena corta (estable entre lecturas). */
export function useListFlags(editor: Editor | undefined): { bullets: boolean; tasks: boolean } {
  const key = useSyncExternalStore(
    (cb) => {
      if (!editor) return () => {}
      editor.on('transaction', cb)
      return () => {
        editor.off('transaction', cb)
      }
    },
    () => (editor && !editor.isDestroyed ? `${editor.isActive('bulletList') ? 1 : 0}${editor.isActive('taskList') ? 1 : 0}` : '00'),
    () => '00',
  )
  return { bullets: key[0] === '1', tasks: key[1] === '1' }
}

/** Qué estilos tiene el texto bajo el cursor (o la selección), para marcar los botones N / K / S. */
export function useMarkFlags(editor: Editor | undefined): { bold: boolean; italic: boolean; underline: boolean } {
  const key = useSyncExternalStore(
    (cb) => {
      if (!editor) return () => {}
      editor.on('transaction', cb)
      return () => {
        editor.off('transaction', cb)
      }
    },
    () =>
      editor && !editor.isDestroyed
        ? `${editor.isActive('bold') ? 1 : 0}${editor.isActive('italic') ? 1 : 0}${editor.isActive('underline') ? 1 : 0}`
        : '000',
    () => '000',
  )
  return { bold: key[0] === '1', italic: key[1] === '1', underline: key[2] === '1' }
}
