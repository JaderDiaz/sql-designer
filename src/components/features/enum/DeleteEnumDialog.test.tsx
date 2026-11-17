import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DeleteEnumDialog } from '@/components/features/enum/DeleteEnumDialog'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Engine, Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la confirmación de eliminar un enum (FR-016 a FR-018, SC-004).
 *
 * La descripción nombra exactamente los campos que lo usan y el tipo al que
 * pasarán, que depende del motor del modelo.
 */

/** El modelo de ejemplo, con el motor que se pida. */
function enums(engine: Engine = 'postgres'): Model {
  const result = parseModel(readFixture('modelo-enums'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return { ...result.model, engine }
}

/** Abre la confirmación sobre un enum. */
function renderOpen(name: string, model: Model = enums()) {
  resetStore()
  act(() => {
    useAppStore.setState({ screen: 'editor', model, savedModel: model, isDirty: false })
    useAppStore.getState().openDeleteEnumDialog(name)
  })
  return render(<DeleteEnumDialog />)
}

describe('DeleteEnumDialog', () => {
  it('nombra los dos campos y el tipo al que pasan', () => {
    renderOpen('estado_pago')

    expect(screen.getByRole('heading', { name: '¿Eliminar el enum «estado_pago»?' })).toBeInTheDocument()
    expect(
      screen.getByText('2 campos lo usan (pago.estado, cuota.estado) y pasarán a varchar(40).'),
    ).toBeInTheDocument()
  })

  it('con un solo campo habla en singular', () => {
    const model = enums()
    const cuota = model.tables?.find((item) => item.name === 'cuota')
    if (cuota) cuota.fields = cuota.fields.filter((item) => item.name !== 'estado')
    renderOpen('estado_pago', model)

    expect(screen.getByText('1 campo lo usa (pago.estado) y pasará a varchar(40).')).toBeInTheDocument()
  })

  it('con SQLite dice text', () => {
    renderOpen('estado_pago', enums('sqlite'))

    expect(screen.getByText(/y pasarán a text\.$/)).toBeInTheDocument()
  })

  it('sin uso lo dice', () => {
    renderOpen('tipo_documento')

    expect(screen.getByText('Ningún campo lo usa.')).toBeInTheDocument()
  })

  it('«Cancelar» no cambia nada y «Eliminar enum» lo quita', async () => {
    renderOpen('estado_pago')
    const before = useAppStore.getState().model

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(useAppStore.getState().model).toBe(before)

    act(() => useAppStore.getState().openDeleteEnumDialog('estado_pago'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar enum' }))
    expect(useAppStore.getState().model?.enums?.some((item) => item.name === 'estado_pago')).toBe(false)
  })
})
