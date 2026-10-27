import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { StatusBar } from '@/components/layout/StatusBar'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la barra de estado (FR-004).
 *
 * Dice cinco cosas, y las cinco se comprueban aquí: motor, estado del
 * archivo, esquema enfocado, contadores y zoom.
 */
describe('barra de estado', () => {
  beforeEach(() => {
    const result = parseModel(readFixture('modelo-tres-esquemas'))
    if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
    resetStore()
    useAppStore.setState({ screen: 'editor', model: result.model })
  })

  it('dice el motor, los contadores y el zoom', () => {
    render(<StatusBar />)

    expect(screen.getByText('PostgreSQL')).toBeInTheDocument()
    expect(screen.getByText('4 esquemas')).toBeInTheDocument()
    expect(screen.getByText('4 tablas')).toBeInTheDocument()
    expect(screen.getByLabelText('Zoom 100 %')).toBeInTheDocument()
  })

  it('el estado del archivo es el del Incremento 1 y se anuncia solo', () => {
    useAppStore.setState({ isDirty: true })

    render(<StatusBar />)

    const status = screen.getByText('Cambios sin guardar')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('sigue al zoom del lienzo', () => {
    useAppStore.getState().setView({ pan: { x: 0, y: 0 }, zoom: 1.75 })

    render(<StatusBar />)

    expect(screen.getByLabelText('Zoom 175 %')).toBeInTheDocument()
  })

  it('cuenta en singular con un solo esquema y una sola tabla', () => {
    useAppStore.setState({
      model: {
        formatVersion: 1,
        name: 'Uno',
        engine: 'sqlite',
        schemas: [{ name: 'main', abbreviation: 'MAI' }],
        tables: [{ name: 'notas', schema: 'main', fields: [{ name: 'id', type: 'integer' }] }],
      },
    })

    render(<StatusBar />)

    expect(screen.getByText('1 esquema')).toBeInTheDocument()
    expect(screen.getByText('1 tabla')).toBeInTheDocument()
    expect(screen.getByText('SQLite')).toBeInTheDocument()
  })

  it('dice qué esquema está enfocado, y solo cuando hay uno (FR-030)', () => {
    const { rerender } = render(<StatusBar />)
    expect(screen.queryByText(/Enfocado:/)).not.toBeInTheDocument()

    useAppStore.setState({ focusedSchema: 'ventas' })
    rerender(<StatusBar />)

    expect(screen.getByText('Enfocado: ventas')).toBeInTheDocument()
  })
})
