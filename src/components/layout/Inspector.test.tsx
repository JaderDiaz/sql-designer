import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorScreen } from '@/components/features/editor/EditorScreen'
import { Inspector } from '@/components/layout/Inspector'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, measureModelOpened: vi.fn().mockResolvedValue(undefined) }
})

/**
 * Pruebas del inspector (FR-003).
 *
 * El objeto seleccionable de este incremento es el esquema, y la vía de
 * seleccionarlo que trae la historia 1 es su fila de la barra lateral.
 */
function openEditor() {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  useAppStore.setState({ screen: 'editor', model: result.model })
}

describe('inspector', () => {
  beforeEach(openEditor)

  it('sin selección dice que no hay nada seleccionado', () => {
    render(<Inspector />)

    expect(screen.getByText(/No hay nada seleccionado/)).toBeInTheDocument()
  })

  it('pulsar la fila de un esquema muestra sus datos', async () => {
    const user = userEvent.setup()
    render(<EditorScreen />)

    await user.click(screen.getByRole('option', { name: 'ventas, 2 tablas' }))

    // «VEN» y «2 tablas» también están en la barra lateral: se busca dentro
    // del inspector para comprobar que son los suyos.
    const inspector = within(screen.getByRole('complementary', { name: 'Inspector' }))
    expect(inspector.getByRole('heading', { name: 'ventas' })).toBeInTheDocument()
    expect(inspector.getByText('Facturación y cobros')).toBeInTheDocument()
    expect(inspector.getByText('VEN')).toBeInTheDocument()
    expect(inspector.getByText('Azul')).toBeInTheDocument()
    expect(inspector.getByText('2 tablas')).toBeInTheDocument()
  })

  it('muestra los seis datos del esquema seleccionado', () => {
    useAppStore.getState().selectSchema('reportes')

    render(<Inspector />)

    expect(screen.getByRole('heading', { name: 'reportes' })).toBeInTheDocument()
    expect(screen.getByText('Nombre técnico')).toBeInTheDocument()
    expect(screen.getByText('Abreviatura')).toBeInTheDocument()
    expect(screen.getByText('REP')).toBeInTheDocument()
    expect(screen.getByText('Naranja')).toBeInTheDocument()
    expect(screen.getByText('sin tablas')).toBeInTheDocument()
    expect(screen.getByText('Todavía sin tablas')).toBeInTheDocument()
  })

  it('dice «Sin descripción» cuando el esquema no la trae', () => {
    useAppStore.getState().selectSchema('inventario')

    render(<Inspector />)

    expect(screen.getByText('Sin descripción')).toBeInTheDocument()
  })

  it('un esquema que deja de existir deja el inspector sin selección', () => {
    useAppStore.getState().selectSchema('ventas')
    useAppStore.getState().deleteSchema('ventas', { withTables: true, target: null })

    render(<Inspector />)

    expect(screen.getByText(/No hay nada seleccionado/)).toBeInTheDocument()
  })
})
