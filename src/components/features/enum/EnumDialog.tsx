import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { TextField } from '@/components/ui/TextField'
import { resolveSchemaColor } from '@/lib/model/colors'
import {
  EMPTY_ENUM_NAME_MESSAGE,
  EMPTY_LIST_HINT,
  NO_SCHEMA_ENUM_MESSAGE,
  NO_USAGE_MESSAGE,
  cleanEnumValue,
  enumNameProblem,
  enumUsage,
  enumValueProblems,
  valueCountLabel,
} from '@/lib/model/enums'
import { toTechnicalName } from '@/lib/model/propose'
import { useAppStore } from '@/store'

/**
 * Hoja «Nuevo enum» / «Editar enum», según el componente `EnumForm` del
 * lienzo de diseño (FR-001 a FR-013, FR-020).
 *
 * El borrador —nombre, esquema, valores y el valor a medio escribir— es estado
 * de este componente: el almacén solo se toca al confirmar, así que cancelar o
 * cerrar no cambia nada (FR-009, research R5). Las reglas de la hoja salen de
 * `src/lib/model/enums.ts`, las mismas que vuelve a comprobar el almacén.
 *
 * Dos errores solo se dicen al intentar guardar —nombre vacío y lista vacía—,
 * para no regañar antes de escribir; los demás se ven en cuanto aparecen y
 * apagan el botón de confirmar.
 */

/** Pista del nombre cuando no hay nada que decir de él. */
const NAME_HINT = 'Minúsculas y guion bajo, como un tipo del motor.'

/** Qué se lee en una fila con problema. */
const ROW_PROBLEM_TEXT = { duplicate: 'Repetido', empty: 'Vacío' } as const

export function EnumDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const target = useAppStore((state) => state.enumTarget)
  const model = useAppStore((state) => state.model)
  const focusedSchema = useAppStore((state) => state.focusedSchema)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const createEnum = useAppStore((state) => state.createEnum)
  const updateEnum = useAppStore((state) => state.updateEnum)
  const openSchemaDialog = useAppStore((state) => state.openSchemaDialog)
  const openDeleteEnumDialog = useAppStore((state) => state.openDeleteEnumDialog)
  const openFieldsPanel = useAppStore((state) => state.openFieldsPanel)

  const open = dialog === 'enum'
  const schemas = model?.schemas ?? []
  const editing = (model?.enums ?? []).find((item) => item.name === target) ?? null

  const [written, setWritten] = useState('')
  const [schema, setSchema] = useState('')
  const [values, setValues] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [touched, setTouched] = useState(false)
  const valuesRef = useRef<HTMLDivElement>(null)

  // El esquema propuesto es el enfocado o el primero del modelo (FR-003).
  const proposedSchema = focusedSchema ?? schemas[0]?.name ?? ''

  useEffect(() => {
    if (!open) return
    setWritten(editing?.name ?? '')
    setSchema(editing?.schema ?? proposedSchema)
    setValues(editing === null ? [] : [...editing.values])
    setDraft('')
    setTouched(false)
    // Solo al abrir: mientras la hoja está abierta el borrador es del usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target])

  if (model === null) return null

  const name = toTechnicalName(written)
  const nameProblem = name === '' ? null : enumNameProblem(model, name, editing?.name ?? null)
  const nameError = nameProblem ?? (touched && name === '' ? EMPTY_ENUM_NAME_MESSAGE : null)
  const nameHint = name !== '' && name !== written ? `Se guardará como ${name}` : NAME_HINT

  const problems = enumValueProblems(values)
  // Sin valores se dice al intentar guardar; repetidos y vacíos, siempre.
  const valuesError = values.length === 0 ? (touched ? problems.message : null) : problems.message
  const hasSchemas = schemas.length > 0
  const blocked = nameProblem !== null || (values.length > 0 && problems.message !== null) || schema === ''
  const usage = editing === null ? [] : enumUsage(model, editing.name)

  /** Pasa lo escrito en «Nuevo valor» a la lista y deja el campo listo. */
  function addDraft() {
    const value = draft.trim()
    if (value === '') return
    setValues((current) => [...current, value])
    setDraft('')
    valuesRef.current?.querySelector<HTMLInputElement>('input[aria-label="Nuevo valor"]')?.focus()
  }

  /** Cambia el valor de una fila. */
  function setValue(index: number, value: string) {
    setValues((current) => current.map((item, position) => (position === index ? cleanEnumValue(value) : item)))
  }

  /** Cambia una fila de sitio con la de al lado. */
  function move(index: number, offset: -1 | 1) {
    setValues((current) => {
      const target = index + offset
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const moved = next[index] as string
      next[index] = next[target] as string
      next[target] = moved
      return next
    })
  }

  /** Quita una fila. */
  function remove(index: number) {
    setValues((current) => current.filter((_, position) => position !== index))
  }

  /** Confirma el borrador; si falta el nombre o los valores, lo dice (FR-005, FR-006). */
  function save() {
    if (name === '' || values.length === 0) {
      setTouched(true)
      return
    }
    if (blocked) return
    const result = { name, schema, values: values.map((value) => value.trim()) }
    if (editing === null) createEnum(result)
    else updateEnum(editing.name, result)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      title={editing === null ? 'Nuevo enum' : 'Editar enum'}
      description="Lista cerrada de valores permitidos, para usarla como tipo de los campos."
      icon="tags"
      iconClassName="bg-purple-soft"
      iconColorClassName="text-purple"
      width={460}
      {...(hasSchemas ? { onSubmit: save } : {})}
      footer={
        hasSchemas ? (
          <>
            {editing === null ? null : (
              <Button
                variant="plain"
                icon="trash-2"
                className="mr-auto text-danger-text"
                onClick={() => openDeleteEnumDialog(editing.name)}
              >
                Eliminar enum
              </Button>
            )}
            <Button onClick={closeDialog}>Cancelar</Button>
            <Button variant="primary" type="submit" disabled={blocked}>
              {editing === null ? 'Crear enum' : 'Guardar'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={closeDialog}>Cancelar</Button>
            <Button variant="primary" onClick={() => openSchemaDialog(null)}>
              Nuevo esquema
            </Button>
          </>
        )
      }
    >
      {hasSchemas ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <TextField
              className="flex-1"
              label="Nombre"
              placeholder="estado_pago"
              value={written}
              onValueChange={setWritten}
              hint={nameHint}
              error={nameError}
              inputClassName="font-mono"
              spellCheck={false}
              autoFocus
            />
            <div className="au-field w-[160px] flex-none">
              <span className="au-field-label">Esquema</span>
              <Select
                label="Esquema"
                value={schema}
                onValueChange={setSchema}
                options={schemas.map((item) => ({
                  value: item.name,
                  label: `${item.abbreviation} · ${item.name}`,
                  icon: 'layers' as const,
                  tint: resolveSchemaColor(item.color),
                }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-medium leading-4 text-label">Valores</span>
              <span className="text-[11px] leading-[14px] text-label-secondary">
                {valueCountLabel(values.length)}
              </span>
            </div>

            <div ref={valuesRef} className="sm-enum-values">
              {values.length === 0 ? (
                <p className="m-0 px-1 py-1.5 text-[12px] leading-4 text-label-secondary">
                  {EMPTY_LIST_HINT}
                </p>
              ) : null}
              {values.map((value, index) => {
                const problem = problems.rows[index] ?? null
                return (
                  <div key={index} className="sm-enum-row" data-problem={problem ?? undefined}>
                    <span className="sm-enum-num" aria-hidden="true">
                      {index + 1}
                    </span>
                    <TextField
                      className="min-w-0 flex-1"
                      aria-label={`Valor ${index + 1}`}
                      value={value}
                      onValueChange={(next) => setValue(index, next)}
                      error={problem === null ? null : ROW_PROBLEM_TEXT[problem]}
                      inputClassName="font-mono"
                      spellCheck={false}
                    />
                    <Button
                      variant="plain"
                      size="sm"
                      icon="arrow-up"
                      aria-label="Subir"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    />
                    <Button
                      variant="plain"
                      size="sm"
                      icon="arrow-down"
                      aria-label="Bajar"
                      disabled={index === values.length - 1}
                      onClick={() => move(index, 1)}
                    />
                    <Button
                      variant="plain"
                      size="sm"
                      icon="x"
                      aria-label={`Quitar ${value}`}
                      onClick={() => remove(index)}
                    />
                  </div>
                )
              })}
              <div className="sm-enum-row">
                <span className="sm-enum-num text-purple" aria-hidden="true">
                  <Icon name="plus" size={14} />
                </span>
                <TextField
                  className="min-w-0 flex-1"
                  aria-label="Nuevo valor"
                  placeholder="Nuevo valor · Enter para añadir"
                  value={draft}
                  onValueChange={(next) => setDraft(cleanEnumValue(next))}
                  inputClassName="font-mono"
                  spellCheck={false}
                  onKeyDown={(event) => {
                    // Enter aquí añade el valor; no confirma la hoja.
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    addDraft()
                  }}
                />
                <Button size="sm" disabled={draft.trim() === ''} onClick={addDraft}>
                  Añadir
                </Button>
              </div>
            </div>

            {valuesError === null ? null : (
              <span role="alert" className="text-[11px] leading-[14px] text-danger-text">
                {valuesError}
              </span>
            )}
          </div>

          {editing === null ? null : (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium leading-4 text-label">Usado por</span>
              {usage.length === 0 ? (
                <span className="text-[12px] leading-4 text-label-secondary">{NO_USAGE_MESSAGE}</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {usage.map((item) => (
                    <button
                      key={`${item.table}.${item.field}`}
                      type="button"
                      className="sm-refby-chip"
                      aria-label={`Abrir ${item.table}.${item.field} en el editor`}
                      onClick={() => {
                        closeDialog()
                        openFieldsPanel(item.table, { field: item.field, column: 'type' }, 'fields')
                      }}
                    >
                      <span className="sm-refby-name">
                        {item.table}.{item.field}
                      </span>
                      <Icon name="arrow-up-right" size={14} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-start gap-2.5" role="alert">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-warning-soft"
          >
            <Icon name="layers" size={16} />
          </span>
          <p className="m-0 text-[13px] leading-[18px] text-label">{NO_SCHEMA_ENUM_MESSAGE}</p>
        </div>
      )}
    </Sheet>
  )
}
