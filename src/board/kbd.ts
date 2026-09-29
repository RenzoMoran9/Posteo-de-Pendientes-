/**
 * iOS solo abre el teclado si `focus()` ocurre en el mismo instante del toque.
 * Al crear un posit, el editor todavía no existe en ese momento, así que enfocamos
 * primero este campo invisible (abre el teclado) y luego el editor toma el foco.
 */
export const kbdProxy = {
  el: null as HTMLInputElement | null,
  prime(): void {
    if (typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches) return
    this.el?.focus({ preventScroll: true })
  },
}
