import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * Navegación de la rejilla del editor de campos (FR-046a, research R7).
 *
 * Implementa el tabindex rotatorio del patrón WAI-ARIA de rejilla: de toda la
 * rejilla, una sola celda es parada de tabulador, así que el tabulador entra
 * en el panel y sale de él en una pulsación —en una tabla de cuarenta campos y
 * nueve columnas, con una parada por celda harían falta 360—. Dentro, las
 * flechas mueven de celda y de fila, Inicio y Fin van a los extremos de la
 * fila, Intro empieza a editar la celda enfocada y Esc cancela lo escrito.
 *
 * El hook no pinta nada y no conoce el modelo: recibe las filas y las columnas
 * como listas de identificadores y devuelve qué celda está enfocada, el
 * `tabIndex` de cada una y el manejador del teclado.
 */

/** Celda de la rejilla, por fila y columna. */
export interface GridCell<TRow extends string, TColumn extends string> {
  row: TRow
  column: TColumn
}

/** Lo que el hook necesita saber de la rejilla. */
export interface GridNavigationOptions<TRow extends string, TColumn extends string> {
  /** Filas, en el orden en que se muestran. */
  rows: TRow[]
  /** Columnas, en el orden en que se muestran. */
  columns: TColumn[]
  /** Celda enfocada ahora, o `null` para que la primera sea la parada. */
  focused: GridCell<TRow, TColumn> | null
  /** Qué hacer cuando el foco se mueve. */
  onFocus: (cell: GridCell<TRow, TColumn>) => void
  /** Qué hacer con Intro sobre una celda. */
  onActivate?: (cell: GridCell<TRow, TColumn>) => void
  /** Qué hacer con Esc dentro de la rejilla. */
  onCancel?: () => void
  /** Columnas a las que el foco no puede entrar, por fila (FR-015). */
  isDisabled?: (cell: GridCell<TRow, TColumn>) => boolean
}

/** Lo que el hook devuelve a la rejilla. */
export interface GridNavigation<TRow extends string, TColumn extends string> {
  /** Celda que es parada de tabulador: la enfocada o la primera. */
  active: GridCell<TRow, TColumn> | null
  /** `0` en la parada de tabulador y `-1` en todas las demás celdas. */
  tabIndexOf: (cell: GridCell<TRow, TColumn>) => number
  /** Si esa celda es la que tiene el foco. */
  isActive: (cell: GridCell<TRow, TColumn>) => boolean
  /** Manejador de teclado de la rejilla, uno para toda ella. */
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  /** Mueve el foco a una celda, saltando las deshabilitadas. */
  focusCell: (cell: GridCell<TRow, TColumn>) => void
}

/** La misma celda que la de referencia. */
function sameCell<TRow extends string, TColumn extends string>(
  one: GridCell<TRow, TColumn> | null,
  other: GridCell<TRow, TColumn> | null,
): boolean {
  if (one === null || other === null) return one === other
  return one.row === other.row && one.column === other.column
}

/**
 * Engancha la navegación de una rejilla.
 *
 * @param options Filas, columnas, celda enfocada y qué hacer con cada tecla.
 */
export function useGridNavigation<TRow extends string, TColumn extends string>({
  rows,
  columns,
  focused,
  onFocus,
  onActivate,
  onCancel,
  isDisabled,
}: GridNavigationOptions<TRow, TColumn>): GridNavigation<TRow, TColumn> {
  /** Última celda enfocada, para volver a ella cuando el tabulador regresa. */
  const lastRef = useRef<GridCell<TRow, TColumn> | null>(null)

  useEffect(() => {
    if (focused !== null) lastRef.current = focused
  }, [focused])

  const firstRow = rows[0]
  const firstColumn = columns[0]
  const fallback: GridCell<TRow, TColumn> | null =
    firstRow !== undefined && firstColumn !== undefined
      ? { row: firstRow, column: firstColumn }
      : null
  // La parada de tabulador es la celda enfocada; si no hay ninguna, la última
  // por la que pasó el foco, y si tampoco, la primera de la rejilla.
  const remembered = lastRef.current
  const active =
    focused ??
    (remembered !== null && rows.includes(remembered.row) && columns.includes(remembered.column)
      ? remembered
      : fallback)

  /** Mueve el foco a una celda, saltando las que no admiten su valor. */
  const focusCell = useCallback(
    (cell: GridCell<TRow, TColumn>) => {
      if (isDisabled?.(cell) === true) {
        // Una celda deshabilitada no recibe el foco: se sigue en la misma
        // dirección hasta encontrar una que sí y, si la fila se acaba antes,
        // se vuelve hacia atrás, para que Fin siempre caiga en la última
        // celda que acepta el foco (FR-015, FR-046a).
        const index = columns.indexOf(cell.column)
        const current = active === null ? 0 : columns.indexOf(active.column)
        const forward = index >= current ? 1 : -1
        for (const step of [forward, -forward]) {
          for (let next = index + step; next >= 0 && next < columns.length; next += step) {
            const column = columns[next]
            if (column === undefined) continue
            if (isDisabled({ row: cell.row, column }) !== true) {
              onFocus({ row: cell.row, column })
              return
            }
          }
        }
        return
      }
      onFocus(cell)
    },
    [active, columns, isDisabled, onFocus],
  )

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (active === null) return
      const rowIndex = rows.indexOf(active.row)
      const columnIndex = columns.indexOf(active.column)
      if (rowIndex === -1 || columnIndex === -1) return

      /** Mueve el foco y se queda con la tecla. */
      const move = (row: number, column: number) => {
        const target = rows[Math.min(rows.length - 1, Math.max(0, row))]
        const targetColumn = columns[Math.min(columns.length - 1, Math.max(0, column))]
        if (target === undefined || targetColumn === undefined) return
        event.preventDefault()
        focusCell({ row: target, column: targetColumn })
      }

      switch (event.key) {
        case 'ArrowRight':
          move(rowIndex, columnIndex + 1)
          return
        case 'ArrowLeft':
          move(rowIndex, columnIndex - 1)
          return
        case 'ArrowDown':
          move(rowIndex + 1, columnIndex)
          return
        case 'ArrowUp':
          move(rowIndex - 1, columnIndex)
          return
        case 'Home':
          move(rowIndex, 0)
          return
        case 'End':
          move(rowIndex, columns.length - 1)
          return
        case 'Enter':
          if (onActivate === undefined) return
          event.preventDefault()
          onActivate(active)
          return
        case 'Escape':
          if (onCancel === undefined) return
          onCancel()
          return
        default:
          return
      }
    },
    [active, columns, focusCell, onActivate, onCancel, rows],
  )

  return {
    active,
    tabIndexOf: (cell) => (sameCell(cell, active) ? 0 : -1),
    isActive: (cell) => sameCell(cell, active),
    onKeyDown,
    focusCell,
  }
}
