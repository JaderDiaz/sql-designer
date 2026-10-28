import { forwardRef, type ButtonHTMLAttributes } from 'react'

import { TABLE_WIDTH, tableHeight } from '@/lib/canvas/constants'
import { fieldMarks } from '@/lib/model/marks'
import type { FieldMark } from '@/lib/model/marks'
import type { Position, Relation, Table } from '@/lib/model/types'

/**
 * Tarjeta de una tabla en el lienzo, con sus campos (FR-012, FR-025, FR-047).
 *
 * La tarjeta lista los campos de la tabla con su nombre, su tipo y su marca de
 * llave, así que su alto no es fijo: lo da `tableHeight` a partir de cuántos
 * campos tiene (research R1). Lo que se escribe en el editor de campos se ve
 * aquí al instante, porque las dos cosas leen el mismo modelo.
 *
 * La marca viaja también en el nombre accesible: el color no es el único
 * portador de esa información (FR-047, RS-11).
 */

/** Props de la tarjeta. */
export interface TableCardProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'style'
> {
  table: Table
  /** Posición en coordenadas del modelo, de `resolveLayout`. */
  position: Position
  /** Abreviatura del esquema de la tabla, para su pastilla. */
  abbreviation: string
  /** Nombre técnico del esquema, para el nombre accesible. */
  schema: string
  /** Color del esquema ya resuelto contra la paleta, para su pastilla. */
  color: string
  /** Relaciones del modelo, para la marca `FK` de cada campo. */
  relations?: Relation[]
  /** Si es la tabla seleccionada (FR-007a). */
  isSelected?: boolean
  /** Si está atenuada porque el resaltado está en otra parte (FR-021). */
  isDim: boolean
  /** Si es la tabla resaltada: cursor, foco o selección (FR-021, FR-022). */
  isHot?: boolean
  /** Si está al otro lado de una relación resaltada (FR-021, FR-022). */
  isLinked?: boolean
  /** Campos que forman las relaciones resaltadas de esta tabla (FR-023). */
  hotFields?: ReadonlySet<string>
  /** Si acompaña al grupo que se está arrastrando (FR-026, FR-030). */
  isDragging?: boolean
  /** Qué hacer al pulsarla (FR-007a). */
  onSelect?: () => void
  /** Qué hacer al pulsarla dos veces: abrir su editor de campos (FR-023). */
  onOpenFields?: () => void
}

/** Cómo se dice cada marca en el nombre accesible (FR-047). */
const MARK_WORDS: Record<Exclude<FieldMark, null>, string> = {
  PK: 'llave primaria',
  UK: 'única',
  FK: 'clave foránea',
}

export const TableCard = forwardRef<HTMLButtonElement, TableCardProps>(function TableCard(
  {
    table,
    position,
    abbreviation,
    schema,
    color,
    relations = [],
    isSelected = false,
    isDim,
    isHot = false,
    isLinked = false,
    hotFields,
    isDragging = false,
    onSelect,
    onOpenFields,
    className,
    ...rest
  },
  ref,
) {
  const count = table.fields.length
  const fieldsText = count === 1 ? '1 campo' : `${count} campos`
  const marks = fieldMarks(table, relations)

  /** Nombre accesible de la tarjeta: la tabla y después cada campo. */
  const label = [
    `Tabla ${table.name}, esquema ${abbreviation} · ${schema}, ${fieldsText}`,
    ...table.fields.map((field) => {
      const mark = marks.get(field.name) ?? null
      return [
        field.name,
        field.type,
        mark === null ? null : MARK_WORDS[mark],
        field.nullable === true ? 'admite nulos' : null,
      ]
        .filter((part) => part !== null)
        .join(', ')
    }),
  ].join('. ')

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={isSelected}
      className={[
        'sm-table',
        isHot ? 'is-hot' : null,
        isLinked ? 'is-linked' : null,
        isDim ? 'is-dim' : null,
        className,
      ]
        .filter((part) => part !== null && part !== undefined)
        .join(' ')}
      data-drag={isDragging ? '' : undefined}
      data-selected={isSelected ? '' : undefined}
      style={
        {
          left: position.x,
          top: position.y,
          width: TABLE_WIDTH,
          height: tableHeight(count),
          // La pastilla del esquema lee el color por aquí, igual que la zona.
          '--zone': `var(--${color})`,
        } as React.CSSProperties
      }
      onClick={onSelect}
      onDoubleClick={onOpenFields}
    >
      <span className="sm-table-head" aria-hidden="true">
        <span className="sm-abbr">
          <span className="sm-abbr-dot" />
          {abbreviation}
        </span>
        <span className="sm-table-name">{table.name}</span>
        <span className="sm-table-meta">{count}</span>
      </span>
      <span className="sm-table-fields" aria-hidden="true">
        {table.fields.map((field) => {
          const mark = marks.get(field.name) ?? null
          return (
            <span
              className="sm-field-row"
              key={field.name}
              // Los campos que forman una relación resaltada se marcan en las
              // dos tablas, no solo en la que lleva la clave (FR-023).
              data-hot={hotFields?.has(field.name) === true ? '' : undefined}
            >
              {mark === null ? (
                <span className="sm-field-mark-space" />
              ) : (
                <span className="sm-field-mark" data-mark={mark}>
                  {mark}
                </span>
              )}
              <span className="sm-field-name">{field.name}</span>
              <span className="sm-field-type">
                {field.type}
                {field.nullable === true ? '?' : ''}
              </span>
            </span>
          )
        })}
      </span>
    </button>
  )
})
