import { act, render, screen, waitFor } from '@testing-library/react'
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
    windowApplyMode: vi.fn(),
    windowApplySavedGeometry: vi.fn(),
    windowControls: vi.fn(),
  }
})

/** Último manejador que registró `onMenuAction`, para dispararlo en la prueba. */
let menuHandler: ((action: string) => void) | null = null

vi.mock('@/lib/tauri/events', () => ({
  PREFERENCES_OPEN_EVENT: 'preferences://open',
  onPreferencesOpen: () => () => undefined,
  onCloseRequested: () => () => undefined,
  onMenuAction: (handler: (action: string) => void) => {
    menuHandler = handler
    return () => {
      menuHandler = null
    }
  },
}))

const { windowApplyMode, windowApplySavedGeometry } = await import('@/lib/tauri/commands')

// El efecto del modo de ventana corre en cada montaje de `App`, así que el
// doble tiene que devolver una promesa en todas las pruebas del archivo.
beforeEach(() => {
  vi.mocked(windowApplyMode).mockResolvedValue(undefined)
})

describe('decisión de arranque (FR-006)', () => {
  beforeEach(() => {
    resetStore({
      platform: WINDOWS,
      preferences: { showWelcomeOnStart: false, lastModelPath: null },
    })
    vi.mocked(windowApplySavedGeometry).mockResolvedValue({ applied: false, clamped: false })
  })

  it('sin modelo recordado muestra la Bienvenida y no cambia la preferencia', async () => {
    render(<App />)

    // Se espera a que el suelo de la pantalla de carga pase: cuánto queda
    // depende de lo que haya tardado el arranque de la propia prueba.
    expect(
      await screen.findByRole('heading', { level: 1, name: /sql designer/i }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(useAppStore.getState().preferences.showWelcomeOnStart).toBe(false)
  })

  it('con un modelo recordado lo abre al arrancar', async () => {
    const openModel = vi.fn().mockResolvedValue(true)
    resetStore({
      platform: WINDOWS,
      preferences: { showWelcomeOnStart: false, lastModelPath: '/Users/ada/modelo.yaml' },
    })
    useAppStore.setState({ openModel })

    render(<App />)

    await waitFor(() => {
      expect(openModel).toHaveBeenCalledWith('/Users/ada/modelo.yaml')
    })
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

describe('tamaño de la ventana según la pantalla (RS-01)', () => {
  beforeEach(() => {
    resetStore({ platform: WINDOWS })
    vi.mocked(windowApplySavedGeometry).mockClear()
    vi.mocked(windowApplySavedGeometry).mockResolvedValue({ applied: false, clamped: false })
    vi.mocked(windowApplyMode).mockClear()
    vi.mocked(windowApplyMode).mockResolvedValue(undefined)
  })

  it('la geometría recordada ya no mueve la ventana', async () => {
    render(<App />)

    await screen.findByRole('heading', { level: 1, name: /sql designer/i }, { timeout: 3000 })

    // La posición y el tamaño los decide la pantalla: la Bienvenida sale
    // centrada y el Editor maximizado, no donde quedó la sesión anterior.
    expect(windowApplySavedGeometry).not.toHaveBeenCalled()
  })

  it('la Bienvenida pide el modo diálogo y no lleva «Ampliar»', async () => {
    render(<App />)

    await screen.findByRole('heading', { level: 1, name: /sql designer/i }, { timeout: 3000 })

    expect(windowApplyMode).toHaveBeenCalledWith('welcome')
    expect(screen.queryByRole('button', { name: 'Ampliar' })).not.toBeInTheDocument()
  })

  it('al entrar al Editor pide el modo zona de trabajo', async () => {
    render(<App />)

    await screen.findByRole('heading', { level: 1, name: /sql designer/i }, { timeout: 3000 })

    await act(async () => {
      useAppStore.setState({ screen: 'editor' })
    })

    await waitFor(() => {
      expect(windowApplyMode).toHaveBeenCalledWith('editor')
    })
  })
})

describe('menú Archivo del sistema', () => {
  beforeEach(() => {
    resetStore({ platform: WINDOWS })
    vi.mocked(windowApplySavedGeometry).mockResolvedValue({ applied: false, clamped: false })
  })

  it('crear y abrir pasan por la misma acción que los atajos', async () => {
    const requestIntent = vi.fn()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: /sql designer/i }, { timeout: 3000 })
    act(() => {
      useAppStore.setState({ requestIntent })
    })

    act(() => {
      menuHandler?.('archivo://nuevo-modelo')
      menuHandler?.('archivo://abrir-modelo')
    })

    expect(requestIntent).toHaveBeenNthCalledWith(1, 'new-model')
    expect(requestIntent).toHaveBeenNthCalledWith(2, 'open-model')
  })

  it('guardar y cerrar solo hacen algo con el Editor delante', async () => {
    const saveModel = vi.fn().mockResolvedValue(true)
    const requestClose = vi.fn()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: /sql designer/i }, { timeout: 3000 })
    act(() => {
      useAppStore.setState({ saveModel, requestClose })
    })

    act(() => {
      menuHandler?.('archivo://guardar')
      menuHandler?.('archivo://cerrar-modelo')
    })

    expect(saveModel).not.toHaveBeenCalled()
    expect(requestClose).not.toHaveBeenCalled()

    await act(async () => {
      useAppStore.setState({ screen: 'editor' })
    })
    act(() => {
      menuHandler?.('archivo://guardar')
      menuHandler?.('archivo://cerrar-modelo')
    })

    expect(saveModel).toHaveBeenCalledTimes(1)
    expect(requestClose).toHaveBeenCalledTimes(1)
  })
})
