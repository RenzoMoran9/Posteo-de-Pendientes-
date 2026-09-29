import { useEffect } from 'react'
import { keepCaretVisible } from '../board/caret'

/**
 * En el celular, el teclado en pantalla achica el "viewport visual" pero no la
 * página. Publicamos su alto y su desplazamiento como variables CSS (`--vvh`, `--vvt`)
 * para que la app siempre ocupe justo lo que se ve, encima del teclado.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement

    const update = () => {
      const h = vv ? vv.height : window.innerHeight
      const t = vv ? vv.offsetTop : 0
      root.style.setProperty('--vvh', `${Math.round(h)}px`)
      root.style.setProperty('--vvt', `${Math.round(t)}px`)
      keepCaretVisible()
    }

    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
}
