import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { UniquesTab } from '@/components/features/table/UniquesTab'
import { readFixture } from '@/lib/model/__fixtures__'
import {
  NO_COMPOUND_UNIQUES_MESSAGE,
  UNIQUE_NEEDS_TWO_COLUMNS_MESSAGE,
  UNIQUE_NEEDS_TWO_FIELDS_MESSAGE,
} from '@/lib/model/indexes'
import { parseModel } from '@/lib/model/parse'
import type { Model, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la ficha «Únicos» (FR-032 a FR-038, FR-044, SC-009).
 *
 * Arriba están los únicos de un campo, que vienen de la marca UK; abajo los
 * compuestos, que nunca bajan de dos columnas.
 */

/** El modelo de ejemplo del recorrido. */
function enums(): Model {
  const result = parseModel(readFixture('modelo-enums'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Dibuja la ficha de una tabla y la vuelve a pintar con cada cambio. */
function renderTab(name: string, model: Model = enums()) {
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openFieldsPanel(name, undefined, 'uniques')
  })
  /** La ficha con la tabla que hay ahora en el almacén. */
  function Harness() {
    const current = useAppStore((state) =>
      (state.model?.tables ?? []).find((table) => table.name === name),
    )
    return current === undefined ? null : <UniquesTab table={current} />
  }
  return render(<Harness />)
}

/** Una tabla del almacén. */
function tableOf(name: string): Table {
  const table = (useAppStore.getState().model?.tables ?? []).find((item) => item.name === name)
  if (table === undefined) throw new Error(`no hay tabla ${name}`)
  return table
}

describe('UniquesTab', () => {
  it('el único de un campo sale arriba, sin mandos (FR-032)', () => {
    renderTab('pago')

    const block = screen.getByRole('region', { name: 'Desde la columna Llave (UK)' })
    expect(within(block).getByText('uq_pago_referencia')).toBeInTheDocument()
    expect(within(block).getByText('(referencia)')).toBeInTheDocument()
    expect(within(block).queryByRole('button')).toBeNull()
  })

  it('marcar y quitar UK en «Campos» se refleja al momento (FR-038)', () => {
    renderTab('pago')

    act(() => useAppStore.getState().setFieldKey('pago', 'referencia', null))
    expect(screen.queryByText('uq_pago_referencia')).toBeNull()

    act(() => useAppStore.getState().setFieldKey('pago', 'mes', 'UK'))
    expect(screen.getByText('(mes)')).toBeInTheDocument()
  })

  it('sin compuestos lo dice con un ejemplo (FR-038)', () => {
    renderTab('pago')

    expect(screen.getByText(NO_COMPOUND_UNIQUES_MESSAGE)).toBeInTheDocument()
  })

  it('«Añadir único» crea uno de dos columnas y deja el foco en su nombre (FR-033)', async () => {
    renderTab('pago')

    await userEvent.click(screen.getByRole('button', { name: 'Añadir único' }))

    expect(screen.getByLabelText('Nombre de la restricción uq_pago_referencia_residente_id')).toHaveFocus()
    expect(tableOf('pago').uniques?.at(-1)?.fields).toEqual(['referencia', 'residente_id'])
  })

  it('en una tabla de un campo no está disponible y dice por qué (FR-033)', () => {
    const model = enums()
    model.tables = [
      ...(model.tables ?? []),
      { name: 'solo', schema: 'personas', fields: [{ name: 'id', type: 'integer' }] },
    ]
    renderTab('solo', model)

    const button = screen.getByRole('button', { name: 'Añadir único' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', UNIQUE_NEEDS_TWO_FIELDS_MESSAGE)
  })

  it('dejarlo en una columna lo impide con su mensaje (FR-035)', async () => {
    renderTab('unidad')

    await userEvent.click(
      screen.getByRole('button', { name: 'Columnas de uq_unidad_torre_numero: torre, numero' }),
    )
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /^numero/ }))

    expect(screen.getByText(UNIQUE_NEEDS_TWO_COLUMNS_MESSAGE)).toBeInTheDocument()
    expect(tableOf('unidad').uniques?.[0]?.fields).toEqual(['torre', 'numero'])
  })

  it('avisa si repite las columnas de la llave o de otro único (FR-037)', () => {
    const model = enums()
    const unidad = model.tables?.find((table) => table.name === 'unidad')
    if (unidad) {
      unidad.uniques = [
        ...(unidad.uniques ?? []),
        { name: 'uq_otro', fields: ['torre', 'numero'] },
      ]
    }
    renderTab('unidad', model)

    expect(screen.getByText('Repite las columnas de uq_otro.')).toBeInTheDocument()
    expect(screen.getByText('Repite las columnas de uq_unidad_torre_numero.')).toBeInTheDocument()
  })

  it('un nombre repetido se avisa y no se guarda (FR-036)', async () => {
    renderTab('unidad')
    const input = screen.getByLabelText('Nombre de la restricción uq_unidad_torre_numero')

    await userEvent.clear(input)
    await userEvent.type(input, 'uq_residente_correo')

    // Cada letra válida se guarda; la última, que lo haría repetido, no.
    expect(screen.getByRole('alert')).toHaveTextContent('Ese nombre ya lo usa otro índice o único del modelo.')
    expect(tableOf('unidad').uniques?.[0]?.name).not.toBe('uq_residente_correo')
  })

  it('la rejilla se recorre con el teclado (FR-044)', async () => {
    renderTab('unidad')

    screen.getByLabelText('Nombre de la restricción uq_unidad_torre_numero').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(
      screen.getByRole('button', { name: 'Columnas de uq_unidad_torre_numero: torre, numero' }),
    ).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('button', { name: 'Eliminar restricción uq_unidad_torre_numero' })).toHaveFocus()
  })
})
