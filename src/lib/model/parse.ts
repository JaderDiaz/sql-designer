import { LineCounter, parseDocument } from 'yaml'

import type {
  Enum,
  Field,
  Model,
  NamedFields,
  Position,
  ReferentialAction,
  Relation,
  Schema,
  Table,
  View,
} from '@/lib/model/types'
import { validateModel } from '@/lib/model/validate'
import type { Locate, ValidationIssue, ValuePath } from '@/lib/model/validate'

/**
 * Lectura del archivo del modelo: texto YAML a {@link Model}.
 *
 * Es el único lector del formato (principio II): la vista previa de Abrir
 * modelo y la apertura en el Editor pasan los dos por aquí. El error de
 * sintaxis llega de la librería `yaml` con su línea; el de validación, de
 * `validate.ts`.
 */

/** Resultado de leer un archivo del modelo. */
export type ParseResult =
  | { ok: true; model: Model }
  | { ok: false; errors: ValidationIssue[] }

/** Primera línea y columna del archivo, cuando no se sabe situar el fallo. */
const START = { line: 1, column: 1 }

/**
 * Construye la función que sitúa una ruta del documento en el texto.
 *
 * Si la ruta exacta no tiene nodo (por ejemplo una clave que falta), se sube
 * por la ruta hasta el primer nodo que sí lo tenga, para que el diálogo señale
 * el sitio más cercano al fallo en lugar del principio del archivo.
 */
function createLocator(
  doc: ReturnType<typeof parseDocument>,
  lineCounter: LineCounter,
): Locate {
  const offsetOf = (path: ValuePath): number | null => {
    const node: unknown = path.length === 0 ? doc.contents : doc.getIn(path, true)
    if (node !== null && typeof node === 'object' && 'range' in node) {
      const range = (node as { range?: [number, number, number] }).range
      if (range) return range[0]
    }
    return null
  }

  return (path) => {
    for (let end = path.length; end >= 0; end -= 1) {
      const offset = offsetOf(path.slice(0, end))
      if (offset === null) continue
      const { line, col } = lineCounter.linePos(offset)
      return { line, column: col }
    }
    return START
  }
}

/** Copia una clave de texto solo si está presente. */
function withText<TKey extends string>(
  source: Record<string, unknown>,
  key: TKey,
): Record<TKey, string> | Record<string, never> {
  const value = source[key]
  return typeof value === 'string' ? ({ [key]: value } as Record<TKey, string>) : {}
}

/** Rearma un esquema validado. */
function toSchema(source: Record<string, unknown>): Schema {
  return {
    name: source['name'] as string,
    abbreviation: source['abbreviation'] as string,
    ...withText(source, 'color'),
    ...withText(source, 'comment'),
  }
}

/** Rearma un campo validado. */
function toField(source: Record<string, unknown>): Field {
  return {
    name: source['name'] as string,
    type: source['type'] as string,
    ...(typeof source['nullable'] === 'boolean' ? { nullable: source['nullable'] } : {}),
    ...withText(source, 'default'),
    ...withText(source, 'comment'),
  }
}

/** Rearma un índice o un único validado. */
function toNamedFields(source: Record<string, unknown>): NamedFields {
  return { name: source['name'] as string, fields: source['fields'] as string[] }
}

/** Rearma una tabla validada. */
function toTable(source: Record<string, unknown>): Table {
  const uniques = source['uniques'] as Array<Record<string, unknown>> | undefined
  const indexes = source['indexes'] as Array<Record<string, unknown>> | undefined
  const position = source['position'] as Position | undefined
  return {
    name: source['name'] as string,
    schema: source['schema'] as string,
    ...withText(source, 'comment'),
    fields: (source['fields'] as Array<Record<string, unknown>>).map(toField),
    ...(Array.isArray(source['primaryKey']) ? { primaryKey: source['primaryKey'] as string[] } : {}),
    ...(uniques ? { uniques: uniques.map(toNamedFields) } : {}),
    ...(indexes ? { indexes: indexes.map(toNamedFields) } : {}),
    ...(position ? { position: { x: position.x, y: position.y } } : {}),
  }
}

/** Rearma una relación validada. */
function toRelation(source: Record<string, unknown>): Relation {
  return {
    name: source['name'] as string,
    fromTable: source['fromTable'] as string,
    fromFields: source['fromFields'] as string[],
    toTable: source['toTable'] as string,
    toFields: source['toFields'] as string[],
    ...(typeof source['onDelete'] === 'string'
      ? { onDelete: source['onDelete'] as ReferentialAction }
      : {}),
    ...(typeof source['onUpdate'] === 'string'
      ? { onUpdate: source['onUpdate'] as ReferentialAction }
      : {}),
  }
}

/** Rearma un enumerado validado. */
function toEnum(source: Record<string, unknown>): Enum {
  return {
    name: source['name'] as string,
    schema: source['schema'] as string,
    values: source['values'] as string[],
    ...withText(source, 'comment'),
  }
}

/** Rearma una vista validada. */
function toView(source: Record<string, unknown>): View {
  return {
    name: source['name'] as string,
    schema: source['schema'] as string,
    tables: source['tables'] as string[],
    ...withText(source, 'comment'),
  }
}

/**
 * Rearma el modelo a partir del documento ya validado.
 *
 * Las colecciones ausentes se quedan ausentes, no vacías: así el serializador
 * vuelve a escribir el mismo archivo y la ida y vuelta compara textos iguales
 * (puerta 3).
 */
function toModel(source: Record<string, unknown>): Model {
  const enums = source['enums'] as Array<Record<string, unknown>> | undefined
  const tables = source['tables'] as Array<Record<string, unknown>> | undefined
  const relations = source['relations'] as Array<Record<string, unknown>> | undefined
  const views = source['views'] as Array<Record<string, unknown>> | undefined
  return {
    formatVersion: source['formatVersion'] as number,
    name: source['name'] as string,
    engine: source['engine'] as Model['engine'],
    schemas: (source['schemas'] as Array<Record<string, unknown>>).map(toSchema),
    ...(enums ? { enums: enums.map(toEnum) } : {}),
    ...(tables ? { tables: tables.map(toTable) } : {}),
    ...(relations ? { relations: relations.map(toRelation) } : {}),
    ...(views ? { views: views.map(toView) } : {}),
  }
}

/**
 * Lee el texto de un archivo de modelo.
 *
 * Pasos: parsea el YAML guardando la cuenta de líneas; si el texto no es YAML
 * válido devuelve el primer error de sintaxis con su línea; si lo es, valida el
 * documento campo a campo y devuelve el modelo o la lista de fallos.
 *
 * @param text Contenido del archivo, tal como lo leyó el disco.
 */
export function parseModel(text: string): ParseResult {
  const lineCounter = new LineCounter()
  const doc = parseDocument(text, { lineCounter })

  if (doc.errors.length > 0) {
    const errors: ValidationIssue[] = doc.errors.map((error) => {
      const position = error.linePos?.[0]
      return {
        path: '(archivo)',
        message: `El archivo no es YAML válido: ${error.message.split(' at line')[0] ?? error.message}.`,
        line: position?.line ?? START.line,
        column: position?.col ?? START.column,
        code: 'syntax',
      }
    })
    return { ok: false, errors }
  }

  const value: unknown = doc.toJS({ maxAliasCount: 100 })
  const issues = validateModel(value, createLocator(doc, lineCounter))
  if (issues.length > 0) return { ok: false, errors: issues }

  return { ok: true, model: toModel(value as Record<string, unknown>) }
}
