import type { ModifierSymbols, PlatformInfo } from './tauri/types'

/**
 * Textos y símbolos que cambian con el sistema operativo (RS-12).
 * Los valores vienen del comando `platform_info`: ningún componente adivina
 * el sistema por su cuenta.
 */

/** Símbolos de Windows, usados también mientras no hay respuesta del backend. */
export const WINDOWS_SYMBOLS: ModifierSymbols = { meta: 'Ctrl', alt: 'Alt', del: 'Supr' }

/** Plataforma por defecto antes de que responda `platform_info`. */
export const DEFAULT_PLATFORM: PlatformInfo = { os: 'windows', modifierSymbols: WINDOWS_SYMBOLS }

/**
 * Compone el texto de un atajo con el símbolo del sistema.
 *
 * @param platform Plataforma resuelta por el backend.
 * @param key Tecla del atajo, por ejemplo `N`.
 * @returns `⌘N` en macOS, `Ctrl+N` en Windows.
 */
export function shortcutLabel(platform: PlatformInfo, key: string): string {
  const { meta } = platform.modifierSymbols
  return platform.os === 'macos' ? `${meta}${key}` : `${meta}+${key}`
}

/**
 * Separador de rutas del sistema, para componer una ruta que se muestra.
 *
 * @param platform Plataforma resuelta por el backend.
 * @returns `\` en Windows, `/` en macOS.
 */
export function pathSeparator(platform: PlatformInfo): string {
  return platform.os === 'windows' ? '\\' : '/'
}

/** ¿El sistema es macOS? Decide qué variante de barra de título se dibuja. */
export function isMacOS(platform: PlatformInfo): boolean {
  return platform.os === 'macos'
}
