import type { AppIdentity, PlatformInfo, Preferences } from '@/lib/tauri/types'
import { useAppStore } from '@/store'
import { DEFAULT_PREFERENCES } from '@/store/preferences'

/**
 * Ayudas comunes de las pruebas: preferencias, identidad y plataforma de
 * ejemplo, y el reinicio del almacén entre casos.
 */

/** Identidad de ejemplo, con la fecha de compilación del escenario. */
export const IDENTITY: AppIdentity = {
  name: 'SQL Designer',
  version: '1.0.0',
  buildDate: '2026.10.24',
}

/** Plataforma macOS, para comprobar los símbolos ⌘. */
export const MACOS: PlatformInfo = {
  os: 'macos',
  modifierSymbols: { meta: '⌘', alt: '⌥', del: '⌫' },
}

/** Plataforma Windows, para comprobar los textos Ctrl. */
export const WINDOWS: PlatformInfo = {
  os: 'windows',
  modifierSymbols: { meta: 'Ctrl', alt: 'Alt', del: 'Supr' },
}

/**
 * Deja el almacén en un estado conocido antes de cada prueba.
 *
 * @param overrides Campos del almacén que la prueba quiere fijar.
 */
export function resetStore(
  overrides: {
    preferences?: Partial<Preferences>
    identity?: AppIdentity | null
    platform?: PlatformInfo
  } = {},
): void {
  useAppStore.setState({
    preferences: { ...DEFAULT_PREFERENCES, ...overrides.preferences },
    effectiveTheme: 'light',
    systemPrefersDark: false,
    identity: overrides.identity === undefined ? IDENTITY : overrides.identity,
    platform: overrides.platform ?? WINDOWS,
    isLoaded: true,
    isPreferencesOpen: false,
    loadError: null,
    writeError: null,
    notice: null,
    screen: 'welcome',
    dialog: null,
    pendingIntent: null,
  })
}
