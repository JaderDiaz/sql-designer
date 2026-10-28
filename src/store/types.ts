import type { StateCreator } from 'zustand'

import type { BrowserSlice } from '@/store/browser'
import type { CanvasSlice } from '@/store/canvas'
import type { FieldsPanelSlice } from '@/store/fieldsPanel'
import type { ModelSlice } from '@/store/model'
import type { NavigationSlice } from '@/store/navigation'
import type { PreferencesSlice } from '@/store/preferences'
import type { RecentsSlice } from '@/store/recents'
import type { RelationsSlice } from '@/store/relations'
import type { SchemasSlice } from '@/store/schemas'
import type { TablesSlice } from '@/store/tables'

/**
 * Tipos del almacén único (principio IV de la constitución).
 *
 * Cada dominio de estado vive en su propio archivo y declara su interfaz; aquí
 * se componen en {@link AppState}, que es lo que ve `set` y `get` dentro de
 * cualquier parte. Así una parte puede leer el estado de otra sin que ninguna
 * tenga que importar el almacén ya creado.
 */

/** Estado completo del almacén: la unión de todas sus partes. */
export type AppState = PreferencesSlice &
  NavigationSlice &
  ModelSlice &
  SchemasSlice &
  TablesSlice &
  FieldsPanelSlice &
  RelationsSlice &
  CanvasSlice &
  BrowserSlice &
  RecentsSlice

/**
 * Firma de un creador de parte del almacén.
 *
 * @typeParam TSlice Interfaz que aporta esa parte al estado completo.
 */
export type AppSlice<TSlice> = StateCreator<AppState, [], [], TSlice>
