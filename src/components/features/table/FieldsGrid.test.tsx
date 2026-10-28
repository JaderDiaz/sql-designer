import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  FieldsGrid,
  NOT_FOR_TYPE,
  SCALE_OVER_LENGTH_MESSAGE,
  unknownTypeMessage,
  usedByRelationMessage,
} from '@/components/features/table/FieldsGrid'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { repeatedFieldError } from '@/store/tables'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la rejilla del editor de campos (FR-011 a FR-021, FR-046a).
 *
 * Dos cosas se miran aquí: que la rejilla pida cada propiedad en su columna y
 * solo donde el tipo la admite, y que el teclado se mueva por ella como manda
 * el patrón de rejilla, con una sola parada de tabulador.
 */

/** Modelo de ejemplo con seis tablas y seis relaciones. */
function postgres(): Model {
  const result = parseModel(readFixture('modelo-postgres'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** La tabla del modelo abierto, para volver a pintarla tras cada cambio. */
function tableNamed(name: string): Table {
  const table = (useAppStore.getState().model?.tables ?? []).find((item) => item.name === name)
  if (table === undefined) throw new Error(`no hay tabla ${name}`)
  return table
}

/** Dibuja la rejilla de una tabla del ejemplo. */
function renderGrid(name = 'pagos') {
  resetStore()
  const model = postgres()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openFieldsPanel(name)
  })
  /** Vuelve a pintar con la tabla que hay ahora en el almacén. */
  function Harness() {
    const current = useAppStore((state) =>
      (state.model?.tables ?? []).find((table) => table.name === name),
    )
    return current === undefined ? null : <FieldsGrid table={current} />
  }
  return render(<Harness />)
}

describe('FieldsGrid', () => {
  beforeEach(() => renderGrid())

  it('pide las nueve columnas de FR-011 en su orden', () => {
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent)

    expect(headers).toEqual([
      'Llave',
      'Nombre',
      'Tipo',
      'Long.',
      'Escala',
      'No nulo',
      'Por defecto',
      'Comentario',
      'Orden',
    ])
  })

  it('se anuncia como la rejilla de su tabla (§5)', () => {
    const grid = screen.getByRole('grid', { name: 'Campos de pagos' })

    expect(grid).toHaveAttribute('aria-colcount', '9')
    expect(grid).toHaveAttribute('aria-rowcount', '5')
  })

  it('longitud y escala se deshabilitan donde el tipo no las admite (FR-015)', () => {
    // `id` es `integer`: ni longitud ni escala.
    expect(screen.getByLabelText(`Longitud de id${NOT_FOR_TYPE}`)).toBeDisabled()
    expect(screen.getByLabelText(`Escala de id${NOT_FOR_TYPE}`)).toBeDisabled()
    // `importe` es `numeric(10,2)`: las dos.
    expect(screen.getByLabelText('Longitud de importe')).toHaveValue('10')
    expect(screen.getByLabelText('Escala de importe')).toHaveValue('2')
  })

  it('una escala mayor que la longitud se avisa y no se guarda (FR-016)', async () => {
    await userEvent.clear(screen.getByLabelText('Escala de importe'))
    await userEvent.type(screen.getByLabelText('Escala de importe'), '40')

    expect(screen.getByRole('alert')).toHaveTextContent(SCALE_OVER_LENGTH_MESSAGE)
    expect(tableNamed('pagos').fields[2]?.scale).not.toBe(40)
  })

  it('un nombre repetido se avisa en la fila y no se guarda (FR-017)', async () => {
    // De una vez, no letra a letra: `i` e `id` son dos nombres distintos y el
    // primero no choca con nada.
    const cell = screen.getByLabelText('Nombre de importe')
    await userEvent.clear(cell)
    cell.focus()
    await userEvent.paste('id')

    expect(screen.getByRole('alert')).toHaveTextContent(repeatedFieldError('id'))
    expect(tableNamed('pagos').fields.map((field) => field.name)).toContain('importe')
  })

  it('el nombre se escribe en minúsculas y con guion bajo (FR-017, research R9)', async () => {
    const cell = screen.getByLabelText('Nombre de importe')
    await userEvent.clear(cell)
    await userEvent.type(cell, 'Importe Total')

    expect(tableNamed('pagos').fields.map((field) => field.name)).toContain('importe_total')
  })

  it('deshacer devuelve el nombre entero, no letra a letra (FR-024a)', async () => {
    // Cada pulsación renombra el campo de verdad, así que la clave de fusión
    // no puede llevar el nombre dentro: si lo llevara, cada letra sería un
    // paso del historial y ⌘Z devolvería «importe_tota».
    const cell = screen.getByLabelText('Nombre de importe')
    cell.focus()
    await userEvent.type(cell, '_total')
    expect(tableNamed('pagos').fields.map((field) => field.name)).toContain('importe_total')

    act(() => {
      useAppStore.getState().undo()
    })

    expect(tableNamed('pagos').fields.map((field) => field.name)).toContain('importe')
  })

  it('la llave de un campo con relación se lee y no se elige (FR-021, FR-025, §6)', () => {
    // `reserva_id` de `pagos` es el extremo `from` de `pagos_reserva_fk`.
    expect(
      screen.getByLabelText(
        `Llave de reserva_id: clave foránea. ${usedByRelationMessage('pagos_reserva_fk')}`,
      ),
    ).toHaveTextContent('FK')
    expect(screen.queryByRole('combobox', { name: /^Llave de reserva_id/ })).not.toBeInTheDocument()
  })

  it('un tipo que el motor no reconoce se avisa sin invalidar nada (FR-018a)', () => {
    renderGrid('reservas')

    expect(
      screen.getByRole('combobox', {
        name: `Tipo de estado. ${unknownTypeMessage('estado_reserva', 'postgres')}`,
      }),
    ).toBeInTheDocument()
  })

  it('un campo de la llave primaria no admite nulos (FR-026)', () => {
    expect(screen.getByLabelText(/^No nulo de id\./)).toBeDisabled()
  })

  it('solo una celda de la rejilla es parada de tabulador (FR-046a, research R7)', () => {
    const stops = screen
      .getByRole('grid', { name: 'Campos de pagos' })
      .querySelectorAll('[tabindex="0"]')

    expect(stops).toHaveLength(1)
  })

  it('las flechas mueven el foco de celda y de fila (FR-046a)', async () => {
    act(() => {
      useAppStore.getState().focusCell({ field: 'id', column: 'name' })
    })
    const grid = screen.getByRole('grid', { name: 'Campos de pagos' })

    act(() => fireEvent.keyDown(grid, { key: 'ArrowDown' }))
    expect(useAppStore.getState().focusedCell).toEqual({ field: 'reserva_id', column: 'name' })

    act(() => fireEvent.keyDown(grid, { key: 'ArrowRight' }))
    expect(useAppStore.getState().focusedCell).toEqual({ field: 'reserva_id', column: 'type' })
  })

  it('las flechas saltan las celdas que el tipo no admite (FR-015, FR-046a)', async () => {
    act(() => {
      useAppStore.getState().focusCell({ field: 'id', column: 'type' })
    })

    // De `type` a la derecha, `length` y `scale` no aplican a `integer`.
    act(() =>
      fireEvent.keyDown(screen.getByRole('grid', { name: 'Campos de pagos' }), {
        key: 'ArrowRight',
      }),
    )

    expect(useAppStore.getState().focusedCell).toEqual({ field: 'id', column: 'nullable' })
  })

  it('Inicio y Fin van a los extremos de la fila (FR-046a)', async () => {
    act(() => {
      useAppStore.getState().focusCell({ field: 'importe', column: 'type' })
    })
    const grid = screen.getByRole('grid', { name: 'Campos de pagos' })

    act(() => fireEvent.keyDown(grid, { key: 'End' }))
    expect(useAppStore.getState().focusedCell).toEqual({ field: 'importe', column: 'order' })

    act(() => fireEvent.keyDown(grid, { key: 'Home' }))
    expect(useAppStore.getState().focusedCell).toEqual({ field: 'importe', column: 'key' })
  })

  it('⌥↑ y ⌥↓ reordenan el campo en lugar de mover el foco (FR-014)', () => {
    act(() => {
      useAppStore.getState().focusCell({ field: 'importe', column: 'name' })
    })

    act(() =>
      fireEvent.keyDown(screen.getByRole('grid', { name: 'Campos de pagos' }), {
        key: 'ArrowUp',
        altKey: true,
      }),
    )

    expect(tableNamed('pagos').fields.map((field) => field.name)).toEqual([
      'id',
      'importe',
      'reserva_id',
      'pagado_el',
    ])
  })

  it('subir se deshabilita en el primero y bajar en el último (FR-014)', () => {
    expect(screen.getByRole('button', { name: 'Subir id' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar pagado_el' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar id' })).toBeEnabled()
  })

  it('eliminar un campo pide confirmación antes de tocar nada (FR-019)', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar importe' }))

    const state = useAppStore.getState()
    expect(state.dialog).toBe('delete-field')
    expect(state.deleteFieldTarget).toEqual({ table: 'pagos', field: 'importe' })
    expect(tableNamed('pagos').fields.map((field) => field.name)).toContain('importe')
  })
})
