import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WelcomeScreen } from '@/components/features/welcome/WelcomeScreen'
import { IDENTITY, MACOS, WINDOWS, resetStore } from '@/test/helpers'
import { useAppStore } from '@/store'
import { DEFAULT_PREFERENCES } from '@/store/preferences'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, preferencesUpdate: vi.fn() }
})

const { preferencesUpdate } = await import('@/lib/tauri/commands')

describe('Bienvenida', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(preferencesUpdate).mockResolvedValue(DEFAULT_PREFERENCES)
  })

  it('muestra nombre, versión y fecha tal como las devuelve app_identity', () => {
    render(<WelcomeScreen />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(IDENTITY.name)
    expect(screen.getByText(`Versión ${IDENTITY.version}`)).toBeInTheDocument()
    expect(screen.getByText(`(${IDENTITY.buildDate})`)).toBeInTheDocument()
    expect(screen.getByLabelText('Icono de SQL Designer')).toBeInTheDocument()
  })

  it('muestra los atajos con los símbolos de la plataforma simulada', () => {
    resetStore({ platform: MACOS })
    render(<WelcomeScreen />)

    expect(screen.getByText('⌘N')).toBeInTheDocument()
    expect(screen.getByText('⌘O')).toBeInTheDocument()
    expect(screen.getByText('⌘,')).toBeInTheDocument()
  })

  it('en Windows los atajos llevan Ctrl', () => {
    resetStore({ platform: WINDOWS })
    render(<WelcomeScreen />)

    expect(screen.getByText('Ctrl+N')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+O')).toBeInTheDocument()
  })

  it('las dos acciones están habilitadas y solo avisan', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen />)

    const nuevo = screen.getByRole('button', { name: /nuevo modelo/i })
    expect(nuevo).toBeEnabled()

    await user.click(nuevo)

    expect(useAppStore.getState().notice).toBe('Esta acción llega en el Incremento 1')
  })

  it('la casilla refleja y cambia showWelcomeOnStart', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen />)

    const casilla = screen.getByRole('checkbox', { name: /mostrar esta ventana al abrir/i })
    expect(casilla).toBeChecked()

    await user.click(casilla)

    expect(preferencesUpdate).toHaveBeenCalledWith({ showWelcomeOnStart: false })
  })

  it('avisa cuando las preferencias llegaron recuperadas', () => {
    resetStore()
    useAppStore.setState({ loadError: 'No se pudieron leer tus preferencias.' })

    render(<WelcomeScreen />)

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron leer/i)
  })
})
