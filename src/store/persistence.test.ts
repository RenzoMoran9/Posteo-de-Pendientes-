import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY, attachPersistence, parsePersisted, pickPersisted, type StorageLike } from './persistence'
import { createDefaultState, createPositsStore } from './store'

function memoryStorage(): StorageLike & { data: Map<string, string>; writes: number } {
  const data = new Map<string, string>()
  return {
    data,
    writes: 0,
    getItem: (k) => data.get(k) ?? null,
    setItem(k, v) {
      data.set(k, v)
      this.writes++
    },
  }
}

describe('parsePersisted', () => {
  it('ida y vuelta sin perder nada', () => {
    const state = createDefaultState(1000)
    const back = parsePersisted(JSON.stringify(pickPersisted(state)))
    expect(back).toEqual(state)
  })

  it('devuelve null con basura, versión desconocida o sin tableros', () => {
    expect(parsePersisted(null)).toBeNull()
    expect(parsePersisted('')).toBeNull()
    expect(parsePersisted('{no es json')).toBeNull()
    expect(parsePersisted('{"v":2,"boards":{},"notes":{}}')).toBeNull()
    expect(parsePersisted('{"v":1,"boards":{},"notes":{}}')).toBeNull()
  })

  it('descarta posits de tableros que no existen y repara números inválidos', () => {
    const state = createDefaultState(1)
    const raw = JSON.parse(JSON.stringify(pickPersisted(state)))
    const [noteId] = Object.keys(raw.notes)
    raw.notes.huerfano = { ...raw.notes[noteId], boardId: 'no-existe' }
    raw.notes[noteId].x = 'abc'
    raw.notes[noteId].w = null
    const back = parsePersisted(JSON.stringify(raw))
    expect(back).not.toBeNull()
    expect(back?.notes.huerfano).toBeUndefined()
    expect(back?.notes[noteId].x).toBe(0)
    expect(back?.notes[noteId].w).toBe(240)
  })

  it('nextZ siempre queda por encima del mayor z', () => {
    const state = createDefaultState(1)
    const raw = JSON.parse(JSON.stringify(pickPersisted(state)))
    const [noteId] = Object.keys(raw.notes)
    raw.notes[noteId].z = 50
    raw.nextZ = 3
    expect(parsePersisted(JSON.stringify(raw))?.nextZ).toBe(51)
  })
})

describe('attachPersistence (guardado automático)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('guarda tras una pausa corta y marca "Guardado"', () => {
    const storage = memoryStorage()
    const store = createPositsStore(createDefaultState(1))
    attachPersistence(store, storage, 300)

    store.getState().addNote({ x: 500, y: 500, edit: false })
    expect(store.getState().saveStatus).toBe('saving')
    expect(storage.writes).toBe(0)

    vi.advanceTimersByTime(299)
    expect(storage.writes).toBe(0)
    vi.advanceTimersByTime(2)
    expect(storage.writes).toBe(1)
    expect(store.getState().saveStatus).toBe('saved')

    const saved = parsePersisted(storage.data.get(STORAGE_KEY) ?? null)
    expect(Object.keys(saved?.notes ?? {}).length).toBe(2)
  })

  it('junta varios cambios seguidos en una sola escritura', () => {
    const storage = memoryStorage()
    const store = createPositsStore(createDefaultState(1))
    attachPersistence(store, storage, 300)
    for (let i = 0; i < 20; i++) store.getState().addNote({ x: i * 300, y: 0 })
    vi.advanceTimersByTime(400)
    expect(storage.writes).toBe(1)
  })

  it('no escribe por cambios que no son datos (selección, avisos)', () => {
    const storage = memoryStorage()
    const store = createPositsStore(createDefaultState(1))
    attachPersistence(store, storage, 300)
    store.getState().showToast({ message: 'hola' })
    store.getState().select(null)
    vi.advanceTimersByTime(1000)
    expect(storage.writes).toBe(0)
  })

  it('avisa si no se pudo guardar', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const store = createPositsStore(createDefaultState(1))
    attachPersistence(store, storage, 100)
    store.getState().addNote({ x: 0, y: 0 })
    vi.advanceTimersByTime(200)
    expect(store.getState().saveStatus).toBe('error')
  })

  it('al desconectar guarda lo pendiente', () => {
    const storage = memoryStorage()
    const store = createPositsStore(createDefaultState(1))
    const detach = attachPersistence(store, storage, 5000)
    store.getState().addNote({ x: 0, y: 0 })
    expect(storage.writes).toBe(0)
    detach()
    expect(storage.writes).toBe(1)
  })
})
