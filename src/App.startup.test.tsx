import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App, { resolveStartupScreen } from '@/App'
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

vi.mock('@/lib/tauri/events', () => ({
  PREFERENCES_OPEN_EVENT: 'preferences://open',
  onPreferencesOpen: () => () => undefined,
}))

const { windowApplySavedGeometry } = await import('@/lib/tauri/commands')

describe('decisión de arranque (FR-006)', () => {
  beforeEach(() => {
    resetStore({
      platform: WINDOWS,
      preferences: { showWelcomeOnStart: false, lastModelPath: null },
    })
    vi.mocked(windowApplySavedGeometry).mockResolvedValue({ applied: false, clamped: false })
  })

  it('sin modelo recordado muestra la Bienvenida y no cambia la preferencia', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: /sql designer/i })).toBeInTheDocument()
    expect(useAppStore.getState().preferences.showWelcomeOnStart).toBe(false)
  })

  it('resuelve la pantalla inicial según la casilla y el último modelo', () => {
    expect(resolveStartupScreen(DEFAULT_PREFERENCES)).toBe('welcome')
    expect(resolveStartupScreen({ ...DEFAULT_PREFERENCES, showWelcomeOnStart: false })).toBe(
      'welcome',
    )
    expect(
      resolveStartupScreen({
        ...DEFAULT_PREFERENCES,
        showWelcomeOnStart: false,
        lastModelPath: '/tmp/modelo.yaml',
      }),
    ).toBe('last-model')
  })
})

describe('pantalla de carga (SC-001)', () => {
  beforeEach(() => {
    resetStore({ platform: WINDOWS })
    vi.mocked(windowApplySavedGeometry).mockResolvedValue({ applied: false, clamped: false })
  })

  it('mientras la carga no termina se ve el arranque y no la Bienvenida', () => {
    useAppStore.setState({ isLoaded: false })

    render(<App />)

    expect(screen.getByRole('progressbar', { name: /abriendo sql designer/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('cuando la carga termina aparece la Bienvenida', async () => {
    useAppStore.setState({ isLoaded: false })
    render(<App />)

    act(() => {
      useAppStore.setState({ isLoaded: true })
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: /sql designer/i }, { timeout: 3000 }),
    ).toBeInTheDocument()
  })
})

describe('cambio de tema sin perder la pantalla (FR-009, SC-003)', () => {
  beforeEach(() => {
    resetStore({ platform: WINDOWS })
    vi.mocked(windowApplySavedGeometry).mockResolvedValue({ applied: false, clamped: false })
  })

  it('conserva la casilla y el foco al cambiar de tema', async () => {
    render(<App />)

    const casilla = screen.getByRole('checkbox', { name: /mostrar esta ventana al abrir/i })
    casilla.focus()
    expect(casilla).toHaveFocus()

    await act(async () => {
      useAppStore.getState().setSystemPrefersDark(true)
    })

    expect(document.documentElement.dataset['theme']).toBe('dark')
    // Mismo nodo: la pantalla no se desmontó al cambiar el tema.
    expect(screen.getByRole('checkbox', { name: /mostrar esta ventana al abrir/i })).toBe(casilla)
    expect(casilla).toHaveFocus()
  })
})
