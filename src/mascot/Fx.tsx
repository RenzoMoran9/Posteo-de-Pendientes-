import type { ReactNode } from 'react'
import { MASCOT_ART, type MascotShape } from './art.generated'

/** Cuánto se corre el relleno respecto al contorno (igual que en los íconos). */
const FILL_DX = 1.5
const FILL_DY = 1.2

const FILL: Record<string, string> = {
  pink: '#F6A5C0',
  sky: '#86CCF3',
  yellow: '#FFD84A',
}

/** Dibuja una lista de trazos del generador (relleno corrido + contorno a mano). */
export function Shapes({ list }: { list: readonly MascotShape[] }): ReactNode {
  return list.map(([d, fill, stroke, shifted], i) => (
    <g key={i}>
      {fill && (
        <path
          className={fill === 'ink' ? 'f f-ink' : 'f'}
          fill={fill === 'ink' ? undefined : FILL[fill]}
          transform={shifted ? `translate(${FILL_DX} ${FILL_DY})` : undefined}
          d={d}
        />
      )}
      {stroke !== 'n' && <path className={`s s-${stroke}`} d={d} />}
    </g>
  ))
}

/**
 * Adornos que flotan sobre la cabeza y no giran con el cuerpo: las «zzz» de cuando duerme, los destellos de cuando
 * festeja y el «¡!» de cuando se sorprende. Cuál se ve lo decide mascot.css según `data-mood`.
 */
export function MascotFx() {
  return (
    <svg className="ic m-fx" viewBox="0 0 64 64" focusable="false" aria-hidden="true">
      <g className="m-zzz">
        <Shapes list={MASCOT_ART.fx.zzz} />
      </g>
      <g className="m-party">
        <Shapes list={MASCOT_ART.fx.party} />
      </g>
      <g className="m-alert">
        <Shapes list={MASCOT_ART.fx.alert} />
      </g>
    </svg>
  )
}
