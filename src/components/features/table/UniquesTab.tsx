import type { CSSProperties } from 'react'

import { ConstraintGrid, constraintRowId } from '@/components/features/table/ConstraintGrid'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { resolveSchemaColor } from '@/lib/model/colors'
import {
  NO_COMPOUND_UNIQUES_MESSAGE,
  UNIQUE_NEEDS_TWO_FIELDS_MESSAGE,
  splitUniques,
} from '@/lib/model/indexes'
import type { Table } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Ficha «Únicos» del editor de tabla (FR-032 a FR-038).
 *
 * Arriba, «Desde la columna Llave (UK)»: los únicos de un solo campo, que son
 * la marca UK de la ficha «Campos» y se ponen y se quitan allí. Aquí se leen
 * sin mandos, y siguen al momento lo que se marque en «Campos» (FR-038).
 *
 * Debajo, los únicos compuestos en su rejilla: siempre de dos o más columnas.
 * «Añadir único» crea uno ya completo con dos columnas y un nombre con el
 * prefijo de Ajustes, y no está disponible en una tabla de menos de dos campos
 * (FR-033, research R11, R13).
 */

/** Props de la ficha. */
export interface UniquesTabProps {
  /** Tabla cuyos únicos se editan. */
  table: Table
}

/**
 * Cómo se lee el número de únicos de la tabla, de un campo y compuestos.
 *
 * @param count Cuántos tiene la tabla.
 */
export function uniqueCountLabel(count: number): string {
  return count === 1 ? '1 único' : `${count} únicos`
}

export function UniquesTab({ table }: UniquesTabProps) {
  const model = useAppStore((state) => state.model)
  const focusCell = useAppStore((state) => state.focusCell)
  const addUnique = useAppStore((state) => state.addUnique)
  const setUniqueName = useAppStore((state) => state.setUniqueName)
  const setUniqueFields = useAppStore((state) => state.setUniqueFields)
  const deleteUnique = useAppStore((state) => state.deleteUnique)

  const schema = model?.schemas.find((item) => item.name === table.schema)
  const { single, compound } = splitUniques(table)
  const canAdd = table.fields.length >= 2

  /** Añade un único compuesto y deja el foco en su nombre. */
  function add() {
    if (addUnique(table.name) === null) return
    focusCell({ field: constraintRowId('uniques', compound.length), column: 'name' })
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
        <span className="sm-fields-count">{uniqueCountLabel(single.length + compound.length)}</span>

        <span className="ml-auto flex items-center gap-1.5 pr-9">
          <Button
            size="sm"
            variant="primary"
            icon="plus"
            disabled={!canAdd}
            title={canAdd ? undefined : UNIQUE_NEEDS_TWO_FIELDS_MESSAGE}
            aria-description={canAdd ? undefined : UNIQUE_NEEDS_TWO_FIELDS_MESSAGE}
            onClick={add}
          >
            Añadir único
          </Button>
        </span>
      </header>

      <div className="sm-constraint-body">
        <section aria-label="Desde la columna Llave (UK)" className="sm-constraint-block">
          <span className="sm-refby-label">Desde la columna Llave (UK)</span>
          {single.length === 0 ? (
            <p className="sm-constraint-empty">
              Ningún campo está marcado UK. Se marca en la ficha «Campos».
            </p>
          ) : (
            <ul className="sm-auto-list">
              {single.map((item) => (
                <li key={item.name} className="sm-auto-row">
                  <Icon name="key-round" size={14} className="text-label-secondary" />
                  <code>{item.name}</code>
                  <span className="sm-auto-cols">({item.fields.join(', ')})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Únicos compuestos" className="sm-constraint-block sm-constraint-grid">
          <span className="sm-refby-label">Únicos compuestos</span>
          {compound.length === 0 ? (
            <p className="sm-constraint-empty">{NO_COMPOUND_UNIQUES_MESSAGE}</p>
          ) : (
            <ConstraintGrid
              table={table}
              kind="uniques"
              items={compound}
              label={`Únicos compuestos de ${table.name}`}
              nameLabel="Nombre de la restricción"
              removeLabel="Eliminar restricción"
              onName={(name, next) => setUniqueName(table.name, name, next)}
              onFields={(name, fields) => setUniqueFields(table.name, name, fields)}
              onDelete={(name) => deleteUnique(table.name, name)}
            />
          )}
        </section>
      </div>
    </>
  )
}
