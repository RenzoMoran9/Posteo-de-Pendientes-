import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, SyntheticEvent } from 'react'
import { Search, X } from 'lucide-react'
import { pickIcon } from '../board/actions'
import { useCoarsePointer } from '../hooks/useCoarsePointer'
import { CATEGORIES, getIcon, searchIcons, type RawIcon } from '../icons/catalog'
import { IconArt } from '../icons/IconArt'
import { store, useStore } from '../store/store'

const RECENT = 'recientes'
const ALL = 'todos'

/** No robar el foco al texto del posit: así el teclado del celular no se cierra al tocar el panel. */
const keepFocus = (e: SyntheticEvent) => {
  if (!(e.target as Element | null)?.closest('input')) e.preventDefault()
}

/**
 * Panel de íconos: buscador, categorías, recientes y una cuadrícula. Un toque pega el ícono
 * (en el tablero o dentro del texto, según desde dónde se abrió). Vive dentro de la zona inferior
 * de la pantalla; en el celular ocupa el ancho completo.
 */
export function IconPanel() {
  const panel = useStore((s) => s.iconPanel)
  if (!panel) return null
  return <IconPanelBody mode={panel.mode} />
}

function IconPanelBody({ mode }: { mode: 'board' | 'text' }) {
  const coarse = useCoarsePointer()
  const recent = useStore((s) => s.settings.recentIcons)
  // ¿hay un posit «de turno»? (seleccionado, o dueño del ícono seleccionado)
  const noteSelected = useStore((s) => s.selectedId !== null || (s.selectedStickerId !== null && !!s.stickers[s.selectedStickerId]?.noteId))
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string>(() => (store.getState().settings.recentIcons.length ? RECENT : CATEGORIES[0].id))
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest('[data-icon-panel]')) store.getState().closeIcons()
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      store.getState().closeIcons()
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [])

  const searching = query.trim().length > 0
  const results = useMemo<RawIcon[]>(() => {
    if (searching) return searchIcons(query)
    if (cat === RECENT) return recent.map(getIcon).filter((i): i is RawIcon => !!i)
    return searchIcons('', cat === ALL ? null : cat)
  }, [query, searching, cat, recent])

  useEffect(() => {
    gridRef.current?.scrollTo({ top: 0 })
  }, [cat, searching])

  const chips: Array<{ id: string; name: string }> = [
    ...(recent.length ? [{ id: RECENT, name: 'Recientes' }] : []),
    ...CATEGORIES,
    { id: ALL, name: 'Todos' },
  ]

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results[0]) {
      e.preventDefault()
      pickIcon(results[0].id)
    }
  }

  const hint =
    mode === 'text'
      ? 'Se pone en el texto, donde está el cursor.'
      : noteSelected
        ? 'Se pega en el posit seleccionado. Arrástralo para acomodarlo.'
        : 'Se pega en la hoja. Arrástralo donde quieras: si lo sueltas sobre un posit, se le pega.'

  return (
    <div
      className="icon-pop hand-box"
      role="dialog"
      aria-label={mode === 'text' ? 'Íconos para el texto' : 'Íconos para pegar'}
      data-icon-panel
      onMouseDown={mode === 'text' ? keepFocus : undefined}
      onPointerDown={mode === 'text' ? keepFocus : undefined}
    >
      <div className="icon-pop-head">
        <p className="palette-title">{mode === 'text' ? 'Ícono en el texto' : 'Pegar un ícono'}</p>
        <button type="button" className="icon-pop-close" aria-label="Cerrar" onClick={() => store.getState().closeIcons()}>
          <X aria-hidden="true" />
        </button>
      </div>

      <label className="icon-search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="Buscar: urgente, hoy, pago…"
          aria-label="Buscar ícono"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus={!coarse && mode === 'board'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
        />
      </label>

      <div className="icon-chips" role="group" aria-label="Categorías">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className="icon-chip"
            aria-pressed={!searching && cat === c.id}
            onClick={() => {
              setQuery('')
              setCat(c.id)
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="icon-grid" ref={gridRef} role="list" aria-label="Íconos">
        {results.map((icon) => (
          <button
            key={icon.id}
            type="button"
            role="listitem"
            className="icon-tile"
            title={icon.name}
            aria-label={icon.name}
            data-icon-id={icon.id}
            onClick={() => pickIcon(icon.id)}
          >
            <IconArt id={icon.id} />
            <span className="icon-tile-name">{icon.name}</span>
          </button>
        ))}
        {results.length === 0 && (
          <p className="icon-empty">{searching ? `No hay íconos para «${query.trim()}»` : 'Aún no has usado ningún ícono'}</p>
        )}
      </div>

      <p className="icon-hint">{hint}</p>
    </div>
  )
}
