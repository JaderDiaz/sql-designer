import { emptyModel } from '@/lib/model/defaults'
import { serializeModel } from '@/lib/model/serialize'
import { toFileStem } from '@/lib/model/slug'
import type { Engine, Model } from '@/lib/model/types'
import {
  CommandError,
  modelWrite,
  pathBuildModel,
  preferencesUpdate,
  recentsTouch,
} from '@/lib/tauri/commands'
import type { FileStamp } from '@/lib/tauri/types'
import type { AppSlice } from '@/store/types'

/**
 * Parte del modelo abierto: qué modelo hay en memoria, de qué archivo salió y
 * si tiene cambios sin guardar.
 *
 * Nada se escribe en el disco hasta que el usuario guarda (RS-07), con una
 * excepción deliberada: crear un modelo escribe el archivo en ese momento,
 * porque el archivo **es** el modelo y hasta que existe no hay nada que abrir
 * (FR-005).
 */

/** Lo que hace falta para crear un modelo nuevo. */
export interface NewModelDraft {
  name: string
  engine: Engine
  folder: string
}

/** Un paso del historial, con la etiqueta de qué cambió (RS-06). */
export interface HistoryStep {
  model: Model
  label: string
}

/** Estado y acciones de la parte del modelo. */
export interface ModelSlice {
  /** Modelo en memoria, o `null` mientras no hay ninguno abierto. */
  model: Model | null
  /** Ruta del archivo del que salió. */
  path: string | null
  /** Sello de la última lectura o escritura, para detectar cambios por fuera. */
  stamp: FileStamp | null
  /** Modelo tal como está en el archivo; `isDirty` se mide contra él. */
  savedModel: Model | null
  /** Si hay cambios sin guardar (RS-07). */
  isDirty: boolean
  /** Hora del último guardado, para «Guardado · <motor>» (FR-018). */
  savedAtMs: number | null
  /** Causa del último fallo al guardar, si lo hubo (FR-024). */
  saveError: string | null
  /**
   * Marca de `performance.now()` de cuando se pidió abrir o crear el modelo,
   * o `null` si no hay medida en curso; el Editor la cierra al pintarse
   * (SC-002).
   */
  openStartedMs: number | null
  createModel: (draft: NewModelDraft) => Promise<void>
  closeModel: () => void
  clearOpenMeasure: () => void
}

/** Lo que se dice cuando el nombre no deja ningún carácter para el archivo. */
export const EMPTY_NAME_ERROR = 'Escribe un nombre para el modelo.'

/**
 * ¿Son el mismo modelo? Se comparan por el texto que se escribiría al disco,
 * que es lo que de verdad decide si hay algo que guardar.
 *
 * @param left Un modelo, o `null`.
 * @param right El otro modelo, o `null`.
 */
export function isSameModel(left: Model | null, right: Model | null): boolean {
  if (left === right) return true
  if (left === null || right === null) return false
  return serializeModel(left) === serializeModel(right)
}

/** Número de tablas del modelo, que es lo que cachean los recientes. */
function tableCount(model: Model): number {
  return model.tables?.length ?? 0
}

/**
 * Crea la parte del modelo.
 *
 * @param set Escritura del almacén compuesto.
 */
export const createModelSlice: AppSlice<ModelSlice> = (set) => ({
  model: null,
  path: null,
  stamp: null,
  savedModel: null,
  isDirty: false,
  savedAtMs: null,
  saveError: null,
  openStartedMs: null,

  /**
   * Crea el archivo del modelo y lo abre en el Editor (FR-005).
   *
   * Pasos: arma el nombre del archivo y pide a Rust la ruta final; escribe el
   * modelo vacío sin sello esperado, de modo que un archivo ya existente
   * vuelve como `path_exists` en lugar de pisarse; registra el modelo en
   * recientes; y recuerda la carpeta y el modelo en las preferencias.
   *
   * @param draft Nombre, motor y carpeta elegidos en Nuevo modelo.
   * @throws CommandError Si el disco no deja crear el archivo; el diálogo lo
   * muestra y se queda abierto con el borrador intacto.
   */
  async createModel(draft) {
    const startedMs = performance.now()
    const stem = toFileStem(draft.name)
    if (stem === '') throw new Error(EMPTY_NAME_ERROR)

    const name = draft.name.trim()
    const built = await pathBuildModel(draft.folder, stem)
    const model = emptyModel(name, draft.engine)
    const written = await modelWrite(built.path, serializeModel(model))

    set({
      model,
      savedModel: model,
      path: built.path,
      stamp: written.stamp,
      isDirty: false,
      savedAtMs: Date.now(),
      saveError: null,
      openStartedMs: startedMs,
      screen: 'editor',
      dialog: null,
    })

    await Promise.all([
      recentsTouch({
        path: built.path,
        name,
        engine: draft.engine,
        tables: tableCount(model),
        stamp: written.stamp,
        invalid: false,
      }),
      preferencesUpdate({ lastFolder: draft.folder, lastModelPath: built.path }),
    ]).catch((error: unknown) => {
      // El modelo ya está en el disco: que recientes o preferencias fallen no
      // se lleva por delante el archivo creado, solo se anota.
      set({
        saveError:
          error instanceof CommandError
            ? `El modelo se creó, pero no se pudo recordar: ${error.message}`
            : null,
      })
    })
  },

  /** Cierra el modelo y vuelve a la Bienvenida, sin tocar el disco. */
  closeModel() {
    set({
      model: null,
      savedModel: null,
      path: null,
      stamp: null,
      isDirty: false,
      savedAtMs: null,
      saveError: null,
      openStartedMs: null,
      screen: 'welcome',
      dialog: null,
    })
  },

  /** Cierra la medida de SC-002 para que no se vuelva a anotar. */
  clearOpenMeasure() {
    set({ openStartedMs: null })
  },
})
