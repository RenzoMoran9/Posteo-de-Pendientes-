import { TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { InlineIcon } from './inlineIcon'
import { PencilTaskItem } from './taskItem'

/**
 * Lo que se puede escribir dentro de un posit.
 *   Etapa 1: texto libre.
 *   Etapa 2: viñetas y lista de pendientes con casillas (con tachado de lápiz).
 *   Etapa 3: íconos dentro del texto; negrita, cursiva y subrayado (la letra se elige por posit, no aquí).
 */
export const noteExtensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    dropcursor: false,
    gapcursor: false,
    heading: false,
    horizontalRule: false,
    link: false,
    orderedList: false,
    strike: false,
    trailingNode: false,
  }),
  TaskList,
  PencilTaskItem.configure({ nested: false }),
  InlineIcon,
  Placeholder.configure({ placeholder: 'Escribe aquí…', showOnlyWhenEditable: false }),
]
