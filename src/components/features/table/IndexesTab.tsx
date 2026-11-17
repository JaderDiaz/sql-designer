import type { CSSProperties } from 'react'

import { ConstraintGrid, constraintRowId } from '@/components/features/table/ConstraintGrid'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { resolveSchemaColor } from '@/lib/model/colors'
import { NO_INDEXES_MESSAGE, NO_RESTRICTIONS_MESSAGE, automaticIndexes } from '@/lib/model/indexes'
import type { Table } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Ficha «Índices» del editor de tabla (FR-021 a FR-030).
 *
 * Arriba, «Creados por restricciones»: la llave primaria y cada único crean su
 * índice, y aquí se leen sin mandos, porque se cambian donde se definen. Se
 * deducen de la tabla y no se guardan (research R9).
 *
 * Debajo, los índices propios en su rejilla. «Añadir índice» crea uno ya
 * completo: la columna de la primera clave foránea sin índice y un nombre con
 * el prefijo de Ajustes (FR-023, FR-024). En cuanto existe, la fila de esa
 * clave foránea pasa a «Indexada» en su ficha (FR-031).
 */

/** Props de la ficha. */
export interface IndexesTabProps {
  /** Tabla cuyos índices se editan. */
  table: Table
}

/**
 * Cómo se lee el número de índices propios.
 *
 * @param count Cuántos tiene la tabla.
 */
export function indexCountLabel(count: number): string {
  return count === 1 ? '1 índice' : `${count} índices`
}

export function IndexesTab({ table }: IndexesTabProps) {
  const model = useAppStore((state) => state.model)
  const focusCell = useAppStore((state) => state.focusCell)
  const addIndex = useAppStore((state) => state.addIndex)
  const setIndexName = useAppStore((state) => state.setIndexName)
  const setIndexFields = useAppStore((state) => state.setIndexFields)
  const setIndexUnique = useAppStore((state) => state.setIndexUnique)
  const deleteIndex = useAppStore((state) => state.deleteIndex)

  const schema = model?.schemas.find((item) => item.name === table.schema)
  const automatic = automaticIndexes(table)
  const indexes = table.indexes ?? []

  /** Añade un índice y deja el foco en su nombre. */
  function add() {
    if (addIndex(table.name) === null) return
    focusCell({ field: constraintRowId('indexes', indexes.length), column: 'name' })
  }

  return (
    <>
      <header className="sm-fields-head">
        <span
          className="sm-abbr"
          aria-hidden="true"
          style={{ '--zone': `var(--${resolveSchemaColor(schema?.color)})` } as CSSProperties}
        >
          <span className="sm-abbr-dot" />
          {schema?.abbreviation ?? '···'}
        </span>
        <span className="sm-fields-title">{table.name}</span>
        <span className="sm-fields-count">{indexCountLabel(indexes.length)}</span>

        <span className="ml-auto flex items-center gap-1.5 pr-9">
          <Button size="sm" variant="primary" icon="plus" onClick={add}>
            Añadir índice
          </Button>
        </span>
      </header>

      <div className="sm-constraint-body">
        <section aria-label="Creados por restricciones" className="sm-constraint-block">
          <span className="sm-refby-label">Creados por restricciones</span>
          {automatic.length === 0 ? (
            <p className="sm-constraint-empty">{NO_RESTRICTIONS_MESSAGE}</p>
          ) : (
            <ul className="sm-auto-list">
              {automatic.map((item) => (
                <li key={item.name} className="sm-auto-row">
                  <Icon name="lock" size={14} className="text-label-secondary" />
                  <code>{item.name}</code>
                  <span className="sm-auto-cols">({item.fields.join(', ')})</span>
                  <span className="sm-auto-kind">{item.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Índices" className="sm-constraint-block sm-constraint-grid">
          <span className="sm-refby-label">Índices</span>
          {indexes.length === 0 ? (
            <p className="sm-constraint-empty">{NO_INDEXES_MESSAGE}</p>
          ) : (
            <ConstraintGrid
              table={table}
              kind="indexes"
              items={indexes}
              label={`Índices de ${table.name}`}
              nameLabel="Nombre del índice"
              removeLabel="Eliminar índice"
              onName={(name, next) => setIndexName(table.name, name, next)}
              onFields={(name, fields) => setIndexFields(table.name, name, fields)}
              onUnique={(name, unique) => setIndexUnique(table.name, name, unique)}
              onDelete={(name) => deleteIndex(table.name, name)}
            />
          )}
        </section>
      </div>
    </>
  )
}
