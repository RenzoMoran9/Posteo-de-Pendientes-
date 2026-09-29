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

describe('letra del posit al guardar y cargar', () => {
  it('la letra elegida sobrevive y un posit sin letra no la inventa', () => {
    const state = createDefaultState(1)
    const [id] = Object.keys(state.notes)
    const raw = JSON.parse(JSON.stringify(pickPersisted(state)))
    expect(parsePersisted(JSON.stringify(raw))?.notes[id].font).toBeUndefined()
    raw.notes[id].font = 'caveat'
    expect(parsePersisted(JSON.stringify(raw))?.notes[id].font).toBe('caveat')
    raw.notes[id].font = 42
    expect(parsePersisted(JSON.stringify(raw))?.notes[id].font).toBeUndefined()
  })
})

describe('la pluma en la mano al guardar y cargar', () => {
  it('se recuerda la letra elegida para los posits nuevos', () => {
    const d = createDefaultState(5)
    d.settings.defaultFont = 'architects'
    expect(parsePersisted(JSON.stringify(d))?.settings.defaultFont).toBe('architects')
  })

  it('lo guardado antes de que existiera, o con una letra que ya no está, vuelve a la de siempre', () => {
    const d = createDefaultState(5)
    const old = JSON.parse(JSON.stringify(d))
    delete old.settings.defaultFont
    expect(parsePersisted(JSON.stringify(old))?.settings.defaultFont).toBe('kalam')
    for (const bad of ['comic-sans', 7, null, {}]) {
      old.settings.defaultFont = bad
      expect(parsePersisted(JSON.stringify(old))?.settings.defaultFont).toBe('kalam')
    }
  })
})

describe('la mascota al guardar y cargar', () => {
  const raw = () => JSON.parse(JSON.stringify(pickPersisted(createDefaultState(1))))

  it('lo guardado antes de la mascota se abre con ella despierta y sin haberse presentado', () => {
    const old = raw()
    delete old.settings.mascot
    delete old.settings.mascotMet
    const back = parsePersisted(JSON.stringify(old))
    expect(back?.settings).toMatchObject({ mascot: 'on', mascotMet: false })
  })

  it('recuerda si está callada u oculta, y descarta valores raros', () => {
    for (const mode of ['on', 'quiet', 'off']) {
      const d = raw()
      d.settings.mascot = mode
      d.settings.mascotMet = true
      expect(parsePersisted(JSON.stringify(d))?.settings).toMatchObject({ mascot: mode, mascotMet: true })
    }
    const weird = raw()
    weird.settings.mascot = 'gritando'
    weird.settings.mascotMet = 'sí'
    expect(parsePersisted(JSON.stringify(weird))?.settings).toMatchObject({ mascot: 'on', mascotMet: false })
  })

  it('recuerda cuántos pendientes se marcaron hoy y descarta datos raros', () => {
    const d = raw()
    expect(parsePersisted(JSON.stringify(d))?.settings.mascotDone).toEqual({ day: '', n: 0 })
    d.settings.mascotDone = { day: '2026-09-29', n: 4.9 }
    expect(parsePersisted(JSON.stringify(d))?.settings.mascotDone).toEqual({ day: '2026-09-29', n: 4 })
    for (const bad of [{ day: 5, n: 1 }, { day: 'x', n: -1 }, { day: 'x' }, 'x', null]) {
      d.settings.mascotDone = bad
      expect(parsePersisted(JSON.stringify(d))?.settings.mascotDone).toEqual({ day: '', n: 0 })
    }
  })

  it('recuerda dónde la dejaron, y repara o descarta posiciones raras', () => {
    const d = raw()
    expect(parsePersisted(JSON.stringify(d))?.settings.mascotPos).toBeNull()
    d.settings.mascotPos = { x: 0.3, y: 0.7 }
    expect(parsePersisted(JSON.stringify(d))?.settings.mascotPos).toEqual({ x: 0.3, y: 0.7 })
    d.settings.mascotPos = { x: 5, y: -2 }
    expect(parsePersisted(JSON.stringify(d))?.settings.mascotPos).toEqual({ x: 1, y: 0 })
    for (const bad of [{ x: 'a', y: 1 }, { x: 1 }, 'x', [1, 2], null]) {
      d.settings.mascotPos = bad
      expect(parsePersisted(JSON.stringify(d))?.settings.mascotPos).toBeNull()
    }
  })
})

describe('íconos pegados al guardar y cargar', () => {
  const raw = () => JSON.parse(JSON.stringify(pickPersisted(createDefaultState(1))))

  it('lo guardado antes de la Etapa 3 (sin íconos) se sigue abriendo', () => {
    const old = raw()
    delete old.stickers
    delete old.settings.recentIcons
    const back = parsePersisted(JSON.stringify(old))
    expect(back).not.toBeNull()
    expect(back?.stickers).toEqual({})
    expect(back?.settings.recentIcons).toEqual([])
  })

  it('descarta íconos sin dibujo, de tableros inexistentes o de un posit que ya no existe', () => {
    const data = raw()
    const [noteId] = Object.keys(data.notes)
    const [boardId] = Object.keys(data.boards)
    const ok = { boardId, icon: 'fuego', noteId: null, x: 1, y: 2, size: 60, tilt: 4, z: 3, createdAt: 1, updatedAt: 1 }
    data.stickers = {
      bueno: ok,
      sinIcono: { ...ok, icon: '' },
      tableroFantasma: { ...ok, boardId: 'nada' },
      positFantasma: { ...ok, noteId: 'nada' },
      pegado: { ...ok, noteId },
    }
    const back = parsePersisted(JSON.stringify(data))
    expect(Object.keys(back?.stickers ?? {}).sort()).toEqual(['bueno', 'pegado'])
  })

  it('repara tamaños absurdos y números inválidos, y nextZ queda por encima del z de los íconos', () => {
    const data = raw()
    const [boardId] = Object.keys(data.boards)
    data.nextZ = 2
    data.stickers = {
      grande: { boardId, icon: 'sol', noteId: null, x: 'x', y: null, size: 99999, tilt: 'a', z: 40 },
      chico: { boardId, icon: 'sol', noteId: null, x: 0, y: 0, size: 1, z: 1 },
    }
    const back = parsePersisted(JSON.stringify(data))
    expect(back?.stickers.grande).toMatchObject({ x: 0, y: 0, size: 320, tilt: 0 })
    expect(back?.stickers.chico.size).toBe(24)
    expect(back?.nextZ).toBe(41)
  })

  it('los íconos recientes se limpian: solo texto y con tope', () => {
    const data = raw()
    data.settings.recentIcons = ['a', 3, null, ...Array.from({ length: 30 }, (_, i) => `i${i}`)]
    const back = parsePersisted(JSON.stringify(data))
    expect(back?.settings.recentIcons.every((v) => typeof v === 'string')).toBe(true)
    expect(back?.settings.recentIcons.length).toBeLessThanOrEqual(12)
  })

  it('agregar un ícono cuenta como cambio y se guarda', () => {
    vi.useFakeTimers()
    try {
      const storage = memoryStorage()
      const store = createPositsStore(createDefaultState(1))
      attachPersistence(store, storage, 100)
      store.getState().addSticker({ icon: 'rayo', x: 5, y: 5 })
      vi.advanceTimersByTime(200)
      expect(storage.writes).toBe(1)
      const saved = parsePersisted(storage.data.get(STORAGE_KEY) ?? null)
      expect(Object.values(saved?.stickers ?? {}).some((st) => st.icon === 'rayo')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
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
