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
        {/* Degradados de los instrumentos de escritura del estuche (src/ui/PenArt.tsx): cilindros con brillo a un lado. */}
        <linearGradient id="pn-black" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#05070a" />
          <stop offset="0.2" stopColor="#2b3138" />
          <stop offset="0.38" stopColor="#5b636d" />
          <stop offset="0.56" stopColor="#1b2025" />
          <stop offset="1" stopColor="#040507" />
        </linearGradient>
        <linearGradient id="pn-steel" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#4c535b" />
          <stop offset="0.22" stopColor="#dde3e8" />
          <stop offset="0.4" stopColor="#ffffff" />
          <stop offset="0.62" stopColor="#98a1a9" />
          <stop offset="0.86" stopColor="#cdd4da" />
          <stop offset="1" stopColor="#434a51" />
        </linearGradient>
        <linearGradient id="pn-grey" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#23282d" />
          <stop offset="0.34" stopColor="#7d8791" />
          <stop offset="0.62" stopColor="#414850" />
          <stop offset="1" stopColor="#1a1d21" />
        </linearGradient>
        <linearGradient id="pn-wood" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#a5713b" />
          <stop offset="0.36" stopColor="#ebc78f" />
          <stop offset="0.58" stopColor="#f6ddb0" />
          <stop offset="1" stopColor="#996734" />
        </linearGradient>
        <linearGradient id="pn-lead" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#101214" />
          <stop offset="0.4" stopColor="#50565d" />
          <stop offset="1" stopColor="#0d0f11" />
        </linearGradient>
        <linearGradient id="pn-orange" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#a84d0a" />
          <stop offset="0.3" stopColor="#ffb970" />
          <stop offset="0.52" stopColor="#ff9a3a" />
          <stop offset="1" stopColor="#993f06" />
        </linearGradient>
        <linearGradient id="pn-blue" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#1f4a86" />
          <stop offset="0.34" stopColor="#8bbcff" />
          <stop offset="0.6" stopColor="#4d88d8" />
          <stop offset="1" stopColor="#173765" />
        </linearGradient>
        <linearGradient id="pn-gold" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7d5a12" />
          <stop offset="0.3" stopColor="#fbe08a" />
          <stop offset="0.56" stopColor="#d6a636" />
          <stop offset="1" stopColor="#6f4e0e" />
        </linearGradient>
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
