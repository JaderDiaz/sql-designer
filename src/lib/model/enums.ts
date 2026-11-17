import { textTypeOf, typesOf } from '@/lib/model/engines'
import { freeName } from '@/lib/model/relations'
import { TECHNICAL_NAME_MAX_LENGTH } from '@/lib/model/types'
import type { Engine, Field, Model, Table } from '@/lib/model/types'

/**
 * Lo que el dominio sabe de los enums: qué clase de tipo es un nombre, quién
 * usa un enum, qué falla en la hoja y cómo se renombra o se elimina sin dejar
 * campos con un tipo que no existe.
 *
 * Son funciones puras sobre el modelo. Las reglas de la hoja viven aquí y no
 * en el validador del archivo, que no se endurece: un archivo que hoy se abre
 * se sigue abriendo (contracts/enums.md §1, research R4).
 */

/** Largo máximo de un valor de enum (FR-007). */
export const ENUM_VALUE_MAX_LENGTH = TECHNICAL_NAME_MAX_LENGTH

/** Longitud del tipo de reemplazo cuando el motor la admite (FR-018). */
export const REPLACEMENT_LENGTH = 40

/** Sufijo del nombre de la copia de un enum (FR-020). */
const COPY_SUFFIX = '_copia'

/** Sin esquemas no hay dónde crear un enum (FR-004). */
export const NO_SCHEMA_ENUM_MESSAGE = 'Primero crea un esquema: un enum vive dentro de uno.'

/** Nombre vacío (FR-005). */
export const EMPTY_ENUM_NAME_MESSAGE = 'Escribe un nombre para el enum.'

/** Nombre repetido o igual a un tipo del motor (FR-005). */
export const TAKEN_ENUM_NAME_MESSAGE = 'Ese nombre ya lo usa otro tipo.'

/** Nombre que no cabe (FR-005). */
export const LONG_ENUM_NAME_MESSAGE = `El nombre no puede pasar de ${TECHNICAL_NAME_MAX_LENGTH} caracteres.`

/** Un enum sin valores (FR-006). */
export const NO_VALUES_MESSAGE = 'Añade al menos un valor.'

/** La lista vacía antes de intentar guardar (contracts/enums.md §5). */
export const EMPTY_LIST_HINT = 'Aún no hay valores. Escribe el primero abajo y pulsa Enter.'

/** Valores repetidos (FR-007). */
export const DUPLICATE_VALUES_MESSAGE = 'Hay valores repetidos.'

/** Valores vacíos (FR-007). */
export const EMPTY_VALUES_MESSAGE = 'Hay valores vacíos.'

/** Un enum que ningún campo usa, en la hoja (FR-013). */
export const NO_USAGE_MESSAGE = 'Ningún campo lo usa todavía.'

/** Qué clase de tipo es un nombre en un modelo (research R1). */
export type TypeKind = 'engine' | 'enum' | 'unknown'

/** Un campo que usa un enum. */
export interface EnumUsage {
  /** Tabla del campo. */
  table: string
  /** Nombre del campo. */
  field: string
}

/** Qué le pasa a cada fila de la hoja (FR-007). */
export type EnumValueProblem = 'empty' | 'duplicate' | null

/** Los problemas de la lista de valores. */
export interface EnumValueProblems {
  /** Uno por fila, en el mismo orden. */
  rows: EnumValueProblem[]
  /** El mensaje de la hoja, uno solo, o `null` si no hay ninguno. */
  message: string | null
}

/** El tipo al que pasan los campos de un enum que se elimina (FR-018). */
export interface ReplacementType {
  type: string
  /** Solo cuando el tipo admite longitud. */
  length?: number
}

/**
 * Qué clase de tipo es un nombre (research R1).
 *
 * El tipo del motor gana al enum del mismo nombre: un archivo con un enum
 * `text` es válido, pero sus campos de tipo `text` son el texto del motor. La
 * hoja impide crear ese caso (FR-005).
 *
 * @param model Modelo completo.
 * @param type Nombre del tipo de un campo.
 * @returns `'engine'`, `'enum'` o `'unknown'`.
 */
export function typeKindOf(model: Model, type: string): TypeKind {
  if (typesOf(model.engine).includes(type)) return 'engine'
  if ((model.enums ?? []).some((item) => item.name === type)) return 'enum'
  return 'unknown'
}

/**
 * Los campos que usan un enum como tipo (research R19).
 *
 * La leen la hoja («Usado por»), la cabecera del menú contextual y la
 * confirmación de eliminar, así que las tres cuentan lo mismo (SC-004).
 *
 * @param model Modelo completo.
 * @param name Nombre del enum.
 * @returns Tabla y campo, en el orden de las tablas y de sus campos. Vacía si
 * nadie lo usa o si el nombre es un tipo del motor.
 */
export function enumUsage(model: Model, name: string): EnumUsage[] {
  if (typesOf(model.engine).includes(name)) return []
  const usage: EnumUsage[] = []
  for (const table of model.tables ?? []) {
    for (const field of table.fields) {
      if (field.type === name) usage.push({ table: table.name, field: field.name })
    }
  }
  return usage
}

/**
 * Qué falla en el nombre de un enum (FR-005).
 *
 * @param model Modelo completo.
 * @param name Nombre ya convertido a nombre técnico.
 * @param editing Nombre del enum que se edita, que no choca consigo mismo; o
 * `null` para uno nuevo.
 * @returns El mensaje, o `null` si el nombre sirve.
 */
export function enumNameProblem(model: Model, name: string, editing: string | null): string | null {
  if (name === '') return EMPTY_ENUM_NAME_MESSAGE
  if (name.length > TECHNICAL_NAME_MAX_LENGTH) return LONG_ENUM_NAME_MESSAGE
  if (typesOf(model.engine).includes(name)) return TAKEN_ENUM_NAME_MESSAGE
  const taken = (model.enums ?? []).some((item) => item.name === name && item.name !== editing)
  return taken ? TAKEN_ENUM_NAME_MESSAGE : null
}

/**
 * Limpia lo escrito en una fila de valor (FR-007).
 *
 * Quita las comillas simples, que romperían el SQL del enum, y recorta al
 * largo máximo. Los espacios de los extremos no se tocan mientras se escribe:
 * se recortan al guardar.
 *
 * @param text Lo escrito.
 * @returns El valor que se queda en la fila.
 */
export function cleanEnumValue(text: string): string {
  return text.replace(/'/g, '').slice(0, ENUM_VALUE_MAX_LENGTH)
}

/** La clave con la que se comparan dos valores (FR-007). */
function valueKey(value: string): string {
  return value.trim().toLocaleLowerCase('es')
}

/**
 * Qué falla en la lista de valores de la hoja (FR-006, FR-007).
 *
 * Dos valores se comparan sin mayúsculas ni espacios de los extremos; se marca
 * como repetida la segunda aparición y las siguientes. El mensaje es uno solo,
 * con esta prioridad: sin valores, repetidos, vacíos.
 *
 * @param values Los valores tal como están en la hoja.
 * @returns El problema de cada fila y el mensaje de la hoja.
 */
export function enumValueProblems(values: readonly string[]): EnumValueProblems {
  const seen = new Set<string>()
  const rows = values.map((value): EnumValueProblem => {
    const key = valueKey(value)
    if (key === '') return 'empty'
    if (seen.has(key)) return 'duplicate'
    seen.add(key)
    return null
  })

  const message =
    values.length === 0
      ? NO_VALUES_MESSAGE
      : rows.includes('duplicate')
        ? DUPLICATE_VALUES_MESSAGE
        : rows.includes('empty')
          ? EMPTY_VALUES_MESSAGE
          : null
  return { rows, message }
}

/**
 * Nombre de la copia de un enum (FR-020).
 *
 * `<nombre>_copia`, y si ya existe, `<nombre>_copia_2`, `_3`… El nombre del
 * original se recorta para que el sufijo quepa en el largo máximo.
 *
 * @param model Modelo completo.
 * @param name Nombre del enum que se copia.
 * @returns Un nombre técnico que ningún enum usa.
 */
export function duplicateEnumName(model: Model, name: string): string {
  const base = `${name.slice(0, TECHNICAL_NAME_MAX_LENGTH - COPY_SUFFIX.length)}${COPY_SUFFIX}`
  return freeName(base, new Set((model.enums ?? []).map((item) => item.name)))
}

/** Cambia el tipo de los campos de una tabla con una función; la misma tabla si nada cambia. */
function retypeTable(table: Table, retype: (field: Field) => Field | null): Table {
  let changed = false
  const fields = table.fields.map((field) => {
    const next = retype(field)
    if (next === null) return field
    changed = true
    return next
  })
  return changed ? { ...table, fields } : table
}

/** Cambia el tipo de los campos de todo el modelo; el mismo modelo si nada cambia. */
function retypeModel(model: Model, retype: (field: Field) => Field | null): Model {
  const tables = model.tables
  if (tables === undefined) return model
  let changed = false
  const next = tables.map((table) => {
    const updated = retypeTable(table, retype)
    if (updated !== table) changed = true
    return updated
  })
  return changed ? { ...model, tables: next } : model
}

/**
 * Pasa los campos de un enum a su nombre nuevo (research R2, FR-015).
 *
 * Solo cambia `type`: la longitud, la escala y el valor por defecto se quedan
 * como estaban. Un nombre que es tipo del motor no se toca, porque sus campos
 * son de ese tipo y no del enum (research R1).
 *
 * @param model Modelo completo.
 * @param from Nombre que tenía el enum.
 * @param to Nombre nuevo.
 * @returns El modelo con los campos retipados; el mismo objeto si nadie lo usa.
 */
export function renameEnumInFields(model: Model, from: string, to: string): Model {
  if (from === to || typesOf(model.engine).includes(from)) return model
  return retypeModel(model, (field) => (field.type === from ? { ...field, type: to } : null))
}

/**
 * Tipo al que pasan los campos de un enum eliminado (research R3, FR-018).
 *
 * `varchar` de 40 si el motor lo ofrece; si no, el tipo de texto del motor,
 * sin longitud. Se pregunta al catálogo y no se escribe una tabla por motor.
 *
 * @param engine Motor del modelo.
 */
export function replacementTypeOf(engine: Engine): ReplacementType {
  if (typesOf(engine).includes('varchar')) return { type: 'varchar', length: REPLACEMENT_LENGTH }
  return { type: textTypeOf(engine) }
}

/**
 * Cómo se lee el tipo de reemplazo: `varchar(40)` o `text` (contracts/enums.md §5).
 *
 * @param replacement Tipo de {@link replacementTypeOf}.
 */
export function replacementTypeLabel(replacement: ReplacementType): string {
  return replacement.length === undefined
    ? replacement.type
    : `${replacement.type}(${replacement.length})`
}

/**
 * Quita enums y pasa sus campos al tipo de reemplazo (research R3, FR-018, FR-019).
 *
 * Lo usan eliminar un enum y eliminar un esquema con sus enums, para que los
 * dos caminos no diverjan. Los campos pierden la escala y toman la longitud
 * del reemplazo, o ninguna. La lista `enums` desaparece si queda vacía.
 *
 * @param model Modelo completo.
 * @param names Nombres de los enums que se van.
 * @returns El modelo sin esos enums y sin campos que los usen.
 */
export function dropEnums(model: Model, names: readonly string[]): Model {
  if (names.length === 0) return model
  const engineTypes = typesOf(model.engine)
  const gone = new Set(names.filter((name) => !engineTypes.includes(name)))
  const replacement = replacementTypeOf(model.engine)

  const retyped = retypeModel(model, (field) => {
    if (!gone.has(field.type)) return null
    const next: Field = { ...field, type: replacement.type }
    delete next.scale
    if (replacement.length === undefined) delete next.length
    else next.length = replacement.length
    return next
  })

  const kept = (model.enums ?? []).filter((item) => !names.includes(item.name))
  const next: Model = { ...retyped }
  if (kept.length === 0) delete next.enums
  else next.enums = kept
  return next
}

/**
 * Cómo se escribe «4 valores» o «1 valor».
 *
 * @param count Cuántos valores.
 */
export function valueCountLabel(count: number): string {
  return count === 1 ? '1 valor' : `${count} valores`
}

/**
 * Cómo se escribe «2 campos», «1 campo» o «sin uso».
 *
 * @param count Cuántos campos lo usan.
 */
export function usageCountLabel(count: number): string {
  if (count === 0) return 'sin uso'
  return count === 1 ? '1 campo' : `${count} campos`
}

/**
 * Título de la confirmación de eliminar (contracts/enums.md §5).
 *
 * @param name Nombre del enum.
 */
export function deleteEnumTitle(name: string): string {
  return `¿Eliminar el enum «${name}»?`
}

/**
 * Lo que dice la confirmación de eliminar un enum (FR-016, FR-017).
 *
 * Nombra cada campo como `tabla.campo` y el tipo al que pasarán; sin uso, lo
 * dice así.
 *
 * @param usage Campos que usan el enum, de {@link enumUsage}.
 * @param replacement Tipo de {@link replacementTypeOf}.
 */
export function deleteEnumDescription(usage: readonly EnumUsage[], replacement: ReplacementType): string {
  if (usage.length === 0) return 'Ningún campo lo usa.'
  const fields = usage.map((item) => `${item.table}.${item.field}`).join(', ')
  const type = replacementTypeLabel(replacement)
  return usage.length === 1
    ? `1 campo lo usa (${fields}) y pasará a ${type}.`
    : `${usage.length} campos lo usan (${fields}) y pasarán a ${type}.`
}
