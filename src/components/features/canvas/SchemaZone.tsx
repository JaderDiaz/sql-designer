import { forwardRef, type ButtonHTMLAttributes } from 'react'

import type { SchemaZone as Zone } from '@/lib/canvas/geometry'
import { cn } from '@/lib/cn'
import type { Schema } from '@/lib/model/types'

/**
 * Zona de un esquema en el lienzo (FR-023 a FR-025).
 *
 * El rectángulo lo calcula la geometría pura; aquí solo se pinta, con el color
 * del esquema entrando por la variable `--zone` para que el relleno, el borde
 * y el rótulo salgan todos del mismo token. El color no es el único portador
 * de la información: la abreviatura y el nombre están siempre en el rótulo
 * (FR-040).
 *
 * Todo lo que no es suyo viaja al botón sin tocarlo: la zona es el disparador
 * de su menú contextual, y ese menú le pasa manejadores propios —el del botón
 * derecho y el de ⇧F10— que se perderían si aquí solo se leyeran los que la
 * zona conoce (FR-038).
 */

/** Lo que dice una zona que todavía no tiene tablas (FR-025). */
export const EMPTY_ZONE_TEXT = 'Aún no hay tablas en este esquema'

/** Props de la zona; lo que no se declara son atributos nativos del botón. */
export interface SchemaZoneProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  zone: Zone
  schema: Schema
  /** Si es la seleccionada, lo que mira el inspector (FR-003). */
  isSelected: boolean
  /** Si está atenuada porque el foco está en otro esquema (FR-030). */
  isDim: boolean
  /** Si forma parte del grupo que se está arrastrando (FR-026). */
  isDragging?: boolean
}

/** Cómo se lee el número de tablas en el rótulo y el nombre accesible. */
function countText(count: number): string {
  if (count === 0) return 'sin tablas'
  return count === 1 ? '1 tabla' : `${count} tablas`
}

export const SchemaZone = forwardRef<HTMLButtonElement, SchemaZoneProps>(function SchemaZone(
  { zone, schema, isSelected, isDim, isDragging = false, className, style, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-label={`Esquema ${schema.abbreviation} · ${schema.name}, ${countText(zone.tableCount)}`}
      aria-pressed={isSelected}
      className={cn(
        'sm-zone',
        zone.isEmpty ? 'is-empty' : null,
        isSelected ? 'is-sel' : null,
        isDim ? 'is-dim' : null,
        className,
      )}
      data-drag={isDragging ? '' : undefined}
      style={
        {
          ...style,
          left: zone.rect.x,
          top: zone.rect.y,
          width: zone.rect.width,
          height: zone.rect.height,
          '--zone': `var(--${zone.color})`,
        } as React.CSSProperties
      }
    >
      <span className="sm-zone-head">
        <span className="sm-zone-abbr">
          <span aria-hidden="true" className="sm-zone-dot" />
          {schema.abbreviation}
        </span>
        <span className="min-w-0 truncate">{schema.name}</span>
        <span className="sm-zone-count">· {countText(zone.tableCount)}</span>
      </span>

      {zone.isEmpty ? <span className="sm-zone-empty">{EMPTY_ZONE_TEXT}</span> : null}
    </button>
  )
})
