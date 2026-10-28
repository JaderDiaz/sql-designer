import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  REFERENCED_BY_LABEL,
  ReferencedByList,
} from '@/components/features/table/ReferencedByList'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model, Table } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de «Referenciada por» (FR-031, FR-032).
 *
 * Es la vuelta de la relación: lo que se afirma es que lista quién apunta a la
 * tabla abierta, con el esquema de cada uno, que lleva allí al pulsarla y que
 * calla cuando no hay nadie.
 */

/** El modelo de ejemplo del incremento. */
function relations(): Model {
  const result = parseModel(readFixture('modelo-relaciones'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Dibuja la sección de una tabla del ejemplo. */
function renderList(name: string) {
  const model = relations()
  const table = (model.tables ?? []).find((item) => item.name === name) as Table
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
  })
  return render(<ReferencedByList table={table} />)
}

describe('ReferencedByList', () => {
  beforeEach(() => resetStore())

  it('lista cada tabla que la referencia con su esquema y su columna (FR-031)', () => {
    renderList('clientes')

    const section = screen.getByRole('region', { name: REFERENCED_BY_LABEL })
    const chips = screen.getAllByRole('button').map((chip) => chip.textContent)

    expect(section).toBeInTheDocument()
    // `pedidos` es de `ventas`, con abreviatura VEN.
    expect(chips).toEqual(['VENpedidos.cliente_id', 'VENpedidos.responsable_id'])
  })

  it('pulsar una entrada lleva a esa tabla (FR-031)', async () => {
    renderList('clientes')

    await userEvent.click(screen.getByRole('button', { name: /pedidos\.cliente_id/ }))

    const state = useAppStore.getState()
    expect(state.selectedTable).toBe('pedidos')
    expect(state.fieldsPanelTable).toBe('pedidos')
    expect(state.panelTab).toBe('foreignKeys')
  })

  it('una relación hacia la propia tabla no se lista aquí (FR-031)', () => {
    // `clientes` se referencia a sí misma con `recomendado_por`: eso ya está
    // arriba, en su propia fila de la rejilla.
    renderList('clientes')

    expect(screen.queryByRole('button', { name: /clientes\./ })).toBeNull()
  })

  it('sin nadie que la referencie, no dibuja nada (FR-032)', () => {
    const { container } = renderList('comentarios')

    expect(container).toBeEmptyDOMElement()
  })
})
