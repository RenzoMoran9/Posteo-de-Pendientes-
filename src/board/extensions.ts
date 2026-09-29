import { TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { PencilTaskItem } from './taskItem'

/**
 * Lo que se puede escribir dentro de un posit.
 *   Etapa 1: texto libre.
 *   Etapa 2: viñetas y lista de pendientes con casillas (con tachado de lápiz).
 *   Etapa 3 (después): negrita, cursiva, subrayado y letras a elegir.
 */
export const noteExtensions = [
  StarterKit.configure({
    blockquote: false,
    bold: false,
    code: false,
    codeBlock: false,
    dropcursor: false,
    gapcursor: false,
    heading: false,
    horizontalRule: false,
    italic: false,
    link: false,
    orderedList: false,
    strike: false,
    trailingNode: false,
    underline: false,
  }),
  TaskList,
  PencilTaskItem.configure({ nested: false }),
  Placeholder.configure({ placeholder: 'Escribe aquí…', showOnlyWhenEditable: false }),
]
