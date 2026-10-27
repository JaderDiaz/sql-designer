import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorScreen } from '@/components/features/editor/EditorScreen'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { useAppStore } from '@/store'
import { DEFAULT_PREFERENCES } from '@/store/preferences'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    measureModelOpened: vi.fn().mockResolvedValue(undefined),
    preferencesUpdate: vi.fn(),
  }
})

const { preferencesUpdate } = await import('@/lib/tauri/commands')

/**
 * Pruebas de las cinco zonas del Editor (FR-001, FR-006).
 *
 * Se monta el Editor entero y no solo el marco: lo que importa es que las
 * cinco zonas lleguen con su nombre accesible y que esconder una la saque del
 * árbol, de modo que el tabulador deje de pasar por ella.
 */
function openEditor() {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  useAppStore.setState({ screen: 'editor', model: result.model })
}

describe('las cinco zonas del Editor', () => {
  beforeEach(() => {
    openEditor()
    vi.mocked(preferencesUpdate).mockResolvedValue(DEFAULT_PREFERENCES)
  })

  it('están todas con su nombre accesible (FR-001)', () => {
    render(<EditorScreen />)

    expect(screen.getByRole('navigation', { name: 'Esquemas y tablas del modelo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Lienzo del modelo')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('esconder la barra lateral la saca del árbol y el botón la devuelve (FR-006)', async () => {
    const user = userEvent.setup()
    render(<EditorScreen />)

    await user.click(screen.getByRole('button', { name: 'Ocultar barra lateral' }))

    expect(
      screen.queryByRole('navigation', { name: 'Esquemas y tablas del modelo' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mostrar barra lateral' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await user.click(screen.getByRole('button', { name: 'Mostrar barra lateral' }))

    expect(
      screen.getByRole('navigation', { name: 'Esquemas y tablas del modelo' }),
    ).toBeInTheDocument()
  })

  it('esconder el inspector lo saca del árbol y el botón lo devuelve (FR-006)', async () => {
    const user = userEvent.setup()
    render(<EditorScreen />)

    await user.click(screen.getByRole('button', { name: 'Ocultar inspector' }))

    expect(screen.queryByRole('complementary', { name: 'Inspector' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mostrar inspector' }))

    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument()
  })

  it('arranca con la disposición que traen las preferencias', () => {
    useAppStore.setState({ isSidebarHidden: true, isInspectorHidden: true })

    render(<EditorScreen />)

    expect(
      screen.queryByRole('navigation', { name: 'Esquemas y tablas del modelo' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Lienzo del modelo')).toBeInTheDocument()
  })
})
