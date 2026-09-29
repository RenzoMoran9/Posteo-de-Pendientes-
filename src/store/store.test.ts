import { beforeEach, describe, expect, it } from 'vitest'
import { GRID } from '../lib/geometry'
import { NOTE_DEFAULTS, createDefaultState, createPositsStore, taskDoc, textDoc } from './store'

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
    expect(items).toHaveLength(4)
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
