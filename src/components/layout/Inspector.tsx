import type { ReactNode } from 'react'

import { ScrollRegion } from '@/components/layout/ScrollRegion'
import { tableCountLabel } from '@/components/layout/ModelSidebar'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { resolveSchemaColor, schemaColorLabel } from '@/lib/model/colors'
import { useAppStore } from '@/store'

/**
 * Inspector del Editor: los datos de lo que está seleccionado (FR-003).
 *
 * En este incremento lo seleccionable es el esquema. Sin selección, el
 * inspector lo dice en lugar de quedarse en blanco: un panel vacío sin
 * explicación parece roto.
 */

/** Una fila de dato del inspector: su rótulo y su valor. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="m-0 text-[11px] leading-4 text-label-tertiary">{label}</dt>
      <dd className="m-0 text-[13px] leading-[18px] text-label">{children}</dd>
    </div>
  )
}

export function Inspector() {
  const model = useAppStore((state) => state.model)
  const selectedSchema = useAppStore((state) => state.selectedSchema)
  const openSchemaDialog = useAppStore((state) => state.openSchemaDialog)

  const schema = model?.schemas.find((candidate) => candidate.name === selectedSchema)

  if (model === null) return null

  if (schema === undefined) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <Icon name="mouse-pointer-click" size={20} className="text-label-tertiary" />
        <p className="m-0 text-[12px] leading-4 text-label-secondary">
          No hay nada seleccionado. Pulsa un esquema en la barra lateral o su zona en el lienzo.
        </p>
      </div>
    )
  }

  const count = (model.tables ?? []).filter((table) => table.schema === schema.name).length
  const color = resolveSchemaColor(schema.color)

  return (
    <ScrollRegion label="Datos del esquema seleccionado" className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3 w-3 flex-none rounded-full"
          style={{ background: `var(--${color})` }}
        />
        <h2 className="m-0 min-w-0 flex-1 truncate text-[15px] font-semibold leading-5">
          {schema.name}
        </h2>
        <Button
          variant="plain"
          size="sm"
          icon="pencil"
          aria-label="Editar esquema"
          title="Editar esquema"
          onClick={() => openSchemaDialog(schema.name)}
        />
      </div>

      <dl className="m-0 flex flex-col gap-3">
        <Field label="Nombre técnico">
          <span className="font-mono text-[12px]">{schema.name}</span>
        </Field>
        <Field label="Abreviatura">
          <span className="font-mono text-[12px] tracking-[0.04em]">{schema.abbreviation}</span>
        </Field>
        <Field label="Color">{schemaColorLabel(schema.color)}</Field>
        <Field label="Tablas">{tableCountLabel(count)}</Field>
        <Field label="Descripción">
          {schema.comment === undefined || schema.comment === '' ? (
            <span className="text-label-tertiary">Sin descripción</span>
          ) : (
            schema.comment
          )}
        </Field>
      </dl>
    </ScrollRegion>
  )
}
