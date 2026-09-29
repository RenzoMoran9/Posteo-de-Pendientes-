import { eyeRoom } from './clawd'

/** Hacia dónde mira la mascota. Todo son números: se prueba sin navegador. */

export interface Pt {
  x: number
  y: number
}

export interface Look {
  /** Cuánto se corren los ojos sobre la cara (en u, las unidades del modelo). */
  ex: number
  ey: number
  /** Cuánto gira el cuerpo hacia ese lado, en grados (rotateX / rotateY con perspectiva). */
  rx: number
  ry: number
}

const STRAIGHT: Look = { ex: 0, ey: 0, rx: 0, ry: 0 }

/**
 * Máximos de cada movimiento. Los ojos se corren un poco menos de lo que les cabe en la cara (ver `eyeRoom`), así
 * que nunca se salen del bloque; el cuerpo gira hasta 24° de lado y 11° de arriba abajo.
 */
export const GAZE = { eyeX: 1.25, eyeY: 1.0, tiltX: 11, tiltY: 24, near: 150, far: 300 } as const

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * Desde el centro de los ojos (en pantalla) hasta el punto que mira. Cerca del ojo mira "de frente" con poco
 * movimiento; lejos, gira todo lo que puede. Sin punto que mirar, se queda mirando al frente.
 */
export function lookAt(eye: Pt, target: Pt | null): Look {
  if (!target) return STRAIGHT
  const dx = target.x - eye.x
  const dy = target.y - eye.y
  const d = Math.hypot(dx, dy)
  if (d < 1) return STRAIGHT
  const ux = dx / d
  const uy = dy / d
  const s = clamp(d / GAZE.near, 0, 1)
  const room = eyeRoom()
  return {
    ex: ux * Math.min(GAZE.eyeX, room.x) * s,
    ey: uy * Math.min(GAZE.eyeY, room.y) * s,
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
