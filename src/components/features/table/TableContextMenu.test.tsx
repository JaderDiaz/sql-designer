import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CanvasSurface } from '@/components/features/canvas/CanvasSurface'
import { NO_OTHER_SCHEMA } from '@/components/features/table/TableContextMenu'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { addForeignKeyNotice } from '@/store/relations'
import { MACOS, resetStore } from '@/test/helpers'

/**
 * Pruebas del menú contextual de una tabla (FR-035, FR-036, FR-046).
 *
 * El menú se abre con el botón derecho y con ⇧F10 sobre la tarjeta, y lo que
 * ofrece en este incremento es editar sus campos y moverla de esquema.
 */

/** Modelo de ejemplo con tablas en tres esquemas y un cuarto vacío. */
function threeSchemas(): Model {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Deja ese modelo abierto en el Editor y dibuja el lienzo. */
function open(model: Model = threeSchemas()) {
  resetStore({ platform: MACOS })
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
  })
  render(<CanvasSurface />)
}

/** La tarjeta de `facturas`. */
function card(): HTMLElement {
  return screen.getByRole('button', { name: /^Tabla facturas,/ })
}

describe('TableContextMenu', () => {
  it('se abre con el botón derecho y ofrece editar campos y mover (FR-036)', async () => {
    open()

    fireEvent.contextMenu(card())

    expect(await screen.findByRole('menuitem', { name: /^Editar campos…/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Mover a esquema' })).toBeInTheDocument()
  })

  it('se abre también con ⇧F10 (RS-09)', async () => {
    open()
    const target = card()
    target.focus()

    await userEvent.keyboard('{Shift>}{F10}{/Shift}')

    expect(await screen.findByRole('menuitem', { name: /^Editar campos…/ })).toBeInTheDocument()
  })

  it('muestra el atajo con el modificador del sistema (FR-046)', async () => {
    open()

    fireEvent.contextMenu(card())

    expect(await screen.findByRole('menuitem', { name: /^Editar campos…/ })).toHaveTextContent('⌥⌘E')
  })

  it('«Editar campos…» abre el panel sobre esa tabla (FR-023)', async () => {
    open()
    fireEvent.contextMenu(card())

    await userEvent.click(await screen.findByRole('menuitem', { name: /^Editar campos…/ }))

    const state = useAppStore.getState()
    expect(state.isFieldsPanelOpen).toBe(true)
    expect(state.fieldsPanelTable).toBe('facturas')
  })

  it('«Mover a esquema» lista los demás esquemas con su abreviatura (FR-035)', async () => {
    open()
    fireEvent.contextMenu(card())

    await userEvent.click(await screen.findByRole('menuitem', { name: 'Mover a esquema' }))

    expect(await screen.findByRole('menuitem', { name: 'INV · inventario' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'PER · personas' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'REP · reportes' })).toBeInTheDocument()
    // El suyo no se ofrece: moverla a su esquema no es un cambio.
    expect(screen.queryByRole('menuitem', { name: /ventas$/ })).not.toBeInTheDocument()
  })

  it('elegir un esquema mueve la tabla a su zona (FR-035)', async () => {
    open()
    fireEvent.contextMenu(card())
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Mover a esquema' }))

    await userEvent.click(await screen.findByRole('menuitem', { name: 'PER · personas' }))

    const table = (useAppStore.getState().model?.tables ?? []).find(
      (item) => item.name === 'facturas',
    )
    expect(table?.schema).toBe('personas')
  })

  it('con un solo esquema, mover queda apagado y lo dice', async () => {
    const model = threeSchemas()
    open({
      ...model,
      schemas: model.schemas.slice(0, 1),
      tables: (model.tables ?? []).filter((table) => table.schema === 'ventas'),
      relations: (model.relations ?? []).filter((relation) => relation.name === 'pagos_factura_fk'),
    })

    fireEvent.contextMenu(card())

    const item = await screen.findByRole('menuitem', { name: 'Mover a esquema' })
    expect(item).toHaveAttribute('data-disabled')
    expect(NO_OTHER_SCHEMA).toBe('Este modelo solo tiene un esquema')
  })

  it('«Nueva clave foránea…» abre la ficha con esa tabla (FR-001)', async () => {
    open()

    fireEvent.contextMenu(card())
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /^Nueva clave foránea…/ }),
    )

    const state = useAppStore.getState()
    expect(state.isFieldsPanelOpen).toBe(true)
    expect(state.fieldsPanelTable).toBe('facturas')
    expect(state.panelTab).toBe('foreignKeys')
    expect(state.notice).toBe(addForeignKeyNotice('facturas'))
  })

  it('abrir el menú selecciona la tabla, para que el inspector la mire (FR-007a)', async () => {
    open()

    fireEvent.contextMenu(card())
    await screen.findByRole('menuitem', { name: /^Editar campos…/ })

    expect(useAppStore.getState().selectedTable).toBe('facturas')
  })
})
