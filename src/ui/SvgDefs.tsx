/**
 * Filtros SVG compartidos que dan el temblor de trazo dibujado a mano
 * (bordes de los paneles, íconos, marcadores). Se aplican solo a "cajas" y
 * dibujos, nunca al texto del posit, para que se lea siempre nítido.
 */
export function SvgDefs() {
  return (
    <svg className="svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id="rough" x="-3%" y="-3%" width="106%" height="106%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="rough-soft" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="1" seed="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Textura de grafito para el tachado: borde un poco áspero y el trazo se "corta" apenas donde el lápiz no apretó. */}
        <filter id="pencil" x="-2%" y="-60%" width="104%" height="220%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.7" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 2.05" result="speckle" />
          <feComposite in="rough" in2="speckle" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}
