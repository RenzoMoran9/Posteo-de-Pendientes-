import type { ReactNode } from 'react'

interface Props {
  label: string
  onClick?: () => void
  pressed?: boolean
  className?: string
  children: ReactNode
}

/** Botón cuadrado con ícono; el texto va en `aria-label` y como ayuda al pasar el ratón. */
export function IconButton({ label, onClick, pressed, className, children }: Props) {
  return (
    <button
      type="button"
      className={['icon-btn', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
