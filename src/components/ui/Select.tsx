import * as RadixSelect from '@radix-ui/react-select'
import type { CSSProperties } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Una opción del selector. */
export interface SelectOption {
  value: string
  label: string
  /** Icono a la izquierda del texto, en la lista y en el disparador. */
  icon?: IconName
  /**
   * Color del icono: el identificador de un token, como `teal` o `indigo`.
   *
   * Es el color del esquema en los selectores que eligen uno; el texto de la
   * opción dice lo mismo, así que el color no porta nada por su cuenta
   * (RS-11).
   */
  tint?: string
  /** Segunda línea de la opción, debajo de su nombre. */
  description?: string
  disabled?: boolean
}

/**
 * El color del icono viaja en una variable, no en `color`.
 *
 * Con el color puesto en el elemento, la fila marcada —que pinta el acento de
 * fondo— se quedaba con el icono de su tinte encima, porque un color del
 * elemento gana a lo que diga la hoja. En una variable, la regla de la fila
 * marcada sigue mandando (SC-011).
 *
 * @param tint Identificador del token del color, o `undefined`.
 */
function tintStyle(tint: string | undefined): CSSProperties | undefined {
  if (tint === undefined) return undefined
  return { '--tint': `var(--${tint})` } as CSSProperties
}

/** Props del selector. */
export interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  /** Texto accesible del disparador. */
  label: string
  disabled?: boolean
  /** Parada de tabulador; `-1` en las rejillas de tabindex rotatorio. */
  tabIndex?: number
  className?: string
}

/**
 * Selector del sistema Aura sobre Radix.
 *
 * El teclado, el rol, el desplazamiento de la lista y el cierre con Escape
 * los aporta el primitivo (principio V); aquí solo viajan las clases `au-*` y
 * los tokens.
 */
export function Select({
  value,
  onValueChange,
  options,
  label,
  disabled = false,
  tabIndex,
  className,
}: SelectProps) {
  const current = options.find((option) => option.value === value)

  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        className={cn('au-select-trigger', className)}
        aria-label={label}
        tabIndex={tabIndex}
      >
        {current?.icon === undefined ? null : (
          <span className="au-select-icon" style={tintStyle(current.tint)}>
            <Icon name={current.icon} size={14} />
          </span>
        )}
        <RadixSelect.Value className="au-select-value" />
        <RadixSelect.Icon className="au-select-chev">
          <Icon name="chevrons-up-down" size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className="au-pop"
          position="popper"
          sideOffset={6}
          collisionPadding={8}
        >
          <RadixSelect.Viewport className="au-select-list">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled ?? false}
                className="au-option"
              >
                <span className="au-option-check">
                  <RadixSelect.ItemIndicator>
                    <Icon name="check" size={14} />
                  </RadixSelect.ItemIndicator>
                </span>
                {option.icon === undefined ? null : (
                  <span className="au-option-icon" style={tintStyle(option.tint)}>
                    <Icon name={option.icon} size={14} />
                  </span>
                )}
                <span className="au-option-text">
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  {option.description === undefined ? null : (
                    <span className="au-option-desc">{option.description}</span>
                  )}
                </span>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
