import type { CSSProperties, ReactNode } from 'react'

import { SchemaContextMenu } from '@/components/features/schema/SchemaContextMenu'
import { TableContextMenu } from '@/components/features/table/TableContextMenu'
import { Titlebar } from '@/components/layout/Titlebar'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ScrollRegion } from '@/components/layout/ScrollRegion'
import { resolveSchemaColor } from '@/lib/model/colors'
import { useAppStore } from '@/store'

/**
 * Barra lateral del Editor: el contenido del modelo (FR-002).
 *
 * Dos secciones. «Esquemas» lista los del modelo con su color, su abreviatura
 * y su número de tablas, con «Todos los esquemas» arriba; «Tablas» lista las
 * del modelo, o solo las del esquema enfocado.
 *
 * Pulsar la fila de un esquema lo enfoca: el lienzo se centra en su zona, el
 * resto se atenúa y esta lista se filtra (FR-029, FR-030). Enfocar también
 * selecciona, que es lo que mira el inspector (FR-003), así que la fila es un
 * único botón y no dos gestos distintos sobre la misma línea.
 *
 * Arriba lleva los controles de la ventana: la barra lateral es lo primero de
 * la ventana por la izquierda, así que los círculos van aquí mientras se vea,
 * y pasan a la barra superior cuando se esconde (FR-012).
 */

/** Cabecera de una sección de la barra lateral, con su botón de añadir. */
function SectionHead({ id, title, action }: { id: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex h-[22px] items-center justify-between pl-1.5 pr-1">
      <h2
        id={id}
        className="m-0 flex items-center gap-1 text-[11px] font-semibold leading-[14px] tracking-[0.01em] text-label-secondary"
      >
        <Icon name="chevron-down" size={12} aria-hidden="true" />
        {title}
      </h2>
      {action}
    </div>
  )
}

/** Cuántas tablas tiene cada esquema del modelo. */
function countBySchema(tables: Array<{ schema: string }>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const table of tables) {
    counts.set(table.schema, (counts.get(table.schema) ?? 0) + 1)
  }
  return counts
}

/** Cómo se lee «3 tablas», «1 tabla» o «sin tablas». */
export function tableCountLabel(count: number): string {
  if (count === 0) return 'sin tablas'
  return count === 1 ? '1 tabla' : `${count} tablas`
}

/** Cómo se lee «4 campos» o «1 campo» en la fila de una tabla. */
export function fieldCountLabel(count: number): string {
  return count === 1 ? '1 campo' : `${count} campos`
}

export function ModelSidebar() {
  const model = useAppStore((state) => state.model)
  const selectedSchema = useAppStore((state) => state.selectedSchema)
  const focusedSchema = useAppStore((state) => state.focusedSchema)
  const focusSchema = useAppStore((state) => state.focusSchema)
  const openSchemaDialog = useAppStore((state) => state.openSchemaDialog)
  const selectedTable = useAppStore((state) => state.selectedTable)
  const selectTable = useAppStore((state) => state.selectTable)
  const openFieldsPanel = useAppStore((state) => state.openFieldsPanel)
  const isDirty = useAppStore((state) => state.isDirty)
  const requestClose = useAppStore((state) => state.requestClose)

  if (model === null) return null

  const tables = model.tables ?? []
  const counts = countBySchema(tables)
  // Con un esquema enfocado, la lista de tablas es la de ese esquema (FR-030).
  const listed =
    focusedSchema === null ? tables : tables.filter((table) => table.schema === focusedSchema)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div data-tauri-drag-region className="flex h-11 flex-none items-center px-3">
        <Titlebar
          onClose={requestClose}
          closeLabel={isDirty ? 'Cerrar (cambios sin guardar)' : 'Cerrar'}
          isDirty={isDirty}
          canZoom
          className="relative left-0 top-0 z-auto"
        />
      </div>

      <ScrollRegion label="Contenido del modelo" className="flex flex-col gap-3.5 px-2 pb-2 pt-1">
        <section className="flex flex-col gap-px" aria-labelledby="sm-side-schemas">
          <SectionHead
            id="sm-side-schemas"
            title="Esquemas"
            action={
              <Button
                variant="plain"
                size="sm"
                icon="plus"
                aria-label="Nuevo esquema"
                title="Nuevo esquema"
                onClick={() => openSchemaDialog(null)}
              />
            }
          />

          <ul role="listbox" aria-label="Esquemas del modelo" className="m-0 list-none p-0">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={selectedSchema === null}
                aria-current={focusedSchema === null}
                className="au-side-item w-full"
                onClick={() => focusSchema(null)}
              >
                <Icon name="layers" size={14} />
                <span className="flex-1 text-left">Todos los esquemas</span>
                <span className="text-[11px] text-label-tertiary">{tables.length}</span>
              </button>
            </li>

            {model.schemas.map((schema) => {
              const count = counts.get(schema.name) ?? 0
              return (
                <li key={schema.name}>
                  <SchemaContextMenu schema={schema} tableCount={count}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedSchema === schema.name}
                      aria-current={focusedSchema === schema.name}
                      aria-label={`${schema.name}, ${tableCountLabel(count)}`}
                      className="au-side-item w-full"
                      onClick={() => focusSchema(schema.name)}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 flex-none rounded-full"
                        style={{ background: `var(--${resolveSchemaColor(schema.color)})` }}
                      />
                      <span className="min-w-0 flex-1 truncate text-left">{schema.name}</span>
                      <span className="font-mono text-[10px] tracking-[0.04em] text-label-tertiary">
                        {schema.abbreviation}
                      </span>
                      <span className="text-[11px] text-label-tertiary">{count}</span>
                    </button>
                  </SchemaContextMenu>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-px" aria-labelledby="sm-side-tables">
          <SectionHead
            id="sm-side-tables"
            title={focusedSchema === null ? 'Tablas' : `Tablas de ${focusedSchema}`}
          />

          {listed.length === 0 ? (
            <p className="m-0 px-2 text-[12px] leading-4 text-label-tertiary">
              {focusedSchema === null
                ? 'Este modelo aún no tiene tablas.'
                : 'Este esquema aún no tiene tablas.'}
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {listed.map((table) => {
                const tableSchema = model.schemas.find((item) => item.name === table.schema)
                return (
                  <li key={table.name}>
                    <TableContextMenu table={table}>
                      <button
                        type="button"
                        aria-pressed={selectedTable === table.name}
                        aria-label={`Tabla ${table.name}, esquema ${tableSchema?.abbreviation ?? table.schema} · ${table.schema}, ${fieldCountLabel(table.fields.length)}`}
                        className="au-side-item w-full"
                        onClick={() => selectTable(table.name)}
                        onDoubleClick={() => openFieldsPanel(table.name)}
                      >
                        <span
                          aria-hidden="true"
                          className="flex flex-none items-center"
                          style={
                            {
                              // El icono lleva el color del esquema de la tabla,
                              // como en el lienzo de diseño; quién es el esquema
                              // lo dice el nombre accesible de la fila, no el
                              // color (RS-11).
                              color: `var(--${resolveSchemaColor(tableSchema?.color)})`,
                            } as CSSProperties
                          }
                        >
                          <Icon name="table-2" size={14} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-left">{table.name}</span>
                        <span className="font-mono text-[10px] tracking-[0.04em] text-label-tertiary">
                          {tableSchema?.abbreviation ?? ''}
                        </span>
                        <span className="text-[11px] tabular-nums text-label-tertiary">
                          {table.fields.length}
                        </span>
                      </button>
                    </TableContextMenu>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </ScrollRegion>
    </div>
  )
}
