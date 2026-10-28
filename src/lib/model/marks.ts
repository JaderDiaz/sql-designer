import type { Model, Relation, Table } from '@/lib/model/types'

/**
 * Marcas de llave de cada campo y relaciones que toca un cambio.
 *
 * Son funciones puras sobre el modelo: la marca no se guarda en el campo, se
 * deduce de `primaryKey`, de `uniques` y de las relaciones, que son lo que
 * viaja en el archivo (FR-029). Así no hay dos verdades que se puedan separar.
 */

/** Marca de un campo tal como se muestra en la tarjeta y en la rejilla. */
export type FieldMark = 'PK' | 'UK' | 'FK' | null

/** Qué elegir con `relationsTouching`. */
export interface RelationTarget {
  /** Tabla que se toca. */
  table: string
  /** Campo de esa tabla; sin él, cuenta toda la tabla. */
  field?: string
}

/**
 * Marca de cada campo de una tabla.
 *
 * Un campo puede ser varias cosas a la vez —llave primaria y llave foránea es
 * lo normal en una tabla de unión—, y entonces gana la marca más fuerte: `PK`,
 * luego `UK`, luego `FK`. La tarjeta del lienzo y la celda «Llave» leen esto
 * (FR-025, FR-047).
 *
 * @param table Tabla del modelo.
 * @param relations Relaciones del modelo; las de otras tablas se ignoran.
 * @returns Mapa de nombre de campo a su marca, con una entrada por campo.
 */
export function fieldMarks(table: Table, relations: Relation[] = []): Map<string, FieldMark> {
  const primary = new Set(table.primaryKey ?? [])
  const unique = new Set((table.uniques ?? []).flatMap((item) => item.fields))
  const foreign = new Set(
    relations.filter((item) => item.fromTable === table.name).flatMap((item) => item.fromFields),
  )

  const marks = new Map<string, FieldMark>()
  for (const field of table.fields) {
    if (primary.has(field.name)) marks.set(field.name, 'PK')
    else if (unique.has(field.name)) marks.set(field.name, 'UK')
    else if (foreign.has(field.name)) marks.set(field.name, 'FK')
    else marks.set(field.name, null)
  }
  return marks
}

/**
 * Si una relación define la llave de un campo, y cuál.
 *
 * La celda «Llave» de un campo que una relación usa es de solo lectura: la
 * llave foránea la gobierna la relación, no el campo (FR-021, FR-025).
 *
 * @param model Modelo completo.
 * @param target Tabla y campo.
 * @returns La relación que lo usa como llave foránea, o `null`.
 */
export function foreignKeyOf(model: Model, target: RelationTarget): Relation | null {
  if (target.field === undefined) return null
  const found = (model.relations ?? []).find(
    (relation) =>
      relation.fromTable === target.table && relation.fromFields.includes(target.field as string),
  )
  return found ?? null
}

/**
 * Relaciones que se eliminarían al eliminar una tabla o un campo.
 *
 * Las usan las dos confirmaciones del incremento, que tienen que decir qué se
 * lleva el borrado antes de hacerlo (FR-019, FR-039).
 *
 * @param model Modelo completo.
 * @param target Tabla, y campo cuando se elimina solo un campo.
 * @returns Las relaciones afectadas, en el orden del modelo.
 */
export function relationsTouching(model: Model, target: RelationTarget): Relation[] {
  const relations = model.relations ?? []
  if (target.field === undefined) {
    return relations.filter(
      (relation) => relation.fromTable === target.table || relation.toTable === target.table,
    )
  }
  return relations.filter(
    (relation) =>
      (relation.fromTable === target.table && relation.fromFields.includes(target.field as string)) ||
      (relation.toTable === target.table && relation.toFields.includes(target.field as string)),
  )
}
