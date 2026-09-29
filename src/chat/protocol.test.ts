import { describe, expect, it } from 'vitest'
import { parseBlocks, splitReply, visibleWhileStreaming } from './protocol'

describe('splitReply', () => {
  it('separa el texto del bloque de acciones', () => {
    const r = splitReply('Te propongo ordenar así.\n\n<acciones>\n[{"do":"number","note":"n1","list":1}]\n</acciones>')
    expect(r.text).toBe('Te propongo ordenar así.')
    expect(r.blocks).toEqual(['\n[{"do":"number","note":"n1","list":1}]\n'])
    expect(r.cut).toBe(false)
  })

  it('sin bloque, todo es texto', () => {
    expect(splitReply('Hola, ¿en qué te ayudo?')).toEqual({ text: 'Hola, ¿en qué te ayudo?', blocks: [], cut: false })
  })

  it('junta varios bloques y entiende mayúsculas', () => {
    const r = splitReply('a <ACCIONES>[1]</ACCIONES> b <acciones>[2]</acciones>')
    expect(r.blocks).toEqual(['[1]', '[2]'])
    expect(r.text).toBe('a  b')
  })

  it('si la respuesta se cortó dentro del bloque, lo avisa y no muestra el pedazo', () => {
    const r = splitReply('Va la propuesta.\n<acciones>\n[{"do":"reor')
    expect(r.cut).toBe(true)
    expect(r.blocks).toEqual([])
    expect(r.text).toBe('Va la propuesta.')
  })
})

describe('visibleWhileStreaming', () => {
  it('no enseña el bloque mientras se escribe', () => {
    expect(visibleWhileStreaming('Listo.\n<acciones>\n[{"do"')).toBe('Listo.')
    expect(visibleWhileStreaming('Listo.\n<accio')).toBe('Listo.')
    expect(visibleWhileStreaming('Listo. <')).toBe('Listo.')
  })

  it('un «<» que no es la marca sí se muestra', () => {
    expect(visibleWhileStreaming('si a < b entonces')).toBe('si a < b entonces')
    expect(visibleWhileStreaming('Hola')).toBe('Hola')
    expect(visibleWhileStreaming('<b>Hola</b>')).toBe('<b>Hola</b>')
  })
})

describe('parseBlocks', () => {
  it('lee una lista, un objeto suelto y varios bloques', () => {
    expect(parseBlocks(['[{"do":"a"},{"do":"b"}]']).actions).toHaveLength(2)
    expect(parseBlocks(['{"do":"a"}']).actions).toEqual([{ do: 'a' }])
    expect(parseBlocks(['[{"do":"a"}]', '[{"do":"b"}]']).actions).toHaveLength(2)
  })

  it('perdona vallas de código y comas de más', () => {
    expect(parseBlocks(['```json\n[{"do":"a"},]\n```']).actions).toEqual([{ do: 'a' }])
    expect(parseBlocks(['[{"do":"a",},]']).actions).toEqual([{ do: 'a' }])
  })

  it('un bloque roto da error y no inventa nada', () => {
    const r = parseBlocks(['[{"do":'])
    expect(r.actions).toEqual([])
    expect(r.error).toMatch(/formato/)
  })

  it('un bloque vacío no es un error', () => {
    expect(parseBlocks(['  ', '[]'])).toEqual({ actions: [] })
  })
})
