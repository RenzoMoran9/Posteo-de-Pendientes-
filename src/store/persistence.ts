import type { StoreApi } from 'zustand'
import { DEFAULT_COLOR } from '../lib/palette'
import type { Board, Note, PersistedState, SaveStatus, Sticker, View } from './types'

export const MAX_RECENT_ICONS = 12

export const STORAGE_KEY = 'posits:v1'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** `localStorage` si está disponible (puede fallar en modo privado o con datos bloqueados). */
export function getStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage
    if (!s) return null
    const probe = '__posits_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)

/** Lee y valida lo guardado. Devuelve null si no hay nada utilizable. */
export function parsePersisted(raw: string | null): PersistedState | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObj(data) || data.v !== 1 || !isObj(data.boards) || !isObj(data.notes)) return null

  const boards: Record<string, Board> = {}
  for (const [id, b] of Object.entries(data.boards)) {
    if (!isObj(b)) continue
    boards[id] = { id, name: str(b.name, 'Tablero'), createdAt: num(b.createdAt, 0), updatedAt: num(b.updatedAt, 0) }
  }
  const boardIds = Object.keys(boards)
  if (boardIds.length === 0) return null

  const notes: Record<string, Note> = {}
  let maxZ = 0
  for (const [id, n] of Object.entries(data.notes)) {
    if (!isObj(n)) continue
    const boardId = str(n.boardId, '')
    if (!boards[boardId]) continue
    const z = num(n.z, 1)
    maxZ = Math.max(maxZ, z)
    notes[id] = {
      id,
      boardId,
      x: num(n.x, 0),
      y: num(n.y, 0),
      w: num(n.w, 240),
      h: num(n.h, 216),
      z,
      color: str(n.color, DEFAULT_COLOR),
      ...(typeof n.font === 'string' && n.font ? { font: n.font } : {}),
      doc: isObj(n.doc) ? (n.doc as Note['doc']) : null,
      createdAt: num(n.createdAt, 0),
      updatedAt: num(n.updatedAt, 0),
    }
  }

  // Íconos pegados. Los de un posit que ya no existe se descartan (sus coordenadas eran relativas a él).
  const stickers: Record<string, Sticker> = {}
  if (isObj(data.stickers)) {
    for (const [id, s] of Object.entries(data.stickers)) {
      if (!isObj(s)) continue
      const icon = str(s.icon, '')
      const boardId = str(s.boardId, '')
      if (!icon || !boards[boardId]) continue
      const noteId = typeof s.noteId === 'string' ? s.noteId : null
      if (noteId && !notes[noteId]) continue
      const z = num(s.z, 1)
      maxZ = Math.max(maxZ, z)
      stickers[id] = {
        id,
        boardId,
        icon,
        noteId,
        x: num(s.x, 0),
        y: num(s.y, 0),
        size: Math.min(320, Math.max(24, num(s.size, 56))),
        tilt: num(s.tilt, 0),
        z,
        createdAt: num(s.createdAt, 0),
        updatedAt: num(s.updatedAt, 0),
      }
    }
  }

  const order = Array.isArray(data.boardOrder)
    ? data.boardOrder.filter((id): id is string => typeof id === 'string' && !!boards[id])
    : []
  for (const id of boardIds) if (!order.includes(id)) order.push(id)
  const active =
    typeof data.activeBoardId === 'string' && boards[data.activeBoardId] ? data.activeBoardId : order[0]

  const views: Record<string, View> = {}
  if (isObj(data.views)) {
    for (const [id, v] of Object.entries(data.views)) {
      if (!boards[id] || !isObj(v)) continue
      views[id] = { x: num(v.x, 0), y: num(v.y, 0), z: num(v.z, 1) }
    }
  }

  const st = isObj(data.settings) ? data.settings : {}
  return {
    v: 1,
    boards,
    boardOrder: order,
    activeBoardId: active,
    notes,
    stickers,
    nextZ: Math.max(num(data.nextZ, 1), maxZ + 1),
    views,
    settings: {
      magnet: st.magnet !== false,
      defaultColor: str(st.defaultColor, DEFAULT_COLOR),
      recentIcons: Array.isArray(st.recentIcons)
        ? st.recentIcons.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT_ICONS)
        : [],
      mascot: st.mascot === 'quiet' || st.mascot === 'off' ? st.mascot : 'on',
      mascotMet: st.mascotMet === true,
      mascotPos:
        isObj(st.mascotPos) && typeof st.mascotPos.x === 'number' && typeof st.mascotPos.y === 'number' && Number.isFinite(st.mascotPos.x) && Number.isFinite(st.mascotPos.y)
          ? { x: Math.min(1, Math.max(0, st.mascotPos.x)), y: Math.min(1, Math.max(0, st.mascotPos.y)) }
          : null,
      mascotDone:
        isObj(st.mascotDone) && typeof st.mascotDone.day === 'string' && typeof st.mascotDone.n === 'number' && Number.isFinite(st.mascotDone.n) && st.mascotDone.n >= 0
          ? { day: st.mascotDone.day, n: Math.floor(st.mascotDone.n) }
          : { day: '', n: 0 },
    },
  }
}

export function loadPersisted(storage: StorageLike | null = getStorage()): PersistedState | null {
  try {
    return parsePersisted(storage?.getItem(STORAGE_KEY) ?? null)
  } catch {
    return null
  }
}

export function pickPersisted(s: PersistedState): PersistedState {
  return {
    v: 1,
    boards: s.boards,
    boardOrder: s.boardOrder,
    activeBoardId: s.activeBoardId,
    notes: s.notes,
    stickers: s.stickers,
    nextZ: s.nextZ,
    views: s.views,
    settings: s.settings,
  }
}

type Persistable = PersistedState & { saveStatus: SaveStatus }

/**
 * Guardado automático: cada cambio se escribe en el dispositivo tras una pausa corta
 * y también al ocultar o cerrar la pestaña. Devuelve la función que lo desconecta.
 */
export function attachPersistence(
  api: StoreApi<Persistable>,
  storage: StorageLike | null = getStorage(),
  delayMs = 350,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false

  const write = () => {
    timer = undefined
    if (!dirty) return
    dirty = false
    try {
      if (!storage) throw new Error('Sin almacenamiento disponible')
      storage.setItem(STORAGE_KEY, JSON.stringify(pickPersisted(api.getState())))
      api.setState({ saveStatus: 'saved' })
    } catch {
      api.setState({ saveStatus: 'error' })
    }
  }

  const schedule = () => {
    dirty = true
    if (api.getState().saveStatus !== 'saving') api.setState({ saveStatus: 'saving' })
    if (timer) clearTimeout(timer)
    timer = setTimeout(write, delayMs)
  }

  const flush = () => {
    if (timer) clearTimeout(timer)
    write()
  }

  const unsubscribe = api.subscribe((s, prev) => {
    if (
      s.notes !== prev.notes ||
      s.stickers !== prev.stickers ||
      s.boards !== prev.boards ||
      s.boardOrder !== prev.boardOrder ||
      s.activeBoardId !== prev.activeBoardId ||
      s.views !== prev.views ||
      s.settings !== prev.settings ||
      s.nextZ !== prev.nextZ
    ) {
      schedule()
    }
  })

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
  }

  return () => {
    unsubscribe()
    flush()
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }
}
