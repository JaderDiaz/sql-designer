import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WelcomeScreen } from '@/components/features/welcome/WelcomeScreen'
import { resetStore } from '@/test/helpers'
import { DEFAULT_PREFERENCES, usePreferencesStore } from '@/store/preferences'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, preferencesUpdate: vi.fn() }
})

const { preferencesUpdate } = await import('@/lib/tauri/commands')

describe('Bienvenida con el teclado (FR-014, SC-004)', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(preferencesUpdate).mockResolvedValue(DEFAULT_PREFERENCES)
  })

  it('tabulando se alcanzan y activan todos los controles', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen />)

    const nuevo = screen.getByRole('button', { name: /nuevo modelo/i })
    const abrir = screen.getByRole('button', { name: /abrir modelo/i })
    const casilla = screen.getByRole('checkbox', { name: /mostrar esta ventana al abrir/i })
    const ajustes = screen.getByRole('button', { name: /ajustes/i })

    await user.tab()
    expect(nuevo).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(usePreferencesStore.getState().notice).toBe('Esta acción llega en el Incremento 1')

    await user.tab()
    expect(abrir).toHaveFocus()

    await user.tab()
    expect(ajustes).toHaveFocus()

    await user.tab()
    expect(casilla).toHaveFocus()

    await user.keyboard(' ')
    expect(preferencesUpdate).toHaveBeenCalledWith({ showWelcomeOnStart: false })

    await user.keyboard('{Shift>}{Tab}{/Shift}{Enter}')
    expect(usePreferencesStore.getState().isPreferencesOpen).toBe(true)
  })
})
