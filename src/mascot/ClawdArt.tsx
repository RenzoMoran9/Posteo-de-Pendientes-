import type { CSSProperties, ReactNode, RefObject } from 'react'
import { CLAWD, armCenterX, legCenters } from './clawd'
import { MascotFx } from './Fx'

export interface MascotRefs {
  /** El cuerpo entero, que se gira hacia lo que mira (rotateX / rotateY con perspectiva). */
  tilt: RefObject<HTMLDivElement | null>
  /** Punto fijo entre los dos ojos (no se mueve con la mirada): desde ahí se mide hacia dónde mirar. */
  anchor: RefObject<HTMLDivElement | null>
  /** Los ojos (se corren sobre la cara hacia lo que mira). */
  eyes: RefObject<HTMLDivElement | null>
}

interface BoxProps {
  w: number
  h: number
  d: number
  x: number
  y: number
  z?: number
  /** Qué caras dibujar (f delantera, t arriba, l izquierda, r derecha, b abajo). La de atrás nunca se ve: no gira tanto. */
  faces?: string
  className?: string
}

/**
 * Un bloque de verdad, hecho con seis caras de CSS en 3D: cada cara es un rectángulo colocado con `translateZ` y
 * girado. Las medidas van en unidades (--u); las caras que miran hacia atrás no se dibujan (backface-visibility),
 * y cada cara tiene su propio tono de luz (arriba clara, a la derecha oscura, abajo la más oscura).
 */
function Box({ w, h, d, x, y, z = 0, faces = 'ftlrb', className }: BoxProps) {
  const style = { '--w': w, '--h': h, '--d': d, '--x': x, '--y': y, '--z': z } as CSSProperties
  return (
    <div className={className ? `bx ${className}` : 'bx'} style={style}>
      {faces.includes('f') && <i className="fc fc-f" />}
      {faces.includes('t') && <i className="fc fc-t" />}
      {faces.includes('l') && <i className="fc fc-l" />}
      {faces.includes('r') && <i className="fc fc-r" />}
      {faces.includes('b') && <i className="fc fc-b" />}
    </div>
  )
}

/** Una pieza que se mueve alrededor de una articulación (hombro o cadera): se gira con la propiedad `rotate`. */
function Joint({ x, y, className, index, children }: { x: number; y: number; className: string; index?: number; children: ReactNode }) {
  const style = { '--x': x, '--y': y, '--i': index ?? 0 } as CSSProperties
  return (
    <div className={`pv ${className}`} style={style}>
      {children}
    </div>
  )
}

/**
 * La mascota de Claude, como el muñeco impreso en 3D: un cuerpo de bloque naranja con dos ojos oscuros, dos
 * bracitos y cuatro patitas. Es un modelo de verdad (bloques con perspectiva) que gira hacia lo que mira; los
 * gestos (parpadeo, festejo, sueño) los pone mascot.css según `data-mood`.
 */
export function ClawdArt({ refs }: { refs: MascotRefs }) {
  const { body, arm, leg, eye } = CLAWD
  const hipY = body.h / 2
  const shoulderY = arm.y // el hombro está a media altura del brazo: al subirlo, el brazo se abre hacia afuera y arriba

  return (
    <div className="m-stage" aria-hidden="true">
      {/* sombra en el suelo: plana, no gira con el cuerpo */}
      <div className="m-ground" />

      <div className="m-rig">
        <div className="m-tilt" ref={refs.tilt}>
          {/* patas: cuelgan de la cadera y se balancean cuando alguien la lleva en brazos */}
          {legCenters().map((cx, i) => (
            <Joint key={i} x={cx} y={hipY} className="m-leg" index={i}>
              <Box w={leg.w} h={leg.h} d={leg.d} x={0} y={leg.h / 2} faces="flrb" />
            </Joint>
          ))}

          <Box w={body.w} h={body.h} d={body.d} x={0} y={0} className="m-body" />

          {/* bracitos: giran desde el hombro (hacia arriba al festejar) */}
          {([-1, 1] as const).map((side) => (
            <Joint key={side} x={side * (body.w / 2)} y={shoulderY} className={side < 0 ? 'm-arm m-arm-l' : 'm-arm m-arm-r'}>
              <Box
                w={arm.w}
                h={arm.h}
                d={arm.d}
                x={armCenterX(side) - side * (body.w / 2)}
                y={arm.y - shoulderY}
                faces={side < 0 ? 'ftlb' : 'ftrb'}
              />
            </Joint>
          ))}

          {/* cara: dos ojos sobre la cara de adelante, un pelín por delante para que no se mezclen con el bloque */}
          <div className="m-eyes-anchor" ref={refs.anchor} style={{ '--y': eye.y, '--z': body.d / 2 + 0.08 } as CSSProperties}>
            <div className="m-eyes" ref={refs.eyes}>
              <i className="m-eye m-eye-l" style={{ '--ox': -eye.x } as CSSProperties} />
              <i className="m-eye m-eye-r" style={{ '--ox': eye.x } as CSSProperties} />
            </div>
          </div>
        </div>
      </div>

      <MascotFx />
    </div>
  )
}

/** La mascota chiquita y plana, para cuando está escondida y solo asoma. */
export function ClawdPeek() {
  return (
    <svg className="m-peek-art" viewBox="0 0 40 33" focusable="false" aria-hidden="true">
      <rect x="1.5" y="12" width="5" height="6.4" fill="#F26D06" />
      <rect x="33.5" y="12" width="5" height="6.4" fill="#DC5D00" />
      <rect x="9.5" y="21" width="4.6" height="8" fill="#F26D06" />
      <rect x="15.4" y="21" width="4.6" height="8" fill="#FF7A0C" />
      <rect x="20" y="21" width="4.6" height="8" fill="#FF7A0C" />
      <rect x="25.9" y="21" width="4.6" height="8" fill="#DC5D00" />
      <rect x="6.5" y="3" width="27" height="19" fill="#FF7E14" />
      <rect x="6.5" y="3" width="27" height="2.4" fill="#FFA542" />
      <rect x="12.6" y="9.2" width="3.4" height="6.6" rx="0.5" fill="#232124" />
      <rect x="24" y="9.2" width="3.4" height="6.6" rx="0.5" fill="#232124" />
    </svg>
  )
}
