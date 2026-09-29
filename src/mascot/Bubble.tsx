import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { cloudShape, hashString } from './cloud'
import { mascotStore, type Bubble as BubbleData } from './mascotStore'

/** No robar el foco al editor: así el teclado del celular no se cierra al tocar la nube. */
const keepFocus = (e: SyntheticEvent) => e.preventDefault()

const TYPE_MS = 26

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * La nube de comentarios: un contorno de bultitos dibujado a mano alrededor del texto, que se va escribiendo
 * letra por letra (y la mascota asiente y mueve los bracitos). Tocarla termina de escribirla y, ya escrita, la cierra. Se queda
 * mientras la miras (con el ratón encima o el dedo puesto) y luego se va sola.
 */
export function Bubble({ bubble, side }: { bubble: BubbleData; side: 'left' | 'right' }) {
  const { text, chips } = bubble
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [typed, setTyped] = useState(0)
  const [held, setHeld] = useState(false)
  const done = typed >= text.length

  // «escribe» el texto letra por letra
  useEffect(() => {
    if (prefersReducedMotion()) {
      setTyped(text.length)
      return
    }
    setTyped(0)
    mascotStore.getState().setTalking(true)
    let i = 0
    const id = setInterval(() => {
      i += 1
      setTyped(i)
      if (i >= text.length) {
        clearInterval(id)
        mascotStore.getState().setTalking(false)
      }
    }, TYPE_MS)
    return () => {
      clearInterval(id)
      mascotStore.getState().setTalking(false)
    }
  }, [bubble.id, text])

  // se va sola cuando ya se leyó (no mientras la tienes bajo el ratón o el dedo)
  useEffect(() => {
    if (held || !done) return
    const t = setTimeout(() => mascotStore.getState().hush(), bubble.ms)
    return () => clearTimeout(t)
  }, [bubble.id, held, done, bubble.ms])

  // el contorno se calcula para el tamaño real de la nube
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [bubble.id])

  const shape = useMemo(() => (size ? cloudShape(size.w, size.h, hashString(text), side) : null), [size, text, side])

  return (
    <div
      ref={boxRef}
      className="mb"
      data-side={side}
      onMouseDown={keepFocus}
      onPointerDown={keepFocus}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onClick={() => (done ? mascotStore.getState().hush() : setTyped(text.length))}
    >
      {size && shape && (
        <svg className="mb-cloud" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true" focusable="false">
          <path className="mb-cloud-body" d={shape.d} />
          {shape.tail.map(([cx, cy, rx, ry], i) => (
            <ellipse key={i} className="mb-cloud-body" cx={cx} cy={cy} rx={rx} ry={ry} />
          ))}
        </svg>
      )}
      {/* Los lectores de pantalla oyen el comentario entero de una vez, no letra por letra. */}
      <span className="sr-only" role="status">
        {text}
      </span>
      <p className="mb-text" aria-hidden="true">
        <span>{text.slice(0, typed)}</span>
        <span className="mb-rest">{text.slice(typed)}</span>
      </p>
      {chips.length > 0 && (
        <div className="mb-chips" data-ready={done || undefined}>
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              className="mb-chip"
              data-tone={c.tone ?? 'plain'}
              tabIndex={done ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation()
                c.run()
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
