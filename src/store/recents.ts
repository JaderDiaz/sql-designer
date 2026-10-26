import { parseModel } from '@/lib/model/parse'
import { serializeModel } from '@/lib/model/serialize'
import { fileNameOf, folderOf } from '@/lib/model/summary'
import type { Engine } from '@/lib/model/types'
import {
  CommandError,
  clipboardWriteText,
  modelRead,
  modelWrite,
  recentsList,
  recentsRemove,
  recentsTouch,
  trashMove,
} from '@/lib/tauri/commands'
import type { FileStamp, RecentEntryRecord } from '@/lib/tauri/types'
import type { AppSlice } from '@/store/types'

/**
 * Parte de Recientes: los diez últimos modelos con su estado ya resuelto, y
 * las acciones que se pueden hacer sobre uno sin abrirlo (FR-031 a FR-038).
 *
 * El orden, el tope de diez y la deduplicación por ruta los decide Rust en
 * `recents.json`; aquí solo se resuelve el estado de cada fila y se revalida
 * en segundo plano lo que haya cambiado en el disco (`research.md` R5).
 */

/** Estado de una fila de Recientes (data-model.md §2). */
export type RecentState = 'ok' | 'missing' | 'invalid' | 'stale'

/** Una fila de Recientes tal como la pinta la Bienvenida. */
export interface RecentEntry {
  path: string
  /** Nombre del modelo, el que está dentro del archivo. */
  name: string
  /** Nombre del archivo con su extensión. */
  fileName: string
  /** Carpeta que lo contiene. */
  folder: string
  engine: Engine
  tables: number
  usedAtMs: number
  state: RecentState
}

/** El modelo que se va a renombrar desde una fila de Recientes (FR-036). */
export interface RenameTarget {
  path: string
  name: string
}

/** Estado y acciones de Recientes. */
export interface RecentsSlice {
  /** Filas listas para pintar, ya ordenadas por último uso. */
  recents: RecentEntry[]
  /** Si la lista se está leyendo. */
  isRecentsLoading: boolean
  /** Fila marcada en la lista, o `null` si no hay ninguna. */
  recentSelection: string | null
  /** Reciente que se intentó abrir y ya no está (FR-034). */
  missingTarget: RecentEntry | null
  /** Reciente que se va a mandar a la papelera, pendiente de confirmar (RS-08). */
  trashTarget: RecentEntry | null
  /** Modelo que se está renombrando desde Recientes, o `null` si es el abierto. */
  renameTarget: RenameTarget | null
  refreshRecents: () => Promise<void>
  revalidateStale: () => Promise<void>
  selectRecent: (path: string | null) => void
  openRecent: (path: string) => Promise<void>
  removeRecent: (path: string) => Promise<void>
  copyRecentPath: (path: string) => Promise<void>
  startRenameRecent: (path: string) => void
  renameRecent: (path: string, name: string) => Promise<void>
  startTrashRecent: (path: string) => void
  confirmTrashRecent: () => Promise<void>
  dismissRecentDialogs: () => void
}

/**
 * ¿Coinciden los dos sellos?
 *
 * @param cached Sello que se guardó en `recents.json`.
 * @param disk Sello real del archivo.
 */
function sameStamp(cached: FileStamp | null, disk: FileStamp | null): boolean {
  if (cached === null || disk === null) return cached === disk
  return cached.modifiedMs === disk.modifiedMs && cached.sizeBytes === disk.sizeBytes
}

/**
 * Resuelve el estado de una entrada según la tabla de data-model.md §2.
 *
 * @param record Entrada tal como la devolvió `recents_list`.
 */
export function resolveState(record: RecentEntryRecord): RecentState {
  if (!record.exists) return 'missing'
  if (record.invalid) return 'invalid'
  if (!sameStamp(record.stamp, record.diskStamp)) return 'stale'
  return 'ok'
}

/**
 * Convierte una entrada de la frontera en una fila de la lista.
 *
 * @param record Entrada tal como la devolvió `recents_list`.
 */
export function toEntry(record: RecentEntryRecord): RecentEntry {
  return {
    path: record.path,
    name: record.name,
    fileName: fileNameOf(record.path),
    folder: folderOf(record.path),
    engine: record.engine,
    tables: record.tables,
    usedAtMs: record.usedAtMs,
    state: resolveState(record),
  }
}

/**
 * Fila que queda marcada tras cambiar la lista.
 *
 * El lienzo nunca deja la lista sin selección: si la fila marcada ya no está
 * —o no había ninguna—, se marca la primera, que es el modelo más reciente, y
 * así «Abrir» queda activo desde el primer momento.
 *
 * @param list Lista de recientes ya ordenada.
 * @param current Ruta marcada hasta ahora.
 */
export function resolveSelection(list: RecentEntry[], current: string | null): string | null {
  if (current !== null && list.some((row) => row.path === current)) return current
  return list[0]?.path ?? null
}

/** Texto de la fila según su estado (FR-033). */
export function recentStateLabel(state: RecentState): string | null {
  if (state === 'missing') return 'No encontrado'
  if (state === 'invalid') return 'Archivo con errores'
  return null
}

/**
 * Crea la parte de Recientes.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createRecentsSlice: AppSlice<RecentsSlice> = (set, get) => ({
  recents: [],
  isRecentsLoading: false,
  recentSelection: null,
  missingTarget: null,
  trashTarget: null,
  renameTarget: null,

  /** Vuelve a leer la lista de recientes (FR-031). */
  async refreshRecents() {
    set({ isRecentsLoading: true })
    try {
      const list = (await recentsList()).map(toEntry)
      set({ recents: list, recentSelection: resolveSelection(list, get().recentSelection) })
    } catch {
      // Una lista que no se puede leer se muestra vacía: la Bienvenida sigue
      // funcionando y crear o abrir no dependen de ella.
      set({ recents: [], recentSelection: null })
    } finally {
      set({ isRecentsLoading: false })
    }
  },

  /**
   * Revalida en segundo plano las filas cuyo sello no coincide con el disco
   * (FR-042, `research.md` R5).
   *
   * Solo se leen esas: una lista de diez modelos grandes no puede costar diez
   * lecturas en cada arranque. Lo que se aprende se devuelve al caché con
   * `recents_touch`, así que la próxima vez ya no hace falta.
   */
  async revalidateStale() {
    const pending = get().recents.filter((entry) => entry.state === 'stale')
    if (pending.length === 0) return

    for (const entry of pending) {
      try {
        const read = await modelRead(entry.path)
        const parsed = parseModel(read.text)
        const next = parsed.ok
          ? {
              name: parsed.model.name,
              engine: parsed.model.engine,
              tables: parsed.model.tables?.length ?? 0,
              invalid: false,
            }
          : { name: entry.name, engine: entry.engine, tables: entry.tables, invalid: true }

        await recentsTouch({ path: entry.path, stamp: read.stamp, ...next })
        set({
          recents: get().recents.map((row) =>
            row.path === entry.path
              ? {
                  ...row,
                  name: next.name,
                  engine: next.engine,
                  tables: next.tables,
                  state: next.invalid ? 'invalid' : 'ok',
                }
              : row,
          ),
        })
      } catch {
        set({
          recents: get().recents.map((row) =>
            row.path === entry.path ? { ...row, state: 'invalid' } : row,
          ),
        })
      }
    }
  },

  /**
   * Marca una fila de la lista.
   *
   * @param path Ruta de la fila, o `null` para soltar la selección.
   */
  selectRecent(path) {
    set({ recentSelection: path })
  },

  /**
   * Abre un reciente (FR-032, FR-034).
   *
   * Un archivo que ya no está abre el aviso de no encontrado en vez de
   * intentar leerlo; uno con errores lo resuelve `openModel`, que deja su
   * línea para el diálogo compartido.
   *
   * @param path Ruta del reciente.
   */
  async openRecent(path) {
    const entry = get().recents.find((row) => row.path === path)
    if (entry === undefined) return
    if (entry.state === 'missing') {
      set({ missingTarget: entry })
      return
    }
    await get().openModel(path)
  },

  /**
   * Quita una entrada de la lista sin tocar el archivo (FR-035).
   *
   * @param path Ruta de la entrada que sale de la lista.
   */
  async removeRecent(path) {
    try {
      set({ recents: (await recentsRemove(path)).map(toEntry) })
    } catch {
      set({ recents: get().recents.filter((row) => row.path !== path) })
    }
    const selection = get().recentSelection
    set({
      recentSelection: resolveSelection(get().recents, selection === path ? null : selection),
      missingTarget: null,
      trashTarget: null,
    })
  },

  /**
   * Copia la ruta de un reciente al portapapeles (FR-035).
   *
   * @param path Ruta que se copia.
   */
  async copyRecentPath(path) {
    try {
      await clipboardWriteText(path)
      get().showNotice('Ruta copiada')
    } catch {
      get().showNotice('No se pudo copiar la ruta.')
    }
  },

  /**
   * Abre el diálogo de renombrar sobre un reciente (FR-036).
   *
   * @param path Ruta del reciente que se renombra.
   */
  startRenameRecent(path) {
    const entry = get().recents.find((row) => row.path === path)
    if (entry === undefined) return
    set({ renameTarget: { path, name: entry.name }, dialog: 'rename' })
  },

  /**
   * Renombra el modelo de un reciente sin abrirlo (FR-036).
   *
   * Se lee, se cambia el nombre y se escribe con el sello de esa lectura, de
   * modo que un archivo tocado por fuera avisa igual que al guardar desde el
   * Editor (FR-025). El nombre del archivo no cambia.
   *
   * @param path Ruta del archivo.
   * @param name Nombre nuevo del modelo.
   */
  async renameRecent(path, name) {
    const trimmed = name.trim()
    if (trimmed === '') return

    try {
      const read = await modelRead(path)
      const parsed = parseModel(read.text)
      if (!parsed.ok) {
        const issue = parsed.errors[0]
        set({
          fileError: {
            path,
            fileName: fileNameOf(path),
            issue: issue ?? {
              path: '',
              message: 'El archivo no es un modelo válido.',
              line: 1,
              column: 1,
              code: 'invalid',
            },
          },
          renameTarget: null,
        })
        return
      }

      const next = { ...parsed.model, name: trimmed }
      const written = await modelWrite(path, serializeModel(next), read.stamp)
      await recentsTouch({
        path,
        name: trimmed,
        engine: next.engine,
        tables: next.tables?.length ?? 0,
        stamp: written.stamp,
        invalid: false,
      })
      set({
        recents: get().recents.map((row) =>
          row.path === path ? { ...row, name: trimmed, state: 'ok' } : row,
        ),
        renameTarget: null,
      })
    } catch (error) {
      if (error instanceof CommandError && error.code === 'model_stale') {
        set({ dialog: 'stale', renameTarget: null })
        return
      }
      get().showNotice(
        error instanceof Error ? `No se pudo renombrar: ${error.message}` : 'No se pudo renombrar.',
      )
      set({ renameTarget: null })
    }
  },

  /**
   * Pide confirmación antes de mandar un archivo a la papelera (RS-08).
   *
   * @param path Ruta del archivo.
   */
  startTrashRecent(path) {
    const entry = get().recents.find((row) => row.path === path)
    if (entry === undefined) return
    set({ trashTarget: entry, dialog: 'trash' })
  },

  /**
   * Manda a la papelera el archivo confirmado y lo quita de la lista
   * (FR-037).
   *
   * Si la papelera falla, el archivo sigue donde estaba y la entrada **no**
   * se quita: solo se avisa.
   */
  async confirmTrashRecent() {
    const target = get().trashTarget
    if (target === null) return

    try {
      await trashMove(target.path)
    } catch (error) {
      set({ dialog: null, trashTarget: null })
      get().showNotice(
        error instanceof Error
          ? `No se pudo mover a la papelera: ${error.message}`
          : 'No se pudo mover a la papelera.',
      )
      return
    }

    set({ dialog: null })
    await get().removeRecent(target.path)
    get().showNotice(`«${target.fileName}» está en la Papelera`)
  },

  /** Cierra los avisos propios de Recientes. */
  dismissRecentDialogs() {
    set({ missingTarget: null, trashTarget: null, renameTarget: null, dialog: null })
  },
})
