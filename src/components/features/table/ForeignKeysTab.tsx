import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { ReferencedByList } from '@/components/features/table/ReferencedByList'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import { useGridNavigation } from '@/hooks/useGridNavigation'
import { resolveSchemaColor } from '@/lib/model/colors'
import { foreignKeyTargets, indexStateOf } from '@/lib/model/relations'
import { REFERENTIAL_ACTIONS, REFERENTIAL_ACTION_LABELS } from '@/lib/model/types'
import type { ReferentialAction, Relation, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import type { ForeignKeyColumn } from '@/store/fieldsPanel'

/**
 * Ficha «Claves foráneas» del editor de tabla (FR-006 a FR-010, FR-032).
 *
 * Es la segunda rejilla del panel inferior, con el mismo patrón que la de
 * campos: una rejilla WAI-ARIA de tabindex rotatorio, donde el tabulador entra
 * y sale en una pulsación y dentro se navega con las flechas (FR-038,
 * research R7). Cada fila es una relación cuya `fromTable` es la tabla
 * abierta, y se identifica por el nombre técnico de la relación, no por el
 * campo: la columna que lleva la clave puede cambiar sin que la fila sea otra.
 *
 * Nada de lo que se ve aquí se guarda dos veces: la marca `FK` del campo y la
 * línea del lienzo se deducen del modelo, así que al dejar la fila con columna
 * y referencia válidas aparecen solas (FR-010).
 */

/** Las seis columnas de FR-006, en su orden. */
const COLUMNS: Array<{ key: ForeignKeyColumn; label: string; name?: string }> = [
  { key: 'column', label: 'Columna' },
  // La cabecera dice «Referencia» por el ancho de la columna, y su nombre
  // accesible el de `contracts/relations.md` §5.
  { key: 'reference', label: 'Referencia', name: 'Tabla referenciada' },
  { key: 'onDelete', label: 'ON DELETE' },
  { key: 'onUpdate', label: 'ON UPDATE' },
  { key: 'index', label: 'Índice' },
  { key: 'remove', label: '' },
]

/** Nombre de la columna en el nombre accesible de su celda (§5). */
const CELL_LABELS: Record<ForeignKeyColumn, string> = {
  column: 'Columna',
  reference: 'Tabla referenciada',
  onDelete: 'ON DELETE',
  onUpdate: 'ON UPDATE',
  index: 'Índice',
  remove: 'Eliminar la clave foránea',
}

/** Lo que se lee cuando la tabla no referencia a ninguna otra (FR-032). */
export const NO_FOREIGN_KEYS_MESSAGE =
  'Esta tabla no referencia a otras. Usa «Añadir clave foránea»: se crea la ' +
  'columna con el tipo de la llave primaria referenciada y la relación ' +
  'aparece en el diagrama.'

/**
 * Lo que dice la fila de una relación de varias columnas (FR-020).
 *
 * @param columns Columnas que forman la clave foránea.
 */
export function multiColumnMessage(columns: string[]): string {
  return (
    `Esta relación usa varias columnas (${columns.join(', ')}). Se conserva tal ` +
    'cual y se dibuja desde la primera; sus columnas no se editan aquí.'
  )
}

/** Lo que se avisa de un `SET NULL` sobre una columna no nula (FR-030). */
export const SET_NULL_WARNING =
  'La columna no admite nulos, así que SET NULL no podrá aplicarse.'

/** Salida del aviso anterior, que quita el «no nulo» del campo (FR-030). */
export const CLEAR_NOT_NULL_ACTION = 'Quitar «no nulo»'

/** `title` del botón de eliminar, que no borra el campo (§5). */
export const DELETE_FOREIGN_KEY_TITLE = 'Eliminar la clave foránea (el campo se conserva)'

/** Las cinco acciones referenciales como opciones del selector (FR-028). */
const ACTION_OPTIONS: SelectOption[] = REFERENTIAL_ACTIONS.map((action) => ({
  value: action,
  label: REFERENTIAL_ACTION_LABELS[action],
}))

/** Props de la ficha. */
export interface ForeignKeysTabProps {
  /** Tabla cuyas claves foráneas se editan. */
  table: Table
}

export function ForeignKeysTab({ table }: ForeignKeysTabProps) {
  const model = useAppStore((state) => state.model)
  const focusedCell = useAppStore((state) => state.focusedCell)
  const focusCell = useAppStore((state) => state.focusCell)
  const addForeignKey = useAppStore((state) => state.addForeignKey)
  const setForeignKeyColumn = useAppStore((state) => state.setForeignKeyColumn)
  const setForeignKeyTarget = useAppStore((state) => state.setForeignKeyTarget)
  const setReferentialAction = useAppStore((state) => state.setReferentialAction)
  const deleteForeignKey = useAppStore((state) => state.deleteForeignKey)
  const clearNotNull = useAppStore((state) => state.clearNotNull)
  const selectTable = useAppStore((state) => state.selectTable)
  const openFieldsPanel = useAppStore((state) => state.openFieldsPanel)

  /** Aviso de cada fila, por nombre de relación (FR-009a). */
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  /** Motivo por el que «Añadir clave foránea» no pudo crear nada (FR-009). */
  const [addError, setAddError] = useState<string | null>(null)

  const schema = model?.schemas.find((item) => item.name === table.schema)
  const relations = (model?.relations ?? []).filter(
    (relation) => relation.fromTable === table.name,
  )
  const targets = model === null ? [] : foreignKeyTargets(model, table.name)

  // La celda enfocada la comparten las dos fichas del panel, así que esta
  // rejilla solo atiende la que es de una de sus columnas (data-model.md §3).
  const focused =
    focusedCell !== null && COLUMNS.some((column) => column.key === focusedCell.column)
      ? { row: focusedCell.field, column: focusedCell.column as ForeignKeyColumn }
      : null

  // Las relaciones de varias columnas se muestran y se conservan, pero sus
  // dos primeras celdas no se editan aquí (FR-020).
  const composite = new Set(
    relations.filter((relation) => relation.fromFields.length > 1).map((relation) => relation.name),
  )

  const grid = useGridNavigation<string, ForeignKeyColumn>({
    rows: relations.map((relation) => relation.name),
    columns: COLUMNS.map((column) => column.key),
    focused,
    onFocus: (cell) => focusCell({ field: cell.row, column: cell.column }),
    isDisabled: (cell) =>
      (cell.column === 'column' || cell.column === 'reference') && composite.has(cell.row),
  })

  /** Crea una clave foránea y deja a la vista el motivo si no pudo (FR-009). */
  function add() {
    setAddError(addForeignKey(table.name))
  }

  /** Deja un aviso en la fila de una relación. */
  function warn(name: string, message: string | null) {
    setErrors((current) => ({ ...current, [name]: message }))
  }

  return (
    <>
      <header className="sm-fields-head">
        <span
          className="sm-abbr"
          aria-hidden="true"
          style={{ '--zone': `var(--${resolveSchemaColor(schema?.color)})` } as CSSProperties}
        >
          <span className="sm-abbr-dot" />
          {schema?.abbreviation ?? '···'}
        </span>
        <span className="sm-fields-title">{table.name}</span>
        <span className="sm-fields-count">
          {relations.length === 1 ? '1 clave foránea' : `${relations.length} claves foráneas`}
        </span>

        <span className="ml-auto flex items-center gap-1.5 pr-9">
          <Button size="sm" variant="primary" icon="plus" onClick={add}>
            Añadir clave foránea
          </Button>
        </span>
      </header>

      {addError === null ? null : (
        <p role="alert" className="sm-grid-error">
          {addError}
        </p>
      )}

      {relations.length === 0 ? (
        <p className="sm-panel-empty">{NO_FOREIGN_KEYS_MESSAGE}</p>
      ) : (
        <div
          role="grid"
          aria-label={`Claves foráneas de ${table.name}`}
          aria-rowcount={relations.length + 1}
          aria-colcount={COLUMNS.length}
          className="sm-grid sm-fkgrid"
          onKeyDown={grid.onKeyDown}
        >
          <div role="row" className="sm-grid-head">
            {COLUMNS.map((column) => (
              <span
                role="columnheader"
                key={column.key}
                className="sm-grid-cell"
                aria-label={column.name}
              >
                {column.label}
              </span>
            ))}
          </div>

          {relations.map((relation) => (
            <ForeignKeyRow
              key={relation.name}
              table={table}
              relation={relation}
              targets={targets}
              error={errors[relation.name] ?? null}
              focused={focused?.row === relation.name ? focused.column : null}
              grid={grid}
              onColumn={(field) => warn(relation.name, setForeignKeyColumn(relation.name, field))}
              onTarget={(target) => {
                warn(relation.name, null)
                setForeignKeyTarget(relation.name, target)
              }}
              onAction={(key, action) => setReferentialAction(relation.name, key, action)}
              onClearNotNull={(field) => clearNotNull(table.name, field)}
              onDelete={() => deleteForeignKey(relation.name)}
              onGo={() => {
                selectTable(relation.toTable)
                openFieldsPanel(relation.toTable, undefined, 'foreignKeys')
              }}
            />
          ))}
        </div>
      )}

      <ReferencedByList table={table} />
    </>
  )
}

/** Props de una fila de la rejilla. */
interface ForeignKeyRowProps {
  table: Table
  relation: Relation
  targets: ReturnType<typeof foreignKeyTargets>
  error: string | null
  /** Columna enfocada de esta fila, o `null` si el foco está en otra. */
  focused: ForeignKeyColumn | null
  grid: ReturnType<typeof useGridNavigation<string, ForeignKeyColumn>>
  onColumn: (field: string) => void
  onTarget: (table: string) => void
  onAction: (key: 'onDelete' | 'onUpdate', action: ReferentialAction) => void
  onClearNotNull: (field: string) => void
  onDelete: () => void
  onGo: () => void
}

/**
 * Una fila de la rejilla: las seis celdas de una clave foránea.
 *
 * El campo referenciado no se elige: es la llave primaria de la tabla
 * referenciada, así que se lee en monoespaciada al lado del selector, con el
 * botón que lleva a esa tabla (FR-006).
 */
function ForeignKeyRow({
  table,
  relation,
  targets,
  error,
  focused,
  grid,
  onColumn,
  onTarget,
  onAction,
  onClearNotNull,
  onDelete,
  onGo,
}: ForeignKeyRowProps) {
  /** Celdas de la fila, para llevarles el foco con las flechas (FR-038). */
  const cells = useRef<Partial<Record<ForeignKeyColumn, HTMLElement | null>>>({})

  useEffect(() => {
    if (focused === null) return
    const host = cells.current[focused]
    const control = host?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), button, [role="combobox"]',
    )
    // La celda del índice no tiene control: entonces el foco va a la celda,
    // que es lo que el lector de pantalla lee.
    ;(control ?? host)?.focus()
  }, [focused])

  /** Nombre accesible de una celda, con su relación (§5). */
  function cellLabel(column: ForeignKeyColumn): string {
    if (column === 'remove') return CELL_LABELS.remove
    return `${CELL_LABELS[column]} de ${relation.name}`
  }

  /** Props comunes de cada celda: el rol, el tabindex rotatorio y el foco. */
  function cell(column: ForeignKeyColumn) {
    const active = grid.isActive({ row: relation.name, column })
    return {
      role: 'gridcell' as const,
      className: 'sm-grid-cell',
      ref: (node: HTMLSpanElement | null) => {
        cells.current[column] = node
      },
      'data-active': active ? '' : undefined,
      onFocus: () => {
        if (!active) grid.focusCell({ row: relation.name, column })
      },
    }
  }

  /** `tabIndex` de la celda, que solo una de la rejilla tiene en 0. */
  function tab(column: ForeignKeyColumn): number {
    return grid.tabIndexOf({ row: relation.name, column })
  }

  // En una relación hacia la propia tabla, el campo al que apunta no se
  // ofrece como columna: una columna no puede referenciarse a sí misma
  // (FR-009a).
  const forbidden =
    relation.fromTable === relation.toTable ? new Set(relation.toFields) : new Set<string>()
  const columnOptions: SelectOption[] = table.fields
    .filter((field) => !forbidden.has(field.name))
    .map((field) => ({ value: field.name, label: field.name }))

  const targetOptions: SelectOption[] = targets.map((target) => ({
    value: target.name,
    label: target.name,
    disabled: !target.enabled,
    ...(target.reason === undefined ? {} : { description: target.reason }),
  }))

  const column = relation.fromFields[0] ?? ''
  const isComposite = relation.fromFields.length > 1
  const state = indexStateOf(table, column)
  // `SET NULL` sobre una columna no nula se guarda igual —es una regla válida
  // del archivo—, pero no podrá aplicarse, y la fila lo dice con su salida a
  // mano (FR-030).
  const field = table.fields.find((item) => item.name === column)
  const notNull = field !== undefined && field.nullable !== true
  const setsNull = relation.onDelete === 'set_null' || relation.onUpdate === 'set_null'
  const warnsNotNull = setsNull && notNull
  const isFocusedRow = grid.active?.row === relation.name

  return (
    <>
      <div role="row" className="sm-grid-row" data-focused={isFocusedRow ? '' : undefined}>
        <span {...cell('column')} data-disabled={isComposite ? '' : undefined}>
          {isComposite ? (
            // Sin selector: no hay nada que elegir, así que la celda solo lee
            // las columnas que trae el archivo (FR-020).
            <span className="sm-fk-field" aria-label={cellLabel('column')}>
              {relation.fromFields.join(', ')}
            </span>
          ) : (
            <Select
              label={cellLabel('column')}
              value={column}
              options={columnOptions}
              tabIndex={tab('column')}
              onValueChange={onColumn}
            />
          )}
        </span>

        <span {...cell('reference')} data-disabled={isComposite ? '' : undefined}>
          <span className="min-w-0 flex-1">
            {isComposite ? (
              <span className="sm-fk-field" aria-label={cellLabel('reference')}>
                {relation.toTable}
              </span>
            ) : (
              <Select
                label={cellLabel('reference')}
                value={relation.toTable}
                options={targetOptions}
                tabIndex={tab('reference')}
                onValueChange={onTarget}
              />
            )}
          </span>
          <span className="sm-fk-field">.{relation.toFields.join(', ')}</span>
          <Button
            size="sm"
            icon="arrow-up-right"
            aria-label={`Ir a ${relation.toTable}`}
            title={`Ir a ${relation.toTable}`}
            tabIndex={-1}
            onClick={onGo}
          />
        </span>

        <span {...cell('onDelete')}>
          <Select
            label={cellLabel('onDelete')}
            value={relation.onDelete ?? 'no_action'}
            options={ACTION_OPTIONS}
            tabIndex={tab('onDelete')}
            onValueChange={(value) => onAction('onDelete', value as ReferentialAction)}
          />
        </span>

        <span {...cell('onUpdate')}>
          <Select
            label={cellLabel('onUpdate')}
            value={relation.onUpdate ?? 'no_action'}
            options={ACTION_OPTIONS}
            tabIndex={tab('onUpdate')}
            onValueChange={(value) => onAction('onUpdate', value as ReferentialAction)}
          />
        </span>

        <span {...cell('index')} aria-label={cellLabel('index')} tabIndex={tab('index')}>
          {state === 'indexed' ? (
            <Badge tone="green" icon="check">
              Indexada
            </Badge>
          ) : (
            <Badge tone="orange" dot>
              Sin índice
            </Badge>
          )}
        </span>

        <span {...cell('remove')}>
          <Button
            size="sm"
            icon="trash-2"
            aria-label={cellLabel('remove')}
            title={DELETE_FOREIGN_KEY_TITLE}
            tabIndex={tab('remove')}
            onClick={onDelete}
          />
        </span>
      </div>

      {isComposite ? (
        <p className="sm-grid-note">{multiColumnMessage(relation.fromFields)}</p>
      ) : null}

      {warnsNotNull ? (
        <p role="alert" className="sm-grid-note">
          {SET_NULL_WARNING}{' '}
          <button
            type="button"
            className="sm-grid-fix"
            onClick={() => onClearNotNull(column)}
          >
            {CLEAR_NOT_NULL_ACTION}
          </button>
        </p>
      ) : null}

      {error === null ? null : (
        <p role="alert" className="sm-grid-error">
          {error}
        </p>
      )}
    </>
  )
}
