import { describe, expect, it } from 'vitest'
import { createDefaultState, taskDoc } from '../store/store'
import type { Note } from '../store/types'
import { planActions } from './actions'
import { buildSnapshot } from './context'
import { itemText, listsOf } from './docOps'
import { localReply, urgencyOf } from './local'

const NOW = new Date(2026, 8, 29, 9, 0)

function world(docs: Record<string, ReturnType<typeof taskDoc> | null>) {
  const base = createDefaultState(1000)
  const boardId = base.activeBoardId
  const notes: Record<string, Note> = {}
  let x = 0
  for (const [id, doc] of Object.entries(docs)) {
    notes[id] = { id, boardId, x: (x += 300), y: 0, w: 240, h: 200, z: 1, color: '#FFD95E', doc, createdAt: 1, updatedAt: 1 }
  }
  const state = { activeBoardId: boardId, boards: base.boards, boardOrder: base.boardOrder, notes }
  return { state, snap: buildSnapshot(state, { now: NOW }) }
}

const w = () =>
  world({
    compras: taskDoc('Compras', [
      ['Cotizar guantes', false],
      ['Llamar al proveedor', false],
      ['Firmar acta URGENTE hoy', false],
      ['Archivar oficios', true],
      ['Revisar stock', false],
    ]),
    hospital: taskDoc('Hospital', [['Enviar oficio mañana', false]]),
  })

describe('urgencyOf', () => {
  it('lo urgente y lo de hoy pesa más que lo demás', () => {
    expect(urgencyOf('Firmar acta urgente hoy')).toBeGreaterThan(urgencyOf('Enviar oficio mañana'))
    expect(urgencyOf('Enviar oficio mañana')).toBeGreaterThan(urgencyOf('Revisar stock'))
    expect(urgencyOf('Regar las plantas')).toBe(0)
  })
})

describe('localReply', () => {
  it('saluda y agradece', () => {
    const { state, snap } = w()
    expect(localReply('Hola', snap, state).text).toMatch(/mascota de Claude/)
    expect(localReply('muchas gracias', snap, state).text).toMatch(/De nada/)
  })

  it('resume los pendientes abiertos y los que suenan urgentes', () => {
    const { state, snap } = w()
    const r = localReply('¿Qué tengo pendiente?', snap, state)
    expect(r.actions).toEqual([])
    expect(r.text).toMatch(/Tienes 5 pendientes abiertos en 2 posits y 1 hecho; 1 suenan urgentes/)
    expect(r.text).toContain('1. Firmar acta URGENTE hoy (Compras)')
  })

  it('dice qué hacer primero, con los tres más urgentes', () => {
    const { state, snap } = w()
    const r = localReply('¿Qué hago primero?', snap, state)
    const lines = r.text.split('\n')
    expect(lines[0]).toMatch(/urgentes o para hoy/)
    expect(lines[1]).toBe('1. Firmar acta URGENTE hoy (Compras)')
    expect(lines[2]).toBe('2. Enviar oficio mañana (Hospital)')
    expect(lines).toHaveLength(4)
  })

  it('propone ordenar por urgencia con una acción que la app puede aplicar', () => {
    const { state, snap } = w()
    const r = localReply('Ordena mis pendientes', snap, state)
    expect(r.text).toMatch(/Te propongo ordenar «Compras»/)
    expect(r.actions).toEqual([{ do: 'reorder', note: 'n1', list: 1, order: [3, 2, 1, 5, 4] }])
    // el plan resultante es válido y deja lo hecho al final
    const plan = planActions(r.actions, snap, state)
    expect(plan.problems).toEqual([])
    const after = (plan.steps[0] as { after: Parameters<typeof listsOf>[0] }).after
    expect(listsOf(after)[0].items.map(itemText)).toEqual(['Firmar acta URGENTE hoy', 'Llamar al proveedor', 'Cotizar guantes', 'Revisar stock', 'Archivar oficios'])
  })

  it('ordena el posit seleccionado, aunque tenga menos pendientes', () => {
    const { state, snap } = world({
      a: taskDoc('A', [['uno', false], ['dos', false], ['tres', false]]),
      b: taskDoc('B', [['algo', false], ['urgente ya', false]]),
    })
    const r = localReply('ordena', snap, state, 'b')
    expect(r.actions).toEqual([{ do: 'reorder', note: 'n2', list: 1, order: [2, 1] }])
  })

  it('si ya está en buen orden, lo dice y no propone nada', () => {
    const { state, snap } = world({ a: taskDoc('A', [['urgente', false], ['algo', false], ['hecho', true]]) })
    const r = localReply('ordena', snap, state)
    expect(r.actions).toEqual([])
    expect(r.text).toMatch(/ya está en un buen orden/)
  })

  it('propone numerar la lista', () => {
    const { state, snap } = w()
    const r = localReply('enuméralos', snap, state)
    expect(r.actions).toEqual([{ do: 'number', note: 'n1', list: 1 }])
    expect(r.text).toMatch(/numerar los 5 renglones de «Compras»/)
  })

  it('con todo hecho lo celebra; con el tablero vacío o sin permiso lo explica', () => {
    const done = world({ a: taskDoc('A', [['x', true]]) })
    expect(localReply('¿qué tengo pendiente?', done.snap, done.state).text).toMatch(/No tienes pendientes abiertos/)
    const empty = world({})
    expect(localReply('ordena', empty.snap, empty.state).text).toMatch(/vacío/)
    const w1 = world({ a: taskDoc('A', [['x', false]]) })
    const blind = buildSnapshot(w1.state, { share: false, now: NOW })
    expect(localReply('ordena', blind, w1.state).text).toMatch(/No tengo permiso/)
  })

  it('lo que no entiende lo reconoce y explica qué sí sabe hacer', () => {
    const { state, snap } = w()
    const r = localReply('¿cuál es la capital de Francia?', snap, state)
    expect(r.actions).toEqual([])
    expect(r.text).toMatch(/sin conexión|no estoy conectado/i)
    expect(r.text).toContain('⚙ Ajustes')
  })
})
