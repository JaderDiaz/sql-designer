import { freeName, indexStateOf } from '@/lib/model/relations'
import { TECHNICAL_NAME_MAX_LENGTH, TECHNICAL_NAME_PATTERN } from '@/lib/model/types'
import type { Model, NamedFields, Table } from '@/lib/model/types'

/**
 * Lo que el dominio sabe de los índices y los únicos: cuáles crean las
 * restricciones, qué nombre proponer, qué columnas proponer, qué falla en un
 * nombre y qué se lleva un campo al eliminarse.
 *
 * Son funciones puras sobre la tabla y el modelo. Nada de lo que se puede
 * deducir se guarda: ni los índices automáticos ni si un nombre es el
 * propuesto (contracts/indexes.md §1, research R9, R10).
 */

/** Prefijo de índices que trae Ajustes por defecto (FR-043). */
export const DEFAULT_INDEX_PREFIX = 'idx_'

/** Prefijo de únicos que trae Ajustes por defecto (FR-043). */
export const DEFAULT_UNIQUE_PREFIX = 'uq_'

/** Tabla sin llave primaria ni únicos (FR-021). */
export const NO_RESTRICTIONS_MESSAGE =
  'Esta tabla no tiene llave primaria ni únicos, así que ninguna restricción crea un índice.'

/** Tabla sin índices propios (FR-030). */
export const NO_INDEXES_MESSAGE =
  'Sin índices adicionales. Añade uno para las columnas por las que más filtras u ordenas, sobre todo las FK.'

/** Tabla sin únicos compuestos (FR-038). */
export const NO_COMPOUND_UNIQUES_MESSAGE =
  'Usa uno cuando la combinación de varias columnas no puede repetirse, por ejemplo torre + número de unidad.'

/** «Añadir único» con menos de dos campos (FR-033). */
export const UNIQUE_NEEDS_TWO_FIELDS_MESSAGE = 'Un único compuesto necesita al menos dos campos.'

/** Nombre vacío (FR-027). */
export const EMPTY_CONSTRAINT_NAME_MESSAGE = 'Escribe un nombre.'

/** Nombre con forma inválida (FR-027, RS-03). */
export const INVALID_CONSTRAINT_NAME_MESSAGE =
  'Usa minúsculas, números y guion bajo, sin empezar por número.'

/** Nombre que no cabe (FR-027). */
export const LONG_CONSTRAINT_NAME_MESSAGE = `El nombre no puede pasar de ${TECHNICAL_NAME_MAX_LENGTH} caracteres.`

/** Nombre repetido en el modelo (FR-027, FR-036). */
export const TAKEN_CONSTRAINT_NAME_MESSAGE = 'Ese nombre ya lo usa otro índice o único del modelo.'

/** Quitar la última columna de un índice (FR-025). */
export const INDEX_NEEDS_COLUMN_MESSAGE = 'Un índice necesita al menos una columna.'

/** Dejar un único compuesto con una columna (FR-035). */
export const UNIQUE_NEEDS_TWO_COLUMNS_MESSAGE =
  'Un único compuesto necesita al menos dos columnas. El de un solo campo se marca con UK en «Campos».'

/** Clase de un índice que crea una restricción (FR-021). */
export type AutomaticIndexKind = 'PRIMARY KEY' | 'UNIQUE'

/** Un índice que crea una restricción; se muestra y no se edita. */
export interface AutomaticIndex {
  name: string
  fields: string[]
  kind: AutomaticIndexKind
}

/** Los únicos de una tabla, separados por número de columnas (research R13). */
export interface SplitUniques {
  /** Los de un campo: la marca UK. */
  single: NamedFields[]
  /** Los de dos o más campos. */
  compound: NamedFields[]
}

/** Lo que se lleva un campo al eliminarse (research R15, FR-039). */
export interface FieldDependents {
  /** Índices no únicos que conservan otras columnas. */
  shrunk: string[]
  /** Índices que desaparecen: los que se quedan sin columnas y todos los únicos. */
  removedIndexes: string[]
  /** Únicos compuestos que desaparecen. */
  removedUniques: string[]
}

/**
 * Nombre del índice de la llave primaria de una tabla (research R9).
 *
 * @param table Nombre de la tabla.
 */
export function primaryKeyIndexName(table: string): string {
  return `pk_${table}`.slice(0, TECHNICAL_NAME_MAX_LENGTH)
}

/**
 * Los índices que crean las restricciones de una tabla (FR-021, research R9).
 *
 * Primero la llave primaria, si la hay; después cada único, en su orden y con
 * su nombre real. Nada de esto se guarda en el archivo.
 *
 * @param table Tabla.
 */
export function automaticIndexes(table: Table): AutomaticIndex[] {
  const out: AutomaticIndex[] = []
  const key = table.primaryKey ?? []
  if (key.length > 0) {
    out.push({ name: primaryKeyIndexName(table.name), fields: [...key], kind: 'PRIMARY KEY' })
  }
  for (const unique of table.uniques ?? []) {
    out.push({ name: unique.name, fields: [...unique.fields], kind: 'UNIQUE' })
  }
  return out
}

/**
 * Separa los únicos de un campo de los compuestos (research R13).
 *
 * @param table Tabla.
 * @returns Los dos grupos, cada uno en el orden del archivo.
 */
export function splitUniques(table: Table): SplitUniques {
  const uniques = table.uniques ?? []
  return {
    single: uniques.filter((item) => item.fields.length === 1),
    compound: uniques.filter((item) => item.fields.length > 1),
  }
}

/**
 * Todos los nombres de índices y únicos del modelo (FR-027).
 *
 * @param model Modelo completo.
 */
export function constraintNames(model: Model): Set<string> {
  const names = new Set<string>()
  for (const table of model.tables ?? []) {
    for (const item of table.uniques ?? []) names.add(item.name)
    for (const item of table.indexes ?? []) names.add(item.name)
  }
  return names
}

/** La base del nombre propuesto, sin sufijo. */
function proposalBase(prefix: string, table: string, fields: readonly string[]): string {
  return [`${prefix}${table}`, ...fields]
    .join('_')
    .slice(0, TECHNICAL_NAME_MAX_LENGTH)
    .replace(/_+$/g, '')
}

/**
 * Nombre propuesto para un índice o un único (FR-024, FR-034, research R10).
 *
 * `<prefijo><tabla>_<campo>_<campo>…`, recortado al largo máximo y con sufijo
 * `_2`, `_3`… hasta no chocar con ningún índice ni único del modelo.
 *
 * @param prefix Prefijo de Ajustes.
 * @param table Nombre de la tabla.
 * @param fields Columnas, en orden.
 * @param taken Nombres ya usados, de {@link constraintNames}.
 */
export function proposeConstraintName(
  prefix: string,
  table: string,
  fields: readonly string[],
  taken: ReadonlySet<string>,
): string {
  return freeName(proposalBase(prefix, table, fields), taken)
}

/**
 * Si un nombre es el que se propondría para esas columnas (FR-026, research R10).
 *
 * Vale con o sin sufijo numérico, porque la propuesta pudo llevarlo. Así no
 * hace falta guardar si el nombre se escribió a mano.
 *
 * @param prefix Prefijo de Ajustes.
 * @param table Nombre de la tabla.
 * @param fields Columnas para las que se compara.
 * @param name Nombre actual.
 */
export function isProposedName(
  prefix: string,
  table: string,
  fields: readonly string[],
  name: string,
): boolean {
  const base = proposalBase(prefix, table, fields)
  if (name === base) return true
  const match = /_(\d+)$/.exec(name)
  if (match === null || Number(match[1]) < 2) return false
  const suffix = match[0]
  return name === `${base.slice(0, TECHNICAL_NAME_MAX_LENGTH - suffix.length)}${suffix}`
}

/**
 * La columna con la que nace un índice (FR-023).
 *
 * La de la primera clave foránea de la tabla que no tiene índice; si no hay,
 * el primer campo fuera de la llave primaria; si tampoco, el primero.
 *
 * @param model Modelo completo.
 * @param table Nombre de la tabla.
 * @returns El nombre del campo, o `null` si la tabla no existe o no tiene campos.
 */
export function proposeIndexField(model: Model, table: string): string | null {
  const current = (model.tables ?? []).find((item) => item.name === table)
  if (current === undefined || current.fields.length === 0) return null

  for (const relation of model.relations ?? []) {
    if (relation.fromTable !== table) continue
    const field = relation.fromFields[0]
    if (field !== undefined && indexStateOf(current, field) === 'missing') return field
  }

  const key = new Set(current.primaryKey ?? [])
  const free = current.fields.find((field) => !key.has(field.name))
  return (free ?? current.fields[0])?.name ?? null
}

/**
 * Las dos columnas con las que nace un único compuesto (FR-033).
 *
 * Los dos primeros campos fuera de la llave primaria; si no llegan a dos, se
 * completa con los de la llave.
 *
 * @param table Tabla.
 * @returns Dos nombres de campo, o `null` si la tabla tiene menos de dos.
 */
export function proposeUniqueFields(table: Table): [string, string] | null {
  if (table.fields.length < 2) return null
  const key = new Set(table.primaryKey ?? [])
  const ordered = [
    ...table.fields.filter((field) => !key.has(field.name)),
    ...table.fields.filter((field) => key.has(field.name)),
  ].map((field) => field.name)
  return [ordered[0] as string, ordered[1] as string]
}

/**
 * Qué falla en el nombre de un índice o de un único (FR-027, FR-036).
 *
 * @param model Modelo completo.
 * @param name Nombre escrito.
 * @param editing Nombre que tenía, que no choca consigo mismo; o `null`.
 * @returns El mensaje, o `null` si el nombre sirve.
 */
export function constraintNameProblem(
  model: Model,
  name: string,
  editing: string | null,
): string | null {
  if (name === '') return EMPTY_CONSTRAINT_NAME_MESSAGE
  if (name.length > TECHNICAL_NAME_MAX_LENGTH) return LONG_CONSTRAINT_NAME_MESSAGE
  if (!TECHNICAL_NAME_PATTERN.test(name)) return INVALID_CONSTRAINT_NAME_MESSAGE
  if (name === editing) return null
  return constraintNames(model).has(name) ? TAKEN_CONSTRAINT_NAME_MESSAGE : null
}

/** Si dos listas de columnas son las mismas, en el mismo orden. */
function sameFields(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((name, index) => right[index] === name)
}

/**
 * El índice o la restricción de la tabla que ya cubre esas columnas (FR-028, FR-037).
 *
 * Mira la llave primaria, los únicos y los índices, salvo el que se edita.
 *
 * @param table Tabla.
 * @param fields Columnas, en orden.
 * @param editing Nombre del índice o único que se edita.
 * @returns El nombre del que repite, o `null`.
 */
export function duplicateOf(table: Table, fields: readonly string[], editing: string): string | null {
  const candidates: NamedFields[] = [
    ...((table.primaryKey ?? []).length > 0
      ? [{ name: primaryKeyIndexName(table.name), fields: table.primaryKey ?? [] }]
      : []),
    ...(table.uniques ?? []),
    ...(table.indexes ?? []),
  ]
  const match = candidates.find(
    (candidate) => candidate.name !== editing && sameFields(candidate.fields, fields),
  )
  return match?.name ?? null
}

/**
 * Qué índices y únicos se lleva un campo al eliminarse (research R15, FR-039).
 *
 * Un índice no único pierde la columna y desaparece si era la única. Un índice
 * único y un único compuesto desaparecen enteros, porque quedarse con menos
 * columnas los haría más estrictos de lo que se definió. El único de un campo
 * no se lista: es la marca UK del propio campo, y se va siempre con él.
 *
 * @param table Tabla.
 * @param field Campo que se elimina.
 */
export function fieldDependents(table: Table, field: string): FieldDependents {
  const shrunk: string[] = []
  const removedIndexes: string[] = []
  for (const index of table.indexes ?? []) {
    if (!index.fields.includes(field)) continue
    if (index.unique === true || index.fields.length === 1) removedIndexes.push(index.name)
    else shrunk.push(index.name)
  }
  const removedUniques = (table.uniques ?? [])
    .filter((unique) => unique.fields.length > 1 && unique.fields.includes(field))
    .map((unique) => unique.name)
  return { shrunk, removedIndexes, removedUniques }
}

/**
 * Aviso de columnas repetidas (FR-028, FR-037).
 *
 * @param name Nombre del índice o restricción que ya las tiene.
 */
export function repeatsColumnsMessage(name: string): string {
  return `Repite las columnas de ${name}.`
}

/**
 * Lo que dice la confirmación de eliminar un campo de cada dependiente (FR-039).
 *
 * @param dependents Lo que devuelve {@link fieldDependents}.
 * @returns Una frase por índice o único, en ese orden.
 */
export function fieldDependentsMessages(dependents: FieldDependents): string[] {
  return [
    ...dependents.shrunk.map((name) => `El índice ${name} perderá esta columna.`),
    ...dependents.removedIndexes.map((name) => `El índice ${name} se eliminará con él.`),
    ...dependents.removedUniques.map((name) => `El único ${name} se eliminará con él.`),
  ]
}
