/** Logo propio: un posit con la esquina doblada y su cinta. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g stroke="#1f262d" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M9 9 H55 V41 L41 56 H9 Z" fill="#FFD95E" />
        <path d="M55 41 H41 V56 Z" fill="#FFF1B8" />
        <path d="M18 24 H44 M18 34 H35" fill="none" />
        <path d="M22 4 L41 4 L39.5 14 L23.5 14 Z" fill="#5F96D7" strokeWidth="2.4" />
      </g>
    </svg>
  )
}
