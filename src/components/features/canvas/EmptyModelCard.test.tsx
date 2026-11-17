import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { EmptyModelCard } from '@/components/features/canvas/EmptyModelCard'
import { emptyModel } from '@/lib/model/defaults'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la tarjeta «Empieza a diseñar tu modelo» (FR-005).
 *
 * Desde el Incremento 5 sus tres filas actúan: «Definir un enum» deja de
 * anunciar algo futuro y abre la hoja «Nuevo enum» (FR-001).
 */

describe('EmptyModelCard', () => {
  beforeEach(() => {
    resetStore()
    const model = emptyModel('Vacío', 'postgres')
    act(() => useAppStore.setState({ screen: 'editor', model, savedModel: model }))
    render(<EmptyModelCard />)
  })

  it('sus tres filas son botones', () => {
    expect(screen.getByRole('button', { name: /Crear la primera tabla/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agregar un esquema/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Definir un enum/ })).toBeInTheDocument()
  })

  it('«Definir un enum» abre la hoja Nuevo enum (FR-001)', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Definir un enum/ }))

    expect(useAppStore.getState().dialog).toBe('enum')
    expect(useAppStore.getState().enumTarget).toBeNull()
  })
})
