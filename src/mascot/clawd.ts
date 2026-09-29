/**
 * Las medidas del modelo 3D de la mascota (bloques, como el muñeco impreso en 3D). Son «unidades» (u): en pantalla,
 * 1 u = `--u` píxeles (ver mascot.css), así que el modelo se agranda o achica con la caja de la mascota.
 * El origen es el centro del cuerpo; x crece hacia la derecha, y hacia abajo y z hacia quien mira.
 */

export const CLAWD = {
  body: { w: 20, h: 14.5, d: 7 },
  /** Bracito: sale del costado del cuerpo. `y` es el centro del brazo. */
  arm: { w: 3.4, h: 4.4, d: 5, y: 1.7 },
  /** Cuatro patitas (dos y dos): cada pareja tiene una rendija entre las dos. `pair` es la separación entre parejas. */
  leg: { w: 2.9, h: 4, d: 7, slit: 0.9, pair: 5.4 },
  /** Ojos: dos rectángulos oscuros verticales, un poco por encima del centro de la cara. */
  eye: { w: 1.9, h: 3.8, x: 5.8, y: -0.8 },
} as const

const { body, arm, leg, eye } = CLAWD

/** Dónde queda el suelo (parte baja de las patas). */
export const FLOOR_Y = body.h / 2 + leg.h

/** Lo que mide la figura entera (con los brazos) y su altura, para acomodarla en su caja. */
export const FIGURE_W = body.w + arm.w * 2
export const FIGURE_H = FLOOR_Y + body.h / 2

/** Centros de las cuatro patas, de izquierda a derecha. */
export function legCenters(): number[] {
  const inner = leg.pair / 2 + leg.w / 2
  const outer = inner + leg.w + leg.slit
  return [-outer, -inner, inner, outer]
}

/** Centro del brazo izquierdo (−1) o derecho (1). */
export const armCenterX = (side: -1 | 1): number => side * (body.w / 2 + arm.w / 2)

/** Cuánto se puede correr un ojo sin salirse de la cara (para no dejar el ojo colgando del borde). */
export function eyeRoom(): { x: number; y: number } {
  return {
    x: body.w / 2 - (eye.x + eye.w / 2),
    y: Math.min(body.h / 2 + eye.y - eye.h / 2, body.h / 2 - eye.y - eye.h / 2),
  }
}
