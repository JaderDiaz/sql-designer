import {
  dropEnums,
  duplicateEnumName,
  enumNameProblem,
  enumValueProblems,
  renameEnumInFields,
} from '@/lib/model/enums'
import type { Enum, Model } from '@/lib/model/types'
import { pushHistory } from '@/store/model'
import type { AppSlice } from '@/store/types'

/**
 * Parte de los enums: abrir su hoja y su confirmación, crearlos, editarlos,
 * duplicarlos y eliminarlos (FR-001 a FR-020).
 *
 * Cada escritura es **un** paso del historial. Renombrar y eliminar cambian a
 * la vez el enum y el tipo de los campos que lo usan, en la misma escritura,
 * para que no haya un instante con campos que apuntan a un tipo que no existe
 * (contracts/enums.md §2, research R2, R3).
 */

/** Etiqueta del paso de crear un enum (FR-041). */
export const CREATE_ENUM_LABEL = 'crear el enum'

/** Etiqueta del paso de editar un enum, también al renombrarlo (FR-041). */
export const UPDATE_ENUM_LABEL = 'editar el enum'

/** Etiqueta del paso de duplicar un enum (FR-041). */
export const DUPLICATE_ENUM_LABEL = 'duplicar el enum'

/** Etiqueta del paso de eliminar un enum (FR-041). */
export const DELETE_ENUM_LABEL = 'eliminar el enum'

/** Lo que la hoja entrega al confirmar. */
export interface EnumDraft {
  /** Nombre ya convertido a nombre técnico. */
  name: string
  /** Esquema elegido (FR-003). */
  schema: string
  /** Valores ya recortados, en el orden de la hoja. */
  values: string[]
}

/** Estado y acciones de la parte de los enums. */
export interface EnumsSlice {
  /** Enum que mira la hoja o la confirmación; `null` para uno nuevo. */
  enumTarget: string | null
  openEnumDialog: (name: string | null) => void
  openDeleteEnumDialog: (name: string) => void
  createEnum: (draft: EnumDraft) => boolean
  updateEnum: (name: string, draft: EnumDraft) => boolean
  duplicateEnum: (name: string) => string | null
  deleteEnum: (name: string) => void
}

/** Los enums del modelo, que es la lista que estas acciones reescriben. */
function enumsOf(model: Model): Enum[] {
  return model.enums ?? []
}

/** Si un borrador sirve: nombre, valores y un esquema que exista. */
function isValidDraft(model: Model, draft: EnumDraft, editing: string | null): boolean {
  return (
    enumNameProblem(model, draft.name, editing) === null &&
    enumValueProblems(draft.values).message === null &&
    model.schemas.some((schema) => schema.name === draft.schema)
  )
}

/**
 * Crea la parte de los enums.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createEnumsSlice: AppSlice<EnumsSlice> = (set, get) => ({
  enumTarget: null,

  /**
   * Abre la hoja del enum (FR-001, FR-010).
   *
   * @param name Enum que editar, o `null` para «Nuevo enum».
   */
  openEnumDialog(name) {
    set({ dialog: 'enum', enumTarget: name })
  },

  /**
   * Abre la confirmación de eliminar un enum (FR-016, FR-020).
   *
   * @param name Enum que se eliminaría.
   */
  openDeleteEnumDialog(name) {
    set({ dialog: 'delete-enum', enumTarget: name })
  },

  /**
   * Añade un enum al final de la lista y cierra la hoja (FR-002 a FR-008).
   *
   * La hoja ya comprobó el borrador; aquí se vuelve a comprobar para no
   * escribir un modelo inválido si alguna vía llamara sin validar.
   *
   * @param draft Nombre, esquema y valores.
   * @returns Si se creó.
   */
  createEnum(draft) {
    const state = get()
    const { model } = state
    if (model === null || !isValidDraft(model, draft, null)) return false

    const created: Enum = { name: draft.name, schema: draft.schema, values: [...draft.values] }
    set({
      ...pushHistory(state, { ...model, enums: [...enumsOf(model), created] }, CREATE_ENUM_LABEL),
      dialog: null,
      enumTarget: null,
    })
    return true
  },

  /**
   * Cambia nombre, esquema y valores de un enum, y cierra la hoja.
   *
   * Si el nombre cambia, los campos que lo usaban pasan al nombre nuevo en la
   * misma escritura (FR-015). Cambiar los valores o el esquema no toca los
   * campos (FR-014). La descripción, que la hoja no edita, se conserva.
   *
   * @param name Nombre que tenía el enum.
   * @param draft Nombre, esquema y valores nuevos.
   * @returns Si se guardó.
   */
  updateEnum(name, draft) {
    const state = get()
    const { model } = state
    if (model === null) return false
    const current = enumsOf(model).find((item) => item.name === name)
    if (current === undefined || !isValidDraft(model, draft, name)) return false

    const updated: Enum = {
      name: draft.name,
      schema: draft.schema,
      values: [...draft.values],
      ...(current.comment === undefined ? {} : { comment: current.comment }),
    }
    const withEnum: Model = {
      ...model,
      enums: enumsOf(model).map((item) => (item.name === name ? updated : item)),
    }
    set({
      ...pushHistory(state, renameEnumInFields(withEnum, name, draft.name), UPDATE_ENUM_LABEL),
      dialog: null,
      enumTarget: null,
    })
    return true
  },

  /**
   * Copia un enum justo después del original, en su mismo esquema (FR-020).
   *
   * La copia lleva los mismos valores y ningún campo la usa.
   *
   * @param name Enum que se copia.
   * @returns El nombre de la copia, o `null` si el enum no existe.
   */
  duplicateEnum(name) {
    const state = get()
    const { model } = state
    if (model === null) return null
    const list = enumsOf(model)
    const position = list.findIndex((item) => item.name === name)
    const source = list[position]
    if (source === undefined) return null

    const copy: Enum = {
      name: duplicateEnumName(model, name),
      schema: source.schema,
      values: [...source.values],
    }
    const enums = [...list.slice(0, position + 1), copy, ...list.slice(position + 1)]
    set(pushHistory(state, { ...model, enums }, DUPLICATE_ENUM_LABEL))
    return copy.name
  },

  /**
   * Elimina un enum y pasa sus campos al tipo de reemplazo (FR-018).
   *
   * Cierra la hoja y la confirmación, que ya no tienen qué mirar.
   *
   * @param name Enum que se elimina.
   */
  deleteEnum(name) {
    const state = get()
    const { model } = state
    if (model === null || !enumsOf(model).some((item) => item.name === name)) return

    set({
      ...pushHistory(state, dropEnums(model, [name]), DELETE_ENUM_LABEL),
      dialog: null,
      enumTarget: null,
    })
  },
})
