import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { fontById } from '../lib/fonts'
import { selectActiveNoteIds, selectLooseStickerIds, store, useStore } from '../store/store'
import { fitAll } from './actions'
import { attachGestures } from './gestures'
import { NoteView } from './NoteView'
import { StickerView } from './StickerView'
import { view } from './view'

/**
 * Espera a las letras de la app y a las que usan los posits de este tablero (con un tope de 1,5 s por si la
 * conexión es mala). Sin esto los posits cambiarían de alto al terminar de cargar y quedarían descentrados.
 */
function fontsReady(): Promise<void> {
  const fonts = document.fonts
  if (!fonts || typeof fonts.load !== 'function') return Promise.resolve()
  const s = store.getState()
  const used = new Set(
    Object.values(s.notes)
      .filter((n) => n.boardId === s.activeBoardId)
      .map((n) => fontById(n.font)),
  )
  const loads = [
    fonts.load('22px "Kalam"'),
    fonts.load('700 18px "Kalam"'),
    fonts.load('20px "Permanent Marker"'),
    ...[...used].map((f) => fonts.load(`22px ${f.stack}`)),
  ]
  const loaded = Promise.all(loads).then(
    () => undefined,
    () => undefined,
  )
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500))
  return Promise.race([loaded, timeout])
}

export function Board() {
  const ids = useStore(useShallow(selectActiveNoteIds))
  const looseIds = useStore(useShallow(selectLooseStickerIds))
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
        {looseIds.map((id) => (
          <StickerView key={id} id={id} />
        ))}
      </div>
      {ids.length === 0 && looseIds.length === 0 && (
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
