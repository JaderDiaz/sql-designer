import type { Engine } from '@/lib/model/types'

/**
 * Tipos de la frontera Rust ↔ TypeScript, exactos a `contracts/commands.md`.
 * Son los mismos que usa el almacén: no hay un segundo juego de tipos.
 *
 * `Engine` no se redeclara aquí: el motor es del modelo y vive en
 * `src/lib/model/types.ts` (principio II).
 */

export type { Engine }

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
  /** Motor inicial de los modelos nuevos (FR-004, RS-10). */
  engine: Engine
  /** Carpeta inicial del diálogo Nuevo modelo. */
  lastFolder: string | null
}

/**
 * Campos que acepta `preferences_update`; los ausentes no se tocan.
 *
 * En `lastFolder` y `lastModelPath`, `null` no es «no tocar» sino «olvidar la
 * ruta»: Rust distingue el campo ausente del campo a `null` (R18).
 */
export interface PreferencesPatch {
  theme?: ThemePreference
  showWelcomeOnStart?: boolean
  engine?: Engine
  lastFolder?: string | null
  lastModelPath?: string | null
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

/** Códigos de error que devuelven los comandos. */
export type AppErrorCode =
  | 'preferences_unreadable'
  | 'preferences_write_failed'
  | 'window_state_failed'
  | 'path_not_found'
  | 'path_not_a_directory'
  | 'path_denied'
  | 'path_invalid'
  | 'path_exists'
  | 'model_read_failed'
  | 'model_write_failed'
  | 'model_stale'
  | 'recents_write_failed'
  | 'trash_unavailable'
  | 'system_command_failed'

/** Sello del archivo en disco; identifica la versión que se leyó o escribió. */
export interface FileStamp {
  modifiedMs: number
  sizeBytes: number
}

/** Qué se lista de una carpeta: solo carpetas, carpetas y modelos, o todo. */
export type ListOnly = 'folders' | 'models' | 'all'

/** Una entrada de carpeta tal como la devuelve `fs_list_directory`. */
export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  sizeBytes: number
  modifiedMs: number
  /** `true` para los `.yaml`. */
  isModel: boolean
}

/** Una ubicación del usuario en la barra lateral de los diálogos de archivo. */
export interface Place {
  id: string
  label: string
  /** Nombre del icono de lucide-react. */
  icon: string
  /** `null` en la ubicación virtual «Recientes». */
  path: string | null
  canCreateFolder: boolean
}

/** Respuesta de `model_read`: el texto del archivo y su sello. */
export interface ModelReadResult {
  text: string
  stamp: FileStamp
}

/** Respuesta de `model_write`: el sello del archivo ya escrito. */
export interface ModelWriteResult {
  stamp: FileStamp
}

/** Respuesta de `model_stat` para una ruta. */
export interface PathStat {
  path: string
  exists: boolean
  stamp: FileStamp | null
}

/** Ruta final de un archivo de modelo, armada por Rust (R9). */
export interface BuiltModelPath {
  path: string
  fileName: string
  exists: boolean
}

/** Nombre y ruta reales de una carpeta recién creada, ya desambiguados. */
export interface CreatedDirectory {
  name: string
  path: string
}

/** Lo que la interfaz manda a `recents_touch`; la marca la pone Rust. */
export interface RecentEntryInput {
  path: string
  name: string
  engine: Engine
  tables: number
  stamp: FileStamp | null
  invalid: boolean
}

/** Una entrada de recientes con el estado del archivo ya resuelto. */
export interface RecentEntryRecord extends RecentEntryInput {
  /** Marca de tiempo del último uso; ordena la lista. */
  usedAtMs: number
  /** Si el archivo sigue en su sitio. */
  exists: boolean
  /** Sello real del disco, para compararlo con el cacheado. */
  diskStamp: FileStamp | null
}

/** Error de un comando, tal como lo serializa Rust. */
export interface AppError {
  code: AppErrorCode
  message: string
}
