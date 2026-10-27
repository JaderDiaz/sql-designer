import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  EMPTY_LABEL_MESSAGE,
  INVALID_ABBREVIATION_MESSAGE,
  SchemaDialog,
  TAKEN_ABBREVIATION_MESSAGE,
  TAKEN_TECHNICAL_MESSAGE,
} from '@/components/features/schema/SchemaDialog'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas del diálogo Nuevo esquema y Editar esquema (FR-015 a FR-021).
 *
 * Lo que se comprueba es la propuesta y lo que la detiene: el nombre técnico y
 * la abreviatura siguen al nombre legible mientras nadie los toque, y el
 * botón no guarda nada mientras algo esté repetido o mal formado.
 */

/** Abre el diálogo sobre el modelo de tres esquemas, creando o editando. */
function renderOpen(target: string | null = null) {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  act(() => {
    useAppStore.setState({
      screen: 'editor',
      model: result.model,
      savedModel: result.model,
      isDirty: false,
    })
    useAppStore.getState().openSchemaDialog(target)
  })
  return render(<SchemaDialog />)
}

/** El campo por su etiqueta visible. */
function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement
}

describe('SchemaDialog al crear', () => {
  beforeEach(() => renderOpen())

  it('se presenta como Nuevo esquema con el botón de crear', () => {
    expect(screen.getByRole('heading', { name: 'Nuevo esquema' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear esquema' })).toBeInTheDocument()
  })

  it('propone el nombre técnico y la abreviatura mientras se escribe (FR-016)', async () => {
    await userEvent.type(field('Nombre'), 'Ventas y cobros')

    expect(field('Nombre técnico').value).toBe('ventas_y_cobros')
    expect(field('Abreviatura').value).toBe('VYC')
  })

  it('deja de proponer el campo que se toca a mano y conserva lo escrito (FR-017)', async () => {
    await userEvent.type(field('Nombre'), 'Ventas')
    await userEvent.clear(field('Abreviatura'))
    await userEvent.type(field('Abreviatura'), 'VTA')
    await userEvent.type(field('Nombre'), ' y cobros')

    expect(field('Nombre técnico').value).toBe('ventas_y_cobros')
    expect(field('Abreviatura').value).toBe('VTA')
  })

  it('pone la abreviatura en mayúsculas y la corta en tres letras', async () => {
    await userEvent.type(field('Abreviatura'), 'ventas')

    expect(field('Abreviatura').value).toBe('VEN')
  })

  it('empieza sin poder crear y pide el nombre (FR-018)', () => {
    expect(screen.getByRole('button', { name: 'Crear esquema' })).toBeDisabled()
    expect(screen.getByText(EMPTY_LABEL_MESSAGE)).toBeInTheDocument()
  })

  it('no deja crear con un nombre técnico que ya existe (FR-018)', async () => {
    await userEvent.type(field('Nombre'), 'ventas')

    expect(screen.getByText(TAKEN_TECHNICAL_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear esquema' })).toBeDisabled()
  })

  it('no deja crear con una abreviatura que ya existe (FR-018)', async () => {
    await userEvent.type(field('Nombre'), 'Contabilidad')
    await userEvent.clear(field('Abreviatura'))
    await userEvent.type(field('Abreviatura'), 'VEN')

    expect(screen.getByText(TAKEN_ABBREVIATION_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear esquema' })).toBeDisabled()
  })

  it('no deja crear con una abreviatura que no son tres letras', async () => {
    await userEvent.type(field('Nombre'), 'Contabilidad')
    await userEvent.clear(field('Abreviatura'))
    await userEvent.type(field('Abreviatura'), 'CO')

    expect(screen.getByText(INVALID_ABBREVIATION_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear esquema' })).toBeDisabled()
  })

  it('escribe el esquema en el modelo con el color elegido y cierra (FR-015, FR-021)', async () => {
    await userEvent.type(field('Nombre'), 'Contabilidad')
    await userEvent.click(screen.getByRole('radio', { name: 'Teal' }))
    await userEvent.type(field('Descripción'), 'Cuentas y asientos')
    await userEvent.click(screen.getByRole('button', { name: 'Crear esquema' }))

    const { model, dialog } = useAppStore.getState()
    expect(model?.schemas.at(-1)).toEqual({
      name: 'contabilidad',
      abbreviation: 'CON',
      color: 'teal',
      comment: 'Cuentas y asientos',
    })
    expect(dialog).toBeNull()
  })

  it('la vista previa enseña la abreviatura y el nombre técnico propuestos (FR-019)', async () => {
    await userEvent.type(field('Nombre'), 'Contabilidad')

    const preview = screen.getByLabelText('Vista previa de la zona')
    expect(preview).toHaveTextContent('CON')
    expect(preview).toHaveTextContent('contabilidad')
  })
})

describe('SchemaDialog al editar', () => {
  beforeEach(() => renderOpen('ventas'))

  it('se presenta como Editar esquema con lo que ya tiene el esquema (FR-020)', () => {
    expect(screen.getByRole('heading', { name: 'Editar esquema' })).toBeInTheDocument()
    expect(field('Nombre técnico').value).toBe('ventas')
    expect(field('Abreviatura').value).toBe('VEN')
    expect(field('Descripción').value).toBe('Facturación y cobros')
    expect(screen.getByRole('radio', { name: 'Azul' })).toBeChecked()
  })

  it('su propia abreviatura no cuenta como repetida', () => {
    expect(screen.queryByText(TAKEN_ABBREVIATION_MESSAGE)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('cambiar el nombre no vuelve a proponer el nombre técnico (FR-017)', async () => {
    await userEvent.type(field('Nombre'), ' y cobros')

    expect(field('Nombre técnico').value).toBe('ventas')
  })

  it('guarda los cambios en el modelo y cierra (FR-020)', async () => {
    await userEvent.clear(field('Abreviatura'))
    await userEvent.type(field('Abreviatura'), 'FAC')
    await userEvent.click(screen.getByRole('radio', { name: 'Rojo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const schema = useAppStore.getState().model?.schemas[0]
    expect(schema?.abbreviation).toBe('FAC')
    expect(schema?.color).toBe('red')
    expect(useAppStore.getState().dialog).toBeNull()
  })

  it('no deja guardar con la abreviatura de otro esquema (FR-018)', async () => {
    await userEvent.clear(field('Abreviatura'))
    await userEvent.type(field('Abreviatura'), 'INV')

    expect(screen.getByText(TAKEN_ABBREVIATION_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })
})
