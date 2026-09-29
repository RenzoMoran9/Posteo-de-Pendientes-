/**
 * Lee una respuesta en «server-sent events» (el formato en que las IA mandan el texto a medida que lo escriben) y entrega
 * el `data:` de cada evento ya separado. Los eventos se separan con una línea en blanco (`\n\n` o `\r\n\r\n`), pueden llegar
 * partidos en varios pedazos y un mismo evento puede traer varias líneas `data:` (se unen con salto de línea).
 */
export async function readSSE(body: ReadableStream<Uint8Array> | null, onData: (data: string) => void): Promise<void> {
  if (!body) return
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  const handle = (raw: string): void => {
    const data = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
    if (data) onData(data)
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      for (;;) {
        const m = /\r?\n\r?\n/.exec(buf)
        if (!m) break
        handle(buf.slice(0, m.index))
        buf = buf.slice(m.index + m[0].length)
      }
    }
    buf += decoder.decode()
    if (buf.trim()) handle(buf)
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* ya estaba suelto */
    }
  }
}

/** ¿Es un aborto pedido por la persona (o por el navegador)? */
export const isAbort = (e: unknown, signal?: AbortSignal): boolean =>
  !!signal?.aborted || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError')

/** Lo que dijo el servicio cuando falló: intenta leerlo como JSON (aunque diga que es otra cosa) y, si no, deja el texto. */
export async function readErrorBody(res: Response): Promise<{ json: unknown; text: string }> {
  let text = ''
  try {
    text = await res.text()
  } catch {
    text = ''
  }
  try {
    return { json: JSON.parse(text) as unknown, text }
  } catch {
    return { json: null, text }
  }
}

/** Recorta un mensaje del servicio para mostrarlo entre paréntesis sin llenar la pantalla. */
export const brief = (s: string, max = 140): string => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}
