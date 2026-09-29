import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Palette, Plus } from 'lucide-react'
import { addNoteAtCenter } from '../board/actions'
import { useCoarsePointer } from '../hooks/useCoarsePointer'
import { IconArt } from '../icons/IconArt'
import { NOTE_FONTS, fontById, type NoteFont } from '../lib/fonts'
import { PAPER_COLORS } from '../lib/palette'
import { store, useStore } from '../store/store'
import { PenArt } from './PenArt'

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/** Una ranura del estuche: el instrumento (que se levanta cuando es el que tienes en la mano) y una muestra de su letra. */
function Pen({ font, active, onPick }: { font: NoteFont; active: boolean; onPick: (id: string) => void }) {
  return (
    <button
      type="button"
      role="radio"
      className="pen"
      aria-checked={active}
      aria-label={`Letra ${font.name}`}
      title={font.name}
      data-font-id={font.id}
      onClick={() => onPick(font.id)}
    >
      <span className="pen-art">
        <PenArt kind={font.pen} />
      </span>
      <span className="pen-sample" style={{ fontFamily: font.stack, fontSize: `${(15 * font.scale).toFixed(1)}px` }}>
        Hola
      </span>
    </button>
  )
}

/**
 * La barra de abajo, con aire de estuche de instrumentos: el «Nuevo» pega un posit, cada instrumento es un tipo de
 * letra (el levantado es el que tienes en la mano: sirve para el posit seleccionado y para los nuevos) y a la derecha
 * están los íconos y la paleta de colores del papel, que se abre chiquita sobre el estuche.
 */
export function PenCase() {
  const coarse = useCoarsePointer()
  const editing = useStore((s) => s.editingId !== null)
  const iconsOpen = useStore((s) => s.iconPanel?.mode === 'board')
  const color = useStore((s) => (s.selectedId ? s.notes[s.selectedId]?.color : undefined) ?? s.settings.defaultColor)
  const fontId = useStore((s) => fontById(s.selectedId ? s.notes[s.selectedId]?.font : s.settings.defaultFont).id)
  const [open, setOpen] = useState(false)
  const strip = useRef<HTMLDivElement>(null)

  // La paleta se cierra al tocar fuera de ella o con Esc.
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

  // En pantallas angostas los instrumentos no caben todos: el que tienes en la mano se acerca al centro.
  const hidden = editing && coarse
  useEffect(() => {
    const el = strip.current
    const on = el?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!el || !on) return
    const left = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2
    if (Math.abs(el.scrollLeft - left) > 2) el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [fontId, hidden])

  // Con el teclado del celular abierto no cabe: la barra contextual ("Listo") ocupa su lugar.
  if (hidden) return null

  const pickColor = (hex: string) => {
    store.getState().pickColor(hex)
    setOpen(false)
  }

  return (
    <div className="case" role="group" aria-label="Estuche de instrumentos" data-palette>
      <button type="button" className="add-btn" aria-label="Nuevo posit" onClick={addNoteAtCenter}>
        <Plus aria-hidden="true" />
        <span className="add-label">Nuevo</span>
      </button>

      <div className="pen-strip" ref={strip} role="radiogroup" aria-label="Tipo de letra">
        {NOTE_FONTS.map((f) => (
          <Pen key={f.id} font={f} active={f.id === fontId} onPick={(id) => store.getState().pickFont(id)} />
        ))}
      </div>

      <span className="case-sep" aria-hidden="true" />

      <button
        type="button"
        className="tool-btn icons-btn"
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

      <button
        type="button"
        className="tool-btn palette-btn"
        aria-label="Colores del papel"
        aria-expanded={open}
        title="Color del papel"
        onClick={() => {
          store.getState().closeIcons()
          setOpen((o) => !o)
        }}
      >
        <Palette aria-hidden="true" />
        <i className="palette-chip" aria-hidden="true" style={{ '--c': color } as CSSProperties} />
      </button>

      {open && (
        <div className="palette-pop hand-box" role="dialog" aria-label="Colores del papel">
          <p className="palette-title">Color del papel</p>
          <div className="palette-grid">
            {PAPER_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                className="swatch"
                aria-label={`Color ${c.name}`}
                aria-pressed={same(c.hex, color)}
                title={c.name}
                style={{ '--c': c.hex } as CSSProperties}
                onClick={() => pickColor(c.hex)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
