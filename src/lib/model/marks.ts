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

/** Cómo se lee un extremo de una relación. */
export type CardinalityEnd = 'one' | 'many' | 'zero-or-many' | 'zero-or-one'

/** Los dos extremos de una relación, en el orden en que se leen. */
export interface Cardinality {
  /** Extremo de la tabla referenciada, la que tiene la llave primaria. */
  from: 'one'
  /** Extremo de la tabla que lleva la llave foránea. */
  to: CardinalityEnd
}

/** Cómo se dice cada extremo. */
const END_LABELS: Record<CardinalityEnd, string> = {
  one: 'uno',
  many: 'muchos',
  'zero-or-many': 'cero o muchos',
  'zero-or-one': 'cero o uno',
}

/**
 * Cardinalidad de una relación, como dato (FR-014, SC-011).
 *
 * Es la **única** fuente de la cardinalidad: {@link relationCardinality} la
 * formatea para el inspector y `glyphOf` la dibuja en el lienzo, así que la
 * línea y el texto no pueden discrepar. Sale de dos datos de la tabla que
 * lleva la llave foránea —si sus campos admiten nulos y si son además únicos—
 * y no se guarda en el archivo porque no hace falta: la relación, el
 * `NOT NULL` y el único ya lo dicen (research R5).
 *
 * @param model Modelo completo.
 * @param relation Relación que se lee.
 * @returns El extremo referenciado, siempre «uno», y el de la clave foránea.
 */
export function cardinalityOf(model: Model, relation: Relation): Cardinality {
  const from = (model.tables ?? []).find((table) => table.name === relation.fromTable)
  if (from === undefined) return { from: 'one', to: 'many' }

  const fields = from.fields.filter((field) => relation.fromFields.includes(field.name))
  const nullable = fields.some((field) => field.nullable === true)

  const keys = [from.primaryKey ?? [], ...(from.uniques ?? []).map((item) => item.fields)]
  const unique = keys.some(
    (key) =>
      key.length === relation.fromFields.length &&
      key.every((name) => relation.fromFields.includes(name)),
  )

  if (unique) return { from: 'one', to: nullable ? 'zero-or-one' : 'one' }
  return { from: 'one', to: nullable ? 'zero-or-many' : 'many' }
}

/**
 * Cómo se lee la cardinalidad de una relación (FR-045).
 *
 * Son las cuatro de la leyenda del lienzo de diseño. Desde el Incremento 4 es
 * el formateador de {@link cardinalityOf} y no vuelve a deducir nada, para que
 * el texto del inspector y el glifo de la línea digan siempre lo mismo
 * (SC-011).
 *
 * @param model Modelo completo.
 * @param relation Relación que se lee.
 * @returns La cardinalidad en palabras.
 */
export function relationCardinality(model: Model, relation: Relation): string {
  const cardinality = cardinalityOf(model, relation)
  const first = END_LABELS[cardinality.from]
  return `${first.charAt(0).toUpperCase()}${first.slice(1)} a ${END_LABELS[cardinality.to]}`
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
      (relation.fromTable === target.table &&
        relation.fromFields.includes(target.field as string)) ||
      (relation.toTable === target.table && relation.toFields.includes(target.field as string)),
  )
}
