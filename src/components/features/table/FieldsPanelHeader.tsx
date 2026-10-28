import type { CSSProperties } from 'react'

import { FieldTemplatesMenu } from '@/components/features/table/FieldTemplatesMenu'
import { Button } from '@/components/ui/Button'
import { resolveSchemaColor } from '@/lib/model/colors'
import { useAppStore } from '@/store'
import type { Table } from '@/lib/model/types'

/**
 * Cabecera del editor de campos (FR-010).
 *
 * Dice de qué tabla se están editando los campos —con la abreviatura de su
 * esquema, para no confundir dos tablas del mismo nombre en esquemas
 * distintos— y deja a mano las dos acciones de la fila: «Plantillas», con los
 * cuatro grupos de campos comunes, y «Añadir campo».
 */

/** Props de la cabecera. */
export interface FieldsPanelHeaderProps {
  /** Tabla cuyos campos se editan. */
  table: Table
}

export function FieldsPanelHeader({ table }: FieldsPanelHeaderProps) {
  const model = useAppStore((state) => state.model)
  const addField = useAppStore((state) => state.addField)

  const schema = model?.schemas.find((item) => item.name === table.schema)
  const count = table.fields.length

  return (
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
      <span className="text-[11px] leading-4 text-label-secondary">
        {count === 1 ? '1 campo' : `${count} campos`}
      </span>

      <span className="ml-auto flex items-center gap-1.5 pr-9">
        <FieldTemplatesMenu table={table} />
        <Button
          size="sm"
          variant="primary"
          icon="plus"
          onClick={() => {
            addField(table.name)
          }}
        >
          Añadir campo
        </Button>
      </span>
    </header>
  )
}
