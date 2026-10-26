import { useRef, type KeyboardEvent, type ReactNode } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Una fila de la lista de archivos. */
export interface FileRow {
  id: string
  name: string
  /** Segunda columna, normalmente la fecha de modificación. */
  meta: string
  icon: IconName
  /** Una fila deshabilitada se ve pero no se puede elegir. */
  disabled?: boolean
}

/** Props de la lista de archivos. */
export interface FileListProps {
  rows: FileRow[]
  /** Fila seleccionada, o `null` si no hay ninguna. */
  value: string | null
  onValueChange: (id: string) => void
  /** Doble clic o Enter sobre una fila: entrar en la carpeta o abrir el modelo. */
  onActivate?: (id: string) => void
  /** Texto accesible de la lista. */
  label: string
  /** Título de la segunda columna. */
  metaLabel: string
  /** Ancho en píxeles de la segunda columna, como en el lienzo. */
  metaWidth?: number
  /** Qué se ve cuando no hay ninguna fila. */
  empty?: ReactNode
  className?: string
}

/**
 * Lista de archivos de los diálogos de carpeta y de abrir modelo.
 *
 * Es un `listbox` de verdad: cada fila es una opción con su estado de
 * selección, las flechas mueven la selección y Enter activa la fila, que es
 * lo mismo que el doble clic (RS-09). El estado vacío entra por composición,
 * para que cada pantalla ponga su propio mensaje.
 */
export function FileList({
  rows,
  value,
  onValueChange,
  onActivate,
  label,
  metaLabel,
  metaWidth = 130,
  empty,
  className,
}: FileListProps) {
  const container = useRef<HTMLDivElement>(null)
  const selectable = rows.filter((row) => !row.disabled)

  /** Mueve la selección con el teclado y activa la fila con Enter. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && value !== null) {
      event.preventDefault()
      onActivate?.(value)
      return
    }

    const index = selectable.findIndex((row) => row.id === value)
    let next = index
    if (event.key === 'ArrowDown') next = Math.min(selectable.length - 1, index + 1)
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = selectable.length - 1
    else return

    event.preventDefault()
    const target = selectable[next]
    if (!target || target.id === value) return
    onValueChange(target.id)
    container.current?.querySelector<HTMLButtonElement>(`[data-id="${target.id}"]`)?.focus()
  }

  return (
    <>
      <div className="sm-file-head">
        <span className="sm-file-name">Nombre</span>
        <span className="sm-file-date" style={{ width: metaWidth }}>
          {metaLabel}
        </span>
      </div>
      <div
        ref={container}
        className={cn('sm-file-list', className)}
        role="listbox"
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        {rows.map((row) => {
          const selected = row.id === value
          return (
            <button
              key={row.id}
              type="button"
              data-id={row.id}
              role="option"
              aria-selected={selected}
              disabled={row.disabled ?? false}
              tabIndex={selected || (value === null && row === selectable[0]) ? 0 : -1}
              className={cn('sm-file', selected ? 'is-sel' : null)}
              onClick={() => onValueChange(row.id)}
              onDoubleClick={() => onActivate?.(row.id)}
            >
              <Icon name={row.icon} size={16} />
              <span className="sm-file-name">{row.name}</span>
              <span className="sm-file-date" style={{ width: metaWidth }}>
                {row.meta}
              </span>
            </button>
          )
        })}
        {rows.length === 0 ? empty : null}
      </div>
    </>
  )
}
