import * as RadioGroup from '@radix-ui/react-radio-group'

import { cn } from '@/lib/cn'

/** Un color ofrecido en la paleta: su identificador y su nombre. */
export interface ColorOption {
  id: string
  label: string
}

/** Props de la paleta. */
export interface ColorSwatchesProps {
  /** Colores que se ofrecen, en el orden en que se muestran. */
  options: readonly ColorOption[]
  /** Identificador del color elegido. */
  value: string
  /** Qué hacer al elegir otro. */
  onValueChange: (value: string) => void
  /** Nombre del grupo, para quien navega sin ver. */
  ariaLabel: string
  className?: string
}

/**
 * Paleta de colores como grupo de radio, sobre el primitivo de Radix.
 *
 * Cada muestra lleva su nombre («Índigo») como nombre accesible, porque el
 * color no puede ser el único portador de la información (FR-040). El
 * componente no sabe de esquemas ni de modelos: recibe la lista y devuelve el
 * identificador elegido (principio V, puerta 7).
 */
export function ColorSwatches({
  options,
  value,
  onValueChange,
  ariaLabel,
  className,
}: ColorSwatchesProps) {
  return (
    <RadioGroup.Root
      className={cn('au-swatches', className)}
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      loop
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.id}
          value={option.id}
          aria-label={option.label}
          title={option.label}
          className="au-swatch"
          style={{ '--swatch': `var(--${option.id})` } as React.CSSProperties}
        >
          <RadioGroup.Indicator className="au-swatch-mark" />
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}
