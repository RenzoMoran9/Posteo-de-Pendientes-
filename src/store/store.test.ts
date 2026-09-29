import { beforeEach, describe, expect, it } from 'vitest'
import { GRID } from '../lib/geometry'
import { NOTE_DEFAULTS, STICKER_LIMITS, createDefaultState, createPositsStore, stickersOfNote, taskDoc, textDoc } from './store'

let store: ReturnType<typeof createPositsStore>
const S = () => store.getState()
const notes = () => Object.values(S().notes)

beforeEach(() => {
  store = createPositsStore(createDefaultState(1))
})

describe('crear posits', () => {
  it('nace con el color del marcador en la mano, encima de todo y seleccionado', () => {
    S().pickColor('#CDB4F6')
    const id = S().addNote({ x: 600, y: 0, edit: true })
    const n = S().notes[id]
    expect(n.color).toBe('#CDB4F6')
    expect(n.z).toBe(Math.max(...notes().map((x) => x.z)))
    expect(S().selectedId).toBe(id)
    expect(S().editingId).toBe(id)
    expect(n.w).toBe(NOTE_DEFAULTS.w)
  })

  it('no nace encima de otro: busca un hueco libre', () => {
    const first = notes()[0]
    const id = S().addNote({ x: first.x, y: first.y })
    const n = S().notes[id]
    const overlap = n.x < first.x + first.w && n.x + n.w > first.x && n.y < first.y + first.h && n.y + n.h > first.y
    expect(overlap).toBe(false)
  })

  it('con exact:true respeta el lugar elegido aunque tape a otro', () => {
    const first = notes()[0]
    S().toggleMagnet()
    const id = S().addNote({ x: first.x + 5, y: first.y + 5, exact: true })
    expect(S().notes[id].x).toBe(first.x + 5)
  })

  it('con el imán activo, los posits nuevos quedan alineados a la cuadrícula', () => {
    const id = S().addNote({ x: 1000.7, y: 333.2, exact: true })
    expect(S().notes[id].x % GRID).toBe(0)
    expect(S().notes[id].y % GRID).toBe(0)
  })
})

describe('mover, redimensionar y colorear', () => {
  it('patchNote cambia solo lo pedido y actualiza la fecha', async () => {
    const id = notes()[0].id
    const before = S().notes[id]
    await new Promise((r) => setTimeout(r, 3))
    S().patchNote(id, { x: 100, y: 200 })
    const after = S().notes[id]
    expect(after.x).toBe(100)
    expect(after.y).toBe(200)
    expect(after.w).toBe(before.w)
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt)
  })

  it('un marcador cambia el color del posit seleccionado y del siguiente', () => {
    const id = notes()[0].id
    S().select(id)
    S().pickColor('#8ECDF5')
    expect(S().notes[id].color).toBe('#8ECDF5')
    expect(S().settings.defaultColor).toBe('#8ECDF5')
  })

  it('sin posit seleccionado, el marcador solo cambia el color de los nuevos', () => {
    const id = notes()[0].id
    const original = S().notes[id].color
    S().select(null)
    S().pickColor('#62D2C8')
    expect(S().notes[id].color).toBe(original)
    expect(S().settings.defaultColor).toBe('#62D2C8')
  })

  it('una pluma cambia la letra del posit seleccionado y la de los siguientes', () => {
    const id = notes()[0].id
    S().select(id)
    S().pickFont('caveat')
    expect(S().notes[id].font).toBe('caveat')
    expect(S().settings.defaultFont).toBe('caveat')
    const next = S().addNote({ x: 900, y: 0 })
    expect(S().notes[next].font).toBe('caveat')
  })

  it('sin posit seleccionado, la pluma solo cambia la letra de los nuevos', () => {
    const id = notes()[0].id
    S().select(null)
    S().pickFont('marker')
    expect(S().notes[id].font).toBeUndefined()
    expect(S().settings.defaultFont).toBe('marker')
    const next = S().addNote({ x: 900, y: 0 })
    expect(S().notes[next].font).toBe('marker')
  })

  it('la letra de siempre no se anota en el posit nuevo, y una letra que no existe se ignora', () => {
    S().pickFont('patrick')
    S().pickFont('kalam')
    const next = S().addNote({ x: 900, y: 0 })
    expect('font' in S().notes[next]).toBe(false)
    S().pickFont('no-existe')
    expect(S().settings.defaultFont).toBe('kalam')
  })

  it('un posit puede nacer con su propia letra, sin cambiar la que se tiene en la mano', () => {
    S().pickFont('gochi')
    const id = S().addNote({ x: 900, y: 0, font: 'altura' })
    expect(S().notes[id].font).toBe('altura')
    expect(S().settings.defaultFont).toBe('gochi')
  })

  it('escribir guarda el documento', () => {
    const id = notes()[0].id
    S().setDoc(id, textDoc('hola'))
    expect(JSON.stringify(S().notes[id].doc)).toContain('hola')
  })
})

describe('selección y orden de apilamiento', () => {
  it('seleccionar trae el posit al frente', () => {
    const a = S().addNote({ x: 1000, y: 0 })
    const b = S().addNote({ x: 2000, y: 0 })
    expect(S().notes[b].z).toBeGreaterThan(S().notes[a].z)
    S().select(a)
    expect(S().notes[a].z).toBeGreaterThan(S().notes[b].z)
  })

  it('seleccionar el que ya está arriba no gasta números de z', () => {
    const a = S().addNote({ x: 1000, y: 0 })
    const z = S().nextZ
    S().select(a)
    expect(S().nextZ).toBe(z)
  })

  it('cambiar de posit termina la escritura del anterior', () => {
    const a = S().addNote({ x: 1000, y: 0, edit: true })
    const b = S().addNote({ x: 2000, y: 0 })
    expect(S().editingId).toBe(null) // b se creó sin edit: no debe quedar editando a
    S().startEditing(a)
    S().select(b)
    expect(S().editingId).toBe(null)
    expect(S().selectedId).toBe(b)
  })

  it('stopEditing solo cierra el posit indicado', () => {
    const a = S().addNote({ x: 1000, y: 0, edit: true })
    S().stopEditing('otro')
    expect(S().editingId).toBe(a)
    S().stopEditing(a)
    expect(S().editingId).toBe(null)
  })
})

describe('borrar y deshacer', () => {
  it('borra, avisa y Deshacer lo devuelve idéntico', () => {
    const id = S().addNote({ x: 1000, y: 0, color: '#8E3E5A', doc: textDoc('importante') })
    const original = S().notes[id]
    S().deleteNote(id)
    expect(S().notes[id]).toBeUndefined()
    expect(S().selectedId).toBe(null)
    expect(S().toast?.message).toBe('Posit borrado')

    S().toast?.onAction?.()
    const back = S().notes[id]
    expect(back.color).toBe(original.color)
    expect(back.doc).toEqual(original.doc)
    expect(back.x).toBe(original.x)
    expect(S().toast).toBeNull()
  })

  it('borrar uno que no existe no hace nada', () => {
    const n = notes().length
    S().deleteNote('fantasma')
    expect(notes().length).toBe(n)
    expect(S().toast).toBeNull()
  })
})

describe('duplicar', () => {
  it('hace una copia independiente, desplazada y seleccionada', () => {
    const id = S().addNote({ x: 1000, y: 0, doc: textDoc('original') })
    const copyId = S().duplicateNote(id) as string
    const copy = S().notes[copyId]
    expect(copyId).not.toBe(id)
    expect(copy.x).toBe(S().notes[id].x + GRID)
    expect(S().selectedId).toBe(copyId)
    S().setDoc(copyId, textDoc('cambiado'))
    expect(JSON.stringify(S().notes[id].doc)).toContain('original')
  })
})

describe('letra del posit', () => {
  it('un posit nuevo no trae letra (usa la de siempre) y se puede cambiar por posit', () => {
    const a = S().addNote({ x: 1000, y: 0 })
    const b = S().addNote({ x: 2000, y: 0 })
    expect(S().notes[a].font).toBeUndefined()
    S().patchNote(a, { font: 'caveat' })
    expect(S().notes[a].font).toBe('caveat')
    expect(S().notes[b].font).toBeUndefined()
  })

  it('duplicar un posit conserva su letra', () => {
    const a = S().addNote({ x: 1000, y: 0 })
    S().patchNote(a, { font: 'marker' })
    const copy = S().duplicateNote(a) as string
    expect(S().notes[copy].font).toBe('marker')
  })
})

describe('vista por tablero', () => {
  it('guarda el zoom de cada tablero por separado', () => {
    const board = S().activeBoardId
    S().setView(board, { x: 10, y: 20, z: 1.5 })
    expect(S().views[board]).toEqual({ x: 10, y: 20, z: 1.5 })
  })
})

describe('documentos con listas', () => {
  it('el posit de bienvenida trae una lista de pendientes con uno ya marcado', () => {
    const welcome = Object.values(createDefaultState(1).notes)[0]
    const lists = (welcome.doc?.content ?? []).filter((n) => n.type === 'taskList')
    const items = lists.flatMap((l) => l.content ?? [])
    expect(items).toHaveLength(5)
    expect(items.filter((i) => i.attrs?.checked)).toHaveLength(1)
  })

  it('taskDoc arma título + lista con el estado de cada casilla', () => {
    const doc = taskDoc('Compras', [
      ['Leche', false],
      ['Pan', true],
    ])
    expect(doc.content?.[0]).toMatchObject({ type: 'paragraph' })
    const list = doc.content?.[1]
    expect(list?.type).toBe('taskList')
    expect(list?.content?.map((i) => i.attrs?.checked)).toEqual([false, true])
  })

  it('un posit con lista sobrevive al guardado y a la recarga', () => {
    const store2 = createPositsStore(createDefaultState(1))
    const id = store2.getState().addNote({ x: 900, y: 0, doc: taskDoc('Hoy', [['Llamar', true]]) })
    const saved = JSON.stringify(store2.getState().notes[id].doc)
    expect(JSON.parse(saved).content[1].content[0].attrs.checked).toBe(true)
  })
})

describe('íconos pegados', () => {
  const stickers = () => Object.values(S().stickers)
  const looseIds = () => stickers().filter((st) => st.noteId === null).map((st) => st.id)

  it('el posit de bienvenida trae un ícono de ejemplo pegado en su esquina', () => {
    const welcome = notes()[0]
    const own = stickersOfNote(S(), welcome.id)
    expect(own).toHaveLength(1)
    expect(own[0].icon).toBe('brillos')
    expect(own[0].boardId).toBe(welcome.boardId)
  })

  it('un ícono nuevo queda seleccionado, encima de todo y con una inclinación pequeña', () => {
    const id = S().addSticker({ icon: 'fuego', x: 500, y: 40 })
    const st = S().stickers[id]
    expect(S().selectedStickerId).toBe(id)
    expect(S().selectedId).toBeNull()
    expect(st.noteId).toBeNull()
    expect(st.z).toBe(S().nextZ - 1)
    expect(Math.abs(st.tilt)).toBeLessThanOrEqual(6)
    expect(st.size).toBe(56)
  })

  it('el tamaño siempre queda dentro de los límites', () => {
    const id = S().addSticker({ icon: 'fuego', size: 5000 })
    expect(S().stickers[id].size).toBe(STICKER_LIMITS.max)
    S().patchSticker(id, { size: 1 })
    expect(S().stickers[id].size).toBe(STICKER_LIMITS.min)
  })

  it('pegado a un posit: sus coordenadas son relativas y va con el posit', () => {
    const note = notes()[0]
    const id = S().addSticker({ icon: 'sirena', noteId: note.id, x: 10, y: -12 })
    expect(S().stickers[id].noteId).toBe(note.id)
    S().patchNote(note.id, { x: 480, y: 96 })
    // no se toca: es relativo al posit
    expect(S().stickers[id].x).toBe(10)
    expect(S().stickers[id].y).toBe(-12)
  })

  it('un noteId que no existe lo deja suelto en la hoja', () => {
    const id = S().addSticker({ icon: 'sol', noteId: 'no-existe', x: 3, y: 4 })
    expect(S().stickers[id].noteId).toBeNull()
  })

  it('placeSticker lo pega a un posit o lo suelta, y lo trae al frente', () => {
    const note = notes()[0]
    const id = S().addSticker({ icon: 'rayo', x: 900, y: 900 })
    const z0 = S().stickers[id].z
    S().placeSticker(id, { noteId: note.id, x: 30, y: 8 })
    expect(S().stickers[id]).toMatchObject({ noteId: note.id, x: 30, y: 8 })
    expect(S().stickers[id].z).toBeGreaterThan(z0)
    S().placeSticker(id, { noteId: null, x: 700, y: 20 })
    expect(S().stickers[id]).toMatchObject({ noteId: null, x: 700, y: 20 })
  })

  it('seleccionar un ícono deselecciona el posit (y al revés) y trae al frente el ícono y su posit', () => {
    const a = S().addNote({ x: 1000, y: 0 })
    const b = S().addNote({ x: 2000, y: 0 })
    const id = S().addSticker({ icon: 'estrella', noteId: a, x: 5, y: 5 })
    S().select(b)
    expect(S().selectedStickerId).toBeNull()
    S().selectSticker(id)
    expect(S().selectedId).toBeNull()
    expect(S().selectedStickerId).toBe(id)
    expect(S().notes[a].z).toBeGreaterThan(S().notes[b].z)
    S().select(b)
    expect(S().selectedStickerId).toBeNull()
    expect(S().selectedId).toBe(b)
  })

  it('borrar un ícono avisa y Deshacer lo devuelve igual', () => {
    const id = S().addSticker({ icon: 'campana', x: 100, y: 50, size: 80, tilt: 3 })
    const original = S().stickers[id]
    S().deleteSticker(id)
    expect(S().stickers[id]).toBeUndefined()
    expect(S().selectedStickerId).toBeNull()
    expect(S().toast?.message).toBe('Ícono borrado')
    S().toast?.onAction?.()
    expect(S().stickers[id]).toMatchObject({ icon: 'campana', x: 100, y: 50, size: 80, tilt: 3, noteId: null })
    expect(S().stickers[id].createdAt).toBe(original.createdAt)
    expect(S().toast).toBeNull()
  })

  it('duplicar un ícono hace una copia desplazada y seleccionada', () => {
    const id = S().addSticker({ icon: 'trofeo', x: 100, y: 100 })
    const copyId = S().duplicateSticker(id) as string
    expect(copyId).not.toBe(id)
    expect(S().stickers[copyId]).toMatchObject({ icon: 'trofeo', x: 114, y: 114 })
    expect(S().selectedStickerId).toBe(copyId)
  })

  it('al borrar un posit se borran sus íconos, y Deshacer devuelve el posit con ellos', () => {
    const note = notes()[0]
    const before = stickersOfNote(S(), note.id).length
    S().addSticker({ icon: 'fuego', noteId: note.id, x: 1, y: 1 })
    expect(stickersOfNote(S(), note.id)).toHaveLength(before + 1)
    const loose = S().addSticker({ icon: 'sol', x: 1500, y: 0 })
    S().deleteNote(note.id)
    expect(stickersOfNote(S(), note.id)).toHaveLength(0)
    expect(S().stickers[loose]).toBeDefined() // los sueltos no se tocan
    S().toast?.onAction?.()
    expect(S().notes[note.id]).toBeDefined()
    expect(stickersOfNote(S(), note.id)).toHaveLength(before + 1)
  })

  it('duplicar un posit duplica también sus íconos', () => {
    const note = notes()[0]
    const before = stickersOfNote(S(), note.id)
    const copyId = S().duplicateNote(note.id) as string
    const twins = stickersOfNote(S(), copyId)
    expect(twins).toHaveLength(before.length)
    expect(twins.map((t) => t.icon).sort()).toEqual(before.map((t) => t.icon).sort())
    expect(twins.every((t) => !before.some((b) => b.id === t.id))).toBe(true)
    expect(looseIds()).toHaveLength(0)
  })

  it('los íconos usados se recuerdan: el último primero, sin repetir, con tope', () => {
    for (const icon of ['a', 'b', 'c', 'a']) S().rememberIcon(icon)
    expect(S().settings.recentIcons.slice(0, 3)).toEqual(['a', 'c', 'b'])
    for (let i = 0; i < 30; i++) S().rememberIcon(`x${i}`)
    expect(S().settings.recentIcons).toHaveLength(12)
    expect(S().settings.recentIcons[0]).toBe('x29')
  })

  it('un ícono nuevo puede pegarse sin quitarle la selección a quien está escribiendo', () => {
    const note = notes()[0]
    S().startEditing(note.id)
    const id = S().addSticker({ icon: 'sirena', noteId: note.id, x: 10, y: 10, select: false })
    expect(S().stickers[id]).toBeDefined()
    expect(S().selectedId).toBe(note.id)
    expect(S().editingId).toBe(note.id)
    expect(S().selectedStickerId).toBeNull()
    const other = S().addSticker({ icon: 'sol', x: 0, y: 0 })
    expect(S().selectedStickerId).toBe(other)
    expect(S().editingId).toBeNull()
  })

  it('la mascota: modo (habla / callada / oculta) y presentación se recuerdan en los ajustes', () => {
    expect(S().settings.mascot).toBe('on')
    expect(S().settings.mascotMet).toBe(false)
    S().setMascotMode('quiet')
    expect(S().settings.mascot).toBe('quiet')
    S().setMascotMode('off')
    expect(S().settings.mascot).toBe('off')
    const same = S().settings
    S().setMascotMode('off')
    expect(S().settings).toBe(same) // sin cambio no se vuelve a guardar
    S().markMascotMet()
    expect(S().settings.mascotMet).toBe(true)
  })

  it('cuenta los pendientes marcados hoy y empieza de cero al cambiar de día', () => {
    expect(S().countMascotDone('2026-09-29')).toBe(1)
    expect(S().countMascotDone('2026-09-29')).toBe(2)
    expect(S().settings.mascotDone).toEqual({ day: '2026-09-29', n: 2 })
    expect(S().countMascotDone('2026-09-30')).toBe(1)
  })

  it('el sitio donde se deja a la mascota se guarda (entre 0 y 1) y se puede devolver a su lugar', () => {
    expect(S().settings.mascotPos).toBeNull()
    S().setMascotPos({ x: 0.25, y: 0.8 })
    expect(S().settings.mascotPos).toEqual({ x: 0.25, y: 0.8 })
    S().setMascotPos({ x: -3, y: 9 })
    expect(S().settings.mascotPos).toEqual({ x: 0, y: 1 })
    S().setMascotPos(null)
    expect(S().settings.mascotPos).toBeNull()
  })

  it('el panel de íconos se abre para el tablero o para el texto de un posit', () => {
    S().openIcons({ mode: 'board' })
    expect(S().iconPanel).toEqual({ mode: 'board' })
    S().openIcons({ mode: 'text', noteId: 'n1' })
    expect(S().iconPanel).toEqual({ mode: 'text', noteId: 'n1' })
    S().closeIcons()
    expect(S().iconPanel).toBeNull()
  })
})
