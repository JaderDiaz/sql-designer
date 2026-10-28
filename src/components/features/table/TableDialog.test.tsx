import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  EMPTY_NAME_MESSAGE,
  INVALID_NAME_MESSAGE,
  NO_SCHEMA_MESSAGE,
  TableDialog,
  takenNameMessage,
} from '@/components/features/table/TableDialog'
import { readFixture } from '@/lib/model/__fixtures__'
import { emptyModel } from '@/lib/model/defaults'
import { parseModel } from '@/lib/model/parse'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas del diálogo Nueva tabla (FR-002 a FR-009).
 *
 * Lo que se comprueba es la propuesta y lo que la detiene: el nombre técnico
 * sigue al legible mientras nadie lo toque, el botón no crea nada mientras el
 * nombre esté vacío, mal formado o repetido, y la vista previa enseña los
 * campos que las dos casillas añaden.
 */

/** Modelo de ejemplo con tablas en tres esquemas y un cuarto vacío. */
function threeSchemas(): Model {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Abre el diálogo sobre ese modelo. */
function renderOpen(model: Model = threeSchemas()) {
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openTableDialog()
  })
  return render(<TableDialog />)
}

/** El campo por su etiqueta visible. */
function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement
}

/** El botón «Crear tabla». */
function createButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Crear tabla' }) as HTMLButtonElement
}

describe('TableDialog', () => {
  beforeEach(() => renderOpen())

  it('se presenta como Nueva tabla con el botón de crear', () => {
    expect(screen.getByRole('heading', { name: 'Nueva tabla' })).toBeInTheDocument()
    expect(createButton()).toBeInTheDocument()
  })

  it('propone el nombre técnico mientras se escribe (FR-003)', async () => {
    await userEvent.type(field('Nombre'), 'Pagos pendientes')

    expect(field('Nombre técnico').value).toBe('pagos_pendientes')
  })

  it('deja de seguir al nombre en cuanto se corrige a mano (FR-003)', async () => {
    await userEvent.type(field('Nombre'), 'Pagos pendientes')
    await userEvent.clear(field('Nombre técnico'))
    await userEvent.type(field('Nombre técnico'), 'pagos')
    await userEvent.type(field('Nombre'), ' del mes')

    expect(field('Nombre técnico').value).toBe('pagos')
  })

  it('no crea nada sin nombre, y lo dice (FR-004)', async () => {
    await userEvent.type(field('Nombre'), 'Pagos')
    await userEvent.clear(field('Nombre'))

    expect(screen.getByText(EMPTY_NAME_MESSAGE)).toBeInTheDocument()
    expect(createButton()).toBeDisabled()
  })

  it('no admite un nombre técnico que empiece por número (FR-004, RS-03)', async () => {
    await userEvent.clear(field('Nombre técnico'))
    await userEvent.type(field('Nombre técnico'), '2026_pagos')

    expect(screen.getByText(INVALID_NAME_MESSAGE)).toBeInTheDocument()
    expect(createButton()).toBeDisabled()
  })

  it('no admite un nombre que ya está en el modelo (FR-004, RS-03)', async () => {
    await userEvent.type(field('Nombre'), 'Facturas')

    expect(screen.getByText(takenNameMessage('facturas'))).toBeInTheDocument()
    expect(createButton()).toBeDisabled()
  })

  it('propone el esquema enfocado (FR-005)', async () => {
    act(() => {
      useAppStore.setState({ focusedSchema: 'inventario' })
      useAppStore.getState().openTableDialog()
    })

    expect(screen.getByRole('combobox', { name: 'Esquema de la tabla' })).toHaveTextContent(
      'INV · inventario',
    )
  })

  it('Intro en el nombre crea la tabla, y no la crea si el nombre no vale (FR-046)', async () => {
    // Confirmar sin ratón es parte de SC-009, y el envío implícito del
    // navegador no llega en la ventana de la aplicación: lo hace la hoja.
    await userEvent.type(screen.getByLabelText('Nombre'), 'Pagos pendientes{Enter}')

    expect((useAppStore.getState().model?.tables ?? []).map((table) => table.name)).toContain(
      'pagos_pendientes',
    )
  })

  it('Intro no crea nada con el nombre vacío (FR-046, FR-004)', async () => {
    const antes = (useAppStore.getState().model?.tables ?? []).length
    await userEvent.type(screen.getByLabelText('Nombre'), '{Enter}')

    expect((useAppStore.getState().model?.tables ?? []).length).toBe(antes)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('la vista previa trae `id` y la auditoría marcadas por defecto (FR-008)', () => {
    const preview = screen.getByLabelText('Vista previa de la tabla')

    expect(screen.getByRole('checkbox', { name: /Llave primaria id/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Campos de auditoría/ })).toBeChecked()
    expect(preview).toHaveTextContent('id')
    expect(preview).toHaveTextContent('created_at')
    expect(preview).toHaveTextContent('updated_at')
    expect(preview).toHaveTextContent('PK')
  })

  it('quitar las dos casillas deja la vista previa con un campo para empezar (FR-008)', async () => {
    await userEvent.click(screen.getByRole('checkbox', { name: /Llave primaria id/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Campos de auditoría/ }))

    const preview = screen.getByLabelText('Vista previa de la tabla')
    expect(preview).toHaveTextContent('Un campo para empezar')
    expect(preview).not.toHaveTextContent('created_at')
  })

  it('crear la tabla la añade al modelo y cierra el diálogo (FR-007)', async () => {
    await userEvent.type(field('Nombre'), 'Pagos pendientes')
    await userEvent.click(createButton())

    const state = useAppStore.getState()
    expect((state.model?.tables ?? []).some((table) => table.name === 'pagos_pendientes')).toBe(
      true,
    )
    expect(state.dialog).toBeNull()
    expect(state.selectedTable).toBe('pagos_pendientes')
  })
})

describe('TableDialog sin ningún esquema', () => {
  beforeEach(() => renderOpen(emptyModel('Modelo en blanco', 'postgres')))

  it('dice que primero hace falta un esquema y ofrece crearlo (FR-002)', async () => {
    expect(screen.getByRole('alert')).toHaveTextContent(NO_SCHEMA_MESSAGE)
    expect(screen.queryByRole('button', { name: 'Crear tabla' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Crear esquema…' }))

    expect(useAppStore.getState().dialog).toBe('schema')
  })
})
