import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useGridNavigation } from '@/hooks/useGridNavigation'
import type { GridCell } from '@/hooks/useGridNavigation'

/** Filas y columnas de la rejilla de prueba. */
const ROWS = ['id', 'nombre', 'importe'] as const
const COLUMNS = ['name', 'type', 'length'] as const

type Row = (typeof ROWS)[number]
type Column = (typeof COLUMNS)[number]

/** Props del banco de pruebas. */
interface HarnessProps {
  onActivate?: (cell: GridCell<Row, Column>) => void
  onCancel?: () => void
  /** `length` solo aplica a la fila `importe`, como en el editor real. */
  withDisabled?: boolean
}

/**
 * Rejilla mínima con el hook enganchado.
 *
 * Es la forma del editor de campos: `role="grid"`, una fila por campo y un
 * botón por celda, con el tabindex rotatorio del hook.
 */
function Harness({ onActivate, onCancel, withDisabled = false }: HarnessProps) {
  const [focused, setFocused] = useState<GridCell<Row, Column> | null>(null)
  const grid = useGridNavigation<Row, Column>({
    rows: [...ROWS],
    columns: [...COLUMNS],
    focused,
    onFocus: setFocused,
    ...(onActivate ? { onActivate } : {}),
    ...(onCancel ? { onCancel } : {}),
    ...(withDisabled
      ? { isDisabled: (cell) => cell.column === 'length' && cell.row !== 'importe' }
      : {}),
  })

  return (
    <div>
      <button type="button">antes</button>
      <div role="grid" aria-label="Campos de cosas" onKeyDown={grid.onKeyDown}>
        {ROWS.map((row) => (
          <div role="row" key={row}>
            {COLUMNS.map((column) => (
              <button
                type="button"
                role="gridcell"
                key={column}
                aria-label={`${column} de ${row}`}
                tabIndex={grid.tabIndexOf({ row, column })}
                ref={(node) => {
                  // La rejilla real mueve el foco cuando el usuario lo mueve,
                  // no al montarse: al montarse solo deja la parada de
                  // tabulador puesta.
                  if (node !== null && focused !== null && grid.isActive({ row, column })) {
                    node.focus()
                  }
                }}
              >
                {column}
              </button>
            ))}
          </div>
        ))}
      </div>
      <button type="button">después</button>
    </div>
  )
}

/** La celda que tiene el foco ahora, por su nombre accesible. */
function focusedLabel(): string | null {
  return document.activeElement?.getAttribute('aria-label') ?? null
}

describe('useGridNavigation (FR-046a)', () => {
  it('una sola celda es parada de tabulador', () => {
    render(<Harness />)

    const cells = screen.getAllByRole('gridcell')
    expect(cells.filter((cell) => cell.getAttribute('tabindex') === '0')).toHaveLength(1)
    expect(cells[0]).toHaveAttribute('tabindex', '0')
  })

  it('las flechas mueven de celda y de fila', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    await user.tab()
    expect(focusedLabel()).toBe('name de id')

    await user.keyboard('{ArrowRight}')
    expect(focusedLabel()).toBe('type de id')
    await user.keyboard('{ArrowDown}')
    expect(focusedLabel()).toBe('type de nombre')
    await user.keyboard('{ArrowLeft}')
    expect(focusedLabel()).toBe('name de nombre')
    await user.keyboard('{ArrowUp}')
    expect(focusedLabel()).toBe('name de id')
  })

  it('el foco se detiene en los bordes', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    await user.tab()
    await user.keyboard('{ArrowUp}{ArrowLeft}')
    expect(focusedLabel()).toBe('name de id')

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(focusedLabel()).toBe('name de importe')
  })

  it('Inicio y Fin van a los extremos de la fila', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    await user.tab()
    await user.keyboard('{End}')
    expect(focusedLabel()).toBe('length de id')
    await user.keyboard('{Home}')
    expect(focusedLabel()).toBe('name de id')
  })

  it('el tabulador sale de la rejilla en una pulsación', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    await user.tab()
    await user.keyboard('{ArrowRight}{ArrowDown}')
    expect(focusedLabel()).toBe('type de nombre')

    await user.tab()
    expect(document.activeElement?.textContent).toBe('después')
  })

  it('al volver con el tabulador, el foco vuelve a la última celda', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    await user.tab()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(focusedLabel()).toBe('name de importe')

    await user.tab()
    await user.tab({ shift: true })
    expect(focusedLabel()).toBe('name de importe')
  })

  it('Intro activa la celda y Esc cancela', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    const onCancel = vi.fn()
    render(<Harness onActivate={onActivate} onCancel={onCancel} />)

    await user.tab()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(onActivate).toHaveBeenCalledWith({ row: 'id', column: 'name' })

    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('el foco salta las celdas que el tipo no admite', async () => {
    const user = userEvent.setup()
    render(<Harness withDisabled />)

    await user.tab()
    await user.tab()
    // `length` no aplica a `id` ni a `nombre`: Fin se queda en `type`.
    await user.keyboard('{End}')
    expect(focusedLabel()).toBe('type de id')

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}')
    expect(focusedLabel()).toBe('length de importe')
  })
})
