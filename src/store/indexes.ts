import {
  DEFAULT_INDEX_PREFIX,
  DEFAULT_UNIQUE_PREFIX,
  INDEX_NEEDS_COLUMN_MESSAGE,
  UNIQUE_NEEDS_TWO_COLUMNS_MESSAGE,
  constraintNameProblem,
  constraintNames,
  isProposedName,
  proposeConstraintName,
  proposeIndexField,
  proposeUniqueFields,
} from '@/lib/model/indexes'
import type { Index, Model, NamedFields, Table } from '@/lib/model/types'
import { pushHistory } from '@/store/model'
import { replaceTable, tablesOf } from '@/store/tables'
import type { AppSlice, AppState } from '@/store/types'

/**
 * Parte de los índices y los únicos compuestos: crearlos, renombrarlos,
 * cambiar sus columnas y eliminarlos (FR-021 a FR-038).
 *
 * Ninguna acción deja el modelo inválido: añadir crea el objeto completo, y un
 * cambio que dejaría un índice sin columnas, un único compuesto con una o un
 * nombre repetido no llega al almacén; la acción devuelve el mensaje y la
 * celda lo enseña (research R11). Los únicos de un campo son la marca UK de
 * «Campos» y estas acciones no los tocan (research R13).
 */

/** Etiqueta del paso de crear un índice (FR-041). */
export const CREATE_INDEX_LABEL = 'crear el índice'

/** Etiqueta del paso de editar un índice (FR-041). */
export const UPDATE_INDEX_LABEL = 'editar el índice'

/** Etiqueta del paso de eliminar un índice (FR-041). */
export const DELETE_INDEX_LABEL = 'eliminar el índice'

/** Etiqueta del paso de crear un único (FR-041). */
export const CREATE_UNIQUE_LABEL = 'crear el único'

/** Etiqueta del paso de editar un único (FR-041). */
export const UPDATE_UNIQUE_LABEL = 'editar el único'

/** Etiqueta del paso de eliminar un único (FR-041). */
export const DELETE_UNIQUE_LABEL = 'eliminar el único'

/** Estado y acciones de la parte de índices y únicos. */
export interface IndexesSlice {
  addIndex: (table: string) => string | null
  setIndexName: (table: string, name: string, next: string) => string | null
  setIndexFields: (table: string, name: string, fields: string[]) => string | null
  setIndexUnique: (table: string, name: string, unique: boolean) => void
  deleteIndex: (table: string, name: string) => void
  addUnique: (table: string) => string | null
  setUniqueName: (table: string, name: string, next: string) => string | null
  setUniqueFields: (table: string, name: string, fields: string[]) => string | null
  deleteUnique: (table: string, name: string) => void
}

/** Qué lista de la tabla toca la acción. */
type ListKey = 'indexes' | 'uniques'

/** La tabla con una lista reescrita; la lista se omite si queda vacía. */
function withList(table: Table, key: ListKey, list: NamedFields[]): Table {
  const next: Table = { ...table }
  if (list.length === 0) delete next[key]
  else if (key === 'indexes') next.indexes = list as Index[]
  else next.uniques = list
  return next
}

/** La tabla de un modelo, por nombre. */
function tableOf(model: Model, name: string): Table | undefined {
  return tablesOf(model).find((table) => table.name === name)
}

/** El elemento editable de una lista: un índice, o un único compuesto. */
function editableOf(table: Table, key: ListKey, name: string): NamedFields | undefined {
  const item = (table[key] ?? []).find((candidate) => candidate.name === name)
  if (item === undefined) return undefined
  if (key === 'uniques' && item.fields.length < 2) return undefined
  return item
}

/** El prefijo de Ajustes para cada lista (FR-024, FR-034). */
function prefixOf(state: AppState, key: ListKey): string {
  return key === 'indexes'
    ? (state.preferences.indexPrefix ?? DEFAULT_INDEX_PREFIX)
    : (state.preferences.uniquePrefix ?? DEFAULT_UNIQUE_PREFIX)
}

/**
 * Crea la parte de índices y únicos.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createIndexesSlice: AppSlice<IndexesSlice> = (set, get) => {
  /**
   * Añade un índice o un único ya completo al final de su lista.
   *
   * @param tableName Tabla.
   * @param key Lista.
   * @param fields Columnas con las que nace.
   * @param label Etiqueta del paso.
   * @returns El nombre que recibió.
   */
  function add(tableName: string, key: ListKey, fields: string[], label: string): string | null {
    const state = get()
    const { model } = state
    if (model === null) return null
    const table = tableOf(model, tableName)
    if (table === undefined) return null

    const name = proposeConstraintName(prefixOf(state, key), tableName, fields, constraintNames(model))
    const list = [...(table[key] ?? []), { name, fields }]
    set(pushHistory(state, replaceTable(model, tableName, withList(table, key, list)), label))
    return name
  }

  /**
   * Cambia un elemento de una lista por otro, en su sitio.
   *
   * @param coalesceKey Clave del gesto, para fusionar lo que se escribe en la
   * celda del nombre en un solo paso.
   */
  function replace(
    tableName: string,
    key: ListKey,
    name: string,
    next: NamedFields,
    label: string,
    coalesceKey?: string,
  ): void {
    const state = get()
    const { model } = state
    if (model === null) return
    const table = tableOf(model, tableName)
    if (table === undefined) return
    const list = (table[key] ?? []).map((item) => (item.name === name ? next : item))
    set(
      pushHistory(
        state,
        replaceTable(model, tableName, withList(table, key, list)),
        label,
        coalesceKey,
      ),
    )
  }

  /** Renombra un índice o un único compuesto (FR-027, FR-036). */
  function rename(
    tableName: string,
    key: ListKey,
    name: string,
    next: string,
    label: string,
  ): string | null {
    const { model } = get()
    if (model === null) return null
    const table = tableOf(model, tableName)
    const item = table === undefined ? undefined : editableOf(table, key, name)
    if (table === undefined || item === undefined) return null
    const problem = constraintNameProblem(model, next, name)
    if (problem !== null) return problem
    if (next === name) return null

    // La clave del gesto es la posición en la lista y no el nombre, que
    // cambia con cada letra: así escribir un nombre entero es un paso.
    const position = (table[key] ?? []).indexOf(item)
    replace(tableName, key, name, { ...item, name: next }, label, `${key}-name:${tableName}:${position}`)
    return null
  }

  /** Cambia las columnas y repropone el nombre si era el propuesto (FR-026, FR-034). */
  function setFields(
    tableName: string,
    key: ListKey,
    name: string,
    fields: string[],
    label: string,
  ): string | null {
    const state = get()
    const { model } = state
    if (model === null) return null
    const table = tableOf(model, tableName)
    const item = table === undefined ? undefined : editableOf(table, key, name)
    if (table === undefined || item === undefined) return null

    if (key === 'indexes' && fields.length === 0) return INDEX_NEEDS_COLUMN_MESSAGE
    if (key === 'uniques' && fields.length < 2) return UNIQUE_NEEDS_TWO_COLUMNS_MESSAGE
    const known = new Set(table.fields.map((field) => field.name))
    if (!fields.every((field) => known.has(field))) return null

    const prefix = prefixOf(state, key)
    let nextName = name
    if (isProposedName(prefix, tableName, item.fields, name)) {
      const taken = constraintNames(model)
      taken.delete(name)
      nextName = proposeConstraintName(prefix, tableName, fields, taken)
    }
    replace(tableName, key, name, { ...item, name: nextName, fields: [...fields] }, label)
    return null
  }

  /** Quita un índice o un único compuesto. */
  function remove(tableName: string, key: ListKey, name: string, label: string): void {
    const state = get()
    const { model } = state
    if (model === null) return
    const table = tableOf(model, tableName)
    if (table === undefined || editableOf(table, key, name) === undefined) return
    const list = (table[key] ?? []).filter((item) => item.name !== name)
    set(pushHistory(state, replaceTable(model, tableName, withList(table, key, list)), label))
  }

  return {
    /**
     * Añade un índice con la columna y el nombre propuestos (FR-023, FR-024).
     *
     * @param table Tabla.
     * @returns El nombre del índice, o `null` si la tabla no existe.
     */
    addIndex(table) {
      const { model } = get()
      if (model === null) return null
      const field = proposeIndexField(model, table)
      if (field === null) return null
      return add(table, 'indexes', [field], CREATE_INDEX_LABEL)
    },

    /**
     * Renombra un índice (FR-027).
     *
     * @returns El mensaje si el nombre no sirve, o `null` si se guardó.
     */
    setIndexName(table, name, next) {
      return rename(table, 'indexes', name, next, UPDATE_INDEX_LABEL)
    },

    /**
     * Cambia las columnas de un índice, en el orden recibido (FR-025, FR-026).
     *
     * @returns El mensaje si se quedaría sin columnas, o `null` si se guardó.
     */
    setIndexFields(table, name, fields) {
      return setFields(table, 'indexes', name, fields, UPDATE_INDEX_LABEL)
    },

    /**
     * Pone o quita la marca de único (FR-029). Quitarla borra la clave.
     */
    setIndexUnique(table, name, unique) {
      const { model } = get()
      if (model === null) return
      const current = tableOf(model, table)
      const item = current === undefined ? undefined : editableOf(current, 'indexes', name)
      if (item === undefined) return
      const index = item as Index
      if ((index.unique === true) === unique) return
      const next: Index = { name: index.name, fields: index.fields }
      if (unique) next.unique = true
      replace(table, 'indexes', name, next, UPDATE_INDEX_LABEL)
    },

    /** Elimina un índice; la lista desaparece si queda vacía. */
    deleteIndex(table, name) {
      remove(table, 'indexes', name, DELETE_INDEX_LABEL)
    },

    /**
     * Añade un único compuesto con dos columnas y el nombre propuestos (FR-033).
     *
     * @returns El nombre, o `null` si la tabla tiene menos de dos campos.
     */
    addUnique(table) {
      const { model } = get()
      if (model === null) return null
      const current = tableOf(model, table)
      const fields = current === undefined ? null : proposeUniqueFields(current)
      if (fields === null) return null
      return add(table, 'uniques', [...fields], CREATE_UNIQUE_LABEL)
    },

    /** Renombra un único compuesto (FR-036). */
    setUniqueName(table, name, next) {
      return rename(table, 'uniques', name, next, UPDATE_UNIQUE_LABEL)
    },

    /**
     * Cambia las columnas de un único compuesto (FR-035).
     *
     * @returns El mensaje si se quedaría con menos de dos, o `null`.
     */
    setUniqueFields(table, name, fields) {
      return setFields(table, 'uniques', name, fields, UPDATE_UNIQUE_LABEL)
    },

    /** Elimina un único compuesto. */
    deleteUnique(table, name) {
      remove(table, 'uniques', name, DELETE_UNIQUE_LABEL)
    },
  }
}
