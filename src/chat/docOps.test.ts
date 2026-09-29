import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { taskDoc } from '../store/store'
import {
  addItems,
  buildDoc,
  editItemText,
  fingerprint,
  itemText,
  listsOf,
  looseLines,
  noteTitle,
  numberList,
  reorderList,
  setDone,
  taskCount,
} from './docOps'

const compras = (): JSONContent =>
  taskDoc('Compras del hospital', [
    ['Cotizar guantes', false],
    ['Llamar al proveedor', true],
    ['Enviar oficio', false],
    ['Revisar stock', false],
  ])

const texts = (doc: JSONContent, listNo = 1): string[] => listsOf(doc)[listNo - 1].items.map(itemText)

describe('lectura del documento', () => {
  it('encuentra las listas, su tipo y sus renglones', () => {
    const doc = compras()
    doc.content!.push({ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'idea' }] }] }] })
    const lists = listsOf(doc)
    expect(lists.map((l) => [l.no, l.kind, l.items.length])).toEqual([
      [1, 'tasks', 4],
      [2, 'bullets', 1],
    ])
    expect(looseLines(doc)).toEqual(['Compras del hospital'])
    expect(noteTitle(doc)).toBe('Compras del hospital')
    expect(taskCount(doc)).toEqual({ total: 4, done: 1 })
  })

  it('el nombre del posit es su primer renglón, recortado', () => {
    expect(noteTitle(null)).toBe('sin título')
    expect(noteTitle({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('sin título')
    expect(noteTitle(buildDoc('Un título larguísimo que no cabe en el nombre corto del posit', [], 'text'), 20)).toBe('Un título larguísim…')
  })

  it('los íconos dentro del texto se leen como «[ícono: nombre]»', () => {
    const item: JSONContent = { type: 'taskItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Avisar ' }, { type: 'inlineIcon', attrs: { icon: 'sirena' } }] }] }
    expect(itemText(item)).toMatch(/^Avisar \[ícono: .+\]$/)
  })

  it('la huella no cambia al marcar una casilla, pero sí al cambiar un renglón', () => {
    const a = compras()
    const marked = setDone(a, 1, [1], true)!
    expect(fingerprint(marked)).toBe(fingerprint(a))
    expect(fingerprint(addItems(a, 1, ['Uno más'])!)).not.toBe(fingerprint(a))
    expect(fingerprint(editItemText(a, 1, 1, 'Cotizar mascarillas')!)).not.toBe(fingerprint(a))
    expect(fingerprint(null)).toBe(fingerprint(undefined))
  })
})

describe('reorderList', () => {
  it('pone los renglones en el orden pedido (por sus números actuales)', () => {
    const out = reorderList(compras(), 1, [3, 1, 4, 2])!
    expect(texts(out)).toEqual(['Enviar oficio', 'Cotizar guantes', 'Revisar stock', 'Llamar al proveedor'])
    // el renglón marcado sigue marcado
    expect(listsOf(out)[0].items.map((i) => !!i.attrs?.checked)).toEqual([false, false, false, true])
  })

  it('si solo nombra algunos, esos van arriba y los demás siguen en su orden', () => {
    expect(texts(reorderList(compras(), 1, [4, 3])!)).toEqual(['Revisar stock', 'Enviar oficio', 'Cotizar guantes', 'Llamar al proveedor'])
  })

  it('no toca el original y no admite números repetidos ni inexistentes', () => {
    const doc = compras()
    reorderList(doc, 1, [2, 1])
    expect(texts(doc)[0]).toBe('Cotizar guantes')
    expect(reorderList(doc, 1, [1, 1])).toBeNull()
    expect(reorderList(doc, 1, [5])).toBeNull()
    expect(reorderList(doc, 1, [0])).toBeNull()
    expect(reorderList(doc, 2, [1])).toBeNull()
  })

  it('deja intacto el resto del posit (título, otras listas)', () => {
    const doc = compras()
    const out = reorderList(doc, 1, [2, 1])!
    expect(looseLines(out)).toEqual(['Compras del hospital'])
    expect(out.content!.length).toBe(doc.content!.length)
  })
})

describe('numberList', () => {
  it('antepone «1. », «2. »… sin perder las casillas', () => {
    const out = numberList(compras(), 1)!
    expect(texts(out)).toEqual(['1. Cotizar guantes', '2. Llamar al proveedor', '3. Enviar oficio', '4. Revisar stock'])
    expect(listsOf(out)[0].items[1].attrs?.checked).toBe(true)
  })

  it('si ya tenían número, los cambia (por ejemplo, después de reordenar)', () => {
    const once = numberList(compras(), 1)!
    const shuffled = reorderList(once, 1, [3, 1, 2, 4])!
    expect(texts(shuffled)[0]).toBe('3. Enviar oficio')
    expect(texts(numberList(shuffled, 1)!)).toEqual(['1. Enviar oficio', '2. Cotizar guantes', '3. Llamar al proveedor', '4. Revisar stock'])
  })

  it('puede empezar en otro número y respeta el formato del renglón', () => {
    const doc: JSONContent = { type: 'doc', content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'urgente', marks: [{ type: 'bold' }] }] }] }] }] }
    const out = numberList(doc, 1, 5)!
    const node = listsOf(out)[0].items[0].content![0].content![0]
    expect(node.text).toBe('5. urgente')
    expect(node.marks).toEqual([{ type: 'bold' }])
  })

  it('un renglón que empieza con un ícono recibe el número antes del ícono', () => {
    const doc: JSONContent = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'inlineIcon', attrs: { icon: 'sirena' } }, { type: 'text', text: ' avisar' }] }] }] }] }
    const inline = listsOf(numberList(doc, 1)!)[0].items[0].content![0].content!
    expect(inline[0]).toEqual({ type: 'text', text: '1.' + ' ' })
    expect(inline[1].type).toBe('inlineIcon')
  })

  it('no numera una lista que no existe', () => {
    expect(numberList(compras(), 3)).toBeNull()
  })
})

describe('addItems', () => {
  it('agrega al final de la lista indicada', () => {
    const out = addItems(compras(), 1, ['  Pedir   firma ', 'Archivar'])!
    expect(texts(out).slice(-2)).toEqual(['Pedir firma', 'Archivar'])
    expect(listsOf(out)[0].items.at(-1)!.attrs?.checked).toBe(false)
  })

  it('sin lista, usa la primera del tipo pedido o crea una al final', () => {
    expect(texts(addItems(compras(), null, ['Extra'])!).at(-1)).toBe('Extra')
    const out = addItems(textOnly(), null, ['Pendiente A', 'Pendiente B'])!
    expect(listsOf(out)[0].kind).toBe('tasks')
    expect(texts(out)).toEqual(['Pendiente A', 'Pendiente B'])
    expect(looseLines(out)).toEqual(['Solo texto'])
    expect(listsOf(addItems(compras(), null, ['Idea'], 'bullets')!).map((l) => l.kind)).toEqual(['tasks', 'bullets'])
  })

  it('un posit vacío no deja el párrafo en blanco delante de la lista', () => {
    const out = addItems(null, null, ['Primero'])!
    expect(out.content![0].type).toBe('taskList')
    expect(addItems({ type: 'doc', content: [{ type: 'paragraph' }] }, null, ['Primero'])!.content).toHaveLength(1)
  })

  it('ignora lo vacío y rechaza una lista inexistente', () => {
    expect(addItems(compras(), 1, ['  ', ''])).toBeNull()
    expect(addItems(compras(), 4, ['x'])).toBeNull()
  })
})

const textOnly = (): JSONContent => buildDoc('Solo texto', [], 'text')

describe('setDone', () => {
  it('marca y desmarca pendientes por su número', () => {
    const on = setDone(compras(), 1, [1, 3], true)!
    expect(listsOf(on)[0].items.map((i) => !!i.attrs?.checked)).toEqual([true, true, true, false])
    const off = setDone(on, 1, [2], false)!
    expect(listsOf(off)[0].items.map((i) => !!i.attrs?.checked)).toEqual([true, false, true, false])
  })

  it('no vale en viñetas ni con números fuera de la lista', () => {
    const bullets = buildDoc('Ideas', ['a', 'b'], 'bullets')
    expect(setDone(bullets, 1, [1], true)).toBeNull()
    expect(setDone(compras(), 1, [9], true)).toBeNull()
  })
})

describe('editItemText', () => {
  it('cambia el texto de un renglón y deja los demás', () => {
    const out = editItemText(compras(), 1, 3, '  Enviar el oficio de   pedido ')!
    expect(texts(out)).toEqual(['Cotizar guantes', 'Llamar al proveedor', 'Enviar el oficio de pedido', 'Revisar stock'])
    expect(listsOf(out)[0].items[1].attrs?.checked).toBe(true)
  })

  it('no reescribe renglones con íconos o negritas (se perderían) ni vacíos', () => {
    const withIcon: JSONContent = { type: 'doc', content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a ' }, { type: 'inlineIcon', attrs: { icon: 'sirena' } }] }] }] }] }
    expect(editItemText(withIcon, 1, 1, 'b')).toBeNull()
    expect(editItemText(compras(), 1, 1, '   ')).toBeNull()
    expect(editItemText(compras(), 1, 9, 'x')).toBeNull()
  })
})

describe('buildDoc', () => {
  it('arma un título con pendientes, viñetas o líneas', () => {
    const t = buildDoc('Plan de hoy', ['Uno', 'Dos'], 'tasks')
    expect(looseLines(t)).toEqual(['Plan de hoy'])
    expect(listsOf(t)[0].kind).toBe('tasks')
    expect(texts(t)).toEqual(['Uno', 'Dos'])
    expect(listsOf(buildDoc('Ideas', ['x'], 'bullets'))[0].kind).toBe('bullets')
    expect(looseLines(buildDoc('Notas', ['a', 'b'], 'text'))).toEqual(['Notas', 'a', 'b'])
  })

  it('un posit sin nada queda con un párrafo en blanco (válido para el editor)', () => {
    expect(buildDoc('', [], 'tasks')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })

  it('recorta los textos larguísimos', () => {
    const long = 'x'.repeat(900)
    expect(itemText(listsOf(buildDoc('t', [long], 'tasks'))[0].items[0]).length).toBe(300)
  })
})
