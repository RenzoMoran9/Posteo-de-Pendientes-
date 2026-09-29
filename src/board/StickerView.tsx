import { memo } from 'react'
import type { CSSProperties } from 'react'
import { getIcon } from '../icons/catalog'
import { IconArt } from '../icons/IconArt'
import { useStore } from '../store/store'

const cx = (...parts: Array<string | false | undefined>): string => parts.filter(Boolean).join(' ')

/** Grosor de línea (en unidades del dibujo de 64): más gruesa cuando el ícono es chico, para que no se pierda. */
export const lineFor = (size: number): number => Math.min(4.2, Math.max(2.5, 112 / size))

/**
 * Un ícono pegado, suelto en la hoja o sobre un posit. La posición y la inclinación van en las propiedades
 * `translate` y `rotate` (no en `transform`): así el "levantarlo" al arrastrarlo (`scale`) gira y crece
 * desde su propio centro. El motor de gestos escribe `translate`, `rotate` y el tamaño directo mientras
 * se arrastra, se gira o se agranda. Seleccionado, muestra su marco, el tirador de giro (arriba) y el de tamaño (esquina).
 */
export const StickerView = memo(function StickerView({ id }: { id: string }) {
  const st = useStore((s) => s.stickers[id])
  const selected = useStore((s) => s.selectedStickerId === id)
  if (!st) return null
  const name = getIcon(st.icon)?.name ?? 'Ícono'
  const style = {
    translate: `${st.x}px ${st.y}px`,
    rotate: `${st.tilt}deg`,
    width: st.size,
    height: st.size,
    zIndex: st.z,
    '--icon-line': lineFor(st.size).toFixed(2),
  } as CSSProperties

  return (
    <div
      className={cx('sticker', st.noteId ? 'is-attached' : 'is-loose', selected && 'is-selected')}
      data-sticker-id={id}
      style={style}
      role="img"
      aria-label={`Ícono: ${name}`}
    >
      <IconArt id={st.icon} />
      {selected && <div className="sticker-ring" aria-hidden="true" />}
      {selected && <div className="sticker-rotate" data-rotate-sticker aria-hidden="true" />}
      {selected && <div className="sticker-handle" data-resize-sticker aria-hidden="true" />}
    </div>
  )
})
