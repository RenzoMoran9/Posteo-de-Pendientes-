import type { JSONContent } from '@tiptap/core'
import { addNoteWithContent } from '../board/actions'
import { getEditor } from '../board/editors'
import { store } from '../store/store'
import type { PlanIO } from './actions'

/**
 * Cómo se aplican de verdad los cambios que propone Claude: sobre el almacén de la app y, si el posit tiene su
 * editor abierto, a través de él (los posits solo leen su documento al nacer: el editor es quien manda mientras vive).
 */
export const storeIO: PlanIO = {
  readDoc: (id) => {
    const n = store.getState().notes[id]
    return n ? n.doc : undefined
  },

  writeDoc(id, doc: JSONContent) {
    const ed = getEditor(id)
    if (ed && !ed.isDestroyed) {
      ed.commands.setContent(doc) // avisa al almacén con onUpdate…
      store.getState().setDoc(id, ed.getJSON()) // …y se deja escrito lo que el editor entendió
    } else {
      store.getState().setDoc(id, doc)
    }
  },

  addNote: (doc, color) => addNoteWithContent(doc, color),

  removeNote(id) {
    // se quita sin el aviso «Posit borrado · Deshacer»: ya hay un «Deshacer» propio en la conversación
    store.getState().deleteNote(id)
    store.getState().dismissToast()
  },

  readColor: (id) => store.getState().notes[id]?.color,
  setColor: (id, hex) => store.getState().patchNote(id, { color: hex }),
}
