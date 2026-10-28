import { useEffect, useState } from 'react'

import { TableContextMenu } from '@/components/features/table/TableContextMenu'
import { ScrollRegion } from '@/components/layout/ScrollRegion'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Select } from '@/components/ui/Select'
import { TextArea } from '@/components/ui/TextArea'
import { TextField } from '@/components/ui/TextField'
import { fieldMarks, relationsTouching } from '@/lib/model/marks'
import { ENGINE_LABELS, TABLE_COMMENT_MAX_LENGTH, TECHNICAL_NAME_PATTERN } from '@/lib/model/types'
import type { Model, Table } from '@/lib/model/types'
import { isMacOS } from '@/lib/platform'
import { revealInFileManager } from '@/lib/tauri/commands'
import { saveStatusText } from '@/components/layout/EditorChrome'
import { useAppStore } from '@/store'

/**
 * Inspector del Editor: la ficha del modelo o la de la tabla seleccionada
 * (FR-003 del Incremento 2, FR-041 a FR-045).
 *
 * Con una tabla seleccionada el inspector habla de ella: su nombre, su
 * esquema, su descripción, un resumen de sus campos y sus relaciones. Sin
 * selección vuelve a la ficha del modelo: su nombre, si está guardado, dónde
 * vive, su motor y cuánto tiene dentro. Enfocar un esquema no cambia este
 * panel —centra el lienzo y filtra la lista de la barra lateral—, y sus datos
 * se editan en su propio diálogo.
 *
 * El resumen de campos no es el editor: muestra los ocho primeros y abre el
 * panel inferior en el campo que se pulse (FR-044, research R14).
 */

/** Cuántos campos muestra el resumen antes de ofrecer «Mostrar N más». */
export const SUMMARY_FIELDS = 8

/** Nota de la descripción, que dice a dónde va ese texto (FR-043). */
export const COMMENT_NOTE = 'Se exporta como COMMENT ON TABLE y aparece en el diccionario de datos'

/** Lo que se dice cuando la tabla no tiene ninguna relación (FR-045). */
export const NO_RELATIONS = 'Esta tabla todavía no tiene relaciones.'

/** Lo que se dice cuando el nombre nuevo de la tabla no sirve (FR-037). */
export const INVALID_NAME_MESSAGE = 'Usa letras, números y guion bajo; no empieces con un número.'

/** Lo que se dice cuando el nombre ya está en el modelo (RS-03). */
export function takenNameMessage(name: string): string {
  return `Ya existe una tabla llamada \`${name}\`.`
}

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

/** Ficha de la tabla seleccionada (FR-041 a FR-045). */
function TableSheet({ table, model }: { table: Table; model: Model }) {
  const renameTable = useAppStore((state) => state.renameTable)
  const setTableSchema = useAppStore((state) => state.setTableSchema)
  const setTableComment = useAppStore((state) => state.setTableComment)
  const openFieldsPanel = useAppStore((state) => state.openFieldsPanel)

  const [name, setName] = useState(table.name)
  const [expanded, setExpanded] = useState(false)

  // El borrador del nombre vuelve al del modelo cuando cambia por otra vía:
  // el diálogo de renombrar, deshacer o elegir otra tabla.
  useEffect(() => setName(table.name), [table.name])

  const schema = model.schemas.find((item) => item.name === table.schema)
  const marks = fieldMarks(table, model.relations ?? [])
  const relations = relationsTouching(model, { table: table.name })
  const hidden = Math.max(0, table.fields.length - SUMMARY_FIELDS)
  const shown = expanded ? table.fields : table.fields.slice(0, SUMMARY_FIELDS)

  const nameError =
    name === table.name
      ? null
      : !TECHNICAL_NAME_PATTERN.test(name)
        ? INVALID_NAME_MESSAGE
        : (model.tables ?? []).some((item) => item.name === name)
          ? takenNameMessage(name)
          : null

  /** Aplica el nombre al salir del campo, si sirve (FR-042, FR-037). */
  function commitName() {
    if (nameError !== null || name === table.name) {
      setName(table.name)
      return
    }
    renameTable(table.name, name)
  }

  return (
    <>
      <section
        aria-label="Tabla"
        className="flex flex-col gap-3.5 border-b-[length:var(--hairline)] border-separator p-4"
      >
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-indigo-soft"
          >
            <Icon name="table-2" size={18} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="m-0 truncate text-[15px] font-semibold leading-5">{table.name}</h2>
            <span className="text-[11px] leading-[14px] text-label-secondary">
              {schema === undefined ? table.schema : `${schema.abbreviation} · ${schema.name}`}
              {' · '}
              {table.fields.length === 1 ? '1 campo' : `${table.fields.length} campos`}
            </span>
          </div>
          <TableContextMenu table={table} openOnClick>
            <Button
              variant="plain"
              size="sm"
              icon="ellipsis"
              aria-label={`Acciones de ${table.name}`}
              title={`Acciones de ${table.name}`}
            />
          </TableContextMenu>
        </div>

        <TextField
          label="Nombre"
          value={name}
          onValueChange={setName}
          onBlur={commitName}
          error={nameError}
          inputClassName="font-mono"
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium leading-4 text-label">Esquema</span>
          <Select
            label={`Esquema de ${table.name}`}
            value={table.schema}
            options={model.schemas.map((item) => ({
              value: item.name,
              label: `${item.abbreviation} · ${item.name}`,
            }))}
            onValueChange={(value) => setTableSchema(table.name, value)}
          />
        </div>

        <TextArea
          label="Descripción"
          placeholder="Para qué sirve esta tabla"
          value={table.comment ?? ''}
          onValueChange={(value) => setTableComment(table.name, value)}
          maxLength={TABLE_COMMENT_MAX_LENGTH}
          hint={COMMENT_NOTE}
        />
      </section>

      <section
        aria-label="Campos"
        className="flex flex-col gap-2 border-b-[length:var(--hairline)] border-separator p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 text-[12px] font-semibold leading-4">
            Campos · {table.fields.length}
          </h3>
          <Button
            variant="plain"
            size="sm"
            icon="table-properties"
            aria-label={`Editar los campos de ${table.name}`}
            title="Editar campos"
            onClick={() => openFieldsPanel(table.name)}
          />
        </div>

        <ul className="m-0 flex list-none flex-col p-0">
          {shown.map((field) => {
            const mark = marks.get(field.name) ?? null
            return (
              <li key={field.name}>
                <button
                  type="button"
                  className="sm-insp-field"
                  aria-label={[
                    field.name,
                    field.type,
                    mark === 'PK' ? 'llave primaria' : mark === 'UK' ? 'única' : null,
                    mark === 'FK' ? 'clave foránea' : null,
                    field.nullable === true ? 'admite nulos' : null,
                  ]
                    .filter((part) => part !== null)
                    .join(', ')}
                  onClick={() => openFieldsPanel(table.name, { field: field.name, column: 'name' })}
                >
                  {mark === null ? (
                    <span className="sm-field-mark-space" />
                  ) : (
                    <span className="sm-field-mark" data-mark={mark} aria-hidden="true">
                      {mark}
                    </span>
                  )}
                  <span className="sm-field-name">{field.name}</span>
                  <span className="sm-field-type">
                    {field.type}
                    {field.nullable === true ? '?' : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {hidden === 0 ? null : (
          <Button
            variant="plain"
            size="sm"
            className="self-start"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Mostrar menos' : `Mostrar ${hidden} más`}
          </Button>
        )}

        <span className="text-[10px] leading-[13px] text-label-tertiary">? = admite nulos</span>
      </section>

      <section aria-label="Relaciones" className="flex flex-col gap-2 p-4">
        <h3 className="m-0 text-[12px] font-semibold leading-4">Relaciones · {relations.length}</h3>
        {relations.length === 0 ? (
          <p className="m-0 text-[11px] leading-[15px] text-label-secondary">{NO_RELATIONS}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {relations.map((relation) => (
              <li key={relation.name} className="flex items-center gap-1.5">
                <Icon name="git-merge" size={13} className="flex-none text-label-tertiary" />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-[15px]">
                  {relation.name}
                </span>
                <span className="flex-none text-[10px] leading-[13px] text-label-secondary">
                  {relation.fromTable === table.name ? relation.toTable : relation.fromTable}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export function Inspector() {
  const model = useAppStore((state) => state.model)
  const selectedTable = useAppStore((state) => state.selectedTable)
  const path = useAppStore((state) => state.path)
  const isDirty = useAppStore((state) => state.isDirty)
  const savedAtMs = useAppStore((state) => state.savedAtMs)
  const platform = useAppStore((state) => state.platform)

  if (model === null) return null

  const table = (model.tables ?? []).find((item) => item.name === selectedTable)
  if (table !== undefined) {
    return (
      <ScrollRegion label={`Datos de ${table.name}`} className="flex flex-col">
        <TableSheet table={table} model={model} />
      </ScrollRegion>
    )
  }

  const revealLabel = isMacOS(platform) ? 'Mostrar en Finder' : 'Mostrar en el Explorador'

  return (
    <ScrollRegion label="Datos del modelo" className="flex flex-col">
      <section
        aria-label="Modelo"
        className="flex flex-col gap-3.5 border-b-[length:var(--hairline)] border-separator p-4"
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
    </ScrollRegion>
  )
}
