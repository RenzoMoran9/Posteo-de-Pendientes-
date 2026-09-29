import { useSyncExternalStore } from 'react'
import type { Ref } from 'react'
import { Check, Grid3x3, Minus, Plus, Scan } from 'lucide-react'
import { fitAll, resetZoom, zoomBy } from '../board/actions'
import { view } from '../board/view'
import { store, useStore } from '../store/store'
import type { SaveStatus } from '../store/types'
import { IconButton } from './IconButton'
import { Logo } from './Logo'

function SaveBadge({ status }: { status: SaveStatus }) {
  const text = status === 'saving' ? 'Guardando…' : status === 'error' ? 'Sin guardar' : 'Guardado'
  return (
    <span
      className={`save is-${status}`}
      role="status"
      aria-live="polite"
      title={status === 'error' ? 'No se pudo guardar en este dispositivo. Revisa el espacio o el modo privado.' : undefined}
    >
      {status === 'saved' && <Check aria-hidden="true" />}
      <span className="save-text">{text}</span>
    </span>
  )
}

export function TopBar({ ref }: { ref?: Ref<HTMLElement> }) {
  const magnet = useStore((s) => s.settings.magnet)
  const status = useStore((s) => s.saveStatus)
  const boardName = useStore((s) => s.boards[s.activeBoardId]?.name ?? '')
  const zoomPct = useSyncExternalStore(view.subscribe, () => Math.round(view.getSnapshot().z * 100))

  return (
    <header className="topbar" ref={ref}>
      <div className="pill brand hand-box">
        <Logo className="brand-logo" />
        <div className="brand-text">
          <span className="brand-name">Posits</span>
          <span className="board-name">{boardName}</span>
        </div>
      </div>

      <div className="pill tools hand-box" role="toolbar" aria-label="Vista del tablero">
        <SaveBadge status={status} />
        <IconButton
          label={magnet ? 'Imán a la cuadrícula: activado' : 'Imán a la cuadrícula: apagado'}
          pressed={magnet}
          onClick={() => {
            store.getState().toggleMagnet()
            const on = store.getState().settings.magnet
            store.getState().showToast({
              message: on ? 'Imán a la cuadrícula: activado' : 'Imán a la cuadrícula: apagado',
              duration: 2200,
            })
          }}
        >
          <Grid3x3 />
        </IconButton>
        <span className="sep" aria-hidden="true" />
        <IconButton label="Alejar" onClick={() => zoomBy(1 / 1.25)} className="zoom-step">
          <Minus />
        </IconButton>
        <button type="button" className="zoom-pct" onClick={resetZoom} aria-label={`Zoom ${zoomPct} %. Tocar para volver al 100 %`}>
          {zoomPct}%
        </button>
        <IconButton label="Acercar" onClick={() => zoomBy(1.25)} className="zoom-step">
          <Plus />
        </IconButton>
        <IconButton label="Ver todo" onClick={() => fitAll()}>
          <Scan />
        </IconButton>
      </div>
    </header>
  )
}
