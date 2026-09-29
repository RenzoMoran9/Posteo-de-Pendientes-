import {
  GRID,
  MAX_ZOOM,
  MIN_ZOOM,
  angleTo,
  anchoredShift,
  clamp,
  diagonalScale,
  magnet,
  normalizeAngle,
  scaleRange,
  snapTilt,
  type View,
} from '../lib/geometry'
import { NOTE_LIMITS, NOTE_SCALE, STICKER_LIMITS, noteScale, stickersOfNote, store } from '../store/store'
import { addNoteAtClient, cancelReveal, persistViewSoon, revealNote } from './actions'
import { beginEditing, endEditing } from './editors'
import { view } from './view'

type Axis = 'both' | 'x' | 'y'

interface Tracked {
  x: number
  y: number
  /** El navegador se encarga (escribir dentro del texto, casillas…): no lo tocamos. */
  native: boolean
}

type NotePress = {
  kind: 'note'
  pid: number
  type: string
  sx: number
  sy: number
  moved: boolean
  id: string
  el: HTMLElement
  inZone: boolean
  x0: number
  y0: number
  x: number
  y: number
}

/** Un ícono pegado (suelto o sobre un posit). x/y están en el mismo marco que las coordenadas guardadas. */
type StickerPress = {
  kind: 'sticker'
  pid: number
  type: string
  sx: number
  sy: number
  moved: boolean
  id: string
  el: HTMLElement
  noteId: string | null
  /** Escala del posit al que está pegado (1 si está suelto): x/y del ícono están en el marco del posit, ya escalado. */
  k: number
  tilt: number
  x0: number
  y0: number
  x: number
  y: number
}

type Press =
  | { kind: 'pan'; pid: number; type: string; sx: number; sy: number; lx: number; ly: number; moved: boolean }
  | NotePress
  | StickerPress
  | {
      kind: 'sticker-resize'
      pid: number
      sx: number
      sy: number
      id: string
      el: HTMLElement
      s0: number
      x0: number
      y0: number
      /** Cuánto crece el lado por cada píxel arrastrado en horizontal / vertical (depende de cuánto esté girado el ícono). */
      kx: number
      ky: number
      /** Escala del posit al que está pegado (1 si está suelto). */
      k: number
      s: number
      x: number
      y: number
    }
  | {
      kind: 'sticker-rotate'
      pid: number
      type: string
      sx: number
      sy: number
      id: string
      el: HTMLElement
      /** Centro del ícono en la pantalla: el giro se mide desde ahí. */
      cx: number
      cy: number
      t0: number
      /** Ángulo del puntero en el último movimiento y giro acumulado (sin saltos al cruzar los ±180°). */
      last: number
      total: number
      tilt: number
      moved: boolean
    }
  | {
      kind: 'resize'
      pid: number
      sx: number
      sy: number
      id: string
      el: HTMLElement
      axis: Axis
      /** Escala con la que empieza el posit y sus medidas sin escalar: ancho, alto mínimo y alto real (el texto puede alargarlo). */
      k0: number
      w0: number
      h0: number
      realH0: number
      /** Lo que va quedando (escala, ancho y alto mínimo). */
      k: number
      w: number
      h: number
      /** Íconos pegados al posit: dónde estaban y dónde van, para que sigan al borde más cercano cuando cambian el ancho o el alto. */
      pinned: Array<{ id: string; el: HTMLElement | null; x0: number; y0: number; cx: number; cy: number; x: number; y: number }>
    }

/** Cuánto se puede mover el dedo (o el ratón) y seguir contando como "toque". */
const slop = (type: string): number => (type === 'mouse' ? 4 : 10)
const DOUBLE_MS = 340

/**
 * Motor de gestos del tablero:
 *  - un dedo / ratón sobre el fondo → desplaza el tablero
 *  - dos dedos → zoom y desplazamiento a la vez
 *  - sobre un posit → tocar selecciona, tocar de nuevo escribe, arrastrar lo mueve
 *  - sobre el tirador de la esquina → agranda o achica TODO el posit en diagonal (papel, letra e íconos pegados);
 *    sobre los de los bordes (solo con ratón) → cambia solo el ancho o el alto y el texto se acomoda
 *  - sobre un ícono pegado → tocar lo selecciona, arrastrar lo mueve (se pega al posit sobre el que se suelte);
 *    su tirador de la esquina cambia el tamaño y el de arriba lo gira
 *  - rueda: desplaza; Ctrl/⌘ + rueda (o pellizco en el trackpad): zoom
 */
export function attachGestures(board: HTMLElement, world: HTMLElement): () => void {
  const pointers = new Map<number, Tracked>()
  let press: Press | null = null
  let pinch: { d0: number; cx: number; cy: number; v0: View } | null = null
  let ignoreUntilUp = false
  let lastEmptyTap = { t: 0, x: 0, y: 0 }

  const setGesturing = (on: boolean) => {
    if (on) world.setAttribute('data-gesturing', '')
    else world.removeAttribute('data-gesturing')
  }
  const capture = (id: number) => {
    try {
      board.setPointerCapture(id)
    } catch {
      /* el puntero ya se soltó */
    }
  }
  const release = (id: number) => {
    try {
      board.releasePointerCapture(id)
    } catch {
      /* nada que soltar */
    }
  }

  function hitInfo(target: EventTarget | null) {
    const el = target instanceof Element ? target : null
    const noteEl = el?.closest<HTMLElement>('[data-note-id]') ?? null
    if (!el || !noteEl) return null
    return {
      noteEl,
      id: noteEl.dataset.noteId as string,
      axis: el.closest<HTMLElement>('[data-resize]')?.dataset.resize as Axis | undefined,
      noDrag: !!el.closest('[data-no-drag]'),
      inText: !!el.closest('.ProseMirror'),
      inZone: !!el.closest('[data-drag-zone]'),
    }
  }

  /** Un ícono pegado (tiene prioridad sobre el posit que hay debajo). */
  function stickerHit(target: EventTarget | null) {
    const el = target instanceof Element ? target : null
    const stickerEl = el?.closest<HTMLElement>('[data-sticker-id]') ?? null
    if (!el || !stickerEl) return null
    return {
      el: stickerEl,
      id: stickerEl.dataset.stickerId as string,
      resize: !!el.closest('[data-resize-sticker]'),
      rotate: !!el.closest('[data-rotate-sticker]'),
    }
  }

  function selectNote(id: string) {
    const s = store.getState()
    if (s.editingId && s.editingId !== id) endEditing()
    store.getState().select(id)
  }

  function selectSticker(id: string) {
    if (store.getState().editingId) endEditing()
    store.getState().selectSticker(id)
  }

  /** El posit que queda bajo el punto (el de más arriba), sin contar el ícono que se arrastra. */
  function noteAt(cx: number, cy: number, ignore: HTMLElement): string | null {
    for (const el of document.elementsFromPoint(cx, cy)) {
      if (ignore.contains(el)) continue
      if (!board.contains(el)) return null
      const noteEl = el.closest<HTMLElement>('[data-note-id]')
      if (noteEl) return noteEl.dataset.noteId ?? null
    }
    return null
  }

  // ───────────────────────── pinch ─────────────────────────

  function pair(): [Tracked, Tracked] {
    const it = pointers.values()
    return [it.next().value as Tracked, it.next().value as Tracked]
  }

  function beginPinch() {
    if (press) {
      const pr = press
      press = null
      release(pr.pid)
      finish(pr, null, false)
    }
    const [a, b] = pair()
    const r = view.rect()
    pinch = {
      d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      cx: (a.x + b.x) / 2 - r.left,
      cy: (a.y + b.y) / 2 - r.top,
      v0: { ...view.get() },
    }
    setGesturing(true)
  }

  function updatePinch() {
    if (!pinch) return
    const [a, b] = pair()
    const r = view.rect()
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    const mx = (a.x + b.x) / 2 - r.left
    const my = (a.y + b.y) / 2 - r.top
    const z = clamp(pinch.v0.z * (d / pinch.d0), MIN_ZOOM, MAX_ZOOM)
    const bx = (pinch.cx - pinch.v0.x) / pinch.v0.z
    const by = (pinch.cy - pinch.v0.y) / pinch.v0.z
    view.set({ x: mx - bx * z, y: my - by * z, z })
  }

  function endPinch() {
    pinch = null
    setGesturing(false)
    persistViewSoon()
    // el dedo que queda no debe mover el tablero de golpe
    ignoreUntilUp = pointers.size > 0
  }

  // ───────────────────────── press begin ─────────────────────────

  function beginPan(e: PointerEvent) {
    press = {
      kind: 'pan',
      pid: e.pointerId,
      type: e.pointerType,
      sx: e.clientX,
      sy: e.clientY,
      lx: e.clientX,
      ly: e.clientY,
      moved: false,
    }
    capture(e.pointerId)
  }

  function beginNotePress(e: PointerEvent, el: HTMLElement, id: string, inZone: boolean) {
    const n = store.getState().notes[id]
    if (!n) return
    press = {
      kind: 'note',
      pid: e.pointerId,
      type: e.pointerType,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
      id,
      el,
      inZone,
      x0: n.x,
      y0: n.y,
      x: n.x,
      y: n.y,
    }
    capture(e.pointerId)
  }

  /** Escala del posit al que está pegado un ícono (1 si está suelto en la hoja). */
  function parentScale(noteId: string | null): number {
    const parent = noteId ? store.getState().notes[noteId] : undefined
    return parent ? noteScale(parent) : 1
  }

  function beginStickerPress(e: PointerEvent, el: HTMLElement, id: string) {
    const st = store.getState().stickers[id]
    if (!st) return
    press = {
      kind: 'sticker',
      pid: e.pointerId,
      type: e.pointerType,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
      id,
      el,
      noteId: st.noteId,
      k: parentScale(st.noteId),
      tilt: st.tilt,
      x0: st.x,
      y0: st.y,
      x: st.x,
      y: st.y,
    }
    capture(e.pointerId)
  }

  function beginStickerResize(e: PointerEvent, el: HTMLElement, id: string) {
    const st = store.getState().stickers[id]
    if (!st) return
    // El tirador está en la esquina de abajo a la derecha del ícono, que gira con él: hacia dónde queda "afuera"
    // en la pantalla lo da el giro. El ícono crece desde su centro para que el tirador siga bajo el dedo.
    const r = (st.tilt * Math.PI) / 180
    press = {
      kind: 'sticker-resize',
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      id,
      el,
      s0: st.size,
      x0: st.x,
      y0: st.y,
      kx: Math.cos(r) - Math.sin(r),
      ky: Math.sin(r) + Math.cos(r),
      k: parentScale(st.noteId),
      s: st.size,
      x: st.x,
      y: st.y,
    }
    setGesturing(true)
    capture(e.pointerId)
  }

  function beginStickerRotate(e: PointerEvent, el: HTMLElement, id: string) {
    const st = store.getState().stickers[id]
    if (!st) return
    const box = el.getBoundingClientRect()
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    press = {
      kind: 'sticker-rotate',
      pid: e.pointerId,
      type: e.pointerType,
      sx: e.clientX,
      sy: e.clientY,
      id,
      el,
      cx,
      cy,
      t0: st.tilt,
      last: angleTo(cx, cy, e.clientX, e.clientY),
      total: 0,
      tilt: st.tilt,
      moved: false,
    }
    setGesturing(true)
    capture(e.pointerId)
  }

  function beginResize(e: PointerEvent, el: HTMLElement, id: string, axis: Axis) {
    const s = store.getState()
    const n = s.notes[id]
    if (!n) return
    const k0 = noteScale(n)
    press = {
      kind: 'resize',
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      id,
      el,
      axis,
      k0,
      w0: n.w,
      h0: n.h,
      // el alto real (el de verdad, sin escalar): con mucho texto el posit es más alto que el `h` guardado
      realH0: el.offsetHeight,
      k: k0,
      w: n.w,
      h: n.h,
      pinned: stickersOfNote(s, id).map((st) => ({
        id: st.id,
        el: el.querySelector<HTMLElement>(`[data-sticker-id="${st.id}"]`),
        x0: st.x,
        y0: st.y,
        cx: st.x + st.size / 2,
        cy: st.y + st.size / 2,
        x: st.x,
        y: st.y,
      })),
    }
    setGesturing(true)
    capture(e.pointerId)
  }

  // ───────────────────────── events ─────────────────────────

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return
    // si el tablero se estaba desplazando solo (por ejemplo, para mostrar un posit), lo que hagas tú manda
    view.stop()
    cancelReveal()

    const sticker = stickerHit(e.target)
    const hit = sticker ? null : hitInfo(e.target)
    const editingHere = hit ? store.getState().editingId === hit.id : false
    const native = !!hit && (hit.noDrag || (editingHere && hit.inText && !hit.inZone))
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, native })

    if (pointers.size >= 2) {
      if (pointers.size === 2 && !pinch) beginPinch()
      return
    }
    if (ignoreUntilUp || native) return

    if (e.pointerType === 'mouse' && e.button === 1) {
      beginPan(e)
      e.preventDefault()
      return
    }

    if (sticker) {
      if (sticker.rotate) beginStickerRotate(e, sticker.el, sticker.id)
      else if (sticker.resize) beginStickerResize(e, sticker.el, sticker.id)
      else beginStickerPress(e, sticker.el, sticker.id)
    } else if (hit) {
      if (hit.axis) beginResize(e, hit.noteEl, hit.id, hit.axis)
      else beginNotePress(e, hit.noteEl, hit.id, hit.inZone)
    } else {
      beginPan(e)
    }
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent) {
    const p = pointers.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    if (pinch) {
      updatePinch()
      return
    }
    if (p.native || ignoreUntilUp) return

    const pr = press
    if (!pr || pr.pid !== e.pointerId) return

    if (pr.kind === 'pan') {
      if (!pr.moved) {
        if (Math.hypot(e.clientX - pr.sx, e.clientY - pr.sy) < slop(pr.type)) return
        pr.moved = true
        board.setAttribute('data-panning', '')
        setGesturing(true)
      }
      const dx = e.clientX - pr.lx
      const dy = e.clientY - pr.ly
      pr.lx = e.clientX
      pr.ly = e.clientY
      view.panBy(dx, dy)
      return
    }

    const dx = e.clientX - pr.sx
    const dy = e.clientY - pr.sy
    const z = view.get().z
    const snap = store.getState().settings.magnet
    const tol = 9 / z

    if (pr.kind === 'note') {
      if (!pr.moved) {
        if (Math.hypot(dx, dy) < slop(pr.type)) return
        pr.moved = true
        selectNote(pr.id)
        pr.el.setAttribute('data-dragging', '')
        setGesturing(true)
      }
      let nx = pr.x0 + dx / z
      let ny = pr.y0 + dy / z
      if (snap) {
        nx = magnet(nx, GRID, tol)
        ny = magnet(ny, GRID, tol)
      }
      pr.x = nx
      pr.y = ny
      pr.el.style.translate = `${nx}px ${ny}px`
      return
    }

    if (pr.kind === 'sticker') {
      if (!pr.moved) {
        if (Math.hypot(dx, dy) < slop(pr.type)) return
        pr.moved = true
        selectSticker(pr.id)
        pr.el.setAttribute('data-dragging', '')
        setGesturing(true)
      }
      // libre (sin imán): el ícono va exactamente donde lo lleva el dedo (pegado a un posit escalado, sus medidas son las del posit)
      pr.x = pr.x0 + dx / (z * pr.k)
      pr.y = pr.y0 + dy / (z * pr.k)
      pr.el.style.translate = `${pr.x}px ${pr.y}px`
      return
    }

    if (pr.kind === 'sticker-resize') {
      // El ícono es cuadrado y crece desde su centro: el lado aumenta lo que el dedo se aleja del centro
      // a lo largo de la diagonal del tirador (que sigue el giro del ícono).
      const s = clamp(pr.s0 + (dx * pr.kx + dy * pr.ky) / (z * pr.k), STICKER_LIMITS.min, STICKER_LIMITS.max)
      const grow = s - pr.s0
      pr.s = s
      pr.x = pr.x0 - grow / 2
      pr.y = pr.y0 - grow / 2
      pr.el.style.width = `${s}px`
      pr.el.style.height = `${s}px`
      pr.el.style.translate = `${pr.x}px ${pr.y}px`
      return
    }

    if (pr.kind === 'sticker-rotate') {
      if (!pr.moved) {
        if (Math.hypot(dx, dy) < slop(pr.type)) return
        pr.moved = true
        pr.el.setAttribute('data-rotating', '')
      }
      // giro acumulado: el ícono sigue al dedo aunque este dé vueltas alrededor
      const a = angleTo(pr.cx, pr.cy, e.clientX, e.clientY)
      pr.total += normalizeAngle(a - pr.last)
      pr.last = a
      pr.tilt = snapTilt(pr.t0 + pr.total, { strict: e.shiftKey, free: e.altKey })
      pr.el.style.rotate = `${pr.tilt}deg`
      pr.el.style.setProperty('--tilt', String(pr.tilt))
      pr.el.setAttribute('data-angle', `${normalizeAngle(Math.round(pr.tilt))}°`)
      return
    }

    // cambio de tamaño del posit
    if (pr.axis === 'both') {
      // La esquina agranda o achica TODO el posit (papel, letra e íconos pegados) en diagonal, sin deformarlo: la escala
      // sale de cuánto se arrastró la esquina a lo largo de la diagonal de lo que se ve.
      const seen = { w: pr.w0 * pr.k0, h: pr.realH0 * pr.k0 }
      const range = scaleRange(pr.w0, NOTE_SCALE)
      let k = clamp(pr.k0 * diagonalScale(seen.w, seen.h, dx / z, dy / z), range.min, range.max)
      if (snap) k = clamp(magnet(pr.w0 * k, GRID, tol) / pr.w0, range.min, range.max)
      pr.k = k
      pr.el.style.scale = String(k)
      pr.el.style.setProperty('--nk', String(k))
      return
    }

    // Los bordes (solo con ratón) cambian el ancho o el alto del papel, con la escala que ya tiene: el texto se acomoda
    // y los íconos pegados se quedan a la misma distancia del borde que les queda más cerca.
    if (pr.axis === 'x') {
      let w = clamp(pr.w0 + dx / (z * pr.k0), NOTE_LIMITS.minW, NOTE_LIMITS.maxW)
      if (snap) w = clamp(magnet(w * pr.k0, GRID, tol) / pr.k0, NOTE_LIMITS.minW, NOTE_LIMITS.maxW)
      pr.w = w
      pr.el.style.width = `${w}px`
    } else {
      let h = clamp(pr.realH0 + dy / (z * pr.k0), NOTE_LIMITS.minH, NOTE_LIMITS.maxH)
      if (snap) h = clamp(magnet(h * pr.k0, GRID, tol) / pr.k0, NOTE_LIMITS.minH, NOTE_LIMITS.maxH)
      pr.h = h
      pr.el.style.setProperty('--note-min-h', `${h}px`)
    }
    const after = { w: pr.w, h: pr.el.offsetHeight }
    for (const p of pr.pinned) {
      const shift = anchoredShift({ x: p.cx, y: p.cy }, { w: pr.w0, h: pr.realH0 }, after)
      p.x = p.x0 + shift.dx
      p.y = p.y0 + shift.dy
      if (p.el) p.el.style.translate = `${p.x}px ${p.y}px`
    }
  }

  function onPointerUp(e: PointerEvent) {
    const p = pointers.get(e.pointerId)
    if (!p) return
    pointers.delete(e.pointerId)

    if (pinch) {
      if (pointers.size < 2) endPinch()
      return
    }
    if (ignoreUntilUp) {
      if (pointers.size === 0) ignoreUntilUp = false
      return
    }
    if (p.native) return

    const pr = press
    if (!pr || pr.pid !== e.pointerId) return
    press = null
    release(e.pointerId)
    finish(pr, e, e.type === 'pointercancel')
  }

  /** Cierra un gesto: confirma posición/tamaño en el almacén o interpreta el toque. */
  function finish(pr: Press, e: PointerEvent | null, cancelled: boolean) {
    if (pr.kind === 'pan') {
      board.removeAttribute('data-panning')
      setGesturing(false)
      if (pr.moved) {
        persistViewSoon()
        return
      }
      if (cancelled || !e) return
      const now = performance.now()
      const dbl =
        e.pointerType === 'mouse' &&
        now - lastEmptyTap.t < DOUBLE_MS &&
        Math.hypot(e.clientX - lastEmptyTap.x, e.clientY - lastEmptyTap.y) < 8
      lastEmptyTap = { t: now, x: e.clientX, y: e.clientY }
      if (dbl) {
        addNoteAtClient(e.clientX, e.clientY)
        return
      }
      endEditing()
      store.getState().select(null)
      return
    }

    if (pr.kind === 'note') {
      pr.el.removeAttribute('data-dragging')
      setGesturing(false)
      if (pr.moved) {
        store.getState().patchNote(pr.id, { x: pr.x, y: pr.y })
        return
      }
      if (cancelled || !e) return
      const s = store.getState()
      if (s.editingId === pr.id) return
      if (s.selectedId === pr.id && !pr.inZone) {
        beginEditing(pr.id, { x: e.clientX, y: e.clientY })
        return
      }
      selectNote(pr.id)
      revealNote(pr.id)
      return
    }

    if (pr.kind === 'sticker') {
      pr.el.removeAttribute('data-dragging')
      setGesturing(false)
      if (pr.moved) {
        dropSticker(pr)
        return
      }
      if (cancelled || !e) return
      selectSticker(pr.id)
      return
    }

    if (pr.kind === 'sticker-resize') {
      setGesturing(false)
      store.getState().patchSticker(pr.id, { size: pr.s, x: pr.x, y: pr.y })
      return
    }

    if (pr.kind === 'sticker-rotate') {
      setGesturing(false)
      pr.el.removeAttribute('data-rotating')
      pr.el.removeAttribute('data-angle')
      pr.el.style.removeProperty('--tilt')
      // un toque sin arrastrar (o un gesto cancelado) deja el ícono como estaba
      const tilt = pr.moved && !cancelled ? normalizeAngle(pr.tilt) : pr.t0
      pr.el.style.rotate = `${tilt}deg`
      if (tilt !== pr.t0) store.getState().patchSticker(pr.id, { tilt })
      return
    }

    setGesturing(false)
    const changed = pr.k !== pr.k0 || pr.w !== pr.w0 || pr.h !== pr.h0
    if (!changed) return
    const patch = pr.axis === 'both' ? { scale: pr.k } : pr.axis === 'x' ? { w: pr.w } : { h: pr.h }
    const stickers = Object.fromEntries(pr.pinned.filter((p) => p.x !== p.x0 || p.y !== p.y0).map((p) => [p.id, { x: p.x, y: p.y }]))
    store.getState().resizeNote(pr.id, patch, stickers)
  }

  /**
   * Al soltar un ícono: si el centro cae sobre un posit, se le pega (y desde entonces va con él);
   * si cae en la hoja, queda suelto. Las coordenadas se convierten al marco que corresponda.
   */
  function dropSticker(pr: StickerPress) {
    const s = store.getState()
    const box = pr.el.getBoundingClientRect()
    const targetId = noteAt(box.left + box.width / 2, box.top + box.height / 2, pr.el)
    const parent = pr.noteId ? s.notes[pr.noteId] : undefined
    // a coordenadas del tablero (el ícono pegado vive en el marco del posit, que puede estar escalado)
    const wx = (parent ? parent.x : 0) + pr.x * pr.k
    const wy = (parent ? parent.y : 0) + pr.y * pr.k
    const size = s.stickers[pr.id]?.size ?? 0
    const target = targetId ? s.notes[targetId] : undefined
    if (target) {
      // y de ahí al marco del posit destino; el ícono conserva el tamaño que se le ve
      const tk = noteScale(target)
      s.placeSticker(pr.id, { noteId: target.id, x: (wx - target.x) / tk, y: (wy - target.y) / tk, size: (size * pr.k) / tk })
    } else {
      s.placeSticker(pr.id, { noteId: null, x: wx, y: wy, size: size * pr.k })
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const k = e.deltaMode === 1 ? 16 : 1
    if (e.ctrlKey || e.metaKey) {
      const dy = clamp(e.deltaY * k, -120, 120)
      view.zoomAtClient(e.clientX, e.clientY, view.get().z * Math.exp(-dy * 0.0022))
    } else if (e.shiftKey && e.deltaX === 0) {
      view.panBy(-e.deltaY * k, 0)
    } else {
      view.panBy(-e.deltaX * k, -e.deltaY * k)
    }
    persistViewSoon()
  }

  function onContextMenu(e: Event) {
    const t = e.target as Element | null
    if (!t?.closest('.ProseMirror[contenteditable="true"]')) e.preventDefault()
  }

  const stopPageZoom = (e: Event) => e.preventDefault()

  function reset() {
    pointers.clear()
    press = null
    pinch = null
    ignoreUntilUp = false
    setGesturing(false)
    board.removeAttribute('data-panning')
  }

  board.addEventListener('pointerdown', onPointerDown)
  board.addEventListener('pointermove', onPointerMove)
  board.addEventListener('pointerup', onPointerUp)
  board.addEventListener('pointercancel', onPointerUp)
  board.addEventListener('wheel', onWheel, { passive: false })
  board.addEventListener('contextmenu', onContextMenu)
  // Safari (iOS/macOS) haría zoom de toda la página con el pellizco.
  document.addEventListener('gesturestart', stopPageZoom, { passive: false })
  document.addEventListener('gesturechange', stopPageZoom, { passive: false })
  window.addEventListener('blur', reset)

  return () => {
    board.removeEventListener('pointerdown', onPointerDown)
    board.removeEventListener('pointermove', onPointerMove)
    board.removeEventListener('pointerup', onPointerUp)
    board.removeEventListener('pointercancel', onPointerUp)
    board.removeEventListener('wheel', onWheel)
    board.removeEventListener('contextmenu', onContextMenu)
    document.removeEventListener('gesturestart', stopPageZoom)
    document.removeEventListener('gesturechange', stopPageZoom)
    window.removeEventListener('blur', reset)
  }
}
