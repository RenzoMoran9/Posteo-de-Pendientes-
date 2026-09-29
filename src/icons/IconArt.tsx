import { memo } from 'react'
import { iconMarkup } from './markup'

/** Un ícono dibujado a mano; llena el cuadro que lo contiene (el tamaño lo pone quien lo usa). */
export const IconArt = memo(function IconArt({ id, className }: { id: string; className?: string }) {
  return <span className={className ? `ic-box ${className}` : 'ic-box'} aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconMarkup(id) }} />
})
