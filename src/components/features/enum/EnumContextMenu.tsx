import type { ReactNode } from 'react'

import { ContextMenu, type ContextMenuAction } from '@/components/ui/ContextMenu'
import { Icon } from '@/components/ui/Icon'
import { enumUsage, usageCountLabel, valueCountLabel } from '@/lib/model/enums'
import type { Enum } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Menú contextual de un enum de la barra lateral (FR-020).
 *
 * Se abre con el botón derecho, con ⇧F10 y con la tecla de menú, que es lo que
 * aporta `ContextMenu`. La cabecera dice cuántos valores tiene y cuántos campos
 * lo usan, con la misma lista que la hoja y la confirmación (research R19).
 */

/** Props del menú de un enum. */
export interface EnumContextMenuProps {
  value: Enum
  /** La fila sobre la que se abre el menú. */
  children: ReactNode
}

/**
 * Lo que dice la cabecera: «Enum · 4 valores · 2 campos».
 *
 * @param values Cuántos valores tiene.
 * @param fields Cuántos campos lo usan.
 */
export function enumMenuMeta(values: number, fields: number): string {
  return `Enum · ${valueCountLabel(values)} · ${usageCountLabel(fields)}`
}

export function EnumContextMenu({ value, children }: EnumContextMenuProps) {
  const model = useAppStore((state) => state.model)
  const openEnumDialog = useAppStore((state) => state.openEnumDialog)
  const openDeleteEnumDialog = useAppStore((state) => state.openDeleteEnumDialog)
  const duplicateEnum = useAppStore((state) => state.duplicateEnum)

  const usage = model === null ? 0 : enumUsage(model, value.name).length

  const actions: ContextMenuAction[] = [
    {
      id: 'edit',
      label: 'Editar enum…',
      icon: 'pencil',
      onSelect: () => openEnumDialog(value.name),
    },
    {
      id: 'duplicate',
      label: 'Duplicar enum',
      icon: 'copy',
      onSelect: () => {
        duplicateEnum(value.name)
      },
    },
    {
      id: 'delete',
      label: 'Eliminar enum…',
      icon: 'trash-2',
      destructive: true,
      separatorBefore: true,
      onSelect: () => openDeleteEnumDialog(value.name),
    },
  ]

  return (
    <ContextMenu
      actions={actions}
      title={
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <Icon name="tags" size={14} className="flex-none text-purple" />
            <span className="truncate font-mono font-semibold">{value.name}</span>
          </span>
          <span className="text-[11px] leading-[14px] text-label-secondary">
            {enumMenuMeta(value.values.length, usage)}
          </span>
        </span>
      }
    >
      {children}
    </ContextMenu>
  )
}
