import { forwardRef } from 'react'

import type { SchemaZone as Zone } from '@/lib/canvas/geometry'
import type { Schema } from '@/lib/model/types'

/**
 * Zona de un esquema en el lienzo (FR-023 a FR-025).
 *
 * El rectángulo lo calcula la geometría pura; aquí solo se pinta, con el color
 * del esquema entrando por la variable `--zone` para que el relleno, el borde
 * y el rótulo salgan todos del mismo token. El color no es el único portador
 * de la información: la abreviatura y el nombre están siempre en el rótulo
 * (FR-040).
 */

/** Lo que dice una zona que todavía no tiene tablas (FR-025). */
export const EMPTY_ZONE_TEXT = 'Aún no hay tablas en este esquema'

/** Props de la zona. */
export interface SchemaZoneProps {
  zone: Zone
  schema: Schema
  /** Si es la seleccionada, lo que mira el inspector (FR-003). */
  isSelected: boolean
  /** Si está atenuada porque el foco está en otro esquema (FR-030). */
  isDim: boolean
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerMove?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerUp?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerCancel?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void
  /** Si forma parte del grupo que se está arrastrando (FR-026). */
  isDragging?: boolean
  onClick?: () => void
}

/** Cómo se lee el número de tablas en el rótulo y el nombre accesible. */
function countText(count: number): string {
  if (count === 0) return 'sin tablas'
  return count === 1 ? '1 tabla' : `${count} tablas`
}

export const SchemaZone = forwardRef<HTMLButtonElement, SchemaZoneProps>(function SchemaZone(
  {
    zone,
    schema,
    isSelected,
    isDim,
    isDragging = false,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
    onClick,
  },
  ref,
) {
  const classes = ['sm-zone']
  if (zone.isEmpty) classes.push('is-empty')
  if (isSelected) classes.push('is-sel')
  if (isDim) classes.push('is-dim')

  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Esquema ${schema.abbreviation} · ${schema.name}, ${countText(zone.tableCount)}`}
      aria-pressed={isSelected}
      className={classes.join(' ')}
      style={
        {
          left: zone.rect.x,
          top: zone.rect.y,
          width: zone.rect.width,
          height: zone.rect.height,
          '--zone': `var(--${zone.color})`,
        } as React.CSSProperties
      }
      data-drag={isDragging ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
      onClick={onClick}
    >
      <span className="sm-zone-head">
        <span className="sm-zone-abbr">{schema.abbreviation}</span>
        <span className="min-w-0 truncate">{schema.name}</span>
        <span className="sm-zone-count">{countText(zone.tableCount)}</span>
      </span>

      {zone.isEmpty ? <span className="sm-zone-empty">{EMPTY_ZONE_TEXT}</span> : null}
    </button>
  )
})
