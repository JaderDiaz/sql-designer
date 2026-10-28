import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { ModelSidebar } from '@/components/layout/ModelSidebar'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la barra lateral (FR-002, FR-003, FR-029, FR-030).
 *
 * Lo que se protege: que las dos secciones digan lo que hay, que pulsar un
 * esquema lo enfoque, que con un esquema enfocado la lista de tablas sea la
 * de ese esquema y se diga de cuál, y que pulsar una tabla la seleccione para
 * el inspector.
 */

/** Deja el modelo de tres esquemas abierto y dibuja la barra lateral. */
function renderSidebar() {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  act(() => {
    useAppStore.setState({
      screen: 'editor',
      model: result.model,
      savedModel: result.model,
      viewport: { x: 0, y: 0, width: 800, height: 600 },
    })
  })
  return render(<ModelSidebar />)
}

/** La sección Tablas, para no confundir sus filas con las de Esquemas. */
function tablesSection(): HTMLElement {
  return screen.getByRole('region', { name: /^Tablas/ })
}

describe('ModelSidebar', () => {
  beforeEach(() => renderSidebar())

  it('lista los esquemas del modelo con su recuento (FR-002)', () => {
    const list = screen.getByRole('listbox', { name: 'Esquemas del modelo' })
    expect(within(list).getByRole('option', { name: 'ventas, 2 tablas' })).toBeInTheDocument()
    expect(within(list).getByRole('option', { name: 'reportes, sin tablas' })).toBeInTheDocument()
    expect(within(list).getByRole('option', { name: /Todos los esquemas/ })).toBeInTheDocument()
  })

  it('pulsar un esquema lo enfoca y lo selecciona (FR-003, FR-029)', async () => {
    await userEvent.click(screen.getByRole('option', { name: 'inventario, 1 tabla' }))

    expect(useAppStore.getState().focusedSchema).toBe('inventario')
    expect(useAppStore.getState().selectedSchema).toBe('inventario')
  })

  it('con un esquema enfocado la lista trae solo sus tablas (FR-030)', async () => {
    await userEvent.click(screen.getByRole('option', { name: 'ventas, 2 tablas' }))

    const tables = within(tablesSection()).getAllByRole('listitem')
    expect(tables).toHaveLength(2)
    expect(tables.map((item) => item.textContent)).toEqual([
      expect.stringContaining('facturas'),
      expect.stringContaining('pagos'),
    ])
  })

  it('el título dice de qué esquema son las tablas (FR-030)', async () => {
    expect(screen.getByRole('heading', { name: 'Tablas' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('option', { name: 'personas, 1 tabla' }))

    expect(screen.getByRole('heading', { name: 'Tablas de personas' })).toBeInTheDocument()
  })

  it('`aria-current` marca la fila del esquema enfocado (contracts/canvas.md §5)', async () => {
    expect(screen.getByRole('option', { name: /Todos los esquemas/ })).toHaveAttribute(
      'aria-current',
      'true',
    )

    await userEvent.click(screen.getByRole('option', { name: 'ventas, 2 tablas' }))

    expect(screen.getByRole('option', { name: 'ventas, 2 tablas' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('option', { name: /Todos los esquemas/ })).not.toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('un esquema vacío enfocado dice que no tiene tablas (US5 esc. 7)', async () => {
    await userEvent.click(screen.getByRole('option', { name: 'reportes, sin tablas' }))

    expect(within(tablesSection()).getByText('Este esquema aún no tiene tablas.')).toBeInTheDocument()
  })

  it('«Todos los esquemas» quita el foco y devuelve la lista entera (FR-031)', async () => {
    await userEvent.click(screen.getByRole('option', { name: 'ventas, 2 tablas' }))
    await userEvent.click(screen.getByRole('option', { name: /Todos los esquemas/ }))

    expect(useAppStore.getState().focusedSchema).toBeNull()
    expect(within(tablesSection()).getAllByRole('listitem')).toHaveLength(4)
  })

  it('el botón «+» abre el diálogo de esquema nuevo (FR-015)', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo esquema' }))

    expect(useAppStore.getState().dialog).toBe('schema')
    expect(useAppStore.getState().schemaTarget).toBeNull()
  })
})

describe('filas de tabla de la barra lateral (FR-036, FR-041)', () => {
  beforeEach(renderSidebar)

  it('pulsar una tabla la selecciona (FR-007a)', async () => {
    await userEvent.click(
      within(tablesSection()).getByRole('button', { name: /^Tabla facturas,/ }),
    )

    expect(useAppStore.getState().selectedTable).toBe('facturas')
  })

  it('su nombre accesible dice cuántos campos tiene', () => {
    expect(
      within(tablesSection()).getByRole('button', { name: 'Tabla facturas, 3 campos' }),
    ).toBeInTheDocument()
  })

  it('doble clic abre el editor de campos (FR-023)', async () => {
    await userEvent.dblClick(
      within(tablesSection()).getByRole('button', { name: /^Tabla facturas,/ }),
    )

    const state = useAppStore.getState()
    expect(state.isFieldsPanelOpen).toBe(true)
    expect(state.fieldsPanelTable).toBe('facturas')
  })

  it('su menú contextual es el mismo de la tarjeta (FR-036)', async () => {
    fireEvent.contextMenu(
      within(tablesSection()).getByRole('button', { name: /^Tabla facturas,/ }),
    )

    expect(await screen.findByRole('menuitem', { name: /^Editar campos…/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Mover a esquema' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /^Eliminar tabla…/ })).toBeInTheDocument()
  })
})
