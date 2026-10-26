import { fileNameOf, summarizeModel, type ModelPreview } from '@/lib/model/summary'
import type { Engine } from '@/lib/model/types'
import {
  fsCreateDirectory,
  fsListDirectory,
  fsUserPlaces,
  modelRead,
} from '@/lib/tauri/commands'
import type { DirectoryEntry, ListOnly, Place } from '@/lib/tauri/types'
import type { AppSlice } from '@/store/types'

/**
 * Parte del explorador de archivos: las ubicaciones del usuario, el contenido
 * de la carpeta en la que se está, el historial de Atrás y Adelante, la
 * búsqueda, la selección y la vista previa.
 *
 * Un solo explorador sirve a los dos diálogos, Abrir modelo y Elegir carpeta
 * (`research.md` R4): lo único que cambia es el filtro `only` y qué se puede
 * seleccionar.
 *
 * El borrador de Nuevo modelo también vive aquí y no en el diálogo, porque
 * Elegir carpeta se abre encima de Nuevo modelo sin cerrarlo: al volver, el
 * nombre y el motor que ya se habían escrito siguen puestos (FR-011).
 */

/** Para qué se abrió Elegir carpeta. */
export type ChoosePurpose = 'new-model' | 'relocate-save'

/** Texto que se muestra cuando la búsqueda no encuentra nada (FR-009). */
export const NO_RESULTS_TITLE = 'Sin resultados'

/** Texto que se muestra cuando la carpeta no tiene ningún modelo (FR-009). */
export const NO_MODELS_TITLE = 'No hay modelos aquí'

/** Explicación que acompaña a «No hay modelos aquí» (FR-009). */
export const NO_MODELS_HINT = 'Los modelos de SQL Designer son archivos .yaml.'

/** Texto que se muestra cuando la carpeta no tiene ninguna subcarpeta (FR-009). */
export const EMPTY_FOLDER_TITLE = 'Carpeta vacía'

/** Explicación que acompaña a «Carpeta vacía» (FR-009). */
export const EMPTY_FOLDER_HINT = 'Crea una carpeta nueva o elige otra ubicación.'

/** Estado y acciones del explorador. */
export interface BrowserSlice {
  /** Ubicaciones del usuario, ya filtradas por las que existen. */
  places: Place[]
  /** Ubicación marcada en la barra lateral, o `null` si no es ninguna. */
  placeId: string | null
  /** Carpeta que se está mirando, o `null` mientras no hay ninguna. */
  browsePath: string | null
  /** Contenido de esa carpeta, tal como lo ordenó Rust. */
  entries: DirectoryEntry[]
  /** Qué se lista: solo carpetas en Elegir carpeta, modelos en Abrir modelo. */
  only: ListOnly
  /** Texto del buscador; filtra en memoria, sin volver al disco (FR-009). */
  query: string
  /** Ruta seleccionada en la lista, o `null` si no hay ninguna. */
  selection: string | null
  /** Vista previa del archivo seleccionado (FR-013). */
  preview: ModelPreview | null
  /** Si la vista previa se está leyendo. */
  isPreviewLoading: boolean
  /** Si el listado se está leyendo. */
  isListing: boolean
  /** Causa del último fallo al listar, ya en español. */
  browseError: string | null
  /** Carpetas visitadas antes de la actual, de la más antigua a la más reciente. */
  browseHistory: string[]
  /** Carpetas de las que se volvió con Atrás, listas para Adelante. */
  browseFuture: string[]
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
  openOpenModel: () => void
  openChooseFolder: (purpose: ChoosePurpose, folder?: string | null) => void
  startNewModelDraft: () => Promise<void>
  setDraftName: (name: string) => void
  setDraftEngine: (engine: Engine) => void
  setDraftFolder: (folder: string) => void
  startBrowsing: (only: ListOnly, folder?: string | null) => Promise<void>
  goToFolder: (path: string) => Promise<void>
  goToPlace: (placeId: string) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  refreshEntries: () => Promise<void>
  setQuery: (query: string) => void
  select: (path: string | null) => Promise<void>
  createFolder: (name: string) => Promise<string | null>
}

/** Ubicación que se usa como carpeta inicial cuando no hay ninguna recordada. */
const DEFAULT_PLACE_IDS = ['documents', 'home', 'desktop']

/** Nombre con el que nace una carpeta nueva (FR-010). */
export const NEW_FOLDER_NAME = 'carpeta sin título'

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
 * Filtra el listado con el texto del buscador.
 *
 * El filtro va en memoria y no vuelve al disco: escribir en el buscador no
 * puede costar una lectura por tecla (FR-009, `research.md` R4).
 *
 * @param entries Contenido de la carpeta.
 * @param query Texto escrito en el buscador.
 */
export function filterEntries(entries: DirectoryEntry[], query: string): DirectoryEntry[] {
  const needle = query.trim().toLocaleLowerCase('es')
  if (needle === '') return entries
  return entries.filter((entry) => entry.name.toLocaleLowerCase('es').includes(needle))
}

/**
 * ¿Se puede seleccionar esta entrada con el filtro activo?
 *
 * En Elegir carpeta solo las carpetas; en Abrir modelo solo los `.yaml`. Lo
 * demás se dibuja atenuado y no responde (FR-012, FR-017).
 *
 * @param entry Entrada de la lista.
 * @param only Filtro del diálogo.
 */
export function isSelectable(entry: DirectoryEntry, only: ListOnly): boolean {
  if (entry.isDirectory) return only === 'folders'
  return only !== 'folders' && entry.isModel
}

/**
 * Crea la parte del explorador.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createBrowserSlice: AppSlice<BrowserSlice> = (set, get) => ({
  places: [],
  placeId: null,
  browsePath: null,
  entries: [],
  only: 'all',
  query: '',
  selection: null,
  preview: null,
  isPreviewLoading: false,
  isListing: false,
  browseError: null,
  browseHistory: [],
  browseFuture: [],
  draftName: '',
  draftEngine: 'postgres',
  draftFolder: null,
  choosePurpose: 'new-model',

  /** Carga las ubicaciones del usuario una sola vez por sesión. */
  async loadPlaces() {
    if (get().places.length > 0) return
    try {
      // Sin listado el campo queda vacío, nunca indefinido: la carpeta inicial
      // se busca sobre este array sin comprobarlo otra vez.
      set({ places: (await fsUserPlaces()) ?? [] })
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
   * Abre Abrir modelo y empieza a explorar por la última carpeta (FR-012).
   */
  openOpenModel() {
    set({ dialog: 'open-model' })
    void get().startBrowsing('models')
  },

  /**
   * Abre Elegir carpeta encima de lo que haya, sin cerrarlo (FR-011).
   *
   * @param purpose Para qué se abre: el borrador de Nuevo modelo o reubicar
   * un guardado que falló porque su carpeta ya no está (FR-045).
   * @param folder Carpeta de partida; por defecto, la del borrador.
   */
  openChooseFolder(purpose, folder) {
    set({ dialog: 'choose-folder', choosePurpose: purpose })
    void get().startBrowsing('folders', folder ?? get().draftFolder)
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

  /**
   * Prepara el explorador para un diálogo: fija el filtro, limpia la búsqueda
   * y el historial, y lista la carpeta de partida (FR-007).
   *
   * @param only Qué se quiere listar.
   * @param folder Carpeta de partida; si no se da, la última usada.
   */
  async startBrowsing(only, folder) {
    await get().loadPlaces()
    const { places, preferences, draftFolder } = get()
    const start = folder ?? preferences.lastFolder ?? draftFolder ?? initialFolder(places)
    set({
      only,
      query: '',
      selection: null,
      preview: null,
      browseHistory: [],
      browseFuture: [],
      entries: [],
      browseError: null,
      browsePath: start,
      placeId: places.find((place) => place.path === start)?.id ?? null,
    })
    if (start !== null) await get().refreshEntries()
  },

  /**
   * Entra en una carpeta, apilando la actual para Atrás (FR-008).
   *
   * @param path Carpeta en la que se entra.
   */
  async goToFolder(path) {
    const { browsePath, browseHistory, places } = get()
    set({
      browseHistory: browsePath === null ? browseHistory : [...browseHistory, browsePath],
      browseFuture: [],
      browsePath: path,
      query: '',
      selection: null,
      preview: null,
      placeId: places.find((place) => place.path === path)?.id ?? null,
    })
    await get().refreshEntries()
  },

  /**
   * Va a una ubicación de la barra lateral (FR-007).
   *
   * @param placeId Identificador de la ubicación elegida.
   */
  async goToPlace(placeId) {
    const place = get().places.find((candidate) => candidate.id === placeId)
    if (!place?.path) return
    await get().goToFolder(place.path)
    set({ placeId })
  },

  /** Vuelve a la carpeta anterior (FR-008). */
  async goBack() {
    const { browseHistory, browseFuture, browsePath, places } = get()
    const previous = browseHistory[browseHistory.length - 1]
    if (previous === undefined) return
    set({
      browseHistory: browseHistory.slice(0, -1),
      browseFuture: browsePath === null ? browseFuture : [browsePath, ...browseFuture],
      browsePath: previous,
      query: '',
      selection: null,
      preview: null,
      placeId: places.find((place) => place.path === previous)?.id ?? null,
    })
    await get().refreshEntries()
  },

  /** Repite la carpeta de la que se volvió con Atrás (FR-008). */
  async goForward() {
    const { browseHistory, browseFuture, browsePath, places } = get()
    const [next, ...rest] = browseFuture
    if (next === undefined) return
    set({
      browseHistory: browsePath === null ? browseHistory : [...browseHistory, browsePath],
      browseFuture: rest,
      browsePath: next,
      query: '',
      selection: null,
      preview: null,
      placeId: places.find((place) => place.path === next)?.id ?? null,
    })
    await get().refreshEntries()
  },

  /** Vuelve a leer el contenido de la carpeta actual. */
  async refreshEntries() {
    const { browsePath, only } = get()
    if (browsePath === null) return
    set({ isListing: true, browseError: null })
    try {
      set({ entries: await fsListDirectory(browsePath, only) })
    } catch (error) {
      set({
        entries: [],
        browseError:
          error instanceof Error ? error.message : 'No se pudo leer el contenido de la carpeta.',
      })
    } finally {
      set({ isListing: false })
    }
  },

  /**
   * Cambia el texto del buscador y suelta la selección que ya no se ve.
   *
   * @param query Texto escrito en el buscador.
   */
  setQuery(query) {
    const { entries, selection } = get()
    const visible = filterEntries(entries, query).some((entry) => entry.path === selection)
    set({
      query,
      selection: visible ? selection : null,
      preview: visible ? get().preview : null,
    })
  },

  /**
   * Selecciona una entrada y, si es un modelo, lee su vista previa (FR-013).
   *
   * @param path Ruta de la entrada, o `null` para soltar la selección.
   */
  async select(path) {
    if (path === null) {
      set({ selection: null, preview: null, isPreviewLoading: false })
      return
    }

    const entry = get().entries.find((candidate) => candidate.path === path)
    if (entry === undefined || !isSelectable(entry, get().only)) return

    set({ selection: path, preview: null })
    if (!entry.isModel) return

    set({ isPreviewLoading: true })
    try {
      const read = await modelRead(path)
      // La selección puede haber cambiado mientras se leía el archivo.
      if (get().selection !== path) return
      set({
        preview: summarizeModel({
          path,
          text: read.text,
          sizeBytes: read.stamp.sizeBytes,
          modifiedMs: read.stamp.modifiedMs,
        }),
      })
    } catch (error) {
      if (get().selection !== path) return
      set({
        preview: {
          name: fileNameOf(path),
          fileName: fileNameOf(path),
          engine: null,
          tables: 0,
          relations: 0,
          sizeBytes: entry.sizeBytes,
          modifiedMs: entry.modifiedMs,
          invalid: true,
          error: {
            path: '',
            message: error instanceof Error ? error.message : 'No se pudo leer el archivo.',
            line: 1,
            column: 1,
            code: 'invalid',
          },
        },
      })
    } finally {
      if (get().selection === path) set({ isPreviewLoading: false })
    }
  },

  /**
   * Crea una carpeta dentro de la actual y la deja seleccionada (FR-010).
   *
   * El nombre definitivo lo decide Rust: si «carpeta sin título» ya existe,
   * vuelve numerado.
   *
   * @param name Nombre pedido para la carpeta nueva.
   * @returns La ruta creada, o `null` si no se pudo crear.
   */
  async createFolder(name) {
    const { browsePath } = get()
    if (browsePath === null) return null
    try {
      const created = await fsCreateDirectory(browsePath, name)
      await get().refreshEntries()
      await get().select(created.path)
      return created.path
    } catch (error) {
      set({
        browseError:
          error instanceof Error ? error.message : 'No se pudo crear la carpeta.',
      })
      return null
    }
  },
})
