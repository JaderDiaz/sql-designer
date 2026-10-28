import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { useGridNavigation } from '@/hooks/useGridNavigation'
import { typeTraits, typesOf } from '@/lib/model/engines'
import { fieldMarks, relationsTouching } from '@/lib/model/marks'
import { toTechnicalName } from '@/lib/model/propose'
import type { Field, Model, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import type { FieldColumn } from '@/store/fieldsPanel'

/**
 * Rejilla del editor de campos (FR-011 a FR-021, FR-046a).
 *
 * Es una rejilla del patrón WAI-ARIA con tabindex rotatorio: el tabulador
 * entra y sale del panel en una pulsación y dentro se navega con las flechas
 * (research R7). Cada celda escribe en el almacén en cada pulsación con su
 * clave de fusión, así que deshacer devuelve la celda completa y no letra a
 * letra (FR-024a).
 *
 * Longitud y escala solo se piden donde el tipo las admite: en los demás tipos
 * la celda se deshabilita y lo dice en su nombre accesible (FR-015). Lo que no
 * se puede guardar —un nombre repetido, una escala mayor que la longitud— se
 * avisa en la fila y no llega al modelo (FR-016, FR-017).
 */

/** Las nueve columnas de FR-011, en su orden. */
const COLUMNS: Array<{ key: FieldColumn; label: string; numeric?: boolean }> = [
  { key: 'key', label: 'Llave' },
  { key: 'name', label: 'Nombre' },
  { key: 'type', label: 'Tipo' },
  { key: 'length', label: 'Long.', numeric: true },
  { key: 'scale', label: 'Escala', numeric: true },
  { key: 'nullable', label: 'No nulo' },
  { key: 'default', label: 'Por defecto' },
  { key: 'comment', label: 'Comentario' },
  { key: 'order', label: 'Orden' },
]

/** Nombre de la columna en el nombre accesible de su celda. */
const CELL_LABELS: Record<FieldColumn, string> = {
  key: 'Llave',
  name: 'Nombre',
  type: 'Tipo',
  length: 'Longitud',
  scale: 'Escala',
  nullable: 'No nulo',
  default: 'Valor por defecto',
  comment: 'Comentario',
  order: 'Orden',
}

/** Lo que se añade al nombre de una celda que el tipo no admite (FR-015). */
export const NOT_FOR_TYPE = ', no aplica a este tipo'

/** Aviso de una longitud que no es un entero positivo (FR-016). */
export const LENGTH_MESSAGE = 'La longitud tiene que ser un número entero mayor que cero.'

/** Aviso de una escala que no es un entero (FR-016). */
export const SCALE_MESSAGE = 'La escala tiene que ser un número entero.'

/** Aviso de una escala mayor que la longitud (FR-016). */
export const SCALE_OVER_LENGTH_MESSAGE = 'La escala no puede pasar de la longitud.'

/** Aviso de un campo de la llave primaria, que no admite nulos (FR-026). */
export const PRIMARY_KEY_NOT_NULL = 'Un campo de la llave primaria no puede admitir nulos.'

/** Aviso de un tipo que el motor del modelo no reconoce (FR-018a). */
export function unknownTypeMessage(type: string, engine: Model['engine']): string {
  return `\`${type}\` no es un tipo de \`${engine}\`.`
}

/** Lo que dice la marca `FK`, que no se elige a mano (FR-025). */
export const DEFINED_BY_RELATION = 'Definida por una relación'

/** Lo que dice la celda de llave de un campo que una relación usa (FR-021). */
export function usedByRelationMessage(relation: string): string {
  return `La relación \`${relation}\` usa este campo.`
}

/** Opciones de la celda «Llave» (FR-025). */
const KEY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'PK', label: 'PK' },
  { value: 'UK', label: 'UK' },
]

/** Props de la rejilla. */
export interface FieldsGridProps {
  /** Tabla cuyos campos se editan. */
  table: Table
}

export function FieldsGrid({ table }: FieldsGridProps) {
  const model = useAppStore((state) => state.model)
  const focusedCell = useAppStore((state) => state.focusedCell)
  const focusCell = useAppStore((state) => state.focusCell)
  const updateField = useAppStore((state) => state.updateField)
  const moveFieldBy = useAppStore((state) => state.moveFieldBy)
  const setFieldKey = useAppStore((state) => state.setFieldKey)
  const openDeleteFieldDialog = useAppStore((state) => state.openDeleteFieldDialog)

  /** Error de cada fila, por nombre de campo (FR-016, FR-017). */
  const [errors, setErrors] = useState<Record<string, string | null>>({})

  const engine = model?.engine ?? 'postgres'
  const fields = table.fields
  const marks = fieldMarks(table, model?.relations ?? [])
  const primaryKey = table.primaryKey ?? []

  /** Si esa celda no admite valor en el tipo del campo (FR-015). */
  function isDisabled(cell: { row: string; column: FieldColumn }): boolean {
    if (cell.column !== 'length' && cell.column !== 'scale') return false
    const field = fields.find((item) => item.name === cell.row)
    if (field === undefined) return false
    const traits = typeTraits(engine, field.type)
    return cell.column === 'length' ? !traits.hasLength : !traits.hasScale
  }

  const grid = useGridNavigation<string, FieldColumn>({
    rows: fields.map((field) => field.name),
    columns: COLUMNS.map((column) => column.key),
    focused: focusedCell === null ? null : { row: focusedCell.field, column: focusedCell.column },
    onFocus: (cell) => focusCell({ field: cell.row, column: cell.column }),
    isDisabled,
  })

  /** Guarda un cambio del campo y recoge el error que devuelva. */
  function write(field: string, patch: Parameters<typeof updateField>[2], key?: string) {
    const error = updateField(table.name, field, patch, key)
    setErrors((current) => ({ ...current, [field]: error }))
    return error
  }

  /** Deja un aviso en la fila sin tocar el modelo. */
  function warn(field: string, message: string | null) {
    setErrors((current) => ({ ...current, [field]: message }))
  }

  return (
    <div
      role="grid"
      aria-label={`Campos de ${table.name}`}
      aria-rowcount={fields.length + 1}
      aria-colcount={COLUMNS.length}
      className="sm-grid"
      onKeyDown={(event) => {
        // ⌥↑ y ⌥↓ reordenan el campo en lugar de mover el foco (FR-014).
        const active = grid.active
        if (
          event.altKey &&
          active !== null &&
          (event.key === 'ArrowUp' || event.key === 'ArrowDown')
        ) {
          event.preventDefault()
          moveFieldBy(table.name, active.row, event.key === 'ArrowUp' ? -1 : 1)
          return
        }
        grid.onKeyDown(event)
      }}
    >
      <div role="row" className="sm-grid-head">
        {COLUMNS.map((column) => (
          <span
            role="columnheader"
            key={column.key}
            className="sm-grid-cell"
            data-numeric={column.numeric === true ? '' : undefined}
          >
            {column.label}
          </span>
        ))}
      </div>

      {fields.map((field, index) => (
        <FieldRow
          key={field.name}
          table={table}
          field={field}
          index={index}
          count={fields.length}
          engine={engine}
          mark={marks.get(field.name) ?? null}
          isPrimaryKey={primaryKey.includes(field.name)}
          relation={
            model === null
              ? null
              : (relationsTouching(model, { table: table.name, field: field.name })[0]?.name ??
                null)
          }
          error={errors[field.name] ?? null}
          focused={focusedCell?.field === field.name ? focusedCell.column : null}
          grid={grid}
          onWrite={write}
          onWarn={warn}
          onMove={(offset) => moveFieldBy(table.name, field.name, offset)}
          onKey={(key) => setFieldKey(table.name, field.name, key)}
          onDelete={() => openDeleteFieldDialog({ table: table.name, field: field.name })}
        />
      ))}
    </div>
  )
}

/** Props de una fila de la rejilla. */
interface FieldRowProps {
  table: Table
  field: Field
  index: number
  count: number
  engine: Model['engine']
  mark: ReturnType<typeof fieldMarks> extends Map<string, infer T> ? T : never
  isPrimaryKey: boolean
  relation: string | null
  error: string | null
  /** Columna enfocada de esta fila, o `null` si el foco está en otra. */
  focused: FieldColumn | null
  grid: ReturnType<typeof useGridNavigation<string, FieldColumn>>
  onWrite: (
    field: string,
    patch: {
      name?: string
      type?: string
      length?: number | null
      scale?: number | null
      nullable?: boolean
      default?: string
      comment?: string
    },
    key?: string,
  ) => string | null
  onWarn: (field: string, message: string | null) => void
  onMove: (offset: number) => void
  onKey: (key: 'PK' | 'UK' | null) => void
  onDelete: () => void
}

/**
 * Una fila de la rejilla: las nueve celdas de un campo.
 *
 * El borrador de cada celda vive aquí, en estado local, para que lo escrito se
 * vea tal cual mientras el almacén normaliza y valida; cuando el campo cambia
 * por otra vía —deshacer, una plantilla— el borrador vuelve al modelo.
 */
function FieldRow({
  table,
  field,
  index,
  count,
  engine,
  mark,
  isPrimaryKey,
  relation,
  error,
  focused,
  grid,
  onWrite,
  onWarn,
  onMove,
  onKey,
  onDelete,
}: FieldRowProps) {
  const traits = typeTraits(engine, field.type)
  /** Celdas de la fila, para llevarles el foco con las flechas (FR-046a). */
  const cells = useRef<Partial<Record<FieldColumn, HTMLElement | null>>>({})
  const [name, setName] = useState(field.name)
  const [length, setLength] = useState(field.length?.toString() ?? '')
  const [scale, setScale] = useState(field.scale?.toString() ?? '')

  useEffect(() => {
    if (focused === null) return
    // El foco va al control de la celda, no a la celda: lo que se edita es el
    // campo de texto, el selector o la casilla que vive dentro.
    const host = cells.current[focused]
    host
      ?.querySelector<HTMLElement>('input:not([type="hidden"]), button, [role="combobox"]')
      ?.focus()
  }, [focused])

  useEffect(() => setName(field.name), [field.name])
  useEffect(() => setLength(field.length?.toString() ?? ''), [field.length])
  useEffect(() => setScale(field.scale?.toString() ?? ''), [field.scale])

  /**
   * Clave de fusión de una celda, para que el historial guarde un solo paso
   * por celda (FR-024a).
   *
   * Nombra la fila por su posición y no por el nombre del campo: escribir en
   * la celda del nombre renombra el campo en cada pulsación, así que una clave
   * con el nombre dentro cambiaría con cada letra y dejaría un paso por letra.
   *
   * @param column Columna de la celda.
   */
  function cellKey(column: FieldColumn): string {
    return `${column}:${table.name}:#${index}`
  }

  /** Nombre accesible de una celda, con su campo y su estado (§5). */
  function cellLabel(column: FieldColumn, disabled = false): string {
    return `${CELL_LABELS[column]} de ${field.name}${disabled ? NOT_FOR_TYPE : ''}`
  }

  /** Props comunes de cada celda: el rol, el tabindex rotatorio y el foco. */
  function cell(column: FieldColumn, disabled = false) {
    const active = grid.isActive({ row: field.name, column })
    return {
      role: 'gridcell' as const,
      className: 'sm-grid-cell',
      ref: (node: HTMLSpanElement | null) => {
        cells.current[column] = node
      },
      'data-disabled': disabled ? '' : undefined,
      'data-active': active ? '' : undefined,
      onFocus: () => {
        if (!active && !disabled) grid.focusCell({ row: field.name, column })
      },
    }
  }

  /** `tabIndex` de la celda, que solo una de la rejilla tiene en 0. */
  function tab(column: FieldColumn): number {
    return grid.tabIndexOf({ row: field.name, column })
  }

  /** Escribe la longitud, avisando si no es un entero positivo (FR-016). */
  function writeLength(value: string) {
    setLength(value)
    if (value.trim() === '') {
      onWrite(field.name, { length: null }, cellKey('length'))
      return
    }
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      onWarn(field.name, LENGTH_MESSAGE)
      return
    }
    if (field.scale !== undefined && field.scale > parsed) {
      onWarn(field.name, SCALE_OVER_LENGTH_MESSAGE)
      return
    }
    onWrite(field.name, { length: parsed }, cellKey('length'))
  }

  /** Escribe la escala, que no puede pasar de la longitud (FR-016). */
  function writeScale(value: string) {
    setScale(value)
    if (value.trim() === '') {
      onWrite(field.name, { scale: null }, cellKey('scale'))
      return
    }
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 0) {
      onWarn(field.name, SCALE_MESSAGE)
      return
    }
    if (field.length !== undefined && parsed > field.length) {
      onWarn(field.name, SCALE_OVER_LENGTH_MESSAGE)
      return
    }
    onWrite(field.name, { scale: parsed }, cellKey('scale'))
  }

  /** Escribe el nombre, en minúsculas y con guion bajo (FR-017, research R9). */
  function writeName(value: string) {
    const typed = value.toLowerCase().replace(/[^a-z0-9_]+/g, '_')
    setName(typed)
    if (typed === field.name) return
    onWrite(field.name, { name: typed }, cellKey('name'))
  }

  /** Al salir de la celda del nombre: normaliza y deja el del modelo. */
  function commitName() {
    const proposed = toTechnicalName(name)
    if (proposed === field.name || proposed === '') {
      setName(field.name)
      return
    }
    const failed = onWrite(field.name, { name: proposed }, cellKey('name'))
    if (failed !== null) setName(field.name)
  }

  const known = typesOf(engine).map((type) => ({ value: type, label: type }))
  const typeOptions = traits.isUnknown
    ? [{ value: field.type, label: field.type }, ...known]
    : known

  const isFocusedRow = grid.active?.row === field.name

  return (
    <>
      <div role="row" className="sm-grid-row" data-focused={isFocusedRow ? '' : undefined}>
        <span
          {...cell('key')}
          // La celda dice qué marca lleva para que la pastilla salga del color
          // de la marca, igual que en la tarjeta del lienzo (FR-025, FR-047).
          data-mark={mark ?? ''}
          title={relation === null ? undefined : usedByRelationMessage(relation)}
        >
          {mark === 'FK' ? (
            // La marca `FK` no la pone esta celda: la define la relación, así
            // que aquí se lee y no se elige (FR-025, research R12).
            <span
              className="sm-grid-mark"
              data-mark="FK"
              title={DEFINED_BY_RELATION}
              aria-label={`${cellLabel('key')}: clave foránea. ${
                relation === null ? DEFINED_BY_RELATION : usedByRelationMessage(relation)
              }`}
            >
              FK
            </span>
          ) : (
            <Select
              label={`${cellLabel('key')}${relation === null ? '' : `. ${usedByRelationMessage(relation)}`}`}
              value={mark ?? ''}
              options={KEY_OPTIONS}
              tabIndex={tab('key')}
              onValueChange={(value) => onKey(value === '' ? null : (value as 'PK' | 'UK'))}
            />
          )}
        </span>

        <span {...cell('name')}>
          <TextField
            aria-label={cellLabel('name')}
            value={name}
            onValueChange={writeName}
            onBlur={commitName}
            tabIndex={tab('name')}
            inputClassName="font-mono"
          />
        </span>

        <span
          {...cell('type')}
          title={traits.isUnknown ? unknownTypeMessage(field.type, engine) : undefined}
        >
          <Select
            label={`${cellLabel('type')}${traits.isUnknown ? `. ${unknownTypeMessage(field.type, engine)}` : ''}`}
            value={field.type}
            options={typeOptions}
            tabIndex={tab('type')}
            onValueChange={(value) => onWrite(field.name, { type: value })}
          />
        </span>

        <span {...cell('length', !traits.hasLength)} data-numeric="">
          <TextField
            aria-label={cellLabel('length', !traits.hasLength)}
            value={traits.hasLength ? length : ''}
            onValueChange={writeLength}
            disabled={!traits.hasLength}
            inputMode="numeric"
            tabIndex={tab('length')}
          />
        </span>

        <span {...cell('scale', !traits.hasScale)} data-numeric="">
          <TextField
            aria-label={cellLabel('scale', !traits.hasScale)}
            value={traits.hasScale ? scale : ''}
            onValueChange={writeScale}
            disabled={!traits.hasScale}
            inputMode="numeric"
            tabIndex={tab('scale')}
          />
        </span>

        <span {...cell('nullable')} title={isPrimaryKey ? PRIMARY_KEY_NOT_NULL : undefined}>
          <Checkbox
            label={`${cellLabel('nullable')}${isPrimaryKey ? `. ${PRIMARY_KEY_NOT_NULL}` : ''}`}
            checked={field.nullable !== true}
            disabled={isPrimaryKey}
            hideLabel
            tabIndex={tab('nullable')}
            onCheckedChange={(checked) => onWrite(field.name, { nullable: !checked })}
          />
        </span>

        <span {...cell('default')}>
          <TextField
            aria-label={cellLabel('default')}
            value={field.default ?? ''}
            onValueChange={(value) => onWrite(field.name, { default: value }, cellKey('default'))}
            tabIndex={tab('default')}
            inputClassName="font-mono"
          />
        </span>

        <span {...cell('comment')}>
          <TextField
            aria-label={cellLabel('comment')}
            value={field.comment ?? ''}
            onValueChange={(value) => onWrite(field.name, { comment: value }, cellKey('comment'))}
            tabIndex={tab('comment')}
          />
        </span>

        <span {...cell('order')}>
          <Button
            size="sm"
            icon="arrow-up"
            aria-label={`Subir ${field.name}`}
            disabled={index === 0}
            tabIndex={tab('order')}
            onClick={() => onMove(-1)}
          />
          <Button
            size="sm"
            icon="arrow-down"
            aria-label={`Bajar ${field.name}`}
            disabled={index === count - 1}
            tabIndex={-1}
            onClick={() => onMove(1)}
          />
          <Button
            size="sm"
            icon="trash-2"
            aria-label={`Eliminar ${field.name}`}
            tabIndex={-1}
            onClick={onDelete}
          />
        </span>
      </div>

      {error === null ? null : (
        <p role="alert" className="sm-grid-error">
          {error}
        </p>
      )}
    </>
  )
}
