import { createStore, useStore as useZustand } from 'zustand'
import type { JSONContent } from '@tiptap/core'
import { GRID, findFreeSpot, type Rect } from '../lib/geometry'
import { DEFAULT_COLOR, PAPER_COLORS } from '../lib/palette'
import { uid } from '../lib/uid'
import { attachPersistence, loadPersisted } from './persistence'
import type { Board, Note, PersistedState, SaveStatus, View } from './types'

export const NOTE_DEFAULTS = { w: 240, h: 216 } as const
export const NOTE_LIMITS = { minW: 144, minH: 120, maxW: 960, maxH: 1600 } as const

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
  /** Milisegundos que se queda a la vista (por defecto 6,5 s). */
  duration?: number
}

interface UIState {
  selectedId: string | null
  editingId: string | null
  toast: Toast | null
  saveStatus: SaveStatus
}

export interface AddNoteOptions {
  x?: number
  y?: number
  w?: number
  h?: number
  color?: string
  doc?: JSONContent | null
  /** Abre el posit ya listo para escribir. */
  edit?: boolean
  /** Colócalo justo en (x, y), aunque quede encima de otro (doble clic en un lugar elegido). */
  exact?: boolean
  /**
   * Espacios ya ocupados a esquivar (con sus alturas reales medidas en pantalla).
   * Si no se pasa, se usan las medidas guardadas de los posits del tablero.
   */
  avoid?: Rect[]
}

interface Actions {
  addNote(opts?: AddNoteOptions): string
  patchNote(id: string, patch: Partial<Pick<Note, 'x' | 'y' | 'w' | 'h' | 'color'>>): void
  setDoc(id: string, doc: JSONContent): void
  deleteNote(id: string): void
  restoreNote(note: Note): void
  duplicateNote(id: string): string | null
  select(id: string | null): void
  startEditing(id: string): void
  stopEditing(id?: string): void
  /** "Toma un marcador": color para los posits nuevos y para el posit seleccionado. */
  pickColor(hex: string): void
  toggleMagnet(): void
  setView(boardId: string, view: View): void
  showToast(t: Omit<Toast, 'id'>): void
  dismissToast(): void
}

export type Store = PersistedState & UIState & Actions

export const textDoc = (...paragraphs: string[]): JSONContent => ({
  type: 'doc',
  content: paragraphs.map((t) => (t ? { type: 'paragraph', content: [{ type: 'text', text: t }] } : { type: 'paragraph' })),
})

/** Estado inicial de alguien que abre la app por primera vez. */
export function createDefaultState(now = Date.now()): PersistedState {
  const boardId = uid()
  const noteId = uid()
  const board: Board = { id: boardId, name: 'Mi tablero', createdAt: now, updatedAt: now }
  const welcome: Note = {
    id: noteId,
    boardId,
    x: 0,
    y: 0,
    w: 264,
    h: 240,
    z: 1,
    color: PAPER_COLORS[0].hex,
    doc: textDoc(
      '¡Bienvenido a tu tablero!',
      'Toca este posit y vuelve a tocarlo para escribir.',
      'Arrástralo desde la cinta y cámbiale el color con los marcadores de abajo.',
    ),
    createdAt: now,
    updatedAt: now,
  }
  return {
    v: 1,
    boards: { [boardId]: board },
    boardOrder: [boardId],
    activeBoardId: boardId,
    notes: { [noteId]: welcome },
    nextZ: 2,
    views: {},
    settings: { magnet: true, defaultColor: DEFAULT_COLOR },
  }
}

const notesOf = (s: PersistedState): Note[] =>
  Object.values(s.notes).filter((n) => n.boardId === s.activeBoardId)

let toastSeq = 0

export function createPositsStore(initial: PersistedState) {
  return createStore<Store>()((set, get) => ({
    ...initial,
    selectedId: null,
    editingId: null,
    toast: null,
    saveStatus: 'saved',

    addNote(opts = {}) {
      const s = get()
      const now = Date.now()
      const w = opts.w ?? NOTE_DEFAULTS.w
      const h = opts.h ?? NOTE_DEFAULTS.h
      let x = opts.x ?? 0
      let y = opts.y ?? 0
      if (s.settings.magnet) {
        x = Math.round(x / GRID) * GRID
        y = Math.round(y / GRID) * GRID
      }
      if (!opts.exact) {
        const taken = opts.avoid ?? notesOf(s).map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }))
        ;({ x, y } = findFreeSpot(taken, x, y, w, h))
      }
      const note: Note = {
        id: uid(),
        boardId: s.activeBoardId,
        x,
        y,
        w,
        h,
        z: s.nextZ,
        color: opts.color ?? s.settings.defaultColor,
        doc: opts.doc ?? null,
        createdAt: now,
        updatedAt: now,
      }
      set({
        notes: { ...s.notes, [note.id]: note },
        nextZ: s.nextZ + 1,
        selectedId: note.id,
        editingId: opts.edit ? note.id : null,
      })
      return note.id
    },

    patchNote(id, patch) {
      set((s) => {
        const n = s.notes[id]
        if (!n) return s
        return { notes: { ...s.notes, [id]: { ...n, ...patch, updatedAt: Date.now() } } }
      })
    },

    setDoc(id, doc) {
      set((s) => {
        const n = s.notes[id]
        if (!n) return s
        return { notes: { ...s.notes, [id]: { ...n, doc, updatedAt: Date.now() } } }
      })
    },

    deleteNote(id) {
      const note = get().notes[id]
      if (!note) return
      set((s) => {
        const notes = { ...s.notes }
        delete notes[id]
        return {
          notes,
          selectedId: s.selectedId === id ? null : s.selectedId,
          editingId: s.editingId === id ? null : s.editingId,
        }
      })
      get().showToast({
        message: 'Posit borrado',
        actionLabel: 'Deshacer',
        onAction: () => get().restoreNote(note),
      })
    },

    restoreNote(note) {
      set((s) => ({
        notes: { ...s.notes, [note.id]: { ...note, updatedAt: Date.now() } },
        nextZ: Math.max(s.nextZ, note.z + 1),
        selectedId: note.id,
        editingId: null,
        toast: null,
      }))
    },

    duplicateNote(id) {
      const s = get()
      const src = s.notes[id]
      if (!src) return null
      const now = Date.now()
      const copy: Note = {
        ...src,
        id: uid(),
        x: src.x + GRID,
        y: src.y + GRID,
        z: s.nextZ,
        doc: src.doc ? (JSON.parse(JSON.stringify(src.doc)) as JSONContent) : null,
        createdAt: now,
        updatedAt: now,
      }
      set({ notes: { ...s.notes, [copy.id]: copy }, nextZ: s.nextZ + 1, selectedId: copy.id, editingId: null })
      return copy.id
    },

    select(id) {
      set((s) => {
        if (id === null) return { selectedId: null, editingId: null }
        const n = s.notes[id]
        if (!n) return s
        const onTop = n.z === s.nextZ - 1
        return {
          selectedId: id,
          editingId: s.editingId === id ? id : null,
          ...(onTop ? {} : { notes: { ...s.notes, [id]: { ...n, z: s.nextZ } }, nextZ: s.nextZ + 1 }),
        }
      })
    },

    startEditing(id) {
      set((s) => {
        const n = s.notes[id]
        if (!n) return s
        const onTop = n.z === s.nextZ - 1
        return {
          selectedId: id,
          editingId: id,
          ...(onTop ? {} : { notes: { ...s.notes, [id]: { ...n, z: s.nextZ } }, nextZ: s.nextZ + 1 }),
        }
      })
    },

    stopEditing(id) {
      if (id && get().editingId !== id) return
      set({ editingId: null })
    },

    pickColor(hex) {
      set((s) => {
        const sel = s.selectedId ? s.notes[s.selectedId] : undefined
        return {
          settings: { ...s.settings, defaultColor: hex },
          ...(sel ? { notes: { ...s.notes, [sel.id]: { ...sel, color: hex, updatedAt: Date.now() } } } : {}),
        }
      })
    },

    toggleMagnet() {
      set((s) => ({ settings: { ...s.settings, magnet: !s.settings.magnet } }))
    },

    setView(boardId, view) {
      set((s) => ({ views: { ...s.views, [boardId]: view } }))
    },

    showToast(t) {
      set({ toast: { ...t, id: ++toastSeq } })
    },

    dismissToast() {
      set({ toast: null })
    },
  }))
}

/** Almacén de la app (lo guardado en el dispositivo, o un tablero de bienvenida). */
export const store = createPositsStore(loadPersisted() ?? createDefaultState())

if (typeof window !== 'undefined') attachPersistence(store)

export function useStore<T>(selector: (s: Store) => T): T {
  return useZustand(store, selector)
}

export const selectActiveNoteIds = (s: Store): string[] =>
  Object.values(s.notes)
    .filter((n) => n.boardId === s.activeBoardId)
    .map((n) => n.id)
