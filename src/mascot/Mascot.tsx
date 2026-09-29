import { useEffect, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { getEditor } from '../board/editors'
import { chat, useChat } from '../chat/chatStore'
import { useCoarsePointer } from '../hooks/useCoarsePointer'
import { store, useStore } from '../store/store'
import { Bubble } from './Bubble'
import { ClawdArt, ClawdPeek, type MascotRefs } from './ClawdArt'
import { POINTER_MEMORY_MS, isDoubleBlink, lookAt, nextBlinkDelay, type Pt } from './gaze'
import { mascotStore, useMascot } from './mascotStore'
import { setMode, startMascotBrain } from './watch'

/**
 * La vida de la mascota: mira al cursor (o al dedo), y si hace rato que no lo mueves, al cursor de escritura, al posit
 * seleccionado o a cualquier lado; gira el cuerpo hacia lo que mira, corre los ojos sobre la cara y parpadea de vez en
 * cuando. Todo se escribe directo en el DOM (sin pasar por React) para que sea fluido.
 */
function useLife(refs: MascotRefs, root: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return
    const tilt = refs.tilt.current
    const anchor = refs.anchor.current
    const eyes = refs.eyes.current
    const el = root.current
    if (!tilt || !anchor || !eyes || !el) return

    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    let pointer: (Pt & { at: number }) | null = null
    let glance: (Pt & { until: number }) | null = null
    let raf = 0
    let last = ''

    const caret = (): Pt | null => {
      const id = store.getState().editingId
      const ed = id ? getEditor(id) : undefined
      if (!ed || ed.isDestroyed || !ed.isFocused) return null
      try {
        const c = ed.view.coordsAtPos(ed.state.selection.head)
        return { x: (c.left + c.right) / 2, y: (c.top + c.bottom) / 2 }
      } catch {
        return null
      }
    }
    const centerOfNote = (id: string): Pt | null => {
      const n = document.querySelector(`[data-note-id="${id}"]`)
      if (!n) return null
      const r = n.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    /** Con la conversación abierta, mira hacia donde se escribe (el campo de texto, o el panel si no hay campo). */
    const centerOfChat = (): Pt | null => {
      const c = document.querySelector('[data-chat-input]') ?? document.querySelector('[data-chat]')
      if (!c) return null
      const r = c.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    const target = (): Pt | null => {
      const now = performance.now()
      if (pointer && now - pointer.at < POINTER_MEMORY_MS) return pointer
      if (chat.getState().open) return centerOfChat()
      const s = store.getState()
      if (s.editingId) return caret() ?? centerOfNote(s.editingId)
      if (s.selectedId) return centerOfNote(s.selectedId)
      if (glance && now < glance.until) return glance
      return null
    }

    const apply = () => {
      raf = 0
      // el ancla es un punto entre los dos ojos: en pantalla queda justo donde están (con el giro y la perspectiva)
      const r = anchor.getBoundingClientRect()
      const eye = { x: r.left, y: r.top }
      const look = lookAt(eye, el.dataset.mood === 'sleep' ? null : target())
      const k = reduce ? 0.35 : 1
      const key = [look.ex, look.ey, look.rx, look.ry].map((v) => (v * k).toFixed(2)).join()
      if (key === last) return
      last = key
      eyes.style.setProperty('--ex', (look.ex * k).toFixed(3))
      eyes.style.setProperty('--ey', (look.ey * k).toFixed(3))
      tilt.style.setProperty('--rx', `${(look.rx * k).toFixed(1)}deg`)
      tilt.style.setProperty('--ry', `${(look.ry * k).toFixed(1)}deg`)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }

    const onPointer = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY, at: performance.now() }
      schedule()
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('pointerdown', onPointer, { passive: true })
    // el cursor de escritura, el posit seleccionado y las miradas al aire cambian sin que se mueva el ratón
    const poll = setInterval(schedule, 160)

    // de vez en cuando mira por ahí, si no hay nada en particular que mirar
    let glanceTimer: ReturnType<typeof setTimeout>
    const wander = () => {
      const now = performance.now()
      glance = { x: Math.random() * innerWidth, y: Math.random() * innerHeight * 0.8, until: now + 900 + Math.random() * 1000 }
      glanceTimer = setTimeout(wander, 3200 + Math.random() * 4200)
    }
    glanceTimer = setTimeout(wander, 2500)

    // parpadeo (a veces doble)
    let blinkTimer: ReturnType<typeof setTimeout>
    const shut = (ms: number) => {
      el.dataset.blink = '1'
      setTimeout(() => delete el.dataset.blink, ms)
    }
    const blink = () => {
      const m = el.dataset.mood
      if (m !== 'sleep' && m !== 'happy') {
        shut(130)
        if (isDoubleBlink()) setTimeout(() => shut(120), 290)
      }
      blinkTimer = setTimeout(blink, nextBlinkDelay())
    }
    blinkTimer = setTimeout(blink, 1400)

    schedule()
    return () => {
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onPointer)
      clearInterval(poll)
      clearTimeout(glanceTimer)
      clearTimeout(blinkTimer)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [active, refs, root])
}

/** La mascotita asomando, cuando está escondida: un toque y vuelve. */
function Peek() {
  return (
    <button type="button" className="mascot-peek" aria-label="Mostrar a Claude, la mascota" title="Mostrar a la mascota" onClick={() => setMode('on')}>
      <ClawdPeek />
    </button>
  )
}

/** Lee una medida en píxeles de una variable CSS (--top-h, --dock-h, --m-room…). */
function px(el: Element, name: string, fallback = 0): number {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/**
 * La mascota de Claude: un muñeco de bloques en 3D (ver ClawdArt.tsx) que vive sobre el estuche. Mira lo que haces,
 * parpadea, se duerme si no tocas nada y comenta lo que escribes en una nube (ver brain.ts). Al tocarla contesta y
 * ofrece «Que calle» / «Ocultar»; si estorba, se arrastra a otro sitio y ahí se queda (en cada dispositivo).
 */
export function Mascot() {
  const mode = useStore((s) => s.settings.mascot)
  const pos = useStore((s) => s.settings.mascotPos)
  const editing = useStore((s) => s.editingId !== null)
  const coarse = useCoarsePointer()
  const mood = useMascot((s) => (s.asleep ? 'sleep' : s.mood))
  const talking = useMascot((s) => s.talking)
  const hops = useMascot((s) => s.hops)
  const bubble = useMascot((s) => s.bubble)
  const chatOpen = useChat((s) => s.open)

  const rootRef = useRef<HTMLDivElement>(null)
  const refs = useRef<MascotRefs>({ tilt: { current: null }, anchor: { current: null }, eyes: { current: null } }).current
  const drag = useRef<{ pid: number; sx: number; sy: number; left0: number; top0: number; moved: boolean; x: number; y: number } | null>(null)
  const justDragged = useRef(false)

  useEffect(() => startMascotBrain(), [])
  useLife(refs, rootRef, mode !== 'off')

  // ── arrastrarla: el dedo (o el ratón) la lleva por el espacio libre; al soltarla se guarda dónde quedó ──
  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault() // no le quita el foco al editor: el teclado del celular sigue abierto
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const box = rootRef.current?.getBoundingClientRect()
    if (!box) return
    drag.current = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, left0: box.left, top0: box.top, moved: false, x: pos?.x ?? 1, y: pos?.y ?? 1 }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* el puntero ya se soltó */
    }
  }
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    const el = rootRef.current
    if (!d || d.pid !== e.pointerId || !el) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved) {
      if (Math.hypot(dx, dy) < (e.pointerType === 'mouse' ? 4 : 9)) return
      d.moved = true
      el.setAttribute('data-dragging', '')
      mascotStore.getState().hush()
      mascotStore.getState().feel('surprised', 120_000)
    }
    const app = (el.offsetParent ?? document.body).getBoundingClientRect()
    const size = el.offsetWidth
    const top = px(document.documentElement, '--top-h') + px(el, '--m-room', 230)
    const w = Math.max(1, app.width - size)
    const h = Math.max(1, app.height - top - px(document.documentElement, '--dock-h', 110) - size)
    d.x = clamp01((d.left0 + dx - app.left) / w)
    d.y = clamp01((d.top0 + dy - app.top - top) / h)
    el.style.setProperty('--mx', String(d.x))
    el.style.setProperty('--my', String(d.y))
    el.setAttribute('data-custom', '')
  }
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pid !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    rootRef.current?.removeAttribute('data-dragging')
    store.getState().setMascotPos({ x: d.x, y: d.y })
    mascotStore.getState().feel('happy', 900)
    // el «clic» que llega después de soltar no es un toque en ella
    justDragged.current = true
    setTimeout(() => (justDragged.current = false), 0)
  }

  if (mode === 'off') return <Peek />

  const custom = pos !== null
  const style = custom ? ({ '--mx': pos.x, '--my': pos.y } as CSSProperties) : undefined
  return (
    <div
      ref={rootRef}
      className="mascot"
      style={style}
      data-mood={mood}
      data-talking={talking && mood !== 'sleep' && mood !== 'happy' ? '1' : undefined}
      data-hop={hops === 0 ? undefined : hops % 2 === 0 ? 'b' : 'a'}
      data-compact={editing && coarse ? '1' : undefined}
      data-quiet={mode === 'quiet' ? '1' : undefined}
      data-chat={chatOpen ? '1' : undefined}
      data-custom={custom ? '' : undefined}
    >
      {bubble && <Bubble key={bubble.id} bubble={bubble} side={custom && pos.x < 0.5 ? 'left' : 'right'} />}
      <button
        type="button"
        className="mascot-figure"
        aria-label="Tu asistente (la mascota de Claude). Tócala para conversar; arrástrala para moverla"
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          if (!justDragged.current) chat.getState().toggle()
        }}
      >
        <ClawdArt refs={refs} />
      </button>
    </div>
  )
}
