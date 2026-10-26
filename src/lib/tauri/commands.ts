import { invoke } from '@tauri-apps/api/core'

import type {
  AppError,
  AppErrorCode,
  AppIdentity,
  BuiltModelPath,
  CreatedDirectory,
  DirectoryEntry,
  FileStamp,
  ListOnly,
  GeometryApplyResult,
  ModelReadResult,
  ModelWriteResult,
  PathStat,
  Place,
  Preferences,
  PreferencesLoadResult,
  PreferencesPatch,
  PlatformInfo,
  RecentEntryInput,
  RecentEntryRecord,
  WindowControlAction,
  WindowMode,
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

/**
 * Arma la ruta final del archivo del modelo y dice si ya existe (FR-002).
 *
 * El frontend nunca concatena separadores ni añade la extensión: eso lo hace
 * Rust, que es el dueño del disco (`research.md` R9).
 *
 * @param folder Carpeta elegida para el modelo.
 * @param fileStem Nombre del archivo sin extensión, ya saneado por `slug.ts`.
 */
export function pathBuildModel(folder: string, fileStem: string): Promise<BuiltModelPath> {
  return call<BuiltModelPath>('path_build_model', { folder, fileStem })
}

/**
 * Lee el archivo del modelo como texto, con su sello (FR-013, FR-015).
 *
 * Un archivo que no parsea no falla aquí: el texto vuelve bien y es
 * `parseModel` quien decide si se puede abrir (FR-016).
 *
 * @param path Ruta absoluta del archivo.
 */
export function modelRead(path: string): Promise<ModelReadResult> {
  return call<ModelReadResult>('model_read', { path })
}

/**
 * Escribe el archivo del modelo de forma atómica (FR-021 a FR-025).
 *
 * @param path Ruta absoluta del archivo.
 * @param text Contenido completo que se guarda.
 * @param expectedStamp Sello de la última lectura o escritura; se omite al crear.
 * @param force `true` para sobrescribir tras confirmar un `model_stale`.
 */
export function modelWrite(
  path: string,
  text: string,
  expectedStamp?: FileStamp | null,
  force?: boolean,
): Promise<ModelWriteResult> {
  return call<ModelWriteResult>('model_write', {
    path,
    text,
    expectedStamp: expectedStamp ?? null,
    force: force ?? false,
  })
}

/**
 * Estado en disco de varias rutas, de una sola llamada (FR-031).
 *
 * @param paths Rutas absolutas a consultar.
 */
export function modelStat(paths: string[]): Promise<PathStat[]> {
  return call<PathStat[]>('model_stat', { paths })
}

/** Lista de recientes con el estado del archivo ya resuelto (FR-029). */
export function recentsList(): Promise<RecentEntryRecord[]> {
  return call<RecentEntryRecord[]>('recents_list')
}

/**
 * Registra o actualiza una entrada de recientes y la pone primera (FR-029).
 *
 * @param entry Datos cacheados del modelo que se acaba de usar.
 */
export function recentsTouch(entry: RecentEntryInput): Promise<RecentEntryRecord[]> {
  return call<RecentEntryRecord[]>('recents_touch', { entry })
}

/**
 * Quita una entrada de recientes; el archivo no se toca (FR-034).
 *
 * @param path Ruta de la entrada que sale de la lista.
 */
export function recentsRemove(path: string): Promise<RecentEntryRecord[]> {
  return call<RecentEntryRecord[]>('recents_remove', { path })
}

/**
 * Anota los milisegundos que tardó en abrirse un modelo (SC-002).
 *
 * @param millis Tiempo entre la orden de abrir y el modelo pintado.
 * @param tables Número de tablas del modelo.
 * @returns Los milisegundos anotados, o `null` si la medida está apagada.
 */
export function measureModelOpened(millis: number, tables: number): Promise<number | null> {
  return call<number | null>('measure_model_opened', { millis, tables })
}

/**
 * Anota los milisegundos que tardó en guardarse un modelo (SC-003).
 *
 * @param millis Tiempo entre el atajo de guardar y el archivo ya escrito.
 * @param tables Número de tablas del modelo.
 * @returns Los milisegundos anotados, o `null` si la medida está apagada.
 */
export function measureModelSaved(millis: number, tables: number): Promise<number | null> {
  return call<number | null>('measure_model_saved', { millis, tables })
}

/**
 * Ubicaciones del usuario para la barra lateral de los diálogos (FR-007).
 *
 * Nunca falla: una ubicación que no se puede resolver no se lista.
 */
export function fsUserPlaces(): Promise<Place[]> {
  return call<Place[]>('fs_user_places')
}

/**
 * Contenido de una carpeta, ya filtrado y ordenado por Rust (FR-007, FR-009).
 *
 * @param path Carpeta que se lista.
 * @param only Qué se quiere ver; por defecto, todo.
 */
export function fsListDirectory(path: string, only?: ListOnly): Promise<DirectoryEntry[]> {
  return call<DirectoryEntry[]>('fs_list_directory', { path, only })
}

/**
 * Crea una carpeta y devuelve su nombre real, ya desambiguado (FR-010).
 *
 * @param parent Carpeta donde se crea la nueva.
 * @param name Nombre pedido; si está ocupado, Rust lo numera.
 */
export function fsCreateDirectory(parent: string, name: string): Promise<CreatedDirectory> {
  return call<CreatedDirectory>('fs_create_directory', { parent, name })
}

/**
 * Ajusta la ventana al modo de la pantalla visible.
 *
 * La Bienvenida es un diálogo de tamaño fijo; el Editor es la zona de trabajo:
 * baja el mínimo, se puede ampliar y abre en grande la primera vez.
 *
 * @param mode Pantalla que se va a mostrar.
 */
export function windowApplyMode(mode: WindowMode): Promise<void> {
  return call<void>('window_apply_mode', { mode })
}

/**
 * Muestra el archivo en el gestor de archivos del sistema (FR-016).
 *
 * @param path Ruta del archivo que se quiere mostrar.
 */
export function revealInFileManager(path: string): Promise<void> {
  return call<void>('reveal_in_file_manager', { path })
}

/**
 * Escribe texto en el portapapeles del sistema (FR-035).
 *
 * @param text Texto que queda en el portapapeles.
 */
export function clipboardWriteText(text: string): Promise<void> {
  return call<void>('clipboard_write_text', { text })
}

/**
 * Mueve el archivo a la papelera del sistema (FR-037, RS-08).
 *
 * @param path Ruta del archivo que se manda a la papelera.
 */
export function trashMove(path: string): Promise<void> {
  return call<void>('trash_move', { path })
}

/**
 * Dice a Rust si el cierre de la ventana hay que preguntarlo antes (FR-028).
 *
 * @param armed `true` mientras el modelo abierto tenga cambios sin guardar.
 */
export function windowSetCloseGuard(armed: boolean): Promise<void> {
  return call<void>('window_set_close_guard', { armed })
}
