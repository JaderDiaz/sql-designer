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
})
