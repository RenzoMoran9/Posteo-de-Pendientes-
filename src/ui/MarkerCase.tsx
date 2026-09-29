import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Palette, Plus } from 'lucide-react'
import { addNoteAtCenter } from '../board/actions'
import { useCoarsePointer } from '../hooks/useCoarsePointer'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { IconArt } from '../icons/IconArt'
import { FEATURED_COUNT, PAPER_COLORS, type PaperColor } from '../lib/palette'
import { store, useStore } from '../store/store'

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

function Marker({ color, active, onPick }: { color: PaperColor; active: boolean; onPick: (hex: string) => void }) {
  const style = { '--c': color.hex } as CSSProperties
  return (
    <button
      type="button"
      className="marker"
      aria-label={`Color ${color.name}`}
      aria-pressed={active}
      title={color.name}
      style={style}
      onClick={() => onPick(color.hex)}
    >
      <svg viewBox="0 0 34 84" aria-hidden="true" focusable="false">
        <g strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" stroke="var(--panel-line)">
          {/* cuerpo claro con banda del color */}
          <path d="M6 28 H28 L27 78 Q17 82 7 78 Z" fill="#fffdf6" />
          <path d="M6.6 46 H27.4 L27.1 62 H6.9 Z" fill="var(--c)" strokeWidth="1.6" />
          {/* tapa del color pleno, con su brillo y su clip */}
          <path d="M8 5 Q17 0 26 5 L27 30 H7 Z" fill="var(--c)" />
          <path d="M12.5 9 V25" fill="none" stroke="rgb(255 255 255 / 0.6)" strokeWidth="3" />
          <path d="M26.5 11 Q31 11 31 16 V26" fill="none" />
        </g>
      </svg>
    </button>
  )
}

/**
 * La barra inferior con aire de estuche de marcadores: el "＋" pega un posit nuevo
 * y los marcadores cambian el color (el marcador levantado es el "que tienes en la mano").
 */
export function MarkerCase() {
  const coarse = useCoarsePointer()
  const narrow = useMediaQuery('(max-width: 520px)')
  const tiny = useMediaQuery('(max-width: 350px)')
  const editing = useStore((s) => s.editingId !== null)
  const iconsOpen = useStore((s) => s.iconPanel?.mode === 'board')
  const current = useStore((s) => (s.selectedId ? s.notes[s.selectedId]?.color : undefined) ?? s.settings.defaultColor)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest('[data-palette]')) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Con el teclado del celular abierto no cabe: la barra contextual ("Listo") ocupa su lugar.
  if (editing && coarse) return null

  // En pantallas angostas asoman menos marcadores; el que tienes en la mano siempre se ve.
  const count = tiny ? 4 : narrow ? 5 : FEATURED_COUNT
  const featured = PAPER_COLORS.slice(0, count)
  const tray: PaperColor[] = featured.some((c) => same(c.hex, current))
    ? featured
    : [
        ...featured.slice(0, count - 1),
        PAPER_COLORS.find((c) => same(c.hex, current)) ?? { name: 'Personalizado', hex: current },
      ]

  const pick = (hex: string) => {
    store.getState().pickColor(hex)
    setOpen(false)
  }

  return (
    <div className="case hand-box" role="group" aria-label="Estuche de marcadores" data-palette>
      <button type="button" className="add-btn" aria-label="Nuevo posit" onClick={addNoteAtCenter}>
        <Plus aria-hidden="true" />
        <span className="add-label">Nuevo</span>
      </button>

      <div className="markers" role="group" aria-label="Color del posit">
        {tray.map((c) => (
          <Marker key={c.hex} color={c} active={same(c.hex, current)} onPick={pick} />
        ))}
        <div className="pocket" aria-hidden="true" />
      </div>

      <button
        type="button"
        className="more-btn"
        aria-label="Más colores"
        aria-expanded={open}
        title="Más colores"
        onClick={() => {
          store.getState().closeIcons()
          setOpen((o) => !o)
        }}
      >
        <Palette aria-hidden="true" />
      </button>

      <button
        type="button"
        className="more-btn icons-btn"
        aria-label="Íconos"
        aria-expanded={iconsOpen}
        title="Íconos (I)"
        data-icon-panel
        onClick={() => {
          const s = store.getState()
          setOpen(false)
          if (s.iconPanel) s.closeIcons()
          else s.openIcons({ mode: 'board' })
        }}
      >
        <IconArt id="brillos" />
      </button>

      {open && (
        <div className="palette-pop hand-box" role="dialog" aria-label="Todos los colores">
          <p className="palette-title">Color del papel</p>
          <div className="palette-grid">
            {PAPER_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                className="swatch"
                aria-label={c.name}
                aria-pressed={same(c.hex, current)}
                title={c.name}
                style={{ '--c': c.hex } as CSSProperties}
                onClick={() => pick(c.hex)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
