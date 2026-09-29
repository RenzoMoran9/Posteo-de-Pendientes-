import type { ReactNode, RefObject } from 'react'
import { MASCOT_ART, type MascotShape } from './art.generated'

/** Cuánto se corre el relleno respecto al contorno (igual que en los íconos). */
const FILL_DX = 1.5
const FILL_DY = 1.2

/** Relleno de cada pieza: los «url(#…)» son los degradados que dan el volumen (definidos abajo). */
const FILL: Record<string, string> = {
  body: 'url(#mBody)',
  foot: 'url(#mFoot)',
  arm: 'url(#mArm)',
  eye: 'url(#mEye)',
  spark: 'url(#mSpark)',
  gloss: 'url(#mGloss)',
  blush: '#F58FA6',
  char: '#3F474F',
  red: '#EE5B54',
  white: '#FFFFFF',
  pink: '#F6A5C0',
  sky: '#86CCF3',
  yellow: '#FFD84A',
}

export function Shapes({ list }: { list: readonly MascotShape[] }): ReactNode {
  return list.map(([d, fill, stroke, shifted], i) => (
    <g key={i}>
      {fill && (
        <path
          className={fill === 'ink' ? 'f f-ink' : 'f'}
          fill={fill === 'ink' ? undefined : FILL[fill]}
          fillOpacity={fill === 'blush' ? 0.78 : undefined}
          transform={shifted ? `translate(${FILL_DX} ${FILL_DY})` : undefined}
          d={d}
        />
      )}
      {stroke !== 'n' && <path className={`s s-${stroke}`} d={d} />}
    </g>
  ))
}

const part = (layer: keyof typeof MASCOT_ART, name: string): readonly MascotShape[] =>
  (MASCOT_ART[layer] as Record<string, readonly MascotShape[]>)[name]

export interface MascotRefs {
  /** El cuerpo entero, que se gira hacia lo que mira (rotateX / rotateY con perspectiva). */
  tilt: RefObject<HTMLDivElement | null>
  /** Las pupilas (se desplazan hacia lo que mira). */
  pupils: RefObject<SVGGElement | null>
  /** La cara entera (se corre un poco: así parece redonda). */
  face: RefObject<SVGGElement | null>
}

/**
 * Chispa, en capas para que tenga volumen: el fondo (patas y brazos), el cuerpo, la chispa de la cabeza y la cara
 * flotan a distintas profundidades dentro de un contenedor con perspectiva (`translateZ` en mascot.css), y al
 * girar el cuerpo hacia el cursor se ve el paralaje. Encima, degradados de luz arriba a la izquierda, brillos en
 * los ojos y una sombra en el suelo. El trazo sigue siendo el de marcador de los íconos.
 * Los estados de ánimo (ojos, bocas, adornos) se muestran y ocultan con CSS según `data-mood` del contenedor.
 */
export function MascotArt({ refs }: { refs: MascotRefs }) {
  return (
    <div className="m-stage" aria-hidden="true">
      {/* sombra en el suelo: plana, no gira con el cuerpo */}
      <svg className="m-ground" viewBox="0 0 64 64" focusable="false">
        <defs>
          <radialGradient id="mGround" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#281c08" stopOpacity="0.42" />
            <stop offset="0.6" stopColor="#281c08" stopOpacity="0.18" />
            <stop offset="1" stopColor="#281c08" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mBody" cx="0.34" cy="0.24" r="0.98">
            <stop offset="0" stopColor="#FFD6B8" />
            <stop offset="0.22" stopColor="#FCA97D" />
            <stop offset="0.55" stopColor="#EE7C50" />
            <stop offset="0.82" stopColor="#CF5A32" />
            <stop offset="1" stopColor="#A54120" />
          </radialGradient>
          <radialGradient id="mArm" cx="0.35" cy="0.25" r="0.95">
            <stop offset="0" stopColor="#FBAE86" />
            <stop offset="0.7" stopColor="#E9754A" />
            <stop offset="1" stopColor="#C4532E" />
          </radialGradient>
          <linearGradient id="mFoot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E9784D" />
            <stop offset="1" stopColor="#AE4626" />
          </linearGradient>
          <radialGradient id="mEye" cx="0.38" cy="0.32" r="0.85">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.55" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#D5DCE5" />
          </radialGradient>
          <radialGradient id="mSpark" cx="0.4" cy="0.32" r="0.8">
            <stop offset="0" stopColor="#FFF6B8" />
            <stop offset="0.55" stopColor="#FFD84A" />
            <stop offset="1" stopColor="#F0A91B" />
          </radialGradient>
          <radialGradient id="mGloss" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse className="m-ground-shadow" cx="32" cy="61.5" rx="25" ry="5" fill="url(#mGround)" />
      </svg>

      <div className="m-tilt" ref={refs.tilt}>
        <svg className="ic m-layer m-back" viewBox="0 0 64 64" focusable="false">
          <g className="m-arm m-arm-l">
            <Shapes list={part('back', 'armL')} />
          </g>
          <g className="m-arm m-arm-r">
            <Shapes list={part('back', 'armR')} />
          </g>
          <Shapes list={part('back', 'footL')} />
          <Shapes list={part('back', 'footR')} />
        </svg>

        <svg className="ic m-layer m-body" viewBox="0 0 64 64" focusable="false">
          <Shapes list={part('body', 'body')} />
          <Shapes list={part('body', 'gloss')} />
          <Shapes list={part('body', 'shine')} />
        </svg>

        <svg className="ic m-layer m-spark" viewBox="0 0 64 64" focusable="false">
          <g className="m-spark-wiggle">
            <Shapes list={part('spark', 'stalk')} />
            <Shapes list={part('spark', 'star')} />
          </g>
        </svg>

        <svg className="ic m-layer m-face" viewBox="0 0 64 64" focusable="false">
          <g ref={refs.face} className="m-face-shift">
            <Shapes list={part('face', 'cheekL')} />
            <Shapes list={part('face', 'cheekR')} />

            <g className="m-eyes-open">
              <g className="m-blink">
                <Shapes list={part('face', 'eyeL')} />
                <Shapes list={part('face', 'eyeR')} />
                <g ref={refs.pupils} className="m-pupils">
                  <Shapes list={part('face', 'pupilL')} />
                  <Shapes list={part('face', 'pupilR')} />
                </g>
              </g>
            </g>
            <g className="m-eyes-happy">
              <Shapes list={part('face', 'eyesHappy')} />
            </g>
            <g className="m-eyes-sleep">
              <Shapes list={part('face', 'eyesSleep')} />
            </g>

            <g className="m-mouth m-mouth-smile">
              <Shapes list={part('face', 'mouthSmile')} />
            </g>
            <g className="m-mouth m-mouth-grin">
              <Shapes list={part('face', 'mouthGrin')} />
            </g>
            <g className="m-mouth m-mouth-o">
              <Shapes list={part('face', 'mouthO')} />
            </g>
            <g className="m-mouth m-mouth-flat">
              <Shapes list={part('face', 'mouthFlat')} />
            </g>
            <g className="m-mouth m-mouth-hm">
              <Shapes list={part('face', 'mouthHm')} />
            </g>
          </g>
        </svg>
      </div>

      {/* adornos que no giran con el cuerpo */}
      <svg className="ic m-fx" viewBox="0 0 64 64" focusable="false">
        <g className="m-zzz">
          <Shapes list={part('fx', 'zzz')} />
        </g>
        <g className="m-party">
          <Shapes list={part('fx', 'party')} />
        </g>
        <g className="m-alert">
          <Shapes list={part('fx', 'alert')} />
        </g>
      </svg>
    </div>
  )
}
