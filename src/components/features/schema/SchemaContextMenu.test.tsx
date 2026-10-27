import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CanvasSurface } from '@/components/features/canvas/CanvasSurface'
import { LAST_SCHEMA_LABEL } from '@/components/features/schema/SchemaContextMenu'
import { ModelSidebar } from '@/components/layout/ModelSidebar'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas del menú contextual de un esquema (FR-033, FR-035, FR-038).
 *
 * El menú es el mismo en sus dos representaciones, la fila de la barra lateral
 * y la zona del lienzo, y se abre con el botón derecho y con ⇧F10 en las dos.
 */

/** Modelo de ejemplo con tablas en tres esquemas y un cuarto vacío. */
function threeSchemas(): Model {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Deja ese modelo abierto en el Editor. */
function open(model: Model = threeSchemas()) {
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
  })
}

describe('menú contextual en la fila de la barra lateral (FR-033)', () => {
  it('se abre con el botón derecho y ofrece editar y eliminar', async () => {
    open()
    render(<ModelSidebar />)

    fireEvent.contextMenu(screen.getByRole('option', { name: 'ventas, 2 tablas' }))

    expect(await screen.findByRole('menuitem', { name: 'Editar esquema…' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Eliminar esquema…' })).toBeInTheDocument()
  })

  it('se abre también con ⇧F10 (FR-038, RS-09)', async () => {
    open()
    render(<ModelSidebar />)
    const row = screen.getByRole('option', { name: 'ventas, 2 tablas' })

    fireEvent.keyDown(row, { key: 'F10', shiftKey: true })

    expect(await screen.findByRole('menuitem', { name: 'Editar esquema…' })).toBeInTheDocument()
  })

  it('«Editar esquema…» abre el diálogo sobre ese esquema (FR-020)', async () => {
    open()
    render(<ModelSidebar />)
    fireEvent.contextMenu(screen.getByRole('option', { name: 'inventario, 1 tabla' }))

    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar esquema…' }))

    expect(useAppStore.getState().dialog).toBe('schema')
    expect(useAppStore.getState().schemaTarget).toBe('inventario')
  })

  it('«Eliminar esquema…» abre la confirmación (FR-034)', async () => {
    open()
    render(<ModelSidebar />)
    fireEvent.contextMenu(screen.getByRole('option', { name: 'ventas, 2 tablas' }))

    await userEvent.click(await screen.findByRole('menuitem', { name: 'Eliminar esquema…' }))

    expect(useAppStore.getState().dialog).toBe('delete-schema')
    expect(useAppStore.getState().schemaTarget).toBe('ventas')
  })

  it('con un solo esquema, eliminar está deshabilitado y dice por qué (FR-035, SC-009)', async () => {
    open({
      formatVersion: 1,
      name: 'Uno',
      engine: 'postgres',
      schemas: [{ name: 'public', abbreviation: 'PUB' }],
    })
    render(<ModelSidebar />)

    fireEvent.contextMenu(screen.getByRole('option', { name: 'public, sin tablas' }))

    const entry = await screen.findByRole('menuitem', { name: LAST_SCHEMA_LABEL })
    expect(entry).toHaveAttribute('data-disabled')
  })
})

describe('menú contextual en la zona del lienzo (FR-033, FR-038)', () => {
  it('se abre con el botón derecho sobre la zona', async () => {
    open()
    render(<CanvasSurface />)

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Esquema VEN · ventas,/ }))

    expect(await screen.findByRole('menuitem', { name: 'Editar esquema…' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Eliminar esquema…' })).toBeInTheDocument()
  })

  it('se abre también con ⇧F10 y selecciona el esquema', async () => {
    open()
    render(<CanvasSurface />)
    const zone = screen.getByRole('button', { name: /^Esquema PER · personas,/ })

    fireEvent.keyDown(zone, { key: 'F10', shiftKey: true })

    expect(await screen.findByRole('menuitem', { name: 'Editar esquema…' })).toBeInTheDocument()
    expect(useAppStore.getState().selectedSchema).toBe('personas')
  })
})
