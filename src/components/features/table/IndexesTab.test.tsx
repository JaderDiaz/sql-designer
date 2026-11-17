import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { IndexesTab } from '@/components/features/table/IndexesTab'
import { readFixture } from '@/lib/model/__fixtures__'
import {
  INDEX_NEEDS_COLUMN_MESSAGE,
  NO_INDEXES_MESSAGE,
  NO_RESTRICTIONS_MESSAGE,
  TAKEN_CONSTRAINT_NAME_MESSAGE,
} from '@/lib/model/indexes'
import { parseModel } from '@/lib/model/parse'
import type { Model, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la ficha «Índices» (FR-021 a FR-030, FR-044, SC-009).
 *
 * Se mira lo que la ficha enseña —los índices automáticos sin mandos, el
 * estado vacío, los mensajes de la fila— y que la rejilla se recorra con el
 * teclado como las otras dos del panel.
 */

/** El modelo de ejemplo del recorrido: `pago` sin índices propios. */
function enums(): Model {
  const result = parseModel(readFixture('modelo-enums'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  const pago = result.model.tables?.find((table) => table.name === 'pago')
  if (pago) delete pago.indexes
  return result.model
}

/** Dibuja la ficha de una tabla y la vuelve a pintar con cada cambio. */
function renderTab(name: string, model: Model = enums()) {
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openFieldsPanel(name, undefined, 'indexes')
  })
  /** La ficha con la tabla que hay ahora en el almacén. */
  function Harness() {
    const current = useAppStore((state) =>
      (state.model?.tables ?? []).find((table) => table.name === name),
    )
    return current === undefined ? null : <IndexesTab table={current} />
  }
  return render(<Harness />)
}

/** Una tabla del almacén. */
function tableOf(name: string): Table {
  const table = (useAppStore.getState().model?.tables ?? []).find((item) => item.name === name)
  if (table === undefined) throw new Error(`no hay tabla ${name}`)
  return table
}

describe('IndexesTab', () => {
  it('lista los índices de la llave y de los únicos, sin mandos (FR-021)', () => {
    renderTab('pago')

    const block = screen.getByRole('region', { name: 'Creados por restricciones' })
    expect(within(block).getByText('pk_pago')).toBeInTheDocument()
    expect(within(block).getByText('PRIMARY KEY')).toBeInTheDocument()
    expect(within(block).getByText('uq_pago_referencia')).toBeInTheDocument()
    expect(within(block).getByText('UNIQUE')).toBeInTheDocument()
    expect(within(block).queryByRole('button')).toBeNull()
  })

  it('una tabla sin llave ni únicos lo dice', () => {
    const model = enums()
    const cuota = model.tables?.find((table) => table.name === 'cuota')
    if (cuota) delete cuota.primaryKey
    renderTab('cuota', model)

    expect(screen.getByText(NO_RESTRICTIONS_MESSAGE)).toBeInTheDocument()
  })

  it('sin índices propios lo dice y explica para qué añadir uno (FR-030)', () => {
    renderTab('pago')

    expect(screen.getByText(NO_INDEXES_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByRole('grid')).toBeNull()
  })

  it('«Añadir índice» crea la fila con la clave foránea y deja el foco en su nombre', async () => {
    renderTab('pago')

    await userEvent.click(screen.getByRole('button', { name: 'Añadir índice' }))

    const grid = screen.getByRole('grid', { name: 'Índices de pago' })
    const name = within(grid).getByLabelText('Nombre del índice idx_pago_residente_id')
    expect(name).toHaveFocus()
    expect(
      within(grid).getByRole('button', { name: 'Columnas de idx_pago_residente_id: residente_id' }),
    ).toBeInTheDocument()
  })

  it('un nombre repetido se avisa en la fila y no se guarda (FR-027)', async () => {
    renderTab('pago')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir índice' }))
    const input = screen.getByLabelText('Nombre del índice idx_pago_residente_id')

    await userEvent.clear(input)
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un nombre.')
    await userEvent.type(input, 'uq_pago_referencia')

    expect(screen.getByRole('alert')).toHaveTextContent(TAKEN_CONSTRAINT_NAME_MESSAGE)
    expect(tableOf('pago').indexes?.[0]?.name).not.toBe('uq_pago_referencia')
  })

  it('quitar la única columna lo impide con su mensaje (FR-025)', async () => {
    renderTab('pago')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir índice' }))

    await userEvent.click(
      screen.getByRole('button', { name: 'Columnas de idx_pago_residente_id: residente_id' }),
    )
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'residente_id' }))

    expect(screen.getByText(INDEX_NEEDS_COLUMN_MESSAGE)).toBeInTheDocument()
    expect(tableOf('pago').indexes?.[0]?.fields).toEqual(['residente_id'])
  })

  it('avisa si repite las columnas de otro, sin impedirlo (FR-028)', () => {
    const model = enums()
    const pago = model.tables?.find((table) => table.name === 'pago')
    if (pago) pago.indexes = [{ name: 'idx_pago_id', fields: ['id'] }]
    renderTab('pago', model)

    expect(screen.getByText('Repite las columnas de pk_pago.')).toBeInTheDocument()
  })

  it('la casilla marca el índice como único (FR-029)', async () => {
    renderTab('pago')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir índice' }))

    await userEvent.click(screen.getByLabelText('Índice único idx_pago_residente_id'))

    expect(tableOf('pago').indexes?.[0]?.unique).toBe(true)
  })

  it('la rejilla tiene una sola parada de tabulador y se recorre con las flechas (FR-044)', async () => {
    const model = enums()
    const pago = model.tables?.find((table) => table.name === 'pago')
    if (pago) {
      pago.indexes = [
        { name: 'idx_a', fields: ['mes'] },
        { name: 'idx_b', fields: ['cuota_id'] },
      ]
    }
    renderTab('pago', model)

    const grid = screen.getByRole('grid', { name: 'Índices de pago' })
    const stops = [...grid.querySelectorAll('input, button')].filter(
      (node) => node.getAttribute('tabindex') === '0',
    )
    expect(stops).toHaveLength(1)

    screen.getByLabelText('Nombre del índice idx_a').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByLabelText('Nombre del índice idx_b')).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Columnas de idx_b: cuota_id' })).toHaveFocus()
  })
})
