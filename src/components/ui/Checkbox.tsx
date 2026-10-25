import { useId } from 'react'

import { cn } from '@/lib/cn'

/** Props de la casilla. */
export interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  /** Segunda línea que explica la casilla. */
  hint?: string
  disabled?: boolean
  className?: string
}

/**
 * Casilla del sistema Aura: una casilla nativa oculta aporta rol, foco y
 * teclado, y el cuadro visible se dibuja con tokens y anima la marca.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled = false,
  className,
}: CheckboxProps) {
  const id = useId()

  return (
    <label htmlFor={id} className={cn('au-check', className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span className="au-check-box">
        <svg
          className="au-check-mark"
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="au-check-label">
        {label}
        {hint ? <span className="au-check-hint">{hint}</span> : null}
      </span>
    </label>
  )
}
