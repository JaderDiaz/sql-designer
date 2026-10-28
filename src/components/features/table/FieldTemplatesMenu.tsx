import { Button } from '@/components/ui/Button'
import { Menu, type MenuAction } from '@/components/ui/Menu'
import { templatesOf } from '@/lib/model/engines'
import type { Table } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Menú «Plantillas» del editor de campos (FR-027, FR-028).
 *
 * Los cuatro grupos de campos comunes, cada uno diciendo qué campos añade con
 * los tipos del motor del modelo. Un grupo que ya está entero en la tabla se
 * apaga en lugar de desaparecer: así se ve que esa tabla ya lo tiene, y no se
 * duplica nada (FR-028).
 */

/** Lo que se dice de un grupo que la tabla ya tiene entero (FR-028). */
export const ALREADY_APPLIED = 'Ya está en la tabla'

/** Props del menú. */
export interface FieldTemplatesMenuProps {
  /** Tabla a la que se añaden los campos. */
  table: Table
}

export function FieldTemplatesMenu({ table }: FieldTemplatesMenuProps) {
  const engine = useAppStore((state) => state.model?.engine ?? 'postgres')
  const applyTemplate = useAppStore((state) => state.applyTemplate)

  const taken = new Set(table.fields.map((field) => field.name))

  const actions: MenuAction[] = templatesOf(engine).map((group) => {
    const missing = group.fields.filter((field) => !taken.has(field.name))
    const applied = missing.length === 0
    return {
      id: group.key,
      label: group.label,
      icon: group.icon,
      hint: applied ? ALREADY_APPLIED : group.fields.map((field) => field.name).join(', '),
      disabled: applied,
      ...(applied ? { title: ALREADY_APPLIED } : {}),
      onSelect: () => applyTemplate(table.name, group.key),
    }
  })

  return (
    <Menu actions={actions} title="Grupos de campos comunes">
      <Button size="sm" icon="layout-template" aria-label="Plantillas de campos">
        Plantillas
      </Button>
    </Menu>
  )
}
