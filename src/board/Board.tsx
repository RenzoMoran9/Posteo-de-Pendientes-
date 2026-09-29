import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { selectActiveNoteIds, store, useStore } from '../store/store'
import { fitAll } from './actions'
import { attachGestures } from './gestures'
import { NoteView } from './NoteView'
import { view } from './view'

/** Espera a las fuentes de la app (con un tope de 1,5 s por si la conexión es mala). */
function fontsReady(): Promise<void> {
  const fonts = document.fonts
  if (!fonts || typeof fonts.load !== 'function') return Promise.resolve()
  const loaded = Promise.all([fonts.load('22px "Patrick Hand"'), fonts.load('700 26px "Caveat"')]).then(
    () => undefined,
    () => undefined,
  )
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500))
  return Promise.race([loaded, timeout])
}

export function Board() {
  const ids = useStore(useShallow(selectActiveNoteIds))
  const activeBoardId = useStore((s) => s.activeBoardId)
  const boardRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const board = boardRef.current
    const world = worldRef.current
    if (!board || !world) return
    view.attach(board, world)
    const detach = attachGestures(board, world)
    return () => {
      detach()
      view.detach()
    }
  }, [])

  // Al abrir un tablero: recupera su zoom/posición guardados, o encuadra todo la primera vez.
  // Se espera a que carguen las letras manuscritas: los posits cambian de alto al cargarlas
  // y, si se encuadrara antes, quedarían descentrados.
  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    const saved = store.getState().views[activeBoardId]
    if (saved) {
      view.set(saved)
      world.setAttribute('data-ready', '')
      return
    }
    world.removeAttribute('data-ready')
    let cancelled = false
    let raf = 0
    void fontsReady().then(() => {
      if (cancelled) return
      raf = requestAnimationFrame(() => {
        if (cancelled) return
        fitAll(false)
        world.setAttribute('data-ready', '')
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [activeBoardId])

  return (
    <div ref={boardRef} className="board" data-board>
      <div ref={worldRef} className="world">
        {ids.map((id) => (
          <NoteView key={id} id={id} />
        ))}
      </div>
      {ids.length === 0 && (
        <div className="empty-hint" aria-live="polite">
          <p className="empty-title">Tu tablero está vacío</p>
          <p className="empty-sub">
            Toca el botón <b>＋</b> para pegar tu primer posit
          </p>
        </div>
      )}
    </div>
  )
}
