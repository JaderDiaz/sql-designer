import type { ReactNode } from 'react'

import { ContextMenu, type ContextMenuAction } from '@/components/ui/ContextMenu'
import { resolveSchemaColor } from '@/lib/model/colors'
import type { Schema } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Menú contextual de un esquema (FR-020, FR-033, FR-038).
 *
 * Es el mismo menú en sus dos representaciones, la fila de la barra lateral y
 * la zona del lienzo, para que el esquema se maneje igual desde los dos
 * sitios. Se abre con el botón derecho y con ⇧F10, que es lo que aporta
 * `ContextMenu`.
 *
 * Con un solo esquema en el modelo, eliminar queda deshabilitado y la entrada
 * dice por qué: un modelo necesita al menos un esquema (FR-035, RS-02).
 */

/** Lo que se dice cuando el esquema que se mira es el único del modelo. */
export const LAST_SCHEMA_LABEL = 'Eliminar esquema… (es el único del modelo)'

/** Props del menú de un esquema. */
export interface SchemaContextMenuProps {
  schema: Schema
  /** Cuántas tablas tiene, para decirlo al confirmar la eliminación. */
  tableCount: number
  /** La fila o la zona sobre la que se abre el menú. */
  children: ReactNode
}

export function SchemaContextMenu({ schema, tableCount, children }: SchemaContextMenuProps) {
  const openSchemaDialog = useAppStore((state) => state.openSchemaDialog)
  const openDeleteSchemaDialog = useAppStore((state) => state.openDeleteSchemaDialog)
  const selectSchema = useAppStore((state) => state.selectSchema)
  const count = useAppStore((state) => state.model?.schemas.length ?? 0)

  const isLast = count <= 1

  const actions: ContextMenuAction[] = [
    {
      id: 'edit',
      label: 'Editar esquema…',
      icon: 'pencil',
      onSelect: () => openSchemaDialog(schema.name),
    },
    {
      id: 'delete',
      label: isLast ? LAST_SCHEMA_LABEL : 'Eliminar esquema…',
      icon: 'trash-2',
      destructive: true,
      disabled: isLast,
      separatorBefore: true,
      onSelect: () => openDeleteSchemaDialog(schema.name),
    },
  ]

  return (
    <ContextMenu
      actions={actions}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2 w-2 flex-none rounded-full"
            style={{ background: `var(--${resolveSchemaColor(schema.color)})` }}
          />
          <span className="truncate font-semibold">{schema.name}</span>
          <span className="font-mono text-[11px] leading-[14px] text-label-secondary">
            {schema.abbreviation}
          </span>
          <span className="text-[11px] leading-[14px] text-label-tertiary">{tableCount}</span>
        </span>
      }
      onOpen={() => selectSchema(schema.name)}
    >
      {children}
    </ContextMenu>
  )
}
