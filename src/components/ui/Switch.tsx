import * as RadixSwitch from '@radix-ui/react-switch'
import { useId } from 'react'

import { cn } from '@/lib/cn'

/** Props del interruptor. */
export interface SwitchProps {
  /** Si está encendido. */
  checked: boolean
  /** Qué hacer al cambiarlo. */
  onCheckedChange: (checked: boolean) => void
  /** Etiqueta visible, que además nombra al control. */
  label: string
  /** Segunda línea que explica qué pasa al encenderlo. */
  hint?: string
  disabled?: boolean
  className?: string
}

/**
 * Interruptor del sistema Aura, sobre el primitivo de Radix.
 *
 * El primitivo aporta el `role="switch"`, el estado y el teclado; aquí solo se
 * dibuja con tokens. Es puro: no conoce el almacén ni ninguna pantalla
 * (principio V, puerta 7).
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled = false,
  className,
}: SwitchProps) {
  const id = useId()

  return (
    <div className={cn('au-switch', className)}>
      <RadixSwitch.Root
        id={id}
        className="au-switch-track"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      >
        <RadixSwitch.Thumb className="au-switch-thumb" />
      </RadixSwitch.Root>
      <label htmlFor={id} className="au-switch-label">
        {label}
        {hint ? <span className="au-switch-hint">{hint}</span> : null}
      </label>
    </div>
  )
}
