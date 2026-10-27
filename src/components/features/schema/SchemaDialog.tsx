import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { ColorSwatches } from '@/components/ui/ColorSwatches'
import { Sheet } from '@/components/ui/Sheet'
import { TextField } from '@/components/ui/TextField'
import { DEFAULT_SCHEMA_COLOR, SCHEMA_COLORS } from '@/lib/model/colors'
import { toAbbreviation, toTechnicalName } from '@/lib/model/propose'
import { ABBREVIATION_PATTERN, TECHNICAL_NAME_PATTERN } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Diálogo Nuevo esquema y Editar esquema, que son el mismo con otro título
 * (FR-015 a FR-020).
 *
 * Se escribe el nombre legible y el diálogo propone el nombre técnico y la
 * abreviatura; en cuanto el usuario corrige uno a mano, ese campo deja de
 * seguir al nombre y conserva lo escrito (FR-017). Nada se escribe en el
 * modelo hasta confirmar, y la vista previa enseña cómo quedará la zona con el
 * color elegido (FR-019).
 */

/** Lo que se dice cuando falta el nombre legible. */
export const EMPTY_LABEL_MESSAGE = 'Escribe un nombre para el esquema.'

/** Lo que se dice cuando falta el nombre técnico. */
export const EMPTY_TECHNICAL_MESSAGE = 'Escribe el nombre técnico del esquema.'

/** Lo que se dice cuando el nombre técnico no tiene la forma del formato. */
export const INVALID_TECHNICAL_MESSAGE =
  'Usa minúsculas, números y guion bajo; no empieces por un número.'

/** Lo que se dice cuando el nombre técnico ya está en el modelo. */
export const TAKEN_TECHNICAL_MESSAGE = 'Ya existe un esquema con este nombre técnico.'

/** Lo que se dice cuando la abreviatura no son tres letras. */
export const INVALID_ABBREVIATION_MESSAGE = 'La abreviatura son tres letras.'

/** Lo que se dice cuando la abreviatura ya está en el modelo. */
export const TAKEN_ABBREVIATION_MESSAGE = 'Ya la usa otro esquema.'

export function SchemaDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const model = useAppStore((state) => state.model)
  const schemaTarget = useAppStore((state) => state.schemaTarget)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const createSchema = useAppStore((state) => state.createSchema)
  const updateSchema = useAppStore((state) => state.updateSchema)

  const open = dialog === 'schema'
  const editing = model?.schemas.find((schema) => schema.name === schemaTarget)

  const [label, setLabel] = useState('')
  const [technical, setTechnical] = useState('')
  const [technicalTouched, setTechnicalTouched] = useState(false)
  const [abbreviation, setAbbreviation] = useState('')
  const [abbreviationTouched, setAbbreviationTouched] = useState(false)
  const [color, setColor] = useState(DEFAULT_SCHEMA_COLOR)
  const [comment, setComment] = useState('')

  // El borrador se arma al abrir: creando, en blanco; editando, con lo que
  // tiene el esquema, y con los dos campos ya tocados para que no se los
  // lleve por delante una propuesta.
  useEffect(() => {
    if (!open) return
    setLabel(editing?.name ?? '')
    setTechnical(editing?.name ?? '')
    setTechnicalTouched(editing !== undefined)
    setAbbreviation(editing?.abbreviation ?? '')
    setAbbreviationTouched(editing !== undefined)
    setColor(editing?.color ?? DEFAULT_SCHEMA_COLOR)
    setComment(editing?.comment ?? '')
  }, [editing, open])

  const proposedTechnical = technicalTouched ? technical : toTechnicalName(label)
  const proposedAbbreviation = abbreviationTouched ? abbreviation : toAbbreviation(label)

  const others = (model?.schemas ?? []).filter((schema) => schema.name !== editing?.name)

  const labelError = label.trim() === '' ? EMPTY_LABEL_MESSAGE : null
  const technicalError =
    proposedTechnical === ''
      ? // Con el nombre legible vacío ya se queja su propio campo: no hace
        // falta repetir la queja debajo del nombre técnico.
        technicalTouched || labelError === null
        ? EMPTY_TECHNICAL_MESSAGE
        : null
      : !TECHNICAL_NAME_PATTERN.test(proposedTechnical)
        ? INVALID_TECHNICAL_MESSAGE
        : others.some((schema) => schema.name === proposedTechnical)
          ? TAKEN_TECHNICAL_MESSAGE
          : null
  const abbreviationError =
    proposedAbbreviation === '' && !abbreviationTouched && labelError !== null
      ? null
      : !ABBREVIATION_PATTERN.test(proposedAbbreviation)
        ? INVALID_ABBREVIATION_MESSAGE
        : others.some((schema) => schema.abbreviation === proposedAbbreviation)
          ? TAKEN_ABBREVIATION_MESSAGE
          : null

  const invalid = labelError !== null || technicalError !== null || abbreviationError !== null
  const count = (model?.tables ?? []).filter((table) => table.schema === editing?.name).length

  /** Guarda el esquema y cierra el diálogo (FR-015, FR-020). */
  function save() {
    if (invalid) return
    const draft = {
      name: proposedTechnical,
      abbreviation: proposedAbbreviation,
      color,
      comment: comment.trim(),
    }
    if (editing === undefined) createSchema(draft)
    else updateSchema(editing.name, draft)
    closeDialog()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      title={editing === undefined ? 'Nuevo esquema' : 'Editar esquema'}
      description={
        editing === undefined
          ? 'Agrupa las tablas por dominio con su color.'
          : 'Cambia el nombre, la abreviatura, el color o la descripción.'
      }
      icon="layers"
      iconClassName="bg-purple-soft"
      onSubmit={save}
      footer={
        <>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={invalid}>
            {editing === undefined ? 'Crear esquema' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Nombre"
          placeholder="Por ejemplo, Ventas y cobros"
          value={label}
          onValueChange={setLabel}
          hint="De aquí salen el nombre técnico y la abreviatura."
          error={labelError}
          autoFocus
        />

        <div className="flex items-start gap-3">
          <TextField
            className="flex-1"
            label="Nombre técnico"
            placeholder="ventas_y_cobros"
            value={proposedTechnical}
            onValueChange={(value) => {
              setTechnicalTouched(true)
              setTechnical(value)
            }}
            inputClassName="font-mono"
            error={technicalError}
          />
          <TextField
            className="w-[128px] flex-none"
            label="Abreviatura"
            placeholder="VEN"
            value={proposedAbbreviation}
            onValueChange={(value) => {
              setAbbreviationTouched(true)
              setAbbreviation(value.toUpperCase().slice(0, 3))
            }}
            inputClassName="font-mono tracking-[0.08em]"
            error={abbreviationError}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium leading-4 text-label">Color</span>
          <ColorSwatches
            options={SCHEMA_COLORS}
            value={color}
            onValueChange={setColor}
            ariaLabel="Color del esquema"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium leading-4 text-label">Vista previa</span>
          <div
            aria-label="Vista previa de la zona"
            className="sm-zone relative h-[96px] w-full"
            style={{ '--zone': `var(--${color})` } as React.CSSProperties}
          >
            <div className="sm-zone-head">
              <span className="sm-zone-abbr">{proposedAbbreviation || '···'}</span>
              <span className="min-w-0 truncate">{proposedTechnical || 'sin nombre'}</span>
              <span className="sm-zone-count">
                {editing === undefined ? 'sin tablas' : `${count}`}
              </span>
            </div>
          </div>
        </div>

        <TextField
          label="Descripción"
          placeholder="Para qué sirve este esquema"
          value={comment}
          onValueChange={setComment}
          hint="Opcional. Viaja con el modelo."
        />
      </div>
    </Sheet>
  )
}
