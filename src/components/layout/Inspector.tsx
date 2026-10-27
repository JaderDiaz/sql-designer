import type { ReactNode } from 'react'

import { ScrollRegion } from '@/components/layout/ScrollRegion'
import { tableCountLabel } from '@/components/layout/ModelSidebar'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ENGINE_LABELS } from '@/lib/model/types'
import { resolveSchemaColor, schemaColorLabel } from '@/lib/model/colors'
import { isMacOS } from '@/lib/platform'
import { revealInFileManager } from '@/lib/tauri/commands'
import { saveStatusText } from '@/components/layout/EditorChrome'
import { useAppStore } from '@/store'

/**
 * Inspector del Editor: los datos de lo que está seleccionado (FR-003).
 *
 * En este incremento lo seleccionable es el esquema. Sin selección, el
 * inspector muestra la ficha del modelo —su nombre, si está guardado, dónde
 * vive, su motor y cuánto tiene dentro—, que es lo que el tablero `Editor` del
 * lienzo pone aquí: un panel vacío sin explicación parece roto, y el modelo es
 * siempre lo que se está mirando cuando no hay nada más.
 */

/** Una cifra de la rejilla de resumen del modelo. */
function Kpi({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[15px] font-semibold leading-5 [font-variant-numeric:tabular-nums]">
        {value}
      </span>
      <span className="text-[10px] leading-[13px] text-label-secondary">{label}</span>
    </div>
  )
}

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
  const path = useAppStore((state) => state.path)
  const isDirty = useAppStore((state) => state.isDirty)
  const savedAtMs = useAppStore((state) => state.savedAtMs)
  const platform = useAppStore((state) => state.platform)
  const selectedSchema = useAppStore((state) => state.selectedSchema)
  const openSchemaDialog = useAppStore((state) => state.openSchemaDialog)

  const schema = model?.schemas.find((candidate) => candidate.name === selectedSchema)

  if (model === null) return null

  if (schema === undefined) {
    const revealLabel = isMacOS(platform) ? 'Mostrar en Finder' : 'Mostrar en el Explorador'

    return (
      <ScrollRegion label="Datos del modelo" className="flex flex-col">
        <section
          aria-label="Modelo"
          className="flex flex-col gap-3.5 border-b-[0.5px] border-separator p-4"
        >
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-accent-soft"
            >
              <Icon name="database" size={18} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 className="m-0 truncate text-[15px] font-semibold leading-5">{model.name}</h2>
              <span
                aria-live="polite"
                className="flex items-center gap-1.5 text-[11px] leading-[14px] text-label-secondary"
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-orange' : 'bg-green'}`}
                />
                {saveStatusText(isDirty, savedAtMs)}
              </span>
            </div>
          </div>

          {path === null ? null : (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-[14px] text-label-secondary">
                {path}
              </span>
              <Button
                variant="plain"
                size="sm"
                icon="folder-open"
                aria-label={revealLabel}
                title={revealLabel}
                onClick={() => {
                  void revealInFileManager(path).catch(() => undefined)
                }}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] leading-[18px] text-label-secondary">Motor</span>
            <span className="text-[13px] leading-[18px]">{ENGINE_LABELS[model.engine]}</span>
          </div>

          <div
            role="list"
            aria-label="Resumen"
            className="grid grid-cols-2 rounded-[10px] bg-inset py-2.5"
          >
            <div role="listitem">
              <Kpi value={model.schemas.length} label="esquemas" />
            </div>
            <div role="listitem">
              <Kpi value={(model.tables ?? []).length} label="tablas" />
            </div>
          </div>
        </section>

        <p className="m-0 flex items-center gap-2 px-4 py-3 text-[12px] leading-4 text-label-secondary">
          <Icon name="mouse-pointer-click" size={14} className="flex-none text-label-tertiary" />
          No hay nada seleccionado. Pulsa un esquema en la barra lateral o su zona en el lienzo.
        </p>
      </ScrollRegion>
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
