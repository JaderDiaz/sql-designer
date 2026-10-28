import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IDENTITY, WINDOWS, resetStore } from '@/test/helpers'
import { useAppStore } from '@/store'
import { DEFAULT_PREFERENCES, resolveEffectiveTheme } from '@/store/preferences'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    appIdentity: vi.fn(),
    platformInfo: vi.fn(),
    preferencesLoad: vi.fn(),
    preferencesUpdate: vi.fn(),
  }
})

const { CommandError, appIdentity, platformInfo, preferencesLoad, preferencesUpdate } =
  await import('@/lib/tauri/commands')

describe('almacén de preferencias', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(appIdentity).mockResolvedValue(IDENTITY)
    vi.mocked(platformInfo).mockResolvedValue(WINDOWS)
  })

  it('deja aviso cuando las preferencias llegaron recuperadas', async () => {
    vi.mocked(preferencesLoad).mockResolvedValue({
      preferences: DEFAULT_PREFERENCES,
      recovered: true,
      recoveredReason: 'invalid_json',
    })

    await useAppStore.getState().load()

    expect(useAppStore.getState().loadError).toMatch(/no se pudieron leer/i)
  })

  it('no avisa en el primer arranque, cuando no había archivo', async () => {
    vi.mocked(preferencesLoad).mockResolvedValue({
      preferences: DEFAULT_PREFERENCES,
      recovered: true,
      recoveredReason: 'missing',
    })

    await useAppStore.getState().load()

    expect(useAppStore.getState().loadError).toBeNull()
  })

  it('revierte el tema si la escritura falla', async () => {
    vi.mocked(preferencesUpdate).mockRejectedValue(
      new CommandError({ code: 'preferences_write_failed', message: 'disco lleno' }),
    )

    await useAppStore.getState().setTheme('dark')

    const state = useAppStore.getState()
    expect(state.preferences.theme).toBe('system')
    expect(state.effectiveTheme).toBe('light')
    expect(state.writeError).toMatch(/disco lleno/)
  })

  it('revierte la casilla si la escritura falla', async () => {
    vi.mocked(preferencesUpdate).mockRejectedValue(
      new CommandError({ code: 'preferences_write_failed', message: 'sin permisos' }),
    )

    await useAppStore.getState().setShowWelcomeOnStart(false)

    expect(useAppStore.getState().preferences.showWelcomeOnStart).toBe(true)
    expect(useAppStore.getState().writeError).toMatch(/sin permisos/)
  })

  it('guarda el tema elegido cuando la escritura funciona', async () => {
    vi.mocked(preferencesUpdate).mockResolvedValue({ ...DEFAULT_PREFERENCES, theme: 'dark' })

    await useAppStore.getState().setTheme('dark')

    expect(useAppStore.getState().preferences.theme).toBe('dark')
    expect(useAppStore.getState().effectiveTheme).toBe('dark')
  })

  it('calcula el tema efectivo para los tres valores', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark')
    expect(resolveEffectiveTheme('system', false)).toBe('light')
    expect(resolveEffectiveTheme('light', true)).toBe('light')
    expect(resolveEffectiveTheme('dark', false)).toBe('dark')
  })

  it('las tres vías de Ajustes acaban en la misma acción', () => {
    useAppStore.getState().openPreferences()
    expect(useAppStore.getState().isPreferencesOpen).toBe(true)

    useAppStore.getState().closePreferences()
    expect(useAppStore.getState().isPreferencesOpen).toBe(false)
  })

  it('los tres campos del Incremento 4 nacen con su valor por defecto', () => {
    const { preferences } = useAppStore.getState()

    expect(preferences.relationRoute).toBe('orthogonal')
    expect(preferences.relationAnimation).toBe('subtle')
    expect(preferences.foreignKeyPattern).toBe('{tabla}_{pk}')
  })

  it('el parche del trazado no toca lo que no nombra (FR-041)', async () => {
    // El parche viaja con un solo campo y el estado se queda con lo que
    // devuelve Rust, que conserva el resto.
    vi.mocked(preferencesUpdate).mockResolvedValue({
      ...DEFAULT_PREFERENCES,
      relationRoute: 'curved',
      relationAnimation: 'lively',
      foreignKeyPattern: 'fk_{tabla}',
    })

    await useAppStore.getState().setRelationRoute('curved')

    expect(preferencesUpdate).toHaveBeenCalledWith({ relationRoute: 'curved' })
    const { preferences } = useAppStore.getState()
    expect(preferences.relationRoute).toBe('curved')
    expect(preferences.relationAnimation).toBe('lively')
    expect(preferences.foreignKeyPattern).toBe('fk_{tabla}')
  })

  it('el parche de la animación tampoco toca el trazado', async () => {
    vi.mocked(preferencesUpdate).mockResolvedValue({
      ...DEFAULT_PREFERENCES,
      relationAnimation: 'off',
    })

    await useAppStore.getState().setRelationAnimation('off')

    expect(preferencesUpdate).toHaveBeenCalledWith({ relationAnimation: 'off' })
    expect(useAppStore.getState().preferences.relationAnimation).toBe('off')
    expect(useAppStore.getState().preferences.relationRoute).toBe('orthogonal')
  })

  it('revierte el trazado si la escritura falla', async () => {
    vi.mocked(preferencesUpdate).mockRejectedValue(
      new CommandError({ code: 'preferences_write_failed', message: 'disco lleno' }),
    )

    await useAppStore.getState().setRelationRoute('straight')

    expect(useAppStore.getState().preferences.relationRoute).toBe('orthogonal')
    expect(useAppStore.getState().writeError).toMatch(/disco lleno/)
  })
})
