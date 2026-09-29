import type { ReactNode } from 'react'
import type { PenKind } from '../lib/fonts'

/**
 * Los instrumentos de escritura del estuche, dibujados en vectores propios (sin imágenes ni íconos de nadie): cada
 * uno es un cilindro con degradado y brillo (los degradados están en SvgDefs.tsx), con la punta hacia arriba y el
 * cuerpo que se pierde por abajo, dentro de su ranura. Lienzo de 40 × 104; el eje está en x = 20.
 */

const rim = { stroke: '#000', strokeOpacity: 0.55, strokeWidth: 0.6 } as const

const shine = (d: string, opacity = 0.28, width = 1.1): ReactNode => (
  <path d={d} fill="none" stroke="#fff" strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" />
)

/** Pluma estilográfica: plumín de acero con su ranura, cuerpo negro y un anillo azul. */
function Fountain() {
  return (
    <>
      <rect x="12.5" y="50" width="15" height="60" fill="url(#pn-black)" {...rim} />
      <rect x="12.5" y="55.5" width="15" height="4.6" fill="url(#pn-blue)" {...rim} />
      <rect x="11.9" y="45.6" width="16.2" height="4.6" rx="1" fill="url(#pn-steel)" {...rim} />
      <path d="M13.4 30.6 H26.6 L27.5 45.6 H12.5 Z" fill="url(#pn-black)" {...rim} />
      <rect x="12.6" y="27.4" width="14.8" height="3.6" rx="1" fill="url(#pn-steel)" {...rim} />
      <path d="M20 2 C21.3 8.5 26 16.5 27 27.6 H13 C14 16.5 18.7 8.5 20 2 Z" fill="url(#pn-steel)" {...rim} />
      <path d="M20 9 V27.4" stroke="#14171a" strokeWidth="0.9" />
      <circle cx="20" cy="18.5" r="1.7" fill="#14171a" />
      {shine('M15.3 32 V44')}
      {shine('M14.6 62 V104', 0.22)}
    </>
  )
}

/** Bolígrafo: punta cónica de acero, cuerpo negro con agarre estriado y un clip plateado. */
function Ballpoint() {
  return (
    <>
      <path d="M15.2 28 H24.8 L26 110 H14 Z" fill="url(#pn-black)" {...rim} />
      <rect x="14.6" y="37" width="10.8" height="7" fill="#242a30" />
      {[38.6, 40.6, 42.6].map((y) => (
        <path key={y} d={`M14.8 ${y} H25.2`} stroke="#79828b" strokeOpacity="0.55" strokeWidth="0.6" />
      ))}
      <rect x="26" y="40" width="3.2" height="42" rx="1.4" fill="url(#pn-steel)" {...rim} />
      <rect x="14.4" y="24" width="11.2" height="4.4" rx="1" fill="url(#pn-steel)" {...rim} />
      <path d="M20 2 C21.2 6 23.8 13 24.6 24 H15.4 C16.2 13 18.8 6 20 2 Z" fill="url(#pn-steel)" {...rim} />
      <circle cx="20" cy="2.8" r="1" fill="#eef1f3" />
      {shine('M16.7 31 V100', 0.2)}
    </>
  )
}

/** Lápiz: madera afilada con punta de grafito y cuerpo oscuro con una franja dorada. */
function Pencil() {
  return (
    <>
      <rect x="12.6" y="30" width="14.8" height="80" fill="url(#pn-black)" {...rim} />
      <path d="M17.7 30 V110 M22.3 30 V110" stroke="#fff" strokeOpacity="0.07" strokeWidth="0.8" />
      <rect x="12.6" y="36" width="14.8" height="3" fill="url(#pn-gold)" {...rim} />
      <path d="M17.4 10.4 H22.6 L27.4 30.2 H12.6 Z" fill="url(#pn-wood)" {...rim} />
      <path d="M20 10.4 H22.6 L27.4 30.2 H21.6 Z" fill="#3a2410" opacity="0.14" />
      <path d="M17.4 10.4 L18.6 12.6 L20 10.9 L21.4 12.6 L22.6 10.4" fill="none" stroke="#7a532a" strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M20 1.4 L22.6 10.5 H17.4 Z" fill="url(#pn-lead)" {...rim} />
      {shine('M15.4 32 V104', 0.16)}
    </>
  )
}

/** Punta fina (rotulador de aguja): aguja finita, cono oscuro y cuerpo negro con una franjita de rotular. */
function Fineliner() {
  return (
    <>
      <rect x="14.2" y="32.4" width="11.6" height="80" fill="url(#pn-black)" {...rim} />
      <rect x="14.2" y="47" width="11.6" height="3.4" fill="#dfe5ea" opacity="0.88" />
      <rect x="15.2" y="29" width="9.6" height="3.6" rx="1" fill="url(#pn-steel)" {...rim} />
      <path d="M18.6 14 H21.4 L24.4 29 H15.6 Z" fill="url(#pn-grey)" {...rim} />
      <path d="M20 1.4 L21.5 14.2 H18.5 Z" fill="#9aa3ab" {...rim} />
      {shine('M16.4 34 V104', 0.2)}
    </>
  )
}

/** Pincel (rotulador de punta blanda): punta afilada y flexible, cuello de acero y cuerpo negro. */
function Brush() {
  return (
    <>
      <path d="M13.8 31.4 H26.2 L26.8 110 H13.2 Z" fill="url(#pn-black)" {...rim} />
      {[42, 45, 48].map((y) => (
        <path key={y} d={`M13.6 ${y} H26.4`} stroke="#79828b" strokeOpacity="0.4" strokeWidth="0.6" />
      ))}
      <rect x="13" y="27" width="14" height="4.8" rx="1.2" fill="url(#pn-steel)" {...rim} />
      <path d="M20 1.4 C21.9 7 25.9 15.5 25.6 27.2 H14.4 C14.1 15.5 18.1 7 20 1.4 Z" fill="url(#pn-grey)" {...rim} />
      {shine('M17.4 10 C16.4 15.5 16.2 21 16.6 26', 0.32, 1.2)}
      {shine('M15.4 34 V104', 0.18)}
    </>
  )
}

/** Marcador de fieltro: punta redonda, cuello negro y un anillo naranja. */
function Felt() {
  return (
    <>
      <rect x="12" y="35.6" width="16" height="72" fill="url(#pn-black)" {...rim} />
      <rect x="11.7" y="31" width="16.6" height="4.8" rx="1" fill="url(#pn-orange)" {...rim} />
      <path d="M14.2 17 H25.8 L27.8 31.2 H12.2 Z" fill="url(#pn-black)" {...rim} />
      <path d="M20 2.6 C24.8 2.6 26 9 26 17.2 H14 C14 9 15.2 2.6 20 2.6 Z" fill="url(#pn-grey)" {...rim} />
      {shine('M17.6 6.5 C16.6 9.5 16.3 13 16.4 16', 0.3, 1.2)}
      {shine('M15.2 38 V104', 0.2)}
    </>
  )
}

/** Portaminas: mina finita que asoma, cono de acero, agarre negro estriado y anillo plateado. */
function Mechanical() {
  return (
    <>
      <rect x="13.4" y="62.4" width="13.2" height="50" fill="url(#pn-black)" {...rim} />
      <rect x="13" y="59" width="14" height="3.6" rx="1" fill="url(#pn-steel)" {...rim} />
      <rect x="13.8" y="33" width="12.4" height="26.4" fill="url(#pn-black)" {...rim} />
      {[35.5, 38, 40.5, 43, 45.5, 48, 50.5, 53, 55.5].map((y) => (
        <path key={y} d={`M14 ${y} H26`} stroke="#8a939c" strokeOpacity="0.5" strokeWidth="0.6" />
      ))}
      <rect x="14.8" y="27.4" width="10.4" height="5.8" rx="1" fill="url(#pn-steel)" {...rim} />
      <path d="M18 10.6 H22 L25 27.6 H15 Z" fill="url(#pn-steel)" {...rim} />
      <rect x="19.3" y="1.6" width="1.4" height="9.2" rx="0.6" fill="#2e3338" />
      {shine('M16 64 V104', 0.2)}
    </>
  )
}

/** Marcador grueso (punta de cincel): punta ancha naranja, cuello de acero, cuerpo negro con una banda naranja. */
function Chisel() {
  return (
    <>
      <path d="M10.6 23.6 H29.4 L30 112 H10 Z" fill="url(#pn-black)" {...rim} />
      <rect x="10.3" y="33" width="19.4" height="9" fill="url(#pn-orange)" {...rim} />
      <rect x="10.2" y="17.4" width="19.6" height="6.4" rx="1.4" fill="url(#pn-steel)" {...rim} />
      <path d="M11.4 17.6 L14.8 3 H25.2 L28.6 17.6 Z" fill="url(#pn-orange)" {...rim} />
      {shine('M15.4 5 L13 16.4', 0.45, 1.3)}
      {shine('M13 46 V104', 0.16)}
    </>
  )
}

const ART: Record<PenKind, () => ReactNode> = {
  fountain: Fountain,
  ballpoint: Ballpoint,
  pencil: Pencil,
  fineliner: Fineliner,
  brush: Brush,
  felt: Felt,
  mechanical: Mechanical,
  chisel: Chisel,
}

export function PenArt({ kind }: { kind: PenKind }) {
  const Art = ART[kind]
  return (
    <svg className="pen-svg" viewBox="0 0 40 104" preserveAspectRatio="xMidYMin meet" focusable="false" aria-hidden="true" strokeLinejoin="round">
      <Art />
    </svg>
  )
}
