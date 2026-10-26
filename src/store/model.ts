import { emptyModel } from '@/lib/model/defaults'
import { parseModel } from '@/lib/model/parse'
import { serializeModel } from '@/lib/model/serialize'
import { toFileStem } from '@/lib/model/slug'
import { fileNameOf } from '@/lib/model/summary'
import type { Engine, Model } from '@/lib/model/types'
import {
  CommandError,
  measureModelSaved,
  modelRead,
  modelWrite,
  pathBuildModel,
  preferencesUpdate,
  recentsTouch,
} from '@/lib/tauri/commands'
import type { FileStamp } from '@/lib/tauri/types'
import type { ValidationIssue } from '@/lib/model/validate'
import type { AppSlice } from '@/store/types'

/**
 * Parte del modelo abierto: qué modelo hay en memoria, de qué archivo salió,
 * si tiene cambios sin guardar y el historial de deshacer.
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
  /**
   * Nombre del archivo sin extensión, ya limpio y comprobado por el diálogo.
   *
   * En blanco, el archivo se nombra a partir del nombre del modelo.
   */
  fileStem: string
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
  /** Pasos que se pueden deshacer, el último al final (FR-044, RS-06). */
  past: HistoryStep[]
  /** Pasos que se pueden rehacer, el próximo al principio (FR-044, RS-06). */
  future: HistoryStep[]
  /**
   * Marca de `performance.now()` de cuando se pidió abrir o crear el modelo,
   * o `null` si no hay medida en curso; el Editor la cierra al pintarse
   * (SC-002).
   */
  openStartedMs: number | null
  /** Primer fallo del archivo que no se pudo abrir, para el diálogo (FR-016). */
  fileError: FileErrorState | null
  createModel: (draft: NewModelDraft) => Promise<void>
  openModel: (path: string) => Promise<boolean>
  renameModel: (name: string) => void
  saveModel: (options?: { force?: boolean }) => Promise<boolean>
  saveModelAs: (folder: string) => Promise<boolean>
  closeModel: () => void
  undo: () => void
  redo: () => void
  clearOpenMeasure: () => void
  dismissFileError: () => void
}

/** Lo que se dice cuando el nombre no deja ningún carácter para el archivo. */
export const EMPTY_NAME_ERROR = 'Escribe un nombre para el modelo.'

/** Etiqueta del paso de renombrar, la que se dice al deshacer (RS-06). */
export const RENAME_LABEL = 'renombrar el modelo'

/** Archivo que no se pudo abrir, con la causa que muestra el diálogo. */
export interface FileErrorState {
  path: string
  fileName: string
  issue: ValidationIssue
}

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
 * @param get Lectura del almacén compuesto.
 */
export const createModelSlice: AppSlice<ModelSlice> = (set, get) => ({
  model: null,
  path: null,
  stamp: null,
  savedModel: null,
  isDirty: false,
  savedAtMs: null,
  saveError: null,
  past: [],
  future: [],
  openStartedMs: null,
  fileError: null,

  /**
   * Crea el archivo del modelo y lo abre en el Editor (FR-005).
   *
   * Pasos: toma el nombre del archivo del borrador —o lo deriva del nombre
   * del modelo si viene en blanco— y pide a Rust la ruta final; escribe el
   * modelo vacío sin sello esperado, de modo que un archivo ya existente
   * vuelve como `path_exists` en lugar de pisarse; registra el modelo en
   * recientes; y recuerda la carpeta y el modelo en las preferencias.
   *
   * @param draft Nombre, motor, carpeta y nombre de archivo elegidos en Nuevo
   * modelo.
   * @throws CommandError Si el disco no deja crear el archivo; el diálogo lo
   * muestra y se queda abierto con el borrador intacto.
   */
  async createModel(draft) {
    const startedMs = performance.now()
    const stem = draft.fileStem === '' ? toFileStem(draft.name) : draft.fileStem
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
      past: [],
      future: [],
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

  /**
   * Abre un archivo de modelo en el Editor (FR-014, FR-015).
   *
   * Un archivo que no valida no se abre: su primer fallo queda en `fileError`
   * para que el diálogo diga la línea, y la pantalla no cambia (FR-016). La
   * entrada de recientes se marca como inválida para que su fila lo diga.
   *
   * @param path Ruta absoluta del archivo.
   * @returns `true` si el modelo se abrió.
   */
  async openModel(path) {
    const startedMs = performance.now()
    const fileName = fileNameOf(path)

    let read
    try {
      read = await modelRead(path)
    } catch (error) {
      set({
        fileError: {
          path,
          fileName,
          issue: {
            path: '',
            message: error instanceof Error ? error.message : 'No se pudo leer el archivo.',
            line: 1,
            column: 1,
            code: 'invalid',
          },
        },
      })
      return false
    }

    const parsed = parseModel(read.text)
    if (!parsed.ok) {
      const issue = parsed.errors[0]
      set({
        fileError: {
          path,
          fileName,
          issue: issue ?? {
            path: '',
            message: 'El archivo no es un modelo válido.',
            line: 1,
            column: 1,
            code: 'invalid',
          },
        },
      })
      await recentsTouch({
        path,
        name: fileName,
        engine: 'postgres',
        tables: 0,
        stamp: read.stamp,
        invalid: true,
      }).catch(() => undefined)
      return false
    }

    set({
      model: parsed.model,
      savedModel: parsed.model,
      path,
      stamp: read.stamp,
      isDirty: false,
      savedAtMs: read.stamp.modifiedMs,
      saveError: null,
      past: [],
      future: [],
      openStartedMs: startedMs,
      fileError: null,
      screen: 'editor',
      dialog: null,
      pendingIntent: null,
    })

    await Promise.all([
      recentsTouch({
        path,
        name: parsed.model.name,
        engine: parsed.model.engine,
        tables: tableCount(parsed.model),
        stamp: read.stamp,
        invalid: false,
      }),
      preferencesUpdate({ lastModelPath: path }),
    ]).catch(() => undefined)

    return true
  },

  /**
   * Renombra el modelo abierto, único cambio al contenido que permite este
   * incremento (FR-020).
   *
   * El nombre del archivo no se toca: el modelo y su archivo son cosas
   * distintas. El paso entra en el historial para que ⌘Z lo deshaga.
   *
   * @param name Nombre nuevo del modelo.
   */
  renameModel(name) {
    const { model, savedModel, past } = get()
    const trimmed = name.trim()
    if (model === null || trimmed === '' || trimmed === model.name) return

    const next: Model = { ...model, name: trimmed }
    set({
      model: next,
      past: [...past, { model, label: RENAME_LABEL }],
      future: [],
      isDirty: !isSameModel(next, savedModel),
    })
  },

  /**
   * Guarda el modelo en su archivo (FR-021 a FR-025).
   *
   * Sin cambios no se escribe nada. Si el archivo cambió en el disco desde la
   * última lectura, `model_write` devuelve `model_stale` y aquí se abre el
   * diálogo que pregunta antes de pisarlo; con `force` se repite la escritura
   * ya confirmada. Un fallo deja el modelo «Editado» y la causa a la vista,
   * sin descartar ningún cambio (FR-024).
   *
   * @param options `force` para sobrescribir tras confirmar un `model_stale`.
   * @returns `true` si el archivo quedó escrito o no había nada que escribir.
   */
  async saveModel(options) {
    const { model, path, stamp, isDirty } = get()
    if (model === null || path === null) return false
    if (!isDirty && options?.force !== true) return true

    const startedMs = performance.now()
    try {
      const written = await modelWrite(path, serializeModel(model), stamp, options?.force)
      set({
        savedModel: model,
        stamp: written.stamp,
        isDirty: false,
        savedAtMs: Date.now(),
        saveError: null,
        dialog: get().dialog === 'stale' ? null : get().dialog,
      })

      get().showNotice('Guardado')
      void measureModelSaved(performance.now() - startedMs, tableCount(model)).catch(
        () => undefined,
      )
      await recentsTouch({
        path,
        name: model.name,
        engine: model.engine,
        tables: tableCount(model),
        stamp: written.stamp,
        invalid: false,
      }).catch(() => undefined)
      return true
    } catch (error) {
      if (error instanceof CommandError && error.code === 'model_stale') {
        set({ dialog: 'stale', saveError: null })
        return false
      }
      if (error instanceof CommandError && error.code === 'path_not_found') {
        // La carpeta del modelo ya no está: se ofrece elegir otra (FR-045).
        set({ saveError: error.message })
        get().openChooseFolder('relocate-save', null)
        return false
      }
      const message =
        error instanceof Error ? error.message : 'No se pudo guardar el modelo.'
      set({ saveError: message })
      get().showNotice(`No se pudo guardar: ${message}`)
      return false
    }
  },

  /**
   * Guarda el modelo en otra carpeta y adopta esa ruta (FR-045).
   *
   * Es la salida del guardado que falló porque su carpeta ya no existe: se
   * escribe sin sello esperado, porque allí no había nada que pisar, y la
   * ruta nueva pasa a ser la del modelo, también en Recientes.
   *
   * @param folder Carpeta elegida en Elegir carpeta.
   * @returns `true` si el archivo quedó escrito en la carpeta nueva.
   */
  async saveModelAs(folder) {
    const { model, path } = get()
    if (model === null) return false

    const stem = toFileStem(path === null ? model.name : fileNameOf(path).replace(/\.yaml$/i, ''))
    try {
      const built = await pathBuildModel(folder, stem === '' ? toFileStem(model.name) : stem)
      const written = await modelWrite(built.path, serializeModel(model))
      set({
        path: built.path,
        savedModel: model,
        stamp: written.stamp,
        isDirty: false,
        savedAtMs: Date.now(),
        saveError: null,
        dialog: null,
      })
      get().showNotice('Guardado')

      await Promise.all([
        recentsTouch({
          path: built.path,
          name: model.name,
          engine: model.engine,
          tables: tableCount(model),
          stamp: written.stamp,
          invalid: false,
        }),
        preferencesUpdate({ lastFolder: folder, lastModelPath: built.path }),
      ]).catch(() => undefined)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el modelo.'
      set({ saveError: message })
      get().showNotice(`No se pudo guardar: ${message}`)
      return false
    }
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
      past: [],
      future: [],
      openStartedMs: null,
      fileError: null,
      screen: 'welcome',
      dialog: null,
      pendingIntent: null,
    })
  },

  /**
   * Deshace el último cambio y dice qué deshizo (FR-044, RS-06).
   *
   * `isDirty` se mide contra el modelo del archivo, así que deshacer hasta el
   * estado guardado devuelve el Editor a «Guardado».
   */
  undo() {
    const { past, future, model, savedModel } = get()
    const step = past[past.length - 1]
    if (step === undefined || model === null) return

    set({
      model: step.model,
      past: past.slice(0, -1),
      future: [{ model, label: step.label }, ...future],
      isDirty: !isSameModel(step.model, savedModel),
      notice: `Deshecho: ${step.label}`,
    })
  },

  /** Repone el cambio deshecho y dice qué rehízo (FR-044, RS-06). */
  redo() {
    const { past, future, model, savedModel } = get()
    const [step, ...rest] = future
    if (step === undefined || model === null) return

    set({
      model: step.model,
      past: [...past, { model, label: step.label }],
      future: rest,
      isDirty: !isSameModel(step.model, savedModel),
      notice: `Rehecho: ${step.label}`,
    })
  },

  /** Cierra la medida de SC-002 para que no se vuelva a anotar. */
  clearOpenMeasure() {
    set({ openStartedMs: null })
  },

  /** Olvida el archivo que no se pudo abrir al cerrar su diálogo (FR-016). */
  dismissFileError() {
    set({ fileError: null })
  },
})

