import { invoke } from '@tauri-apps/api/core'

import type {
  AppError,
  AppErrorCode,
  AppIdentity,
  GeometryApplyResult,
  Preferences,
  PreferencesLoadResult,
  PreferencesPatch,
  PlatformInfo,
  WindowControlAction,
} from './types'

/**
 * Único archivo del proyecto que usa `invoke` (principio VII de la
 * constitución). Cada comando de `contracts/commands.md` tiene aquí un
 * envoltorio tipado, y los errores llegan como `CommandError`.
 */

/** Error de un comando, con el código del contrato. */
export class CommandError extends Error {
  readonly code: AppErrorCode

  /**
   * @param error Error serializado por Rust.
   */
  constructor(error: AppError) {
    super(error.message)
    this.name = 'CommandError'
    this.code = error.code
  }
}

/** ¿El valor tiene la forma de `AppError`? */
function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<AppError>
  return typeof candidate.code === 'string' && typeof candidate.message === 'string'
}

/**
 * Invoca un comando y convierte cualquier fallo en `CommandError`.
 *
 * @param command Nombre del comando en `snake_case`.
 * @param args Argumentos del comando, si los tiene.
 * @throws CommandError Siempre que el comando devuelva `Err` o falle el puente.
 */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    if (isAppError(error)) throw new CommandError(error)
    throw new CommandError({
      code: 'window_state_failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Identidad del binario: nombre, versión y fecha de compilación. */
export function appIdentity(): Promise<AppIdentity> {
  return call<AppIdentity>('app_identity')
}

/** Sistema en ejecución y símbolos de modificador. */
export function platformInfo(): Promise<PlatformInfo> {
  return call<PlatformInfo>('platform_info')
}

/** Preferencias al arrancar, con la causa si hubo que recuperarlas. */
export function preferencesLoad(): Promise<PreferencesLoadResult> {
  return call<PreferencesLoadResult>('preferences_load')
}

/**
 * Persiste un cambio parcial de preferencias.
 *
 * @param patch Campos a modificar.
 * @returns Las preferencias completas ya guardadas.
 */
export function preferencesUpdate(patch: PreferencesPatch): Promise<Preferences> {
  return call<Preferences>('preferences_update', { patch })
}

/** Restaura la geometría recordada, recortada al área visible. */
export function windowApplySavedGeometry(): Promise<GeometryApplyResult> {
  return call<GeometryApplyResult>('window_apply_saved_geometry')
}

/**
 * Ejecuta una acción de los controles propios de la barra de título.
 *
 * @param action `minimize`, `toggle_maximize`, `close` o `start_drag`.
 */
export function windowControls(action: WindowControlAction): Promise<void> {
  return call<void>('window_controls', { action })
}

/**
 * Anota los milisegundos de arranque hasta la Bienvenida (SC-001).
 *
 * El binario calla salvo que se arranque con `SQL_DESIGNER_MEDIR=1`, así que
 * llamarlo siempre no deja rastro en el registro de un uso normal.
 *
 * @param splash Si llegó a verse la pantalla de carga.
 * @returns Los milisegundos anotados, o `null` si la medida está apagada.
 */
export function measureStartupReady(splash: boolean): Promise<number | null> {
  return call<number | null>('measure_startup_ready', { splash })
}

/**
 * Anota los milisegundos del cambio de tema (SC-003).
 *
 * @param millis Tiempo entre la elección en Ajustes y el primer fotograma ya
 * pintado con el tema nuevo.
 */
export function measureThemeApplied(millis: number): Promise<void> {
  return call<void>('measure_theme_applied', { millis })
}
