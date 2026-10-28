import type { CSSProperties } from 'react'

import { resolveSchemaColor } from '@/lib/model/colors'
import type { Table } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Sección «Referenciada por» de la ficha «Claves foráneas» (FR-031, FR-032).
 *
 * Es la otra mitad de la relación: la ficha de arriba dice a quién apunta esta
 * tabla, y esto dice quién apunta a ella. Cada entrada lleva la abreviatura y
 * el color del esquema de la tabla que referencia —los mismos de la tarjeta y
 * de la pastilla del lienzo— y el nombre `tabla.columna`, y al pulsarla la
 * selecciona en el lienzo, que es a donde se quiere ir.
 *
 * Sin nadie que la referencie la sección no se dibuja: una lista vacía con su
 * título no dice nada que el silencio no diga mejor (FR-032).
 */

/** Título de la sección (contracts/relations.md §5). */
export const REFERENCED_BY_LABEL = 'Referenciada por'

/** Props de la sección. */
export interface ReferencedByListProps {
  /** Tabla abierta, la que otras referencian. */
  table: Table
}

export function ReferencedByList({ table }: ReferencedByListProps) {
  const model = useAppStore((state) => state.model)
  const selectTable = useAppStore((state) => state.selectTable)
  const openFieldsPanel = useAppStore((state) => state.openFieldsPanel)

  const schemaOf = new Map((model?.tables ?? []).map((item) => [item.name, item.schema]))
  const schemas = new Map((model?.schemas ?? []).map((schema) => [schema.name, schema]))
  const incoming = (model?.relations ?? []).filter(
    (relation) => relation.toTable === table.name && relation.fromTable !== table.name,
  )

  if (incoming.length === 0) return null

  return (
    <section aria-label={REFERENCED_BY_LABEL} className="sm-refby">
      <span className="sm-refby-label">{REFERENCED_BY_LABEL}</span>
      <div className="sm-refby-list">
        {incoming.map((relation) => {
          const schema = schemas.get(schemaOf.get(relation.fromTable) ?? '')
          const column = `${relation.fromTable}.${relation.fromFields.join(', ')}`
          return (
            <button
              key={relation.name}
              type="button"
              className="sm-refby-chip"
              onClick={() => {
                selectTable(relation.fromTable)
                openFieldsPanel(relation.fromTable, undefined, 'foreignKeys')
              }}
            >
              <span
                className="sm-abbr"
                aria-hidden="true"
                style={
                  { '--zone': `var(--${resolveSchemaColor(schema?.color)})` } as CSSProperties
                }
              >
                <span className="sm-abbr-dot" />
                {schema?.abbreviation ?? '···'}
              </span>
              <span className="sm-refby-name">{column}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
