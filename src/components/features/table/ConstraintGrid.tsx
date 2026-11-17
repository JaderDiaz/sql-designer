import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { TextField } from '@/components/ui/TextField'
import { useGridNavigation } from '@/hooks/useGridNavigation'
import { duplicateOf, repeatsColumnsMessage } from '@/lib/model/indexes'
import type { Index, NamedFields, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import type { ConstraintColumn } from '@/store/fieldsPanel'

/**
 * Rejilla de las fichas «Índices» y «Únicos» (FR-022, FR-025 a FR-029,
 * FR-032 a FR-037, FR-044).
 *
 * Es la tercera rejilla del panel, con el mismo patrón que las de campos y
 * claves foráneas: tabindex rotatorio, el tabulador entra y sale en una
 * pulsación y dentro se navega con las flechas (research R7 del Incremento 3).
 *
 * Cada fila se identifica por su **posición** y no por su nombre: escribir en
 * la celda del nombre renombra en cada pulsación válida, y con el nombre como
 * identidad la fila se volvería a montar a cada letra y perdería el foco.
 *
 * El modelo nunca queda inválido por una fila: un nombre vacío o repetido se
 * queda en la celda con su error y no llega al almacén, y una lista de
 * columnas que dejaría la fila sin sentido vuelve con su mensaje y la fila
 * conserva las que tenía (research R11).
 */

/** Qué lista de la tabla edita la rejilla. */
export type ConstraintKind = 'indexes' | 'uniques'

/** Props de la rejilla. */
export interface ConstraintGridProps {
  table: Table
  kind: ConstraintKind
  /** Las filas: los índices propios o los únicos compuestos, en su orden. */
  items: NamedFields[]
  /** Nombre accesible de la rejilla. */
  label: string
  /** Nombre accesible de la celda del nombre: «Nombre del índice». */
  nameLabel: string
  /** Nombre accesible del botón de eliminar. */
  removeLabel: string
  onName: (name: string, next: string) => string | null
  onFields: (name: string, fields: string[]) => string | null
  /** Solo los índices llevan la casilla de único. */
  onUnique?: (name: string, unique: boolean) => void
  onDelete: (name: string) => void
}

/** Cabeceras de cada columna. */
const HEADERS: Record<ConstraintColumn, string> = {
  name: 'Nombre',
  columns: 'Columnas',
  unique: 'Único',
  remove: '',
}

/**
 * Identificador de la fila en la celda enfocada del almacén.
 *
 * @param kind Lista de la fila.
 * @param position Posición en la lista.
 */
export function constraintRowId(kind: ConstraintKind, position: number): string {
  return `${kind}#${position}`
}

export function ConstraintGrid({
  table,
  kind,
  items,
  label,
  nameLabel,
  removeLabel,
  onName,
  onFields,
  onUnique,
  onDelete,
}: ConstraintGridProps) {
  const focusedCell = useAppStore((state) => state.focusedCell)
  const focusCell = useAppStore((state) => state.focusCell)

  const columns: ConstraintColumn[] =
    onUnique === undefined ? ['name', 'columns', 'remove'] : ['name', 'columns', 'unique', 'remove']
  const rows = items.map((_, position) => constraintRowId(kind, position))

  // La celda enfocada la comparten todas las fichas del panel: esta rejilla
  // solo atiende la que es de una de sus filas (data-model.md §3).
  const focused =
    focusedCell !== null &&
    rows.includes(focusedCell.field) &&
    (columns as string[]).includes(focusedCell.column)
      ? { row: focusedCell.field, column: focusedCell.column as ConstraintColumn }
      : null

  const grid = useGridNavigation<string, ConstraintColumn>({
    rows,
    columns,
    focused,
    onFocus: (cell) => focusCell({ field: cell.row, column: cell.column }),
  })

  return (
    <div
      role="grid"
      aria-label={label}
      aria-rowcount={items.length + 1}
      aria-colcount={columns.length}
      className={kind === 'indexes' ? 'sm-grid sm-idxgrid' : 'sm-grid sm-uqgrid'}
      onKeyDown={grid.onKeyDown}
    >
      <div role="row" className="sm-grid-head">
        {columns.map((column) => (
          <span
            role="columnheader"
            key={column}
            className="sm-grid-cell"
            aria-label={column === 'remove' ? 'Eliminar' : undefined}
          >
            {HEADERS[column]}
          </span>
        ))}
      </div>

      {items.map((item, position) => (
        <ConstraintRow
          key={rows[position]}
          table={table}
          item={item}
          row={rows[position] as string}
          columns={columns}
          nameLabel={nameLabel}
          removeLabel={removeLabel}
          focused={focused !== null && focused.row === rows[position] ? focused.column : null}
          grid={grid}
          onName={(next) => onName(item.name, next)}
          onFields={(fields) => onFields(item.name, fields)}
          {...(onUnique === undefined
            ? {}
            : { onUnique: (unique: boolean) => onUnique(item.name, unique) })}
          onDelete={() => onDelete(item.name)}
        />
      ))}
    </div>
  )
}

/** Props de una fila. */
interface ConstraintRowProps {
  table: Table
  item: NamedFields
  row: string
  columns: ConstraintColumn[]
  nameLabel: string
  removeLabel: string
  /** Columna enfocada de esta fila, o `null` si el foco está en otra. */
  focused: ConstraintColumn | null
  grid: ReturnType<typeof useGridNavigation<string, ConstraintColumn>>
  onName: (next: string) => string | null
  onFields: (fields: string[]) => string | null
  onUnique?: (unique: boolean) => void
  onDelete: () => void
}

/** Una fila: nombre, columnas, la casilla de único si es un índice, y eliminar. */
function ConstraintRow({
  table,
  item,
  row,
  columns,
  nameLabel,
  removeLabel,
  focused,
  grid,
  onName,
  onFields,
  onUnique,
  onDelete,
}: ConstraintRowProps) {
  /** Celdas de la fila, para llevarles el foco con las flechas. */
  const cells = useRef<Partial<Record<ConstraintColumn, HTMLElement | null>>>({})
  /** Lo escrito en la celda del nombre, que puede no ser válido todavía. */
  const [draft, setDraft] = useState(item.name)
  /** Error del nombre escrito, que no llegó al almacén. */
  const [nameError, setNameError] = useState<string | null>(null)
  /** Motivo por el que el último cambio de columnas no se guardó. */
  const [fieldsError, setFieldsError] = useState<string | null>(null)

  // Mientras lo escrito es válido, la celda sigue al nombre del modelo, que
  // también cambia al reproponerse con las columnas o al deshacer.
  useEffect(() => {
    setDraft(item.name)
    setNameError(null)
  }, [item.name])

  useEffect(() => {
    if (focused === null) return
    const host = cells.current[focused]
    if (host === null || host === undefined) return
    // Si el foco ya está en la celda, o en el menú de columnas que acaba de
    // abrir, no se toca: devolverlo al disparador cerraría el menú, que no es
    // modal y se cierra en cuanto el foco sale de él.
    const current = document.activeElement
    if (current !== null && (host.contains(current) || current.closest('[role="menu"]') !== null)) {
      return
    }
    host.querySelector<HTMLElement>('input:not([type="hidden"]), button')?.focus()
  }, [focused])

  /** Props comunes de cada celda: el rol, el tabindex rotatorio y el foco. */
  function cell(column: ConstraintColumn) {
    const active = grid.isActive({ row, column })
    return {
      role: 'gridcell' as const,
      className: 'sm-grid-cell',
      ref: (node: HTMLSpanElement | null) => {
        cells.current[column] = node
      },
      'data-active': active ? '' : undefined,
      onFocus: () => {
        if (!active) grid.focusCell({ row, column })
      },
    }
  }

  /** `tabIndex` de la celda, que solo una de la rejilla tiene en 0. */
  function tab(column: ConstraintColumn): number {
    return grid.tabIndexOf({ row, column })
  }

  /** Escribe el nombre si sirve; si no, lo deja en la celda con su error. */
  function writeName(next: string) {
    setDraft(next)
    setNameError(onName(next))
  }

  const repeated = duplicateOf(table, item.fields, item.name)
  const options = table.fields.map((field) => ({ value: field.name, label: field.name }))
  const isFocusedRow = grid.active?.row === row

  return (
    <>
      <div role="row" className="sm-grid-row" data-focused={isFocusedRow ? '' : undefined}>
        <span {...cell('name')}>
          <TextField
            className="min-w-0 flex-1"
            aria-label={`${nameLabel} ${item.name}`}
            value={draft}
            onValueChange={writeName}
            onBlur={() => {
              // Al salir, lo que no se pudo guardar vuelve al nombre del modelo.
              if (nameError === null) return
              setDraft(item.name)
              setNameError(null)
            }}
            tabIndex={tab('name')}
            inputClassName="font-mono"
            spellCheck={false}
          />
        </span>

        <span {...cell('columns')}>
          <MultiSelect
            className="min-w-0 flex-1"
            label={`Columnas de ${item.name}`}
            options={options}
            value={item.fields}
            placeholder="Elige columnas"
            tabIndex={tab('columns')}
            onValueChange={(fields) => setFieldsError(onFields(fields))}
          />
        </span>

        {columns.includes('unique') && onUnique !== undefined ? (
          <span {...cell('unique')}>
            <Checkbox
              label={`Índice único ${item.name}`}
              checked={(item as Index).unique === true}
              hideLabel
              tabIndex={tab('unique')}
              onCheckedChange={onUnique}
            />
          </span>
        ) : null}

        <span {...cell('remove')}>
          <Button
            size="sm"
            icon="trash-2"
            aria-label={`${removeLabel} ${item.name}`}
            title={removeLabel}
            tabIndex={tab('remove')}
            onClick={onDelete}
          />
        </span>
      </div>

      {nameError === null ? null : (
        <p role="alert" className="sm-grid-error">
          {nameError}
        </p>
      )}

      {fieldsError === null ? null : (
        <p role="alert" className="sm-grid-error">
          {fieldsError}
        </p>
      )}

      {repeated === null ? null : <p className="sm-grid-note">{repeatsColumnsMessage(repeated)}</p>}
    </>
  )
}
