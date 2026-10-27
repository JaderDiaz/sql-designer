import { SchemaContextMenu } from '@/components/features/schema/SchemaContextMenu'
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
 */

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

export function ModelSidebar() {
  const model = useAppStore((state) => state.model)
  const selectedSchema = useAppStore((state) => state.selectedSchema)
  const focusedSchema = useAppStore((state) => state.focusedSchema)
  const focusSchema = useAppStore((state) => state.focusSchema)
  const openSchemaDialog = useAppStore((state) => state.openSchemaDialog)

  if (model === null) return null

  const tables = model.tables ?? []
  const counts = countBySchema(tables)
  // Con un esquema enfocado, la lista de tablas es la de ese esquema (FR-030).
  const listed = focusedSchema === null
    ? tables
    : tables.filter((table) => table.schema === focusedSchema)

  return (
    <ScrollRegion label="Contenido del modelo" className="flex flex-col gap-4 px-2 py-3">
      <section className="flex flex-col gap-1" aria-labelledby="sm-side-schemas">
        <div className="flex items-center gap-1 px-2">
          <h2
            id="sm-side-schemas"
            className="m-0 flex-1 text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-label-tertiary"
          >
            Esquemas
          </h2>
          <Button
            variant="plain"
            size="sm"
            icon="plus"
            aria-label="Nuevo esquema"
            title="Nuevo esquema"
            onClick={() => openSchemaDialog(null)}
          />
        </div>

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

      <section className="flex flex-col gap-1" aria-labelledby="sm-side-tables">
        <h2
          id="sm-side-tables"
          className="m-0 px-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-label-tertiary"
        >
          {focusedSchema === null ? 'Tablas' : `Tablas de ${focusedSchema}`}
        </h2>

        {listed.length === 0 ? (
          <p className="m-0 px-2 text-[12px] leading-4 text-label-tertiary">
            {focusedSchema === null
              ? 'Este modelo aún no tiene tablas.'
              : 'Este esquema aún no tiene tablas.'}
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {listed.map((table) => (
              <li key={table.name} className="au-side-item cursor-default">
                <Icon name="table-2" size={14} />
                <span className="min-w-0 flex-1 truncate text-left">{table.name}</span>
                <span className="font-mono text-[10px] tracking-[0.04em] text-label-tertiary">
                  {model.schemas.find((schema) => schema.name === table.schema)?.abbreviation ?? ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ScrollRegion>
  )
}
