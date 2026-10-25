/**
 * Tipos de la frontera Rust ↔ TypeScript, exactos a `contracts/commands.md`.
 * Son los mismos que usa el almacén: no hay un segundo juego de tipos.
 */

/** Preferencia de tema elegida por el usuario. */
export type ThemePreference = 'system' | 'light' | 'dark'

/** Tema realmente pintado, ya resuelto contra el del sistema. */
export type EffectiveTheme = 'light' | 'dark'

/** Geometría recordada de la ventana, en píxeles lógicos. */
export interface WindowGeometry {
  x: number
  y: number
  width: number
  height: number
}

/** Preferencias de la instalación tal como las persiste Rust. */
export interface Preferences {
  formatVersion: number
  theme: ThemePreference
  showWelcomeOnStart: boolean
  window: WindowGeometry | null
  lastModelPath: string | null
}

/** Campos que acepta `preferences_update`; los ausentes no se tocan. */
export interface PreferencesPatch {
  theme?: ThemePreference
  showWelcomeOnStart?: boolean
}

/**
 * Causa de una recuperación. `missing` es un primer arranque normal, así que
 * la interfaz no avisa por él; los demás códigos sí (FR-016).
 */
export type RecoveredReason = 'missing' | 'empty' | 'invalid_json' | 'future_version' | 'unreadable'

/** Respuesta de `preferences_load`. */
export interface PreferencesLoadResult {
  preferences: Preferences
  recovered: boolean
  recoveredReason: RecoveredReason | null
}

/** Identidad del binario (FR-002). */
export interface AppIdentity {
  name: string
  version: string
  buildDate: string
}

/** Símbolos de modificador por sistema (RS-12). */
export interface ModifierSymbols {
  meta: string
  alt: string
  del: string
}

/** Sistema en ejecución y sus símbolos de atajo. */
export interface PlatformInfo {
  os: 'macos' | 'windows'
  modifierSymbols: ModifierSymbols
}

/** Resultado de `window_apply_saved_geometry`. */
export interface GeometryApplyResult {
  applied: boolean
  clamped: boolean
}

/** Acciones de los controles propios de la barra de título (FR-012). */
export type WindowControlAction = 'minimize' | 'toggle_maximize' | 'close' | 'start_drag'

/** Códigos de error que devuelven los comandos de este incremento. */
export type AppErrorCode =
  'preferences_unreadable' | 'preferences_write_failed' | 'window_state_failed'

/** Error de un comando, tal como lo serializa Rust. */
export interface AppError {
  code: AppErrorCode
  message: string
}
