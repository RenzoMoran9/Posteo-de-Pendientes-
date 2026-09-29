import { useMediaQuery } from './useMediaQuery'

/** true en pantallas táctiles (celular/tableta): ahí el teclado en pantalla ocupa media pantalla. */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)')
}
