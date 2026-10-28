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
export type ParseResult = { ok: true; model: Model } | { ok: false; errors: ValidationIssue[] }

/** Primera línea y columna del archivo, cuando no se sabe situar el fallo. */
const START = { line: 1, column: 1 }

/**
 * Lo que dice cada error de sintaxis de la librería `yaml`, en español.
 *
 * La librería escribe sus mensajes en inglés, y el diálogo de archivo con
 * errores tiene que estar en español entero (FR-041, RS-12); por eso se
 * traduce por el código del error, que es estable, y no por su texto.
 */
const SYNTAX_MESSAGES: Record<string, string> = {
  ALIAS_PROPS: 'un alias no admite etiqueta ni ancla',
  BAD_ALIAS: 'hay un alias mal escrito',
  BAD_DIRECTIVE: 'hay una directiva mal escrita',
  BAD_DQ_ESCAPE: 'hay un escape mal escrito dentro de un texto entre comillas',
  BAD_INDENT: 'la sangría no cuadra',
  BAD_PROP_ORDER: 'el ancla y la etiqueta van antes del valor',
  BAD_SCALAR_START: 'un valor no puede empezar por ese carácter',
  BLOCK_AS_IMPLICIT_KEY: 'una clave no puede ocupar un bloque',
  BLOCK_IN_FLOW: 'no se puede abrir un bloque dentro de una lista entre corchetes',
  DUPLICATE_KEY: 'hay una clave repetida',
  IMPOSSIBLE: 'el archivo tiene algo que la lectura no sabe interpretar',
  KEY_OVER_1024_CHARS: 'hay una clave demasiado larga',
  MISSING_CHAR: 'falta un carácter',
  MULTILINE_IMPLICIT_KEY: 'una clave no puede ocupar varias líneas',
  MULTIPLE_ANCHORS: 'hay más de un ancla en el mismo valor',
  MULTIPLE_DOCS: 'el archivo tiene más de un documento',
  MULTIPLE_TAGS: 'hay más de una etiqueta en el mismo valor',
  NON_STRING_KEY: 'las claves tienen que ser texto',
  RESOURCE_EXHAUSTION: 'el archivo es demasiado grande para leerlo',
  TAB_AS_INDENT: 'la sangría lleva tabuladores; se sangra con espacios',
  TAG_RESOLVE_FAILED: 'hay una etiqueta que no se reconoce',
  UNEXPECTED_TOKEN: 'hay algo donde no se esperaba',
  BAD_COLLECTION_TYPE: 'la etiqueta no cuadra con lo que hay escrito',
}

/** Mensaje del error de sintaxis, siempre en español. */
function syntaxMessage(code: string): string {
  const reason = SYNTAX_MESSAGES[code]
  return reason === undefined
    ? 'El archivo no es YAML válido.'
    : `El archivo no es YAML válido: ${reason}.`
}

/**
 * Construye la función que sitúa una ruta del documento en el texto.
 *
 * Si la ruta exacta no tiene nodo (por ejemplo una clave que falta), se sube
 * por la ruta hasta el primer nodo que sí lo tenga, para que el diálogo señale
 * el sitio más cercano al fallo en lugar del principio del archivo.
 */
function createLocator(doc: ReturnType<typeof parseDocument>, lineCounter: LineCounter): Locate {
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

/**
 * Rearma un esquema validado.
 *
 * `position` solo sobrevive cuando el esquema no tiene ninguna tabla: con
 * tablas, la zona se deduce de ellas y la posición guardada dejó de aplicar.
 * Se descarta aquí, al leer, y no al escribir, para que el modelo en memoria
 * nunca lleve un dato que el archivo no deba tener y la ida y vuelta de la
 * puerta 3 siga comparando textos iguales (FR-026a).
 *
 * @param source Esquema del documento, ya validado.
 * @param hasTables Si el modelo trae al menos una tabla de este esquema.
 */
function toSchema(source: Record<string, unknown>, hasTables: boolean): Schema {
  const position = source['position'] as Position | undefined
  return {
    name: source['name'] as string,
    abbreviation: source['abbreviation'] as string,
    ...withText(source, 'color'),
    ...(position && !hasTables ? { position: { x: position.x, y: position.y } } : {}),
    ...withText(source, 'comment'),
  }
}

/**
 * Rearma un campo validado.
 *
 * `length` y `scale` se copian tal como vinieron: el validador ya comprobó su
 * forma, y aquí no se transforman ni se completan con el catálogo del motor
 * (FR-018a, FR-051a).
 */
function toField(source: Record<string, unknown>): Field {
  return {
    name: source['name'] as string,
    type: source['type'] as string,
    ...(typeof source['length'] === 'number' ? { length: source['length'] } : {}),
    ...(typeof source['scale'] === 'number' ? { scale: source['scale'] } : {}),
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
    ...(Array.isArray(source['primaryKey'])
      ? { primaryKey: source['primaryKey'] as string[] }
      : {}),
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
  const schemasWithTables = new Set(
    (tables ?? []).map((table) => table['schema'] as string),
  )
  return {
    formatVersion: source['formatVersion'] as number,
    name: source['name'] as string,
    engine: source['engine'] as Model['engine'],
    schemas: (source['schemas'] as Array<Record<string, unknown>>).map((schema) =>
      toSchema(schema, schemasWithTables.has(schema['name'] as string)),
    ),
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
        message: syntaxMessage(error.code),
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
