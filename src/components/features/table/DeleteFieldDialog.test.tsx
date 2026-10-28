import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  alsoDeletedMessage,
  DeleteFieldDialog,
  LAST_FIELD_MESSAGE,
} from '@/components/features/table/DeleteFieldDialog'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la confirmación de eliminar un campo (FR-019, FR-020, FR-037).
 *
 * Con relaciones de verdad en el modelo, el diálogo tiene que nombrar las que
 * se van con el campo y llevárselas en el mismo paso deshacible: eso es lo que
 * el Incremento 4 añade a lo que ya hacía el 3.
 */

/** El modelo de relaciones del incremento. */
function relations(): Model {
  const result = parseModel(readFixture('modelo-relaciones'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Abre la confirmación sobre un campo del ejemplo. */
function renderOpen(table: string, field: string, model: Model = relations()) {
  // Las pruebas que miran otro campo vuelven a llamar aquí: el árbol anterior
  // se suelta antes de pintar el nuevo.
  cleanup()
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openDeleteFieldDialog({ table, field })
  })
  return render(<DeleteFieldDialog />)
}

/** Las relaciones del modelo abierto, por nombre. */
function relationNames(): string[] {
  return (useAppStore.getState().model?.relations ?? []).map((relation) => relation.name)
}

describe('DeleteFieldDialog', () => {
  beforeEach(() => renderOpen('pagos', 'pedido_id'))

  it('el título nombra el campo', () => {
    expect(screen.getByRole('heading', { name: '¿Eliminar «pedido_id»?' })).toBeInTheDocument()
  })

  it('nombra la relación que se va con el campo (FR-019, FR-037)', () => {
    expect(screen.getByText(alsoDeletedMessage('fk_pagos_pedido_id'))).toBeInTheDocument()
  })

  it('confirmar se lleva el campo y su relación en un paso (FR-037)', async () => {
    const before = useAppStore.getState().past.length

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar campo' }))

    const state = useAppStore.getState()
    const pagos = (state.model?.tables ?? []).find((table) => table.name === 'pagos')
    expect(pagos?.fields.map((field) => field.name)).not.toContain('pedido_id')
    expect(relationNames()).not.toContain('fk_pagos_pedido_id')
    expect(state.past.length).toBe(before + 1)

    act(() => {
      useAppStore.getState().undo()
    })
    expect(relationNames()).toContain('fk_pagos_pedido_id')
  })

  it('el campo referenciado se lleva también la relación que apunta a él (FR-037)', () => {
    // `clientes.id` es el destino de tres relaciones del ejemplo.
    renderOpen('clientes', 'id')

    expect(screen.getByText(alsoDeletedMessage('fk_pedidos_cliente_id'))).toBeInTheDocument()
    expect(screen.getByText(alsoDeletedMessage('fk_clientes_recomendado_por'))).toBeInTheDocument()
  })

  it('el campo sin relaciones solo se quita de su tabla (FR-019)', () => {
    renderOpen('pagos', 'importe')

    expect(
      screen.getByText('Este campo se quita de la tabla pagos y del lienzo.'),
    ).toBeInTheDocument()
  })

  it('el último campo de una tabla no se elimina (FR-020)', () => {
    const model = relations()
    model.tables = (model.tables ?? []).map((table) =>
      table.name === 'metodos_pago' ? { ...table, fields: [table.fields[0] as never] } : table,
    )
    model.relations = (model.relations ?? []).filter(
      (relation) => relation.toTable !== 'metodos_pago',
    )

    renderOpen('metodos_pago', 'id', model)

    expect(screen.getByRole('alert')).toHaveTextContent(LAST_FIELD_MESSAGE)
    expect(screen.getByRole('button', { name: 'Eliminar campo' })).toBeDisabled()
  })
})
