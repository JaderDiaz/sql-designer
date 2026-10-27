import { TABLE_HEIGHT, TABLE_WIDTH } from '@/lib/canvas/constants'
import type { Position, Table } from '@/lib/model/types'

/**
 * Tarjeta compacta de una tabla en el lienzo.
 *
 * Solo dibuja: ni crea, ni edita, ni mueve una tabla sola. Eso es del
 * Incremento 3; aquí la tabla se mueve únicamente cuando se arrastra la zona
 * de su esquema (Clarifications del spec).
 */

/** Props de la tarjeta. */
export interface TableCardProps {
  table: Table
  /** Posición en coordenadas del modelo, de `resolveLayout`. */
  position: Position
  /** Abreviatura del esquema de la tabla, para su chip. */
  abbreviation: string
  /** Nombre técnico del esquema, para el nombre accesible. */
  schema: string
  /** Si está atenuada porque el foco está en otro esquema (FR-030). */
  isDim: boolean
  /** Si acompaña a la zona que se está arrastrando (FR-026). */
  isDragging?: boolean
}

export function TableCard({
  table,
  position,
  abbreviation,
  schema,
  isDim,
  isDragging = false,
}: TableCardProps) {
  const fields = table.fields.length

  const fieldsText = fields === 1 ? '1 campo' : `${fields} campos`

  return (
    <button
      // Botón para que el tabulador la alcance y los lectores de pantalla la
      // anuncien (contracts/canvas.md §5), aunque todavía no haga nada: lo que
      // se hace con una tabla llega en el Incremento 3.
      type="button"
      aria-label={`Tabla ${table.name}, esquema ${abbreviation} · ${schema}, ${fieldsText}`}
      className={`sm-table${isDim ? ' is-dim' : ''}`}
      data-drag={isDragging ? '' : undefined}
      style={{ left: position.x, top: position.y, width: TABLE_WIDTH, height: TABLE_HEIGHT }}
    >
      <span className="sm-table-name">{table.name}</span>
      <span className="sm-table-meta">
        {abbreviation} · {fieldsText}
      </span>
    </button>
  )
}
