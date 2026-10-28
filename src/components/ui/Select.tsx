import * as RadixSelect from '@radix-ui/react-select'

import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Una opción del selector. */
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
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
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        className={cn('au-select-trigger', className)}
        aria-label={label}
        tabIndex={tabIndex}
      >
        <RadixSelect.Value className="au-select-value" />
        <RadixSelect.Icon className="au-select-chev">
          <Icon name="chevrons-up-down" size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="au-pop" position="popper" sideOffset={6}>
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
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
