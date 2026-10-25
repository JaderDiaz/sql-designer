import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IDENTITY, WINDOWS, resetStore } from '@/test/helpers'
import {
  DEFAULT_PREFERENCES,
  resolveEffectiveTheme,
  usePreferencesStore,
} from '@/store/preferences'

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

    await usePreferencesStore.getState().load()

    expect(usePreferencesStore.getState().loadError).toMatch(/no se pudieron leer/i)
  })

  it('no avisa en el primer arranque, cuando no había archivo', async () => {
    vi.mocked(preferencesLoad).mockResolvedValue({
      preferences: DEFAULT_PREFERENCES,
      recovered: true,
      recoveredReason: 'missing',
    })

    await usePreferencesStore.getState().load()

    expect(usePreferencesStore.getState().loadError).toBeNull()
  })

  it('revierte el tema si la escritura falla', async () => {
    vi.mocked(preferencesUpdate).mockRejectedValue(
      new CommandError({ code: 'preferences_write_failed', message: 'disco lleno' }),
    )

    await usePreferencesStore.getState().setTheme('dark')

    const state = usePreferencesStore.getState()
    expect(state.preferences.theme).toBe('system')
    expect(state.effectiveTheme).toBe('light')
    expect(state.writeError).toMatch(/disco lleno/)
  })

  it('revierte la casilla si la escritura falla', async () => {
    vi.mocked(preferencesUpdate).mockRejectedValue(
      new CommandError({ code: 'preferences_write_failed', message: 'sin permisos' }),
    )

    await usePreferencesStore.getState().setShowWelcomeOnStart(false)

    expect(usePreferencesStore.getState().preferences.showWelcomeOnStart).toBe(true)
    expect(usePreferencesStore.getState().writeError).toMatch(/sin permisos/)
  })

  it('guarda el tema elegido cuando la escritura funciona', async () => {
    vi.mocked(preferencesUpdate).mockResolvedValue({ ...DEFAULT_PREFERENCES, theme: 'dark' })

    await usePreferencesStore.getState().setTheme('dark')

    expect(usePreferencesStore.getState().preferences.theme).toBe('dark')
    expect(usePreferencesStore.getState().effectiveTheme).toBe('dark')
  })

  it('calcula el tema efectivo para los tres valores', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark')
    expect(resolveEffectiveTheme('system', false)).toBe('light')
    expect(resolveEffectiveTheme('light', true)).toBe('light')
    expect(resolveEffectiveTheme('dark', false)).toBe('dark')
  })

  it('las tres vías de Ajustes acaban en la misma acción', () => {
    usePreferencesStore.getState().openPreferences()
    expect(usePreferencesStore.getState().isPreferencesOpen).toBe(true)

    usePreferencesStore.getState().closePreferences()
    expect(usePreferencesStore.getState().isPreferencesOpen).toBe(false)
  })
})
