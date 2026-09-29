import { describe, expect, it } from 'vitest'
import { createDefaultState, taskDoc, textDoc } from '../store/store'
import type { Note, PersistedState } from '../store/types'
import { buildSnapshot, dateLine, unchanged } from './context'
import { fingerprint, setDone } from './docOps'

const NOW = new Date(2026, 8, 29, 14, 35) // martes 29 de septiembre de 2026

function board(notes: Array<Partial<Note> & { id: string }>): Pick<PersistedState, 'boards' | 'boardOrder' | 'activeBoardId' | 'notes'> {
  const base = createDefaultState(1000)
  const boardId = base.activeBoardId
  const list: Record<string, Note> = {}
  for (const n of notes) {
    list[n.id] = { boardId, x: 0, y: 0, w: 240, h: 200, z: 1, color: '#FFD95E', doc: null, createdAt: 1, updatedAt: 1, ...n }
  }
  return { boards: base.boards, boardOrder: base.boardOrder, activeBoardId: boardId, notes: list }
}

describe('buildSnapshot', () => {
  const s = board([
    { id: 'b', x: 300, y: 0, color: '#EF6A62', doc: taskDoc('Hospital', [['Pedir cotización', false], ['Enviar oficio', true]]) },
    { id: 'a', x: 0, y: 0, doc: taskDoc('Compras', [['Guantes', false], ['Mascarillas', false], ['Jeringas', false]]) },
    { id: 'c', x: 0, y: 400, doc: textDoc('Idea suelta') },
  ])

  it('pone la fecha, cuenta y numera los posits en el orden en que se leen', () => {
    const snap = buildSnapshot(s, { now: NOW })
    expect(snap.text).toContain('Hoy es martes, 29 de septiembre de 2026')
    expect(snap.text).toContain('Tablero activo: «Mi tablero» — 3 posits, 4 pendientes abiertos y 1 hechos.')
    expect(Object.keys(snap.notes)).toEqual(['n1', 'n2', 'n3'])
    // a (x 0, arriba) → n1; b (x 300, arriba) → n2; c (más abajo) → n3
    expect(snap.notes.n1.id).toBe('a')
    expect(snap.notes.n2.id).toBe('b')
    expect(snap.notes.n3.id).toBe('c')
    expect(snap.totals).toEqual({ notes: 3, open: 4, done: 1 })
  })

  it('cada posit lleva su color, sus listas y sus renglones numerados con casilla', () => {
    const { text } = buildSnapshot(s, { now: NOW })
    expect(text).toContain('[n1] posit Amarillo · 0 de 3 pendientes hechos')
    expect(text).toContain('  texto: Compras')
    expect(text).toContain('  lista 1 (pendientes):')
    expect(text).toContain('    1. [ ] Guantes')
    expect(text).toContain('[n2] posit Rojo · 1 de 2 pendientes hechos')
    expect(text).toContain('    2. [x] Enviar oficio')
    expect(text).toContain('[n3] posit Amarillo\n  texto: Idea suelta')
  })

  it('los íconos y las viñetas se describen', () => {
    const doc = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'idea' }] }] }] }] }
    const { text } = buildSnapshot(board([{ id: 'x', doc }]), { now: NOW })
    expect(text).toContain('lista 1 (viñetas):')
    expect(text).toContain('    1. • idea')
  })

  it('un posit vacío se dice vacío', () => {
    expect(buildSnapshot(board([{ id: 'x' }]), { now: NOW }).text).toContain('[n1] posit Amarillo\n  (vacío)')
    expect(buildSnapshot(board([]), { now: NOW }).text).toContain('El tablero está vacío.')
  })

  it('sin permiso no manda el contenido: solo los conteos, y ningún alias', () => {
    const snap = buildSnapshot(s, { share: false, now: NOW })
    expect(snap.text).toContain('3 posits, 4 pendientes abiertos')
    expect(snap.text).not.toContain('Guantes')
    expect(snap.text).toContain('no permitió que leas el contenido')
    expect(snap.notes).toEqual({})
  })

  it('nombra los otros tableros solo con sus pendientes abiertos', () => {
    const base = board([{ id: 'a', doc: taskDoc('Compras', [['Guantes', false]]) }])
    const other = { id: 'b2', name: 'Casa', createdAt: 1, updatedAt: 1 }
    const withOther = {
      ...base,
      boards: { ...base.boards, b2: other },
      boardOrder: [...base.boardOrder, 'b2'],
      notes: { ...base.notes, z: { ...base.notes.a, id: 'z', boardId: 'b2', doc: taskDoc('Hogar', [['Foco', false], ['Pan', false]]) } },
    }
    const { text } = buildSnapshot(withOther, { now: NOW })
    expect(text).toContain('Otros tableros (solo sus nombres; no puedes verlos ni cambiarlos): «Casa» (2 pendientes abiertos).')
    expect(text).not.toContain('Foco')
  })

  it('si no cabe, resume los posits de menos pendientes y avisa (el elegido va completo)', () => {
    const many = board(
      Array.from({ length: 30 }, (_, i) => ({
        id: `n${i}`,
        x: (i % 5) * 300,
        y: Math.floor(i / 5) * 200,
        doc: taskDoc(`Tema ${i}`, Array.from({ length: 6 }, (_, k) => [`Pendiente ${i}-${k} con un texto un poco largo para gastar espacio`, false] as [string, boolean])),
      })),
    )
    const snap = buildSnapshot(many, { now: NOW, maxChars: 4000, selectedId: 'n29' })
    expect(snap.text.length).toBeLessThan(4400)
    expect(snap.text).toContain('(contenido omitido por espacio)')
    expect(snap.text).toMatch(/Por espacio, \d+ posits solo aparecen resumidos/)
    // el posit seleccionado aparece con todos sus renglones
    const alias = Object.values(snap.notes).find((n) => n.id === 'n29')!.alias
    expect(snap.text).toContain(`[${alias}] posit Amarillo · 0 de 6 pendientes hechos\n  texto: Tema 29`)
    // los aliases siguen siendo todos los posits, en orden de lectura
    expect(Object.keys(snap.notes)).toHaveLength(30)
  })

  it('recorta listas y textos enormes', () => {
    const doc = taskDoc('Lista', Array.from({ length: 60 }, (_, i) => [`Renglón ${i + 1} ${'x'.repeat(400)}`, false] as [string, boolean]))
    const { text } = buildSnapshot(board([{ id: 'x', doc }]), { now: NOW })
    expect(text).toContain('(20 renglones más)')
    expect(text).toContain('…')
    expect(text.length).toBeLessThan(14_000)
  })
})

describe('unchanged', () => {
  const s = board([{ id: 'a', doc: taskDoc('Compras', [['Guantes', false], ['Jeringas', false]]) }])
  const snap = buildSnapshot(s, { now: NOW })

  it('detecta si el posit sigue igual, sin contar las casillas', () => {
    const doc = s.notes.a.doc
    expect(unchanged(snap, 'n1', doc)).toBe(true)
    expect(unchanged(snap, 'n1', setDone(doc!, 1, [1], true))).toBe(true)
    expect(unchanged(snap, 'n1', taskDoc('Compras', [['Guantes', false]]))).toBe(false)
    expect(unchanged(snap, 'n9', doc)).toBe(false)
    expect(snap.notes.n1.fp).toBe(fingerprint(doc))
  })
})

describe('dateLine', () => {
  it('escribe el día en español, con la hora', () => {
    expect(dateLine(NOW)).toBe('martes, 29 de septiembre de 2026, 14:35')
  })
})
