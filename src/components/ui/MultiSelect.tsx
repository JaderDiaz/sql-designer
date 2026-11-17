import * as RadixMenu from '@radix-ui/react-dropdown-menu'
import type { CSSProperties } from 'react'

import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/**
 * Selector de varias opciones del sistema Aura, sobre el menú con casillas de
 * Radix (research R12).
 *
 * Radix no trae un selector múltiple, pero su menú con casillas aporta el rol,
 * el foco atrapado, las flechas y el cierre con Escape (principio V). El menú
 * no se cierra al marcar, para elegir varias seguidas, y el valor guarda el
 * **orden de elección**: en un índice compuesto el orden de las columnas es
 * parte del índice (FR-025). Es una pieza pura: no conoce el almacén.
 */

/** Una opción del selector. */
export interface MultiSelectOption {
  value: string
  label: string
  /** Segunda línea, debajo del nombre. */
  description?: string
  disabled?: boolean
}

/** Props del selector. */
export interface MultiSelectProps {
  /** Texto accesible; el disparador se lee «<label>: a, b». */
  label: string
  options: MultiSelectOption[]
  /** Las elegidas, en el orden en que se eligieron. */
  value: string[]
  onValueChange: (value: string[]) => void
  /** Lo que dice el disparador sin nada elegido. */
  placeholder?: string
  /** Parada de tabulador; `-1` en las rejillas de tabindex rotatorio. */
  tabIndex?: number
  disabled?: boolean
  className?: string
}

/** El ancho mínimo de la lista es el del disparador, como en `Select`. */
const LIST_STYLE = {
  minWidth: 'var(--radix-dropdown-menu-trigger-width, 100%)',
} as CSSProperties

/**
 * Lo que se lee del disparador: la etiqueta y las elegidas en orden.
 *
 * @param label Etiqueta del selector.
 * @param labels Nombres de las elegidas, en su orden.
 */
export function multiSelectName(label: string, labels: readonly string[]): string {
  return labels.length === 0 ? label : `${label}: ${labels.join(', ')}`
}

export function MultiSelect({
  label,
  options,
  value,
  onValueChange,
  placeholder = 'Elige',
  tabIndex,
  disabled = false,
  className,
}: MultiSelectProps) {
  const labels = value.map(
    (item) => options.find((option) => option.value === item)?.label ?? item,
  )

  /** Marca o desmarca: lo marcado va al final, lo desmarcado sale sin mover el resto. */
  function toggle(option: string, checked: boolean) {
    if (checked) {
      if (!value.includes(option)) onValueChange([...value, option])
      return
    }
    onValueChange(value.filter((item) => item !== option))
  }

  return (
    <RadixMenu.Root modal={false}>
      <RadixMenu.Trigger
        className={cn('au-select-trigger', className)}
        aria-label={multiSelectName(label, labels)}
        tabIndex={tabIndex}
        disabled={disabled}
      >
        <span className={cn('au-select-value', labels.length === 0 && 'is-placeholder')}>
          {labels.length === 0 ? placeholder : labels.join(', ')}
        </span>
        <span className="au-select-chev" aria-hidden="true">
          <Icon name="chevrons-up-down" size={14} />
        </span>
      </RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content
          className="au-pop au-select-list"
          style={LIST_STYLE}
          align="start"
          sideOffset={6}
          collisionPadding={8}
          aria-label={label}
        >
          {options.map((option) => {
            const position = value.indexOf(option.value)
            return (
              <RadixMenu.CheckboxItem
                key={option.value}
                className="au-option"
                checked={position >= 0}
                disabled={option.disabled ?? false}
                onCheckedChange={(checked) => toggle(option.value, checked === true)}
                // Elegir no cierra el menú: se eligen varias seguidas.
                onSelect={(event) => event.preventDefault()}
              >
                <span className="au-option-check">
                  <RadixMenu.ItemIndicator>
                    <Icon name="check" size={14} />
                  </RadixMenu.ItemIndicator>
                </span>
                <span className="au-option-text">
                  <span>{option.label}</span>
                  {option.description === undefined ? null : (
                    <span className="au-option-desc">{option.description}</span>
                  )}
                </span>
                {position >= 0 && value.length > 1 ? (
                  <span className="au-option-order" aria-hidden="true">
                    {position + 1}
                  </span>
                ) : null}
              </RadixMenu.CheckboxItem>
            )
          })}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  )
}
