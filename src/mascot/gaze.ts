/** Hacia dónde mira Chispa. Todo son números: se prueba sin navegador. */

export interface Pt {
  x: number
  y: number
}

export interface Look {
  /** Cuánto se corren las pupilas (unidades del dibujo de 64). */
  px: number
  py: number
  /** Cuánto se corre la cara entera (poquito: así el cuerpo parece redondo). */
  fx: number
  fy: number
  /** Cuánto gira el cuerpo, en grados (rotateX / rotateY con perspectiva). */
  rx: number
  ry: number
}

/**
 * Máximos de cada movimiento. El ojo mide 6,4 de radio horizontal y 7,4 vertical, y la pupila 3,7: por eso las
 * pupilas se mueven en una elipse de 2,6 × 3,5 y nunca se salen del ojo.
 */
export const GAZE = { pupilX: 2.6, pupilY: 3.5, face: 1.7, tiltX: 12, tiltY: 21, near: 150, far: 300 } as const

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * Desde el centro de los ojos (en pantalla) hasta el punto que mira. Cerca del ojo mira "de frente" con poco
 * movimiento; lejos, gira todo lo que puede. Sin punto que mirar, se queda mirando al frente.
 */
export function lookAt(eye: Pt, target: Pt | null): Look {
  if (!target) return { px: 0, py: 0, fx: 0, fy: 0, rx: 0, ry: 0 }
  const dx = target.x - eye.x
  const dy = target.y - eye.y
  const d = Math.hypot(dx, dy)
  if (d < 1) return { px: 0, py: 0, fx: 0, fy: 0, rx: 0, ry: 0 }
  const ux = dx / d
  const uy = dy / d
  const s = clamp(d / GAZE.near, 0, 1)
  return {
    px: ux * GAZE.pupilX * s,
    py: uy * GAZE.pupilY * s,
    fx: ux * GAZE.face * s,
    fy: uy * GAZE.face * s,
    ry: clamp(dx / GAZE.far, -1, 1) * GAZE.tiltY,
    rx: -clamp(dy / GAZE.far, -1, 1) * GAZE.tiltX,
  }
}

/** Cuánto tarda en aburrirse de mirar un punto quieto y volver a mirar alrededor (ms). */
export const POINTER_MEMORY_MS = 2600

/** Pausa aleatoria entre parpadeos (ms): a veces un doble parpadeo. */
export function nextBlinkDelay(rng: () => number = Math.random): number {
  return 2200 + rng() * 3800
}

export const isDoubleBlink = (rng: () => number = Math.random): boolean => rng() < 0.22
