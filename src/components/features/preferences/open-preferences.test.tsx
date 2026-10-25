import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { WINDOWS, resetStore } from '@/test/helpers'
import { DEFAULT_PREFERENCES, usePreferencesStore } from '@/store/preferences'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    preferencesUpdate: vi.fn(),
    windowApplySavedGeometry: vi.fn(),
    windowControls: vi.fn(),
  }
})

/** Guarda el manejador que registra el evento del menú nativo. */
let menuHandler: (() => void) | null = null

vi.mock('@/lib/tauri/events', () => ({
  PREFERENCES_OPEN_EVENT: 'preferences://open',
  onPreferencesOpen: (handler: () => void) => {
    menuHandler = handler
    return () => {
      menuHandler = null
    }
  },
}))

const { preferencesUpdate, windowApplySavedGeometry } = await import('@/lib/tauri/commands')

describe('las tres vías de abrir Ajustes (FR-020)', () => {
  beforeEach(() => {
    resetStore({ platform: WINDOWS })
    vi.mocked(preferencesUpdate).mockResolvedValue(DEFAULT_PREFERENCES)
    vi.mocked(windowApplySavedGeometry).mockResolvedValue({ applied: false, clamped: false })
  })

  it('el control visible de la Bienvenida abre Ajustes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /ajustes/i }))

    expect(usePreferencesStore.getState().isPreferencesOpen).toBe(true)
  })

  it('el atajo del sistema abre Ajustes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.keyboard('{Control>},{/Control}')

    expect(usePreferencesStore.getState().isPreferencesOpen).toBe(true)
  })

  it('el evento del menú nativo abre Ajustes', () => {
    render(<App />)

    expect(menuHandler).not.toBeNull()
    act(() => menuHandler?.())

    expect(usePreferencesStore.getState().isPreferencesOpen).toBe(true)
  })
})
