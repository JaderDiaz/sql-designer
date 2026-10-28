import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { DeleteTableDialog, relationsLabel } from '@/components/features/table/DeleteTableDialog'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la confirmación de eliminar una tabla (FR-039, RS-08).
 *
 * Antes de eliminar se dice qué se lleva por delante: las relaciones que
 * tocaban a la tabla se van con ella, y en el mismo paso de historial.
 */

/** Modelo de ejemplo con seis tablas y seis relaciones. */
function postgres(): Model {
  const result = parseModel(readFixture('modelo-postgres'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Abre la confirmación sobre una tabla del ejemplo. */
function renderOpen(table: string, model: Model = postgres()) {
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openDeleteTableDialog(table)
  })
  return render(<DeleteTableDialog />)
}

/** Las tablas del modelo abierto, por nombre. */
function tableNames(): string[] {
  return (useAppStore.getState().model?.tables ?? []).map((table) => table.name)
}

describe('DeleteTableDialog', () => {
  beforeEach(() => renderOpen('reservas'))

  it('el título nombra la tabla (§5)', () => {
    expect(screen.getByRole('heading', { name: '¿Eliminar «reservas»?' })).toBeInTheDocument()
  })

  it('dice cuántas relaciones se eliminan y las nombra (FR-039)', () => {
    // `reservas` la tocan cuatro relaciones del ejemplo.
    expect(screen.getByText(`Se eliminarán también sus ${relationsLabel(4)}.`)).toBeInTheDocument()
    expect(screen.getByText('pagos_reserva_fk')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar tabla y relaciones' })).toBeInTheDocument()
  })

  it('cancelar no cambia el modelo (FR-039)', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(tableNames()).toContain('reservas')
    expect(useAppStore.getState().isDirty).toBe(false)
    expect(useAppStore.getState().dialog).toBeNull()
  })

  it('confirmar elimina la tabla y sus relaciones en un paso (FR-039, RS-08)', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar tabla y relaciones' }))

    const state = useAppStore.getState()
    expect(tableNames()).not.toContain('reservas')
    expect((state.model?.relations ?? []).map((relation) => relation.name)).toEqual([
      'habitaciones_hotel_fk',
      'resenas_cliente_fk',
    ])
    expect(state.past).toHaveLength(1)
  })

})

describe('DeleteTableDialog de una tabla sin relaciones', () => {
  it('lo dice y ofrece eliminar solo la tabla (FR-039)', () => {
    const alone: Model = { ...postgres() }
    delete alone.relations
    renderOpen('resenas', alone)

    expect(screen.getByText('Esta tabla tiene 5 campos y ninguna relación.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar tabla' })).toBeInTheDocument()
  })
})
