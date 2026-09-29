import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { createDefaultState, taskDoc } from '../store/store'
import type { Note } from '../store/types'
import { applyPlan, colorByName, planActions, readAction, type PlanIO } from './actions'
import { buildSnapshot } from './context'
import { itemText, listsOf, looseLines } from './docOps'

const NOW = new Date(2026, 8, 29, 9, 0)

function world() {
  const base = createDefaultState(1000)
  const boardId = base.activeBoardId
  const mk = (id: string, x: number, doc: JSONContent | null, color = '#FFD95E'): Note => ({ id, boardId, x, y: 0, w: 240, h: 200, z: 1, color, doc, createdAt: 1, updatedAt: 1 })
  const notes: Record<string, Note> = {
    a: mk('a', 0, taskDoc('Compras', [['Guantes', false], ['Llamar al proveedor', false], ['Enviar oficio', true], ['Revisar stock', false]])),
    b: mk('b', 300, taskDoc('Hospital', [['Pedir cotización', false], ['Firmar acta', false]]), '#EF6A62'),
  }
  const state = { activeBoardId: boardId, boards: base.boards, boardOrder: base.boardOrder, notes }
  return { state, snap: buildSnapshot(state, { now: NOW }) }
}

/** Un «tablero» en memoria con la misma interfaz que usa la app. */
function memoryIO(state: { notes: Record<string, Note> }): PlanIO & { notes: Record<string, Note> } {
  const notes = state.notes
  let n = 0
  return {
    notes,
    readDoc: (id) => (notes[id] ? notes[id].doc : undefined),
    writeDoc: (id, doc) => {
      notes[id] = { ...notes[id], doc: JSON.parse(JSON.stringify(doc)) }
    },
    addNote: (doc, color) => {
      const id = `new${++n}`
      notes[id] = { ...notes.a, id, doc: JSON.parse(JSON.stringify(doc)), color: color ?? '#FFD95E' }
      return id
    },
    removeNote: (id) => {
      delete notes[id]
    },
    readColor: (id) => notes[id]?.color,
    setColor: (id, hex) => {
      notes[id] = { ...notes[id], color: hex }
    },
  }
}

const listTexts = (doc: JSONContent | null | undefined, no = 1): string[] => listsOf(doc)[no - 1].items.map(itemText)

describe('readAction', () => {
  it('acepta las acciones bien formadas y normaliza los alias', () => {
    expect(readAction({ do: 'reorder', note: 'N2', list: 1, order: [2, 1] })).toEqual({ do: 'reorder', note: 'n2', list: 1, order: [2, 1] })
    expect(readAction({ do: 'reorder', note: '2', order: ['2', '1'] })).toEqual({ do: 'reorder', note: 'n2', list: 1, order: [2, 1] })
    expect(readAction({ do: 'number', note: 'n1' })).toEqual({ do: 'number', note: 'n1', list: 1, start: 1 })
    expect(readAction({ do: 'set_done', note: 'n1', list: 1, items: [2], done: true })).toMatchObject({ do: 'set_done', items: [2], done: true })
    expect(readAction({ do: 'add_note', title: 'Plan', items: ['a', '  ', 'b'] })).toEqual({ do: 'add_note', title: 'Plan', items: ['a', 'b'], kind: 'tasks', color: undefined })
    expect(readAction({ do: 'add_items', note: 'n1', items: ['x'] })).toEqual({ do: 'add_items', note: 'n1', list: null, items: ['x'], kind: 'tasks' })
    expect(readAction({ do: 'set_color', note: 'n1', color: 'rojo' })).toEqual({ do: 'set_color', note: 'n1', color: 'rojo' })
  })

  it('rechaza lo que no entiende, con un motivo en español', () => {
    for (const bad of [null, 'x', 42, [], {}, { do: 'borrar_todo', note: 'n1' }, { do: 'reorder', note: 'n1' }, { do: 'reorder', note: 'posit uno', list: 1, order: [1] }, { do: 'reorder', note: 'n1', list: 1, order: [1, 'a'] }, { do: 'set_done', note: 'n1', items: [1] }, { do: 'set_color', note: 'n1', color: 'verde radiactivo' }, { do: 'add_note', title: '', items: [] }, { do: 'edit_item', note: 'n1', item: 1 }]) {
      expect(typeof readAction(bad)).toBe('string')
    }
    expect(readAction({ do: 'borrar_todo' })).toMatch(/No sé hacer «borrar_todo»/)
  })

  it('los colores se buscan por nombre sin importar mayúsculas ni tildes', () => {
    expect(colorByName('rojo')).toBe('#EF6A62')
    expect(colorByName('  CARBÓN ')).toBe('#3B3F46')
    expect(colorByName('carbon')).toBe('#3B3F46')
    expect(colorByName('#ffd95e')).toBe('#FFD95E')
    expect(colorByName('turquesita')).toBeNull()
  })
})

describe('planActions', () => {
  it('ordena una lista y describe el resultado', () => {
    const { state, snap } = world()
    const plan = planActions([{ do: 'reorder', note: 'n1', list: 1, order: [2, 1, 4, 3] }], snap, state)
    expect(plan.problems).toEqual([])
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0].text).toBe('Reordenar la lista 1 de «Compras» (4 renglones)')
    expect(plan.items[0].detail).toEqual(['1. Llamar al proveedor', '2. Guantes', '3. Revisar stock', '4. Enviar oficio'])
    expect(plan.steps).toHaveLength(1)
    const step = plan.steps[0]
    expect(step.kind).toBe('doc')
    // el plan no toca el estado
    expect(listTexts(state.notes.a.doc)[0]).toBe('Guantes')
  })

  it('encadena varias acciones sobre el mismo posit (ordenar y luego numerar)', () => {
    const { state, snap } = world()
    const plan = planActions(
      [
        { do: 'reorder', note: 'n1', list: 1, order: [2, 1] },
        { do: 'number', note: 'n1', list: 1 },
      ],
      snap,
      state,
    )
    expect(plan.problems).toEqual([])
    expect(plan.steps).toHaveLength(1)
    const after = (plan.steps[0] as { after: JSONContent }).after
    expect(listTexts(after)).toEqual(['1. Llamar al proveedor', '2. Guantes', '3. Enviar oficio', '4. Revisar stock'])
  })

  it('crea un posit nuevo con color y pendientes', () => {
    const { state, snap } = world()
    const plan = planActions([{ do: 'add_note', title: 'Plan de hoy', items: ['Firmar acta', 'Llamar a almacén'], color: 'Cielo' }], snap, state)
    expect(plan.items[0].text).toBe('Crear un posit nuevo «Plan de hoy» con 2 pendientes')
    expect(plan.steps).toEqual([{ kind: 'create', doc: expect.anything(), color: '#8ECDF5' }])
    const doc = (plan.steps[0] as { doc: JSONContent }).doc
    expect(looseLines(doc)).toEqual(['Plan de hoy'])
    expect(listTexts(doc)).toEqual(['Firmar acta', 'Llamar a almacén'])
  })

  it('marca hechos, agrega renglones, cambia un texto y pinta', () => {
    const { state, snap } = world()
    const plan = planActions(
      [
        { do: 'set_done', note: 'n1', list: 1, items: [1, 2], done: true },
        { do: 'add_items', note: 'n2', items: ['Archivar expediente'] },
        { do: 'edit_item', note: 'n2', list: 1, item: 1, text: 'Pedir cotización a tres proveedores' },
        { do: 'set_color', note: 'n1', color: 'Verde' },
      ],
      snap,
      state,
    )
    expect(plan.problems).toEqual([])
    expect(plan.items.map((i) => i.text)).toEqual([
      'Marcar como hechos 2 pendientes de «Compras»',
      'Agregar 1 renglón a «Hospital»',
      'Cambiar un renglón de «Hospital»',
      'Pintar el posit «Compras» de Verde',
    ])
    expect(plan.items[2].detail).toEqual(['antes: Pedir cotización', 'ahora: Pedir cotización a tres proveedores'])
    expect(plan.steps.map((s) => s.kind).sort()).toEqual(['color', 'doc', 'doc'])
  })

  it('descarta lo inválido y sigue con lo bueno, avisando de cada problema', () => {
    const { state, snap } = world()
    const plan = planActions(
      [
        { do: 'reorder', note: 'n9', list: 1, order: [1] },
        { do: 'reorder', note: 'n1', list: 3, order: [1] },
        { do: 'reorder', note: 'n1', list: 1, order: [1, 1] },
        { do: 'set_done', note: 'n1', list: 1, items: [9], done: true },
        { do: 'volar' },
        { do: 'number', note: 'n2', list: 1 },
      ],
      snap,
      state,
    )
    expect(plan.problems).toHaveLength(5)
    expect(plan.problems[0]).toMatch(/No veo el posit n9/)
    expect(plan.problems[1]).toMatch(/no tiene una lista 3/)
    expect(plan.problems[2]).toMatch(/no es válido/)
    expect(plan.problems[3]).toMatch(/no existe/)
    expect(plan.problems[4]).toMatch(/No sé hacer «volar»/)
    expect(plan.items).toHaveLength(1)
    expect(plan.steps).toHaveLength(1)
  })

  it('no aplica cambios a un posit que cambió desde la foto (pero da igual que se marque una casilla)', () => {
    const { state, snap } = world()
    const marked = { ...state, notes: { ...state.notes, a: { ...state.notes.a, doc: taskDoc('Compras', [['Guantes', true], ['Llamar al proveedor', false], ['Enviar oficio', true], ['Revisar stock', false]]) } } }
    expect(planActions([{ do: 'number', note: 'n1', list: 1 }], snap, marked).problems).toEqual([])
    const edited = { ...state, notes: { ...state.notes, a: { ...state.notes.a, doc: taskDoc('Compras', [['Guantes nuevos', false]]) } } }
    const plan = planActions([{ do: 'number', note: 'n1', list: 1 }], snap, edited)
    expect(plan.steps).toEqual([])
    expect(plan.problems[0]).toMatch(/cambió desde que hablamos/)
  })

  it('un posit que ya no existe o se fue del tablero no se toca', () => {
    const { state, snap } = world()
    const gone = { ...state, notes: { b: state.notes.b } }
    expect(planActions([{ do: 'number', note: 'n1', list: 1 }], snap, gone).problems[0]).toMatch(/ya no está/)
    const other = { ...state, activeBoardId: 'otro' }
    expect(planActions([{ do: 'number', note: 'n1', list: 1 }], snap, other).problems[0]).toMatch(/ya no está/)
  })

  it('pone tope al número de acciones', () => {
    const { state, snap } = world()
    const many = Array.from({ length: 12 }, (_, i) => ({ do: 'add_note', title: `Posit ${i}`, items: [] }))
    const plan = planActions(many, snap, state)
    expect(plan.items).toHaveLength(8)
    expect(plan.problems[0]).toMatch(/demasiadas/)
  })

  it('no deja marcar viñetas ni cambiar renglones con íconos', () => {
    const { state } = world()
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'idea' }] }] }] },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'avisar ' }, { type: 'inlineIcon', attrs: { icon: 'sirena' } }] }] }] },
      ],
    }
    const s2 = { ...state, notes: { ...state.notes, a: { ...state.notes.a, doc } } }
    const snap2 = buildSnapshot(s2, { now: NOW })
    const plan = planActions(
      [
        { do: 'set_done', note: 'n1', list: 1, items: [1], done: true },
        { do: 'edit_item', note: 'n1', list: 2, item: 1, text: 'otra cosa' },
      ],
      snap2,
      s2,
    )
    expect(plan.steps).toEqual([])
    expect(plan.problems[0]).toMatch(/no es de pendientes/)
    expect(plan.problems[1]).toMatch(/íconos o formato/)
  })
})

describe('applyPlan / deshacer', () => {
  it('aplica el plan y lo deshace dejando todo como estaba', () => {
    const { state, snap } = world()
    const io = memoryIO(state)
    const before = JSON.stringify(state.notes)
    const plan = planActions(
      [
        { do: 'reorder', note: 'n1', list: 1, order: [4, 3] },
        { do: 'number', note: 'n1', list: 1 },
        { do: 'set_color', note: 'n2', color: 'Verde' },
        { do: 'add_note', title: 'Resumen', items: ['Uno'] },
      ],
      snap,
      state,
    )
    const applied = applyPlan(plan, io)
    expect(listTexts(io.notes.a.doc)).toEqual(['1. Revisar stock', '2. Enviar oficio', '3. Guantes', '4. Llamar al proveedor'])
    expect(io.notes.b.color).toBe('#6CC070')
    expect(applied.created).toHaveLength(1)
    expect(looseLines(io.notes[applied.created[0]].doc)).toEqual(['Resumen'])

    expect(applied.undo()).toEqual({ restored: 3, skipped: 0 })
    expect(io.notes[applied.created[0]]).toBeUndefined()
    expect(JSON.stringify(io.notes)).toBe(before)
  })

  it('si la persona tocó el posit después, deshacer no le pisa su trabajo', () => {
    const { state, snap } = world()
    const io = memoryIO(state)
    const applied = applyPlan(planActions([{ do: 'number', note: 'n1', list: 1 }, { do: 'set_color', note: 'n2', color: 'Cielo' }], snap, state), io)
    io.writeDoc('a', taskDoc('Compras', [['Mi propio cambio', false]]))
    const r = applied.undo()
    expect(r).toEqual({ restored: 1, skipped: 1 })
    expect(listTexts(io.notes.a.doc)).toEqual(['Mi propio cambio'])
    expect(io.notes.b.color).toBe('#EF6A62')
  })

  it('un posit que se borró mientras tanto se salta sin fallar', () => {
    const { state, snap } = world()
    const io = memoryIO(state)
    const plan = planActions([{ do: 'number', note: 'n1', list: 1 }], snap, state)
    delete io.notes.a
    expect(() => applyPlan(plan, io)).not.toThrow()
  })
})
