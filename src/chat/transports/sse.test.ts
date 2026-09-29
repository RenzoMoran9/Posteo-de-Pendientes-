import { describe, expect, it } from 'vitest'
import { brief, isAbort, readErrorBody, readSSE } from './sse'

const enc = new TextEncoder()

/** Un cuerpo de respuesta que llega en los pedazos indicados (aunque partan un evento por la mitad). */
const body = (...chunks: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch))
      c.close()
    },
  })

async function collect(b: ReadableStream<Uint8Array> | null): Promise<string[]> {
  const out: string[] = []
  await readSSE(b, (d) => out.push(d))
  return out
}

describe('readSSE', () => {
  it('separa los eventos por línea en blanco', async () => {
    expect(await collect(body('data: uno\n\ndata: dos\n\n'))).toEqual(['uno', 'dos'])
  })

  it('junta los pedazos: un evento partido por la mitad se entrega entero', async () => {
    expect(await collect(body('data: {"a":', '1}\n', '\ndata: dos\n\n'))).toEqual(['{"a":1}', 'dos'])
  })

  it('entiende los saltos de línea de Windows (\\r\\n)', async () => {
    expect(await collect(body('data: uno\r\n\r\ndata: dos\r\n\r\n'))).toEqual(['uno', 'dos'])
  })

  it('un evento con varias líneas data: las une con salto de línea, e ignora event:, id: y comentarios', async () => {
    expect(await collect(body('event: x\nid: 3\n: comentario\ndata: a\ndata: b\n\n'))).toEqual(['a\nb'])
  })

  it('entrega el último evento aunque no termine con línea en blanco', async () => {
    expect(await collect(body('data: uno\n\ndata: cola'))).toEqual(['uno', 'cola'])
  })

  it('no rompe los acentos y emojis que llegan partidos entre pedazos', async () => {
    const bytes = enc.encode('data: canción ñandú 😀\n\n')
    const cut = 15 // en medio de un carácter de varios bytes
    const b = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, cut))
        c.enqueue(bytes.slice(cut))
        c.close()
      },
    })
    expect(await collect(b)).toEqual(['canción ñandú 😀'])
  })

  it('sin cuerpo no hace nada, y una línea sin data: se ignora', async () => {
    expect(await collect(null)).toEqual([])
    expect(await collect(body(': solo un comentario\n\n'))).toEqual([])
  })
})

describe('readErrorBody', () => {
  it('lee un JSON aunque el servicio diga que es otra cosa (Google responde «text/event-stream»)', async () => {
    const res = new Response('{"error":{"message":"clave mala"}}', { status: 400, headers: { 'content-type': 'text/event-stream' } })
    const r = await readErrorBody(res)
    expect(r.json).toEqual({ error: { message: 'clave mala' } })
  })

  it('si no es JSON, deja el texto', async () => {
    const r = await readErrorBody(new Response('Bad gateway', { status: 502 }))
    expect(r.json).toBeNull()
    expect(r.text).toBe('Bad gateway')
  })
})

describe('utilidades', () => {
  it('isAbort reconoce el aborto por la señal o por el nombre del error', () => {
    const c = new AbortController()
    expect(isAbort(new Error('x'), c.signal)).toBe(false)
    c.abort()
    expect(isAbort(new Error('x'), c.signal)).toBe(true)
    expect(isAbort({ name: 'AbortError' })).toBe(true)
    expect(isAbort(null)).toBe(false)
  })

  it('brief recorta y junta espacios', () => {
    expect(brief('  hola   mundo \n ')).toBe('hola mundo')
    expect(brief('x'.repeat(200), 10)).toBe('xxxxxxxxx…')
  })
})
