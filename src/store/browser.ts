import type { Engine } from '@/lib/model/types'
import { fsUserPlaces } from '@/lib/tauri/commands'
import type { Place } from '@/lib/tauri/types'
import type { AppSlice } from '@/store/types'

/**
 * Parte del explorador de archivos: las ubicaciones del usuario y el borrador
 * de Nuevo modelo.
 *
 * El borrador vive aquí y no en el diálogo porque Elegir carpeta se abre
 * encima de Nuevo modelo sin cerrarlo: al volver, el nombre y el motor que ya
 * se habían escrito siguen puestos (FR-011).
 */

/** Para qué se abrió Elegir carpeta. */
export type ChoosePurpose = 'new-model' | 'relocate-save'

/** Estado y acciones del explorador. */
export interface BrowserSlice {
  /** Ubicaciones del usuario, ya filtradas por las que existen. */
  places: Place[]
  /** Nombre escrito en Nuevo modelo. */
  draftName: string
  /** Motor elegido en Nuevo modelo; arranca con el de Ajustes (RS-10). */
  draftEngine: Engine
  /** Carpeta elegida, o `null` mientras no hay ninguna. */
  draftFolder: string | null
  /** Para qué se abrió Elegir carpeta. */
  choosePurpose: ChoosePurpose
  loadPlaces: () => Promise<void>
  openNewModel: () => void
  startNewModelDraft: () => Promise<void>
  setDraftName: (name: string) => void
  setDraftEngine: (engine: Engine) => void
  setDraftFolder: (folder: string) => void
}

/** Ubicación que se usa como carpeta inicial cuando no hay ninguna recordada. */
const DEFAULT_PLACE_IDS = ['documents', 'home', 'desktop']

/**
 * Elige la carpeta inicial de Nuevo modelo entre las ubicaciones del usuario.
 *
 * @param places Ubicaciones que devolvió el sistema.
 * @returns La ruta de Documentos, o la primera ubicación con ruta que haya.
 */
export function initialFolder(places: Place[]): string | null {
  for (const id of DEFAULT_PLACE_IDS) {
    const place = places.find((candidate) => candidate.id === id)
    if (place?.path) return place.path
  }
  return places.find((place) => place.path !== null)?.path ?? null
}

/**
 * Crea la parte del explorador.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createBrowserSlice: AppSlice<BrowserSlice> = (set, get) => ({
  places: [],
  draftName: '',
  draftEngine: 'postgres',
  draftFolder: null,
  choosePurpose: 'new-model',

  /** Carga las ubicaciones del usuario una sola vez por sesión. */
  async loadPlaces() {
    if (get().places.length > 0) return
    try {
      set({ places: await fsUserPlaces() })
    } catch {
      // Sin ubicaciones el diálogo sigue abriéndose: la carpeta se elige a
      // mano y el aviso de no poder crear llega del propio `model_write`.
      set({ places: [] })
    }
  },

  /**
   * Abre Nuevo modelo (FR-002).
   *
   * El borrador se limpia en el mismo paso que se abre el diálogo, para que no
   * se vea un instante el nombre de la vez anterior; las ubicaciones, que
   * tardan, llegan después y rellenan la carpeta.
   */
  openNewModel() {
    const { preferences, draftFolder } = get()
    set({
      draftName: '',
      draftEngine: preferences.engine,
      draftFolder: preferences.lastFolder ?? draftFolder,
      choosePurpose: 'new-model',
      dialog: 'new-model',
    })
    void get().startNewModelDraft()
  },

  /**
   * Prepara el borrador de Nuevo modelo (FR-002, FR-004).
   *
   * El motor arranca en el de Ajustes y la carpeta en la última usada; si no
   * hay ninguna recordada, en Documentos.
   */
  async startNewModelDraft() {
    await get().loadPlaces()
    const { preferences, places, draftFolder } = get()
    set({
      draftName: '',
      draftEngine: preferences.engine,
      draftFolder: preferences.lastFolder ?? draftFolder ?? initialFolder(places),
      choosePurpose: 'new-model',
    })
  },

  /**
   * Cambia el nombre del borrador.
   *
   * @param name Nombre escrito en el campo.
   */
  setDraftName(name) {
    set({ draftName: name })
  },

  /**
   * Cambia el motor del borrador.
   *
   * @param engine Motor elegido en el control segmentado.
   */
  setDraftEngine(engine) {
    set({ draftEngine: engine })
  },

  /**
   * Cambia la carpeta del borrador.
   *
   * @param folder Ruta elegida en Elegir carpeta.
   */
  setDraftFolder(folder) {
    set({ draftFolder: folder })
  },
})
