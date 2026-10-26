import type { StateCreator } from 'zustand'

import type { BrowserSlice } from '@/store/browser'
import type { ModelSlice } from '@/store/model'
import type { NavigationSlice } from '@/store/navigation'
import type { PreferencesSlice } from '@/store/preferences'

/**
 * Tipos del almacén único (principio IV de la constitución).
 *
 * Cada dominio de estado vive en su propio archivo y declara su interfaz; aquí
 * se componen en {@link AppState}, que es lo que ve `set` y `get` dentro de
 * cualquier parte. Así una parte puede leer el estado de otra sin que ninguna
 * tenga que importar el almacén ya creado.
 */

/** Estado completo del almacén: la unión de todas sus partes. */
export type AppState = PreferencesSlice & NavigationSlice & ModelSlice & BrowserSlice

/**
 * Firma de un creador de parte del almacén.
 *
 * @typeParam TSlice Interfaz que aporta esa parte al estado completo.
 */
export type AppSlice<TSlice> = StateCreator<AppState, [], [], TSlice>
