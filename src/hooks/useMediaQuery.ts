import { useSyncExternalStore } from 'react'

/** Se vuelve a evaluar solo cuando cambia la condición (girar el celular, cambiar el tamaño…). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
