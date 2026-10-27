import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DeleteSchemaDialog } from '@/components/features/schema/DeleteSchemaDialog'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la confirmación de eliminar un esquema (FR-034, FR-036).
 *
 * Lo que se protege: que el interruptor arranque apagado, que el destino
 * propuesto sea el primer esquema distinto del que se elimina, que con un solo
 * destino posible se nombre en lugar de ofrecer un selector de una opción, y
 * que el texto diga cuántas tablas quedan afectadas.
 */

/** Modelo de ejemplo con tablas en tres esquemas y un cuarto vacío. */
function threeSchemas(): Model {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

/** Abre la confirmación sobre ese esquema del modelo que se diga. */
function renderOpen(name: string, model: Model = threeSchemas()) {
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openDeleteSchemaDialog(name)
  })
  return render(<DeleteSchemaDialog />)
}

/** El modelo con solo dos esquemas, para el caso sin selector. */
function twoSchemas(): Model {
  const model = threeSchemas()
  return {
    ...model,
    schemas: model.schemas.filter((schema) => ['ventas', 'inventario'].includes(schema.name)),
    tables: (model.tables ?? []).filter((table) => table.schema !== 'personas'),
  }
}

describe('DeleteSchemaDialog con tres esquemas o más', () => {
  it('pregunta por el esquema y dice cuántas tablas quedan afectadas (FR-034)', () => {
    renderOpen('ventas')

    expect(screen.getByRole('heading', { name: '¿Eliminar «ventas»?' })).toBeInTheDocument()
    expect(screen.getByText(/Este esquema tiene 2 tablas/)).toBeInTheDocument()
  })

  it('el interruptor arranca apagado y nombra las tablas (FR-034)', () => {
    renderOpen('ventas')

    const toggle = screen.getByRole('switch', { name: /Eliminar también sus 2 tablas/ })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('ofrece el selector de destino y propone el primer otro esquema (FR-036)', () => {
    renderOpen('ventas')

    expect(screen.getByRole('combobox', { name: 'Esquema de destino' })).toHaveTextContent(
      'INV · inventario',
    )
  })

  it('encender el interruptor quita el destino y cambia el botón (FR-036)', async () => {
    renderOpen('ventas')

    await userEvent.click(screen.getByRole('switch'))

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar esquema y tablas' })).toBeInTheDocument()
  })

  it('dice que los enums y las vistas también se mueven (US6 esc. 8)', () => {
    renderOpen('ventas')

    expect(screen.getByText(/También se mueven su enum y su vista/)).toBeInTheDocument()
  })

  it('confirmar mueve las tablas al destino propuesto y cierra (FR-036)', async () => {
    renderOpen('ventas')

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar esquema' }))

    const model = useAppStore.getState().model
    expect(model?.schemas.some((schema) => schema.name === 'ventas')).toBe(false)
    expect(model?.tables?.filter((table) => table.schema === 'inventario')).toHaveLength(3)
    expect(useAppStore.getState().dialog).toBeNull()
  })

  it('confirmar con el interruptor encendido se lleva las tablas (FR-036)', async () => {
    renderOpen('ventas')

    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar esquema y tablas' }))

    const model = useAppStore.getState().model
    expect(model?.tables?.map((table) => table.name)).toEqual(['productos', 'clientes'])
    expect(model?.relations ?? []).toHaveLength(0)
  })

  it('cancelar no toca el modelo', async () => {
    renderOpen('ventas')

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(useAppStore.getState().model?.schemas).toHaveLength(4)
    expect(useAppStore.getState().isDirty).toBe(false)
  })

  it('un esquema sin tablas no ofrece interruptor y lo dice (FR-034)', () => {
    renderOpen('reportes')

    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText(/no tiene tablas/)).toBeInTheDocument()
  })
})

describe('DeleteSchemaDialog con dos esquemas', () => {
  it('nombra el único destino posible en lugar de ofrecer un selector (FR-036)', () => {
    renderOpen('ventas', twoSchemas())

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText(/el único que queda/)).toBeInTheDocument()
  })

  it('confirmar mueve todo al que queda', async () => {
    renderOpen('ventas', twoSchemas())

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar esquema' }))

    const model = useAppStore.getState().model
    expect(model?.schemas.map((schema) => schema.name)).toEqual(['inventario'])
    expect(model?.tables?.every((table) => table.schema === 'inventario')).toBe(true)
  })
})

describe('DeleteSchemaDialog con un solo esquema', () => {
  /** El modelo con un único esquema, que sigue teniendo sus tablas. */
  function oneSchema(): Model {
    const model = threeSchemas()
    return {
      ...model,
      schemas: model.schemas.filter((schema) => schema.name === 'ventas'),
      tables: (model.tables ?? []).filter((table) => table.schema === 'ventas'),
      enums: [],
      views: [],
    }
  }

  it('no ofrece interruptor ni destino: las tablas se van con él (FR-035)', () => {
    renderOpen('ventas', oneSchema())

    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText(/Es el único esquema del modelo/)).toBeInTheDocument()
  })

  it('confirmar deja el modelo en blanco (FR-005a, FR-035)', async () => {
    renderOpen('ventas', oneSchema())

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar esquema y tablas' }))

    const model = useAppStore.getState().model
    expect(model?.schemas).toEqual([])
    expect(model?.tables ?? []).toEqual([])
  })
})
