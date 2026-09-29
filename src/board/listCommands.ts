import type { Editor } from '@tiptap/core'
import { Fragment } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

type ListKind = 'bulletList' | 'taskList'

/**
 * Si el cursor está dentro de una lista de OTRO tipo, la convierte entera (viñetas ⇄ pendientes).
 * Devuelve true si hizo la conversión; false si no aplica (el cursor no está en una lista, la lista ya
 * es de ese tipo, o el contenido no cabe en el otro tipo) y conviene usar el botón normal.
 *
 * Por qué a mano: el comando estándar solo convierte el renglón donde está el cursor, y en el celular
 * es difícil seleccionar varios renglones. Aquí solo se cambia el "tipo" de los nodos, sin mover
 * posiciones, así que el cursor y el texto quedan exactamente donde estaban.
 */
export function switchListKind(editor: Editor, target: ListKind): boolean {
  const { state } = editor
  const { $from } = state.selection

  for (let depth = $from.depth; depth > 0; depth--) {
    const list = $from.node(depth)
    const current = list.type.name
    if (current !== 'bulletList' && current !== 'taskList') continue
    if (current === target) return false

    const listType = state.schema.nodes[target]
    const itemType = state.schema.nodes[target === 'taskList' ? 'taskItem' : 'listItem']
    if (!listType || !itemType) return false

    let fits = true
    list.forEach((item) => {
      if (!itemType.validContent(item.content)) fits = false // p. ej. viñetas con sub-listas no caben en pendientes
    })
    if (!fits) return false

    // Se reemplaza la lista completa de un solo golpe (por partes quedaría un estado intermedio inválido:
    // una lista de viñetas con casillas dentro). Ocupa exactamente el mismo espacio, así que basta
    // con volver a poner el cursor en las mismas posiciones.
    const items: ReturnType<typeof itemType.create>[] = []
    list.forEach((item) => {
      items.push(itemType.create(target === 'taskList' ? { checked: false } : null, item.content, item.marks))
    })
    const start = $from.before(depth)
    const { from, to } = state.selection
    const tr = state.tr.replaceWith(start, start + list.nodeSize, listType.create(null, Fragment.fromArray(items)))
    tr.setSelection(TextSelection.create(tr.doc, from, to))
    editor.view.dispatch(tr)
    return true
  }
  return false
}

export function toggleBullets(editor: Editor): void {
  if (switchListKind(editor, 'bulletList')) return
  editor.chain().focus().toggleBulletList().run()
}

export function toggleTasks(editor: Editor): void {
  if (switchListKind(editor, 'taskList')) return
  editor.chain().focus().toggleTaskList().run()
}
