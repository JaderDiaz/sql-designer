import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PreferencesWindow } from '@/components/features/preferences/PreferencesWindow'
import { resetStore } from '@/test/helpers'
import { useAppStore } from '@/store'
import { DEFAULT_PREFERENCES } from '@/store/preferences'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, preferencesUpdate: vi.fn() }
})

const { preferencesUpdate } = await import('@/lib/tauri/commands')

/** Abre Ajustes antes de cada prueba, como lo haría cualquiera de las tres vías. */
function renderOpen() {
  resetStore()
  useAppStore.setState({ isPreferencesOpen: true })
  return render(<PreferencesWindow />)
}

describe('Ajustes', () => {
  beforeEach(() => {
    vi.mocked(preferencesUpdate).mockImplementation((patch) =>
      Promise.resolve({ ...DEFAULT_PREFERENCES, ...patch }),
    )
  })

  it('ofrece los tres valores de tema y marca el elegido', async () => {
    const user = userEvent.setup()
    renderOpen()

    const sistema = screen.getByRole('radio', { name: 'Sistema' })
    const claro = screen.getByRole('radio', { name: 'Claro' })
    const oscuro = screen.getByRole('radio', { name: 'Oscuro' })

    expect(sistema).toBeChecked()

    await user.click(oscuro)
    expect(preferencesUpdate).toHaveBeenCalledWith({ theme: 'dark' })

    await user.click(claro)
    expect(preferencesUpdate).toHaveBeenCalledWith({ theme: 'light' })
  })

  it('no muestra ninguna otra preferencia', () => {
    renderOpen()

    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('el control de tema se recorre y se activa solo con el teclado', async () => {
    const user = userEvent.setup()
    renderOpen()

    // Radix lleva el foco al primer control al abrir: la pestaña «General».
    expect(screen.getByRole('tab', { name: 'General' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('radio', { name: 'Sistema' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Claro' })).toHaveFocus()

    await user.keyboard(' ')
    expect(preferencesUpdate).toHaveBeenCalledWith({ theme: 'light' })

    await user.tab()
    expect(screen.getByRole('switch', { name: 'Ajustar a la cuadrícula' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })

  it('«Ajustar a la cuadrícula» escribe la preferencia (FR-032)', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.click(screen.getByRole('switch', { name: 'Ajustar a la cuadrícula' }))

    expect(preferencesUpdate).toHaveBeenCalledWith({ snapToGrid: true })
    expect(
      screen.getByText('Las tablas se alinean a los puntos del lienzo al soltarlas'),
    ).toBeInTheDocument()
  })
})
