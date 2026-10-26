import { useId } from 'react'

import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Props del campo de búsqueda. */
export interface SearchFieldProps {
  value: string
  onValueChange: (value: string) => void
  /** Texto accesible obligatorio: el campo no lleva etiqueta visible. */
  label: string
  placeholder?: string
  className?: string
}

/**
 * Variante de búsqueda del campo de texto, como la dibuja el lienzo en la
 * cabecera de los diálogos de archivo: cápsula con lupa y botón de limpiar
 * que solo aparece cuando hay texto.
 */
export function SearchField({
  value,
  onValueChange,
  label,
  placeholder = 'Buscar',
  className,
}: SearchFieldProps) {
  const id = useId()

  return (
    <div className={cn('au-field au-field-search', className)}>
      <span className="au-input-wrap">
        <Icon name="search" size={14} />
        <input
          id={id}
          type="search"
          className="au-input"
          value={value}
          aria-label={label}
          placeholder={placeholder}
          onChange={(event) => onValueChange(event.target.value)}
        />
        {value === '' ? null : (
          <button
            type="button"
            className="au-input-clear"
            aria-label="Limpiar la búsqueda"
            onClick={() => onValueChange('')}
          >
            <Icon name="x" size={10} />
          </button>
        )}
      </span>
    </div>
  )
}
