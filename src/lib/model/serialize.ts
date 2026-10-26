import { stringify } from 'yaml'

import type { Enum, Model, NamedFields, Relation, Schema, Table, View } from '@/lib/model/types'

/**
 * Escritura del archivo del modelo: {@link Model} a texto YAML.
 *
 * Es el único serializador del proyecto (principio II). El orden de las claves
 * es fijo y las colecciones vacías se omiten, de modo que un modelo recién
 * creado se lee a ojo y la ida y vuelta de la puerta 3 compara textos iguales.
 */

/** Ancho de línea sin límite: no se parten los textos largos. */
const STRINGIFY_OPTIONS = { lineWidth: 0 } as const

/**
 * Copia las claves presentes de un objeto en el orden dado.
 *
 * @param source Objeto del modelo.
 * @param keys Claves en el orden en que se escriben.
 */
function ordered<TSource extends object>(
  source: TSource,
  keys: ReadonlyArray<keyof TSource>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined) out[key as string] = value
  }
  return out
}

/** Pone un esquema en el orden del formato. */
function fromSchema(schema: Schema): Record<string, unknown> {
  return ordered(schema, ['name', 'abbreviation', 'color', 'comment'])
}

/** Pone un índice o un único en el orden del formato. */
function fromNamedFields(named: NamedFields): Record<string, unknown> {
  return ordered(named, ['name', 'fields'])
}

/** Pone una tabla y sus campos en el orden del formato. */
function fromTable(table: Table): Record<string, unknown> {
  const out = ordered(table, [
    'name',
    'schema',
    'comment',
    'fields',
    'primaryKey',
    'uniques',
    'indexes',
    'position',
  ])
  out['fields'] = table.fields.map((field) =>
    ordered(field, ['name', 'type', 'nullable', 'default', 'comment']),
  )
  if (table.uniques) out['uniques'] = table.uniques.map(fromNamedFields)
  if (table.indexes) out['indexes'] = table.indexes.map(fromNamedFields)
  if (table.position) out['position'] = ordered(table.position, ['x', 'y'])
  return out
}

/** Pone una relación en el orden del formato. */
function fromRelation(relation: Relation): Record<string, unknown> {
  return ordered(relation, [
    'name',
    'fromTable',
    'fromFields',
    'toTable',
    'toFields',
    'onDelete',
    'onUpdate',
  ])
}

/** Pone un enumerado en el orden del formato. */
function fromEnum(value: Enum): Record<string, unknown> {
  return ordered(value, ['name', 'schema', 'values', 'comment'])
}

/** Pone una vista en el orden del formato. */
function fromView(view: View): Record<string, unknown> {
  return ordered(view, ['name', 'schema', 'tables', 'comment'])
}

/**
 * Convierte el modelo en el documento plano que se escribe al archivo.
 *
 * Las colecciones opcionales vacías no se escriben; `schemas` siempre está,
 * porque un modelo necesita al menos un esquema (RS-02).
 *
 * @param model Modelo en memoria.
 */
export function toDocument(model: Model): Record<string, unknown> {
  const out: Record<string, unknown> = {
    formatVersion: model.formatVersion,
    name: model.name,
    engine: model.engine,
    schemas: model.schemas.map(fromSchema),
  }
  if (model.enums?.length) out['enums'] = model.enums.map(fromEnum)
  if (model.tables?.length) out['tables'] = model.tables.map(fromTable)
  if (model.relations?.length) out['relations'] = model.relations.map(fromRelation)
  if (model.views?.length) out['views'] = model.views.map(fromView)
  return out
}

/**
 * Escribe el modelo como texto YAML, listo para guardar en el disco.
 *
 * @param model Modelo en memoria.
 */
export function serializeModel(model: Model): string {
  return stringify(toDocument(model), STRINGIFY_OPTIONS)
}
