import { createStore, useStore as useZustand } from 'zustand'
import type { JSONContent } from '@tiptap/core'
import { GRID, clamp, findFreeSpot, type Rect } from '../lib/geometry'
import { DEFAULT_FONT_ID, NOTE_FONTS } from '../lib/fonts'
import { DEFAULT_COLOR, PAPER_COLORS } from '../lib/palette'
import { seeded } from '../lib/seed'
import { uid } from '../lib/uid'
import { MAX_RECENT_ICONS, attachPersistence, loadPersisted } from './persistence'
import type { Board, MascotMode, Note, PersistedState, SaveStatus, Sticker, View } from './types'

export const NOTE_DEFAULTS = { w: 240, h: 216 } as const
export const NOTE_LIMITS = { minW: 144, minH: 120, maxW: 960, maxH: 1600 } as const
/** Escala de un posit entero (la esquina lo agranda o achica): entre 0,3× y 4×, y nunca menos de 96 ni más de 1400 de ancho a la vista. */
export const NOTE_SCALE = { min: 0.3, max: 4, minVisibleW: 96, maxVisibleW: 1400 } as const
export const STICKER_DEFAULTS = { size: 56 } as const
export const STICKER_LIMITS = { min: 24, max: 320 } as const

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
  /** Milisegundos que se queda a la vista (por defecto 6,5 s). */
  duration?: number
}

/** Panel de íconos: `board` pega en el tablero (o en el posit elegido); `text` mete el ícono en el texto de un posit. */
export type IconPanelState = { mode: 'board' } | { mode: 'text'; noteId: string } | null

interface UIState {
  selectedId: string | null
  /** Ícono seleccionado (excluyente con `selectedId`). */
  selectedStickerId: string | null
  editingId: string | null
  iconPanel: IconPanelState
  toast: Toast | null
  saveStatus: SaveStatus
}

export interface AddNoteOptions {
  x?: number
  y?: number
  w?: number
  h?: number
  color?: string
  /** Letra (id de src/lib/fonts.ts); sin ella, la que se tiene «en la mano». */
  font?: string
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

export interface AddStickerOptions {
  icon: string
  /** Posit al que se pega (entonces x e y son relativos a su esquina); sin él, queda suelto en la hoja. */
  noteId?: string | null
  x?: number
  y?: number
  size?: number
  tilt?: number
  /** Por defecto el ícono nuevo queda seleccionado; con `false` no se toca lo que estaba seleccionado ni en escritura. */
  select?: boolean
}

interface Actions {
  addNote(opts?: AddNoteOptions): string
  patchNote(id: string, patch: Partial<Pick<Note, 'x' | 'y' | 'w' | 'h' | 'color' | 'font'>>): void
  /**
   * Cambia el tamaño de un posit y, en el mismo movimiento, acomoda los íconos pegados a él (`stickers`: su nueva
   * posición dentro del posit). Un solo cambio, así se guarda y se ve de una vez.
   */
  resizeNote(id: string, patch: Partial<Pick<Note, 'w' | 'h' | 'scale'>>, stickers?: Record<string, { x: number; y: number }>): void
  setDoc(id: string, doc: JSONContent): void
  deleteNote(id: string): void
  restoreNote(note: Note, stickers?: Sticker[]): void
  duplicateNote(id: string): string | null
  select(id: string | null): void
  startEditing(id: string): void
  stopEditing(id?: string): void

  addSticker(opts: AddStickerOptions): string
  patchSticker(id: string, patch: Partial<Pick<Sticker, 'x' | 'y' | 'size' | 'tilt'>>): void
  /** Al soltar un ícono: lo deja suelto o pegado a un posit, con sus coordenadas ya convertidas, y lo trae al frente. */
  placeSticker(id: string, target: { noteId: string | null; x: number; y: number; size?: number }): void
  deleteSticker(id: string): void
  restoreStickers(list: Sticker[]): void
  duplicateSticker(id: string): string | null
  selectSticker(id: string | null): void
  openIcons(target: IconPanelState): void
  closeIcons(): void
  rememberIcon(icon: string): void
  setMascotMode(mode: MascotMode): void
  markMascotMet(): void
  setMascotPos(pos: { x: number; y: number } | null): void
  /** Suma un pendiente marcado al conteo de hoy (`day` = AAAA-MM-DD; otro día empieza de cero) y devuelve el total. */
  countMascotDone(day: string): number

  /** Elige un color de la paleta: para los posits nuevos y para el posit seleccionado. */
  pickColor(hex: string): void
  /** "Toma una pluma": letra para los posits nuevos y para el posit seleccionado. */
  pickFont(id: string): void
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

/** Un título y una lista de pendientes: `items` son [texto, ¿hecho?]. */
export const taskDoc = (title: string, items: Array<[string, boolean]>): JSONContent => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: title }] },
    {
      type: 'taskList',
      content: items.map(([text, checked]) => ({
        type: 'taskItem',
        attrs: { checked },
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      })),
    },
  ],
})

/** Estado inicial de alguien que abre la app por primera vez. */
export function createDefaultState(now = Date.now()): PersistedState {
  const boardId = uid()
  const noteId = uid()
  const stickerId = uid()
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
    doc: taskDoc('¡Bienvenido a tu tablero!', [
      ['Toca este posit y vuelve a tocarlo para escribir', false],
      ['Marca una casilla: se tacha como con lápiz', true],
      ['Arrástralo desde la cinta', false],
      ['Cambia el color con los marcadores', false],
      ['Pega íconos con el botón de la hojita', false],
    ]),
    createdAt: now,
    updatedAt: now,
  }
  // Un ícono de ejemplo pegado en la esquina del posit de bienvenida.
  const sparkle: Sticker = {
    id: stickerId,
    boardId,
    icon: 'brillos',
    noteId,
    x: welcome.w - 46,
    y: -18,
    size: STICKER_DEFAULTS.size,
    tilt: 9,
    z: 2,
    createdAt: now,
    updatedAt: now,
  }
  return {
    v: 1,
    boards: { [boardId]: board },
    boardOrder: [boardId],
    activeBoardId: boardId,
    notes: { [noteId]: welcome },
    stickers: { [stickerId]: sparkle },
    nextZ: 3,
    views: {},
    settings: { magnet: true, defaultColor: DEFAULT_COLOR, defaultFont: DEFAULT_FONT_ID, recentIcons: [], mascot: 'on', mascotMet: false, mascotPos: null, mascotDone: { day: '', n: 0 } },
  }
}

const notesOf = (s: PersistedState): Note[] =>
  Object.values(s.notes).filter((n) => n.boardId === s.activeBoardId)

/** Escala de un posit (1 = tamaño natural). */
export const noteScale = (n: { scale?: number }): number => n.scale ?? 1

/** Íconos pegados a un posit. */
export const stickersOfNote = (s: PersistedState, noteId: string): Sticker[] =>
  Object.values(s.stickers).filter((st) => st.noteId === noteId)

let toastSeq = 0

export function createPositsStore(initial: PersistedState) {
  return createStore<Store>()((set, get) => ({
    ...initial,
    selectedId: null,
    selectedStickerId: null,
    editingId: null,
    iconPanel: null,
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
        const taken = opts.avoid ?? notesOf(s).map((n) => ({ x: n.x, y: n.y, w: n.w * noteScale(n), h: n.h * noteScale(n) }))
        ;({ x, y } = findFreeSpot(taken, x, y, w, h))
      }
      const font = opts.font ?? s.settings.defaultFont
      const note: Note = {
        id: uid(),
        boardId: s.activeBoardId,
        x,
        y,
        w,
        h,
        z: s.nextZ,
        color: opts.color ?? s.settings.defaultColor,
        // la letra de siempre no se anota: «sin valor» ya es esa
        ...(font && font !== DEFAULT_FONT_ID && NOTE_FONTS.some((f) => f.id === font) ? { font } : {}),
        doc: opts.doc ?? null,
        createdAt: now,
        updatedAt: now,
      }
      set({
        notes: { ...s.notes, [note.id]: note },
        nextZ: s.nextZ + 1,
        selectedId: note.id,
        selectedStickerId: null,
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

    resizeNote(id, patch, stickers) {
      set((s) => {
        const n = s.notes[id]
        if (!n) return s
        const now = Date.now()
        const { scale, ...rest } = { ...n, ...patch }
        // la escala 1 es la de siempre: no se anota
        const next: Note = { ...rest, ...(scale !== undefined && scale !== 1 ? { scale: clamp(scale, NOTE_SCALE.min, NOTE_SCALE.max) } : {}), updatedAt: now }
        let moved = s.stickers
        if (stickers) {
          moved = { ...s.stickers }
          for (const [sid, pos] of Object.entries(stickers)) {
            const st = moved[sid]
            if (st && st.noteId === id) moved[sid] = { ...st, x: pos.x, y: pos.y, updatedAt: now }
          }
        }
        return { notes: { ...s.notes, [id]: next }, stickers: moved }
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
      const attached = stickersOfNote(get(), id)
      set((s) => {
        const notes = { ...s.notes }
        delete notes[id]
        const stickers = { ...s.stickers }
        for (const st of attached) delete stickers[st.id]
        return {
          notes,
          stickers,
          selectedId: s.selectedId === id ? null : s.selectedId,
          selectedStickerId: s.selectedStickerId && attached.some((st) => st.id === s.selectedStickerId) ? null : s.selectedStickerId,
          editingId: s.editingId === id ? null : s.editingId,
        }
      })
      get().showToast({
        message: 'Posit borrado',
        actionLabel: 'Deshacer',
        onAction: () => get().restoreNote(note, attached),
      })
    },

    restoreNote(note, stickers = []) {
      set((s) => {
        const restored = { ...s.stickers }
        let nextZ = Math.max(s.nextZ, note.z + 1)
        for (const st of stickers) {
          restored[st.id] = { ...st, updatedAt: Date.now() }
          nextZ = Math.max(nextZ, st.z + 1)
        }
        return {
          notes: { ...s.notes, [note.id]: { ...note, updatedAt: Date.now() } },
          stickers: restored,
          nextZ,
          selectedId: note.id,
          selectedStickerId: null,
          editingId: null,
          toast: null,
        }
      })
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
      const stickers = { ...s.stickers }
      let nextZ = s.nextZ + 1
      for (const st of stickersOfNote(s, id)) {
        const twin: Sticker = { ...st, id: uid(), noteId: copy.id, z: nextZ++, createdAt: now, updatedAt: now }
        stickers[twin.id] = twin
      }
      set({
        notes: { ...s.notes, [copy.id]: copy },
        stickers,
        nextZ,
        selectedId: copy.id,
        selectedStickerId: null,
        editingId: null,
      })
      return copy.id
    },

    select(id) {
      set((s) => {
        if (id === null) return { selectedId: null, selectedStickerId: null, editingId: null }
        const n = s.notes[id]
        if (!n) return s
        const onTop = n.z === s.nextZ - 1
        return {
          selectedId: id,
          selectedStickerId: null,
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
          selectedStickerId: null,
          editingId: id,
          ...(onTop ? {} : { notes: { ...s.notes, [id]: { ...n, z: s.nextZ } }, nextZ: s.nextZ + 1 }),
        }
      })
    },

    stopEditing(id) {
      if (id && get().editingId !== id) return
      set({ editingId: null })
    },

    addSticker(opts) {
      const s = get()
      const note = opts.noteId ? s.notes[opts.noteId] : undefined
      const id = uid()
      const now = Date.now()
      const sticker: Sticker = {
        id,
        boardId: note ? note.boardId : s.activeBoardId,
        icon: opts.icon,
        noteId: note ? note.id : null,
        x: opts.x ?? 0,
        y: opts.y ?? 0,
        size: clamp(opts.size ?? STICKER_DEFAULTS.size, STICKER_LIMITS.min, STICKER_LIMITS.max),
        tilt: opts.tilt ?? Math.round((seeded(id, 5) - 0.5) * 120) / 10,
        z: s.nextZ,
        createdAt: now,
        updatedAt: now,
      }
      set({
        stickers: { ...s.stickers, [id]: sticker },
        nextZ: s.nextZ + 1,
        ...(opts.select === false ? {} : { selectedStickerId: id, selectedId: null, editingId: null }),
      })
      return id
    },

    patchSticker(id, patch) {
      set((s) => {
        const st = s.stickers[id]
        if (!st) return s
        const next = { ...st, ...patch, updatedAt: Date.now() }
        next.size = clamp(next.size, STICKER_LIMITS.min, STICKER_LIMITS.max)
        return { stickers: { ...s.stickers, [id]: next } }
      })
    },

    placeSticker(id, target) {
      set((s) => {
        const st = s.stickers[id]
        if (!st) return s
        const noteId = target.noteId && s.notes[target.noteId] ? target.noteId : null
        const size = target.size === undefined ? st.size : clamp(target.size, STICKER_LIMITS.min, STICKER_LIMITS.max)
        const next: Sticker = { ...st, noteId, x: target.x, y: target.y, size, z: s.nextZ, updatedAt: Date.now() }
        return { stickers: { ...s.stickers, [id]: next }, nextZ: s.nextZ + 1 }
      })
    },

    deleteSticker(id) {
      const sticker = get().stickers[id]
      if (!sticker) return
      set((s) => {
        const stickers = { ...s.stickers }
        delete stickers[id]
        return { stickers, selectedStickerId: s.selectedStickerId === id ? null : s.selectedStickerId }
      })
      get().showToast({
        message: 'Ícono borrado',
        actionLabel: 'Deshacer',
        onAction: () => get().restoreStickers([sticker]),
      })
    },

    restoreStickers(list) {
      set((s) => {
        const stickers = { ...s.stickers }
        let nextZ = s.nextZ
        let last: string | null = null
        for (const st of list) {
          if (st.noteId && !s.notes[st.noteId]) continue
          stickers[st.id] = { ...st, updatedAt: Date.now() }
          nextZ = Math.max(nextZ, st.z + 1)
          last = st.id
        }
        return { stickers, nextZ, toast: null, ...(last ? { selectedStickerId: last, selectedId: null, editingId: null } : {}) }
      })
    },

    duplicateSticker(id) {
      const s = get()
      const src = s.stickers[id]
      if (!src) return null
      const now = Date.now()
      const copy: Sticker = { ...src, id: uid(), x: src.x + 14, y: src.y + 14, z: s.nextZ, createdAt: now, updatedAt: now }
      set({
        stickers: { ...s.stickers, [copy.id]: copy },
        nextZ: s.nextZ + 1,
        selectedStickerId: copy.id,
        selectedId: null,
        editingId: null,
      })
      return copy.id
    },

    selectSticker(id) {
      set((s) => {
        if (id === null) return { selectedStickerId: null }
        const st = s.stickers[id]
        if (!st) return s
        let nextZ = s.nextZ
        let stickers = s.stickers
        let notes = s.notes
        // Al frente: el ícono y, si está pegado, también su posit (el ícono se ve dentro de él).
        if (st.z !== nextZ - 1) {
          stickers = { ...stickers, [id]: { ...st, z: nextZ } }
          nextZ += 1
        }
        const parent = st.noteId ? s.notes[st.noteId] : undefined
        if (parent && parent.z !== nextZ - 1) {
          notes = { ...notes, [parent.id]: { ...parent, z: nextZ } }
          nextZ += 1
        }
        return { selectedStickerId: id, selectedId: null, editingId: null, stickers, notes, nextZ }
      })
    },

    openIcons(target) {
      set({ iconPanel: target })
    },

    closeIcons() {
      set({ iconPanel: null })
    },

    rememberIcon(icon) {
      set((s) => ({
        settings: {
          ...s.settings,
          recentIcons: [icon, ...s.settings.recentIcons.filter((i) => i !== icon)].slice(0, MAX_RECENT_ICONS),
        },
      }))
    },

    setMascotMode(mode) {
      set((s) => (s.settings.mascot === mode ? s : { settings: { ...s.settings, mascot: mode } }))
    },

    countMascotDone(day) {
      const cur = get().settings.mascotDone
      const n = cur.day === day ? cur.n + 1 : 1
      set((s) => ({ settings: { ...s.settings, mascotDone: { day, n } } }))
      return n
    },

    setMascotPos(pos) {
      set((s) => ({
        settings: { ...s.settings, mascotPos: pos ? { x: clamp(pos.x, 0, 1), y: clamp(pos.y, 0, 1) } : null },
      }))
    },

    markMascotMet() {
      set((s) => (s.settings.mascotMet ? s : { settings: { ...s.settings, mascotMet: true } }))
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

    pickFont(id) {
      if (!NOTE_FONTS.some((f) => f.id === id)) return
      set((s) => {
        const sel = s.selectedId ? s.notes[s.selectedId] : undefined
        return {
          settings: { ...s.settings, defaultFont: id },
          ...(sel ? { notes: { ...s.notes, [sel.id]: { ...sel, font: id, updatedAt: Date.now() } } } : {}),
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

/** Íconos sueltos en la hoja del tablero activo (los pegados a un posit los dibuja el propio posit). */
export const selectLooseStickerIds = (s: Store): string[] =>
  Object.values(s.stickers)
    .filter((st) => st.boardId === s.activeBoardId && st.noteId === null)
    .map((st) => st.id)
