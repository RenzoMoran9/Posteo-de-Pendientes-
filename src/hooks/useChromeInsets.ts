import { useEffect } from 'react'
import type { RefObject } from 'react'
import { view } from '../board/view'

/**
 * Mide cuánto ocupan las barras flotantes para que "ver todo", los posits nuevos
 * y el cursor al escribir queden en la zona realmente libre de la pantalla.
 */
export function useChromeInsets(topRef: RefObject<HTMLElement | null>, dockRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const top = topRef.current
    const dock = dockRef.current
    const measure = () => {
      view.setChrome({
        top: (top?.offsetHeight ?? 0) + 6,
        bottom: (dock?.offsetHeight ?? 0) + 6,
      })
      // el panel de íconos usa esta medida para no salirse por arriba
      document.documentElement.style.setProperty('--dock-h', `${dock?.offsetHeight ?? 0}px`)
      // y la mascota, para moverse solo por el espacio libre entre las dos barras
      document.documentElement.style.setProperty('--top-h', `${top?.offsetHeight ?? 0}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (top) ro.observe(top)
    if (dock) ro.observe(dock)
    return () => ro.disconnect()
  }, [topRef, dockRef])
}
