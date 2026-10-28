import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Icon } from '@/components/ui/Icon'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { TextArea } from '@/components/ui/TextArea'
import { TextField } from '@/components/ui/TextField'
import { tableHeight } from '@/lib/canvas/constants'
import { auditFields, idField } from '@/lib/model/engines'
import { toTechnicalName } from '@/lib/model/propose'
import {
  TABLE_COMMENT_MAX_LENGTH,
  TECHNICAL_NAME_PATTERN,
  type Field,
} from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Diálogo Nueva tabla (FR-002 a FR-009).
 *
 * Se escribe el nombre legible y el diálogo propone el técnico, que es el que
 * viaja al archivo; en cuanto el usuario lo corrige a mano, deja de seguir al
 * nombre. Las dos opciones de campos llegan marcadas y la vista previa enseña
 * la tarjeta que aparecerá en el lienzo, con los campos que cada casilla
 * añade según el motor del modelo (research R2).
 *
 * Sin ningún esquema no se puede crear una tabla: el diálogo lo dice y ofrece
 * crear el esquema primero, que es el diálogo del Incremento 2 (FR-002).
 */

/** Lo que se dice cuando falta el nombre. */
export const EMPTY_NAME_MESSAGE = 'Escribe un nombre para la tabla.'

/** Lo que se dice cuando el nombre técnico no tiene la forma del formato. */
export const INVALID_NAME_MESSAGE =
  'Usa letras, números y guion bajo; no empieces con un número.'

/** Lo que se dice cuando el nombre ya está en el modelo (RS-03). */
export function takenNameMessage(name: string): string {
  return `Ya existe una tabla llamada \`${name}\`.`
}

/** Lo que se dice cuando el modelo todavía no tiene ningún esquema. */
export const NO_SCHEMA_MESSAGE = 'Primero crea un esquema: una tabla vive dentro de uno.'

export function TableDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const model = useAppStore((state) => state.model)
  const focusedSchema = useAppStore((state) => state.focusedSchema)
  const selectedTable = useAppStore((state) => state.selectedTable)
  const draftPosition = useAppStore((state) => state.tableDraftPosition)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const createTable = useAppStore((state) => state.createTable)
  const openSchemaDialog = useAppStore((state) => state.openSchemaDialog)

  const open = dialog === 'table'
  const schemas = model?.schemas ?? []
  const tables = model?.tables ?? []
  const engine = model?.engine ?? 'postgres'

  const [label, setLabel] = useState('')
  const [technical, setTechnical] = useState('')
  const [technicalTouched, setTechnicalTouched] = useState(false)
  const [schema, setSchema] = useState('')
  const [comment, setComment] = useState('')
  const [withId, setWithId] = useState(true)
  const [withAudit, setWithAudit] = useState(true)

  // El esquema propuesto es el enfocado, el de la tabla seleccionada o el
  // primero del modelo, en ese orden (FR-005).
  const proposedSchema =
    focusedSchema ?? tables.find((table) => table.name === selectedTable)?.schema ?? schemas[0]?.name

  useEffect(() => {
    if (!open) return
    setLabel('')
    setTechnical('')
    setTechnicalTouched(false)
    setSchema(proposedSchema ?? '')
    setComment('')
    setWithId(true)
    setWithAudit(true)
  }, [open, proposedSchema])

  const proposedName = technicalTouched ? technical : toTechnicalName(label)

  const nameError =
    proposedName === ''
      ? technicalTouched || label.trim() === ''
        ? EMPTY_NAME_MESSAGE
        : INVALID_NAME_MESSAGE
      : !TECHNICAL_NAME_PATTERN.test(proposedName)
        ? INVALID_NAME_MESSAGE
        : tables.some((table) => table.name === proposedName)
          ? takenNameMessage(proposedName)
          : null

  const hasSchemas = schemas.length > 0
  const invalid = !hasSchemas || nameError !== null || schema === ''

  /** Campos con los que nacerá la tabla, que es lo que enseña la vista previa. */
  const preview: Field[] = [
    ...(withId ? [idField(engine)] : []),
    ...(withAudit ? auditFields(engine) : []),
  ]

  /** Crea la tabla y cierra el diálogo (FR-007). */
  function save() {
    if (invalid) return
    createTable({
      name: proposedName,
      schema,
      comment,
      withId,
      withAudit,
      ...(draftPosition ? { position: draftPosition } : {}),
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      title="Nueva tabla"
      description="Representa una entidad dentro de un esquema."
      icon="table-2"
      iconClassName="bg-accent-soft"
      onSubmit={save}
      footer={
        <>
          <Button onClick={closeDialog}>Cancelar</Button>
          {hasSchemas ? (
            <Button variant="primary" type="submit" disabled={invalid}>
              Crear tabla
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                openSchemaDialog(null)
              }}
            >
              Crear esquema…
            </Button>
          )}
        </>
      }
    >
      {hasSchemas ? (
        <div className="flex flex-col gap-4">
          <TextField
            label="Nombre"
            placeholder="Por ejemplo, Pagos pendientes"
            value={label}
            onValueChange={setLabel}
            hint={
              proposedName === ''
                ? 'De aquí sale el nombre técnico de la tabla.'
                : `Se guardará como \`${proposedName}\`.`
            }
            error={nameError}
            autoFocus
          />

          <div className="flex items-start gap-3">
            <TextField
              className="flex-1"
              label="Nombre técnico"
              placeholder="pagos_pendientes"
              value={proposedName}
              onValueChange={(value) => {
                setTechnicalTouched(true)
                setTechnical(value)
              }}
              inputClassName="font-mono"
            />
            <div className="au-field w-[160px] flex-none">
              <span className="au-field-label">Esquema</span>
              <Select
                label="Esquema de la tabla"
                value={schema}
                onValueChange={setSchema}
                options={schemas.map((item) => ({
                  value: item.name,
                  label: `${item.abbreviation} · ${item.name}`,
                }))}
              />
            </div>
          </div>

          <TextArea
            label="Descripción"
            placeholder="Para qué sirve esta tabla"
            value={comment}
            onValueChange={setComment}
            maxLength={TABLE_COMMENT_MAX_LENGTH}
            hint="Opcional. Viaja con el modelo."
          />

          <div className="flex flex-col gap-2">
            <Checkbox
              checked={withId}
              onCheckedChange={setWithId}
              label="Llave primaria id"
              hint={`Añade \`${idField(engine).name}\` de tipo \`${idField(engine).type}\` como llave primaria.`}
            />
            <Checkbox
              checked={withAudit}
              onCheckedChange={setWithAudit}
              label="Campos de auditoría"
              hint={`Añade \`${auditFields(engine)
                .map((field) => field.name)
                .join('` y `')}\` de tipo \`${auditFields(engine)[0]?.type ?? ''}\`.`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-medium leading-4 text-label">Vista previa</span>
            <div
              aria-label="Vista previa de la tabla"
              className="sm-table relative"
              style={{ position: 'relative', height: tableHeight(preview.length) }}
            >
              <span className="sm-table-head">
                <span className="sm-table-name">{proposedName || 'sin nombre'}</span>
                <span className="sm-table-meta">
                  {schemas.find((item) => item.name === schema)?.abbreviation ?? '···'}
                </span>
              </span>
              <span className="sm-table-fields">
                {preview.length === 0 ? (
                  <span className="sm-field-row">
                    <span className="sm-field-mark-space" />
                    <span className="sm-field-name text-label-tertiary">
                      Un campo para empezar
                    </span>
                  </span>
                ) : (
                  preview.map((field, index) => (
                    <span className="sm-field-row" key={field.name}>
                      {withId && index === 0 ? (
                        <span className="sm-field-mark" data-mark="PK">
                          PK
                        </span>
                      ) : (
                        <span className="sm-field-mark-space" />
                      )}
                      <span className="sm-field-name">{field.name}</span>
                      <span className="sm-field-type">{field.type}</span>
                    </span>
                  ))
                )}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5" role="alert">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-orange-soft"
          >
            <Icon name="layers" size={16} />
          </span>
          <p className="m-0 text-[13px] leading-[18px] text-label">{NO_SCHEMA_MESSAGE}</p>
        </div>
      )}
    </Sheet>
  )
}
