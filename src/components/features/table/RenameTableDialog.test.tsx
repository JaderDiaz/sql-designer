import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  INVALID_NAME_MESSAGE,
  RenameTableDialog,
  takenNameMessage,
} from '@/components/features/table/RenameTableDialog'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas del diálogo de renombrar una tabla (FR-037, RS-03).
 *
 * Lo que se comprueba es el nombre técnico a la vista y lo que detiene el
 * cambio: un nombre vacío, mal formado o ya usado por otra tabla.
 */

/** Modelo de ejemplo con tablas en tres esquemas. */
function threeSchemas(): Model {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Abre el diálogo sobre una tabla del ejemplo. */
function renderOpen(table = 'facturas') {
  resetStore()
  const model = threeSchemas()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openRenameTableDialog(table)
  })
  return render(<RenameTableDialog />)
}

/** El campo por su etiqueta visible. */
function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement
}

/** El botón «Renombrar». */
function renameButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Renombrar' }) as HTMLButtonElement
}

/** La tabla con ese nombre del modelo abierto. */
function tableNamed(name: string) {
  return (useAppStore.getState().model?.tables ?? []).find((table) => table.name === name)
}

describe('RenameTableDialog', () => {
  beforeEach(() => renderOpen())

  it('nace con el nombre que la tabla tiene ahora (FR-037)', () => {
    expect(field('Nombre').value).toBe('facturas')
    expect(renameButton()).toBeDisabled()
  })

  it('enseña el nombre técnico que se guardará (FR-037)', async () => {
    await userEvent.clear(field('Nombre'))
    await userEvent.type(field('Nombre'), 'Facturas emitidas')

    expect(screen.getByText('Se guardará como `facturas_emitidas`.')).toBeInTheDocument()
  })

  it('no renombra a un nombre que ya existe (RS-03)', async () => {
    await userEvent.clear(field('Nombre'))
    await userEvent.type(field('Nombre'), 'productos')

    expect(screen.getByText(takenNameMessage('productos'))).toBeInTheDocument()
    expect(renameButton()).toBeDisabled()
  })

  it('no renombra a un nombre mal formado (RS-03)', async () => {
    await userEvent.clear(field('Nombre'))
    await userEvent.type(field('Nombre'), '2026 facturas')

    expect(screen.getByText(INVALID_NAME_MESSAGE)).toBeInTheDocument()
    expect(renameButton()).toBeDisabled()
  })

  it('renombrar aplica el nombre y cierra el diálogo (FR-037)', async () => {
    await userEvent.clear(field('Nombre'))
    await userEvent.type(field('Nombre'), 'Facturas emitidas')
    await userEvent.click(renameButton())

    expect(tableNamed('facturas_emitidas')).toBeDefined()
    expect(tableNamed('facturas')).toBeUndefined()
    expect(useAppStore.getState().dialog).toBeNull()
  })

  it('cerrar el diálogo deja el modelo como estaba (FR-037)', async () => {
    await userEvent.clear(field('Nombre'))
    await userEvent.type(field('Nombre'), 'Otra cosa')
    await userEvent.keyboard('{Escape}')

    expect(tableNamed('facturas')).toBeDefined()
    expect(useAppStore.getState().isDirty).toBe(false)
    expect(useAppStore.getState().dialog).toBeNull()
  })
})
