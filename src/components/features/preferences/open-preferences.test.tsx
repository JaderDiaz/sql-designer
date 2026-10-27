import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { WINDOWS, resetStore } from '@/test/helpers'
import { useAppStore } from '@/store'
import { DEFAULT_PREFERENCES } from '@/store/preferences'

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
  onCloseRequested: () => () => undefined,
  onMenuAction: () => () => undefined,
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

    // La Bienvenida llega cuando la pantalla de carga cumple su mínimo, que se
    // cuenta desde que arrancó la página: si este archivo es el primero del
    // proceso, el control todavía no está en el DOM al montar.
    await user.click(await screen.findByRole('button', { name: /ajustes/i }, { timeout: 3000 }))

    expect(useAppStore.getState().isPreferencesOpen).toBe(true)
  })

  it('el atajo del sistema abre Ajustes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.keyboard('{Control>},{/Control}')

    expect(useAppStore.getState().isPreferencesOpen).toBe(true)
  })

  it('el evento del menú nativo abre Ajustes', () => {
    render(<App />)

    expect(menuHandler).not.toBeNull()
    act(() => menuHandler?.())

    expect(useAppStore.getState().isPreferencesOpen).toBe(true)
  })
})
