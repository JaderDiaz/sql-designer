import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { EnumDialog } from '@/components/features/enum/EnumDialog'
import { readFixture } from '@/lib/model/__fixtures__'
import {
  DUPLICATE_VALUES_MESSAGE,
  EMPTY_VALUES_MESSAGE,
  NO_SCHEMA_ENUM_MESSAGE,
  NO_USAGE_MESSAGE,
  NO_VALUES_MESSAGE,
  TAKEN_ENUM_NAME_MESSAGE,
} from '@/lib/model/enums'
import { emptyModel } from '@/lib/model/defaults'
import { parseModel } from '@/lib/model/parse'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la hoja «Nuevo enum» / «Editar enum» (FR-001 a FR-013, SC-002,
 * SC-009).
 *
 * El alta se hace con el teclado, como pide SC-002: se escribe el nombre, se
 * pasa a «Nuevo valor» y cada Enter añade una fila sin confirmar la hoja.
 */

/** El modelo de ejemplo: `estado_pago` lo usan `pago.estado` y `cuota.estado`. */
function enums(): Model {
  const result = parseModel(readFixture('modelo-enums'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Abre la hoja sobre ese modelo, nueva o editando un enum. */
function renderOpen(model: Model = enums(), target: string | null = null) {
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openEnumDialog(target)
  })
  return render(<EnumDialog />)
}

/** El modelo del almacén. */
function current(): Model {
  const { model } = useAppStore.getState()
  if (model === null) throw new Error('no hay modelo')
  return model
}

/** Escribe valores en «Nuevo valor», cada uno con Enter. */
async function addValues(...values: string[]) {
  for (const value of values) {
    await userEvent.type(screen.getByLabelText('Nuevo valor'), `${value}{Enter}`)
  }
}

describe('EnumDialog · nuevo (US1)', () => {
  it('se presenta como Nuevo enum con el foco en el nombre (FR-001)', () => {
    renderOpen()

    expect(screen.getByRole('heading', { name: 'Nuevo enum' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
  })

  it('crea un enum de cuatro valores solo con el teclado (SC-002)', async () => {
    renderOpen()

    await userEvent.type(screen.getByLabelText('Nombre'), 'Canal Aviso')
    expect(screen.getByText('Se guardará como canal_aviso')).toBeInTheDocument()
    await addValues('correo', 'sms', 'app', 'carta')

    // Enter en «Nuevo valor» añade y deja el foco ahí; no confirma.
    expect(screen.getByLabelText('Nuevo valor')).toHaveFocus()
    expect(useAppStore.getState().dialog).toBe('enum')
    expect(screen.getByText('4 valores')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Valor 1'), '{Enter}')

    const created = current().enums?.find((item) => item.name === 'canal_aviso')
    expect(created).toEqual({
      name: 'canal_aviso',
      schema: 'personas',
      values: ['correo', 'sms', 'app', 'carta'],
    })
    expect(useAppStore.getState().dialog).toBeNull()
  })

  it('subir, bajar y quitar mueven y quitan filas (FR-002)', async () => {
    renderOpen()
    await userEvent.type(screen.getByLabelText('Nombre'), 'orden')
    await addValues('a', 'b', 'c')

    await userEvent.click(screen.getAllByRole('button', { name: 'Bajar' })[0] as HTMLElement)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar c' }))

    expect((screen.getByLabelText('Valor 1') as HTMLInputElement).value).toBe('b')
    expect((screen.getByLabelText('Valor 2') as HTMLInputElement).value).toBe('a')
    expect(screen.queryByLabelText('Valor 3')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Subir' })[0]).toBeDisabled()
  })

  it('un nombre repetido o de un tipo del motor apaga el botón (FR-005)', async () => {
    renderOpen()

    await userEvent.type(screen.getByLabelText('Nombre'), 'estado_pago')
    expect(screen.getByText(TAKEN_ENUM_NAME_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear enum' })).toBeDisabled()

    await userEvent.clear(screen.getByLabelText('Nombre'))
    await userEvent.type(screen.getByLabelText('Nombre'), 'integer')
    expect(screen.getByText(TAKEN_ENUM_NAME_MESSAGE)).toBeInTheDocument()
  })

  it('valores repetidos o vacíos se marcan y no dejan guardar (FR-007)', async () => {
    renderOpen()
    await userEvent.type(screen.getByLabelText('Nombre'), 'canal')
    await addValues('sms', 'SMS ')

    expect(screen.getByText(DUPLICATE_VALUES_MESSAGE)).toBeInTheDocument()
    expect(screen.getByText('Repetido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear enum' })).toBeDisabled()

    await userEvent.clear(screen.getByLabelText('Valor 2'))
    expect(screen.getByText(EMPTY_VALUES_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear enum' })).toBeDisabled()
  })

  it('sin valores, intentar crear lo dice y no crea nada (FR-006)', async () => {
    renderOpen()
    const before = current()

    await userEvent.type(screen.getByLabelText('Nombre'), 'canal{Enter}')

    expect(screen.getByText(NO_VALUES_MESSAGE)).toBeInTheDocument()
    expect(current()).toBe(before)
  })

  it('las comillas simples no entran en un valor (FR-007)', async () => {
    renderOpen()
    await addValues("o'neil")

    expect((screen.getByLabelText('Valor 1') as HTMLInputElement).value).toBe('oneil')
  })

  it('sin esquemas lo dice y ofrece crearlo (FR-004)', async () => {
    renderOpen(emptyModel('Vacío', 'postgres'))

    expect(screen.getByText(NO_SCHEMA_ENUM_MESSAGE)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo esquema' }))
    expect(useAppStore.getState().dialog).toBe('schema')
  })

  it('cancelar y Escape no cambian el modelo (FR-009)', async () => {
    renderOpen()
    const before = current()
    await userEvent.type(screen.getByLabelText('Nombre'), 'canal')
    await addValues('a')

    await userEvent.keyboard('{Escape}')

    expect(useAppStore.getState().dialog).toBeNull()
    expect(current()).toBe(before)
  })
})

describe('EnumDialog · editar (US1, US2)', () => {
  it('trae el nombre, los valores y «Usado por» con sus campos (FR-013)', () => {
    renderOpen(enums(), 'estado_pago')

    expect(screen.getByRole('heading', { name: 'Editar enum' })).toBeInTheDocument()
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('estado_pago')
    expect((screen.getByLabelText('Valor 4') as HTMLInputElement).value).toBe('anulado')
    expect(screen.getByRole('button', { name: 'Abrir pago.estado en el editor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir cuota.estado en el editor' })).toBeInTheDocument()
  })

  it('pulsar un campo de «Usado por» cierra la hoja y lleva a ese campo (FR-013)', async () => {
    renderOpen(enums(), 'estado_pago')

    await userEvent.click(screen.getByRole('button', { name: 'Abrir cuota.estado en el editor' }))

    const state = useAppStore.getState()
    expect(state.dialog).toBeNull()
    expect(state.isFieldsPanelOpen).toBe(true)
    expect(state.fieldsPanelTable).toBe('cuota')
    expect(state.panelTab).toBe('fields')
    expect(state.focusedCell?.field).toBe('estado')
  })

  it('un enum sin uso lo dice', () => {
    renderOpen(enums(), 'tipo_documento')

    expect(screen.getByText(NO_USAGE_MESSAGE)).toBeInTheDocument()
  })

  it('renombrar en uso guarda y retipa los campos (FR-015)', async () => {
    renderOpen(enums(), 'estado_pago')

    await userEvent.clear(screen.getByLabelText('Nombre'))
    await userEvent.type(screen.getByLabelText('Nombre'), 'estado_cobro')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    const pago = current().tables?.find((item) => item.name === 'pago')
    expect(pago?.fields.find((item) => item.name === 'estado')?.type).toBe('estado_cobro')
  })

  it('«Eliminar enum» lleva a la confirmación (FR-020)', async () => {
    renderOpen(enums(), 'estado_pago')

    const footer = screen.getByRole('button', { name: 'Guardar' }).parentElement as HTMLElement
    await userEvent.click(within(footer).getByRole('button', { name: 'Eliminar enum' }))

    expect(useAppStore.getState().dialog).toBe('delete-enum')
    expect(useAppStore.getState().enumTarget).toBe('estado_pago')
  })
})
