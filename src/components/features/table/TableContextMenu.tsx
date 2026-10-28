import type { ReactNode } from 'react'

import { ContextMenu, type ContextMenuAction } from '@/components/ui/ContextMenu'
import { Kbd } from '@/components/ui/Kbd'
import { resolveSchemaColor } from '@/lib/model/colors'
import { shortcutLabel } from '@/lib/platform'
import type { Table } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Menú contextual de una tabla (FR-035, FR-036, FR-046).
 *
 * Es el mismo menú en sus dos representaciones, la tarjeta del lienzo y la
 * fila de la barra lateral, para que una tabla se maneje igual desde los dos
 * sitios. Se abre con el botón derecho y con ⇧F10, que es lo que aporta
 * `ContextMenu`.
 *
 * «Mover a esquema» solo lista los demás esquemas: mover una tabla al suyo no
 * es un cambio, y con un único esquema en el modelo la entrada se apaga en
 * lugar de abrir un submenú vacío. «Eliminar tabla…» abre la confirmación,
 * nunca elimina de golpe (FR-039).
 */

/** Lo que se dice cuando no hay otro esquema al que mover la tabla. */
export const NO_OTHER_SCHEMA = 'Este modelo solo tiene un esquema'

/** Props del menú de una tabla. */
export interface TableContextMenuProps {
  table: Table
  /** Si el menú se abre también con un clic normal, no solo con el derecho. */
  openOnClick?: boolean
  /** La tarjeta o la fila sobre la que se abre el menú. */
  children: ReactNode
}

export function TableContextMenu({ table, openOnClick, children }: TableContextMenuProps) {
  const model = useAppStore((state) => state.model)
  const platform = useAppStore((state) => state.platform)
  const openFieldsPanel = useAppStore((state) => state.openFieldsPanel)
  const setTableSchema = useAppStore((state) => state.setTableSchema)
  const openRenameTableDialog = useAppStore((state) => state.openRenameTableDialog)
  const openDeleteTableDialog = useAppStore((state) => state.openDeleteTableDialog)
  const duplicateTable = useAppStore((state) => state.duplicateTable)
  const selectTable = useAppStore((state) => state.selectTable)

  const { alt } = platform.modifierSymbols
  const others = (model?.schemas ?? []).filter((schema) => schema.name !== table.schema)

  const actions: ContextMenuAction[] = [
    {
      id: 'fields',
      label: 'Editar campos…',
      icon: 'table-properties',
      shortcut: (
        <Kbd>
          {platform.os === 'macos'
            ? `${alt}${shortcutLabel(platform, 'E')}`
            : `${alt}+${shortcutLabel(platform, 'E')}`}
        </Kbd>
      ),
      onSelect: () => openFieldsPanel(table.name),
    },
    {
      id: 'move',
      label: 'Mover a esquema',
      icon: 'folder-input',
      separatorBefore: true,
      disabled: others.length === 0,
      ...(others.length === 0
        ? {}
        : {
            items: others.map((schema) => ({
              id: schema.name,
              label: `${schema.abbreviation} · ${schema.name}`,
              swatch: resolveSchemaColor(schema.color),
              onSelect: () => setTableSchema(table.name, schema.name),
            })),
          }),
      onSelect: () => undefined,
    },
    {
      id: 'rename',
      label: 'Renombrar…',
      icon: 'pencil',
      separatorBefore: true,
      onSelect: () => openRenameTableDialog(table.name),
    },
    {
      id: 'duplicate',
      label: 'Duplicar tabla',
      icon: 'copy',
      shortcut: <Kbd>{shortcutLabel(platform, 'D')}</Kbd>,
      onSelect: () => duplicateTable(table.name),
    },
    {
      id: 'delete',
      label: 'Eliminar tabla…',
      icon: 'trash-2',
      destructive: true,
      separatorBefore: true,
      shortcut: <Kbd>{platform.modifierSymbols.del}</Kbd>,
      onSelect: () => openDeleteTableDialog(table.name),
    },
  ]

  return (
    <ContextMenu
      actions={actions}
      openOnClick={openOnClick ?? false}
      title={<span className="truncate">{table.name}</span>}
      onOpen={() => selectTable(table.name)}
    >
      {children}
    </ContextMenu>
  )
}
