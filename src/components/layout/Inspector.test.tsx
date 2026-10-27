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
 * El inspector mira la tabla seleccionada, y en este incremento todavía no
 * hay tablas que seleccionar: lo que enseña siempre es la ficha del modelo.
 * Enfocar un esquema mueve el lienzo y filtra la barra lateral, pero no toca
 * este panel.
 */
function openEditor() {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  useAppStore.setState({ screen: 'editor', model: result.model })
}

describe('inspector', () => {
  beforeEach(openEditor)

  it('muestra la ficha del modelo con su motor y su resumen', () => {
    render(<Inspector />)

    expect(screen.getByRole('heading', { name: 'Comercio · Tres esquemas' })).toBeInTheDocument()
    expect(screen.getByText('Motor')).toBeInTheDocument()
    const resumen = within(screen.getByRole('list', { name: 'Resumen' }))
    expect(resumen.getByText('esquemas')).toBeInTheDocument()
    expect(resumen.getByText('tablas')).toBeInTheDocument()
  })

  it('enfocar un esquema no cambia el inspector (FR-003, FR-029)', async () => {
    const user = userEvent.setup()
    render(<EditorScreen />)

    await user.click(screen.getByRole('option', { name: 'ventas, 2 tablas' }))

    const inspector = within(screen.getByRole('complementary', { name: 'Inspector' }))
    expect(inspector.queryByRole('heading', { name: 'ventas' })).not.toBeInTheDocument()
    expect(inspector.getByText('Motor')).toBeInTheDocument()
  })
})
