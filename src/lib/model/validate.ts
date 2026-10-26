import {
  ABBREVIATION_PATTERN,
  ENGINES,
  FORMAT_VERSION,
  NAME_MAX_LENGTH,
  TECHNICAL_NAME_MAX_LENGTH,
  TECHNICAL_NAME_PATTERN,
} from '@/lib/model/types'
import type { Model } from '@/lib/model/types'

/**
 * Validación del archivo del modelo, campo a campo.
 *
 * Se valida a mano en lugar de con un validador de esquemas para poder dar la
 * línea y la columna de cada fallo (FR-016, research.md R2): el documento ya
 * parseado llega aquí junto a una función que sabe situar cada ruta en el
 * texto original.
 */

/** Ruta de un valor dentro del documento, por claves e índices. */
export type ValuePath = ReadonlyArray<string | number>

/** Sitúa una ruta del documento en el texto original. */
export type Locate = (path: ValuePath) => { line: number; column: number }

/**
 * Qué clase de fallo es, para que la interfaz elija el mensaje.
 *
 * `syntax` lo emite `parse.ts` cuando el texto no es YAML válido; el validador
 * solo emite `future_version` e `invalid`.
 */
export type IssueCode = 'syntax' | 'future_version' | 'invalid'

/** Un fallo de validación, con su sitio exacto en el archivo. */
export interface ValidationIssue {
  /** Ruta legible del valor, por ejemplo `tables[2].fields[0].name`. */
  path: string
  /** Causa en español, tal como se muestra en el diálogo. */
  message: string
  /** Línea del archivo, empezando en 1. */
  line: number
  /** Columna del archivo, empezando en 1. */
  column: number
  /** Clase de fallo. */
  code: IssueCode
}

/** Claves permitidas en cada nivel; cualquier otra es clave desconocida. */
const ALLOWED_KEYS = {
  model: ['formatVersion', 'name', 'engine', 'schemas', 'enums', 'tables', 'relations', 'views'],
  schema: ['name', 'abbreviation', 'color', 'comment'],
  table: ['name', 'schema', 'comment', 'fields', 'primaryKey', 'uniques', 'indexes', 'position'],
  field: ['name', 'type', 'nullable', 'default', 'comment'],
  namedFields: ['name', 'fields'],
  position: ['x', 'y'],
  relation: ['name', 'fromTable', 'fromFields', 'toTable', 'toFields', 'onDelete', 'onUpdate'],
  enum: ['name', 'schema', 'values', 'comment'],
  view: ['name', 'schema', 'tables', 'comment'],
} as const

/** Acciones referenciales aceptadas. */
const REFERENTIAL_ACTIONS = ['cascade', 'restrict', 'set_null', 'no_action']

/**
 * Escribe una ruta de valores como la ve el usuario.
 *
 * @param path Ruta por claves e índices.
 */
export function formatPath(path: ValuePath): string {
  let out = ''
  for (const step of path) {
    if (typeof step === 'number') out += `[${step}]`
    else out += out === '' ? step : `.${step}`
  }
  return out === '' ? '(raíz)' : out
}

/** Si el valor es un mapa de claves y valores. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Acumula fallos sabiendo situar cada ruta en el texto. */
class Report {
  readonly issues: ValidationIssue[] = []

  constructor(private readonly locate: Locate) {}

  /**
   * Anota un fallo.
   *
   * @param path Ruta del valor que falla.
   * @param message Causa en español.
   * @param code Clase de fallo; por defecto `invalid`.
   */
  add(path: ValuePath, message: string, code: IssueCode = 'invalid'): void {
    const { line, column } = this.locate(path)
    this.issues.push({ path: formatPath(path), message, line, column, code })
  }
}

/**
 * Comprueba que un valor es texto no vacío.
 *
 * @returns El texto, o `null` si no lo es (ya anotado en el informe).
 */
function requireText(
  report: Report,
  value: unknown,
  path: ValuePath,
  label: string,
): string | null {
  if (typeof value !== 'string' || value === '') {
    report.add(path, `${label} tiene que ser un texto y no puede estar vacío.`)
    return null
  }
  return value
}

/** Comprueba que un valor es un nombre técnico conforme a RS-03. */
function requireTechnicalName(
  report: Report,
  value: unknown,
  path: ValuePath,
  label: string,
): string | null {
  const text = requireText(report, value, path, label)
  if (text === null) return null
  if (text.length > TECHNICAL_NAME_MAX_LENGTH) {
    report.add(path, `${label} no puede pasar de ${TECHNICAL_NAME_MAX_LENGTH} caracteres.`)
    return null
  }
  if (!TECHNICAL_NAME_PATTERN.test(text)) {
    report.add(
      path,
      `${label} solo admite minúsculas, números y guion bajo, y no puede empezar por un número.`,
    )
    return null
  }
  return text
}

/** Comprueba que un valor es una lista con al menos un elemento. */
function requireList(
  report: Report,
  value: unknown,
  path: ValuePath,
  label: string,
  minItems = 1,
): unknown[] | null {
  if (!Array.isArray(value)) {
    report.add(path, `${label} tiene que ser una lista.`)
    return null
  }
  if (value.length < minItems) {
    report.add(path, `${label} necesita al menos ${minItems} elemento.`)
    return null
  }
  return value
}

/** Comprueba que un valor es un mapa. */
function requireRecord(
  report: Report,
  value: unknown,
  path: ValuePath,
  label: string,
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    report.add(path, `${label} tiene que ser un mapa de campos.`)
    return null
  }
  return value
}

/** Anota toda clave que no esté en la lista de claves permitidas (R3). */
function rejectUnknownKeys(
  report: Report,
  record: Record<string, unknown>,
  path: ValuePath,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      report.add([...path, key], `«${key}» no es un campo conocido de este formato.`)
    }
  }
}

/** Comprueba una lista de nombres técnicos y la devuelve. */
function technicalNameList(
  report: Report,
  value: unknown,
  path: ValuePath,
  label: string,
): string[] {
  const list = requireList(report, value, path, label)
  if (list === null) return []
  const names: string[] = []
  list.forEach((item, index) => {
    const name = requireTechnicalName(report, item, [...path, index], `Cada elemento de ${label}`)
    if (name !== null) names.push(name)
  })
  return names
}

/** Comprueba un índice o un único: nombre y campos de la tabla. */
function validateNamedFields(
  report: Report,
  value: unknown,
  path: ValuePath,
  label: string,
  fieldNames: Set<string>,
): void {
  const record = requireRecord(report, value, path, label)
  if (record === null) return
  rejectUnknownKeys(report, record, path, ALLOWED_KEYS.namedFields)
  requireTechnicalName(report, record['name'], [...path, 'name'], `El nombre de ${label}`)
  const names = technicalNameList(report, record['fields'], [...path, 'fields'], `los campos de ${label}`)
  names.forEach((name, index) => {
    if (!fieldNames.has(name)) {
      report.add([...path, 'fields', index], `El campo «${name}» no existe en esta tabla.`)
    }
  })
}

/** Comprueba un esquema. */
function validateSchema(report: Report, value: unknown, path: ValuePath): string | null {
  const record = requireRecord(report, value, path, 'Cada esquema')
  if (record === null) return null
  rejectUnknownKeys(report, record, path, ALLOWED_KEYS.schema)
  const name = requireTechnicalName(report, record['name'], [...path, 'name'], 'El nombre del esquema')
  const abbreviation = record['abbreviation']
  if (typeof abbreviation !== 'string' || !ABBREVIATION_PATTERN.test(abbreviation)) {
    report.add(
      [...path, 'abbreviation'],
      'La abreviatura del esquema son exactamente tres letras mayúsculas.',
    )
  }
  if (record['color'] !== undefined) {
    requireText(report, record['color'], [...path, 'color'], 'El color del esquema')
  }
  if (record['comment'] !== undefined) {
    requireText(report, record['comment'], [...path, 'comment'], 'El comentario del esquema')
  }
  return name
}

/** Comprueba un campo de una tabla. */
function validateField(report: Report, value: unknown, path: ValuePath): string | null {
  const record = requireRecord(report, value, path, 'Cada campo')
  if (record === null) return null
  rejectUnknownKeys(report, record, path, ALLOWED_KEYS.field)
  const name = requireTechnicalName(report, record['name'], [...path, 'name'], 'El nombre del campo')
  requireText(report, record['type'], [...path, 'type'], 'El tipo del campo')
  if (record['nullable'] !== undefined && typeof record['nullable'] !== 'boolean') {
    report.add([...path, 'nullable'], '«nullable» tiene que ser verdadero o falso.')
  }
  if (record['default'] !== undefined) {
    requireText(report, record['default'], [...path, 'default'], 'El valor por defecto')
  }
  if (record['comment'] !== undefined) {
    requireText(report, record['comment'], [...path, 'comment'], 'El comentario del campo')
  }
  return name
}

/** Comprueba una tabla con sus campos, llaves, únicos e índices. */
function validateTable(
  report: Report,
  value: unknown,
  path: ValuePath,
  schemaNames: Set<string>,
): { name: string | null; fields: Set<string> } {
  const fieldNames = new Set<string>()
  const record = requireRecord(report, value, path, 'Cada tabla')
  if (record === null) return { name: null, fields: fieldNames }
  rejectUnknownKeys(report, record, path, ALLOWED_KEYS.table)
  const name = requireTechnicalName(report, record['name'], [...path, 'name'], 'El nombre de la tabla')
  const schema = requireTechnicalName(
    report,
    record['schema'],
    [...path, 'schema'],
    'El esquema de la tabla',
  )
  if (schema !== null && !schemaNames.has(schema)) {
    report.add([...path, 'schema'], `El esquema «${schema}» no está declarado en el modelo.`)
  }
  if (record['comment'] !== undefined) {
    requireText(report, record['comment'], [...path, 'comment'], 'El comentario de la tabla')
  }

  const fields = requireList(report, record['fields'], [...path, 'fields'], 'Los campos de la tabla')
  if (fields !== null) {
    fields.forEach((field, index) => {
      const fieldName = validateField(report, field, [...path, 'fields', index])
      if (fieldName === null) return
      if (fieldNames.has(fieldName)) {
        report.add(
          [...path, 'fields', index, 'name'],
          `El campo «${fieldName}» está repetido en esta tabla.`,
        )
        return
      }
      fieldNames.add(fieldName)
    })
  }

  if (record['primaryKey'] !== undefined) {
    const keys = technicalNameList(
      report,
      record['primaryKey'],
      [...path, 'primaryKey'],
      'la llave primaria',
    )
    keys.forEach((key, index) => {
      if (!fieldNames.has(key)) {
        report.add([...path, 'primaryKey', index], `El campo «${key}» no existe en esta tabla.`)
      }
    })
  }

  for (const key of ['uniques', 'indexes'] as const) {
    if (record[key] === undefined) continue
    const list = requireList(report, record[key], [...path, key], `«${key}»`, 0)
    if (list === null) continue
    const label = key === 'uniques' ? 'cada único' : 'cada índice'
    list.forEach((item, index) => {
      validateNamedFields(report, item, [...path, key, index], label, fieldNames)
    })
  }

  if (record['position'] !== undefined) {
    const position = requireRecord(report, record['position'], [...path, 'position'], 'La posición')
    if (position !== null) {
      rejectUnknownKeys(report, position, [...path, 'position'], ALLOWED_KEYS.position)
      for (const axis of ['x', 'y'] as const) {
        if (typeof position[axis] !== 'number' || !Number.isFinite(position[axis])) {
          report.add([...path, 'position', axis], `«${axis}» de la posición tiene que ser un número.`)
        }
      }
    }
  }

  return { name, fields: fieldNames }
}

/** Comprueba una relación y que sus tablas y campos existan. */
function validateRelation(
  report: Report,
  value: unknown,
  path: ValuePath,
  tables: Map<string, Set<string>>,
): string | null {
  const record = requireRecord(report, value, path, 'Cada relación')
  if (record === null) return null
  rejectUnknownKeys(report, record, path, ALLOWED_KEYS.relation)
  const name = requireTechnicalName(
    report,
    record['name'],
    [...path, 'name'],
    'El nombre de la relación',
  )

  for (const side of ['from', 'to'] as const) {
    const tableKey = side === 'from' ? 'fromTable' : 'toTable'
    const fieldsKey = side === 'from' ? 'fromFields' : 'toFields'
    const tableName = requireTechnicalName(
      report,
      record[tableKey],
      [...path, tableKey],
      `«${tableKey}»`,
    )
    const fieldNames = technicalNameList(report, record[fieldsKey], [...path, fieldsKey], `«${fieldsKey}»`)
    if (tableName === null) continue
    const tableFields = tables.get(tableName)
    if (tableFields === undefined) {
      report.add([...path, tableKey], `La tabla «${tableName}» no está declarada en el modelo.`)
      continue
    }
    fieldNames.forEach((fieldName, index) => {
      if (!tableFields.has(fieldName)) {
        report.add(
          [...path, fieldsKey, index],
          `El campo «${fieldName}» no existe en la tabla «${tableName}».`,
        )
      }
    })
  }

  for (const key of ['onDelete', 'onUpdate'] as const) {
    const action = record[key]
    if (action === undefined) continue
    if (typeof action !== 'string' || !REFERENTIAL_ACTIONS.includes(action)) {
      report.add([...path, key], `«${key}» admite ${REFERENTIAL_ACTIONS.join(', ')}.`)
    }
  }

  return name
}

/** Comprueba un enumerado. */
function validateEnum(
  report: Report,
  value: unknown,
  path: ValuePath,
  schemaNames: Set<string>,
): string | null {
  const record = requireRecord(report, value, path, 'Cada enumerado')
  if (record === null) return null
  rejectUnknownKeys(report, record, path, ALLOWED_KEYS.enum)
  const name = requireTechnicalName(
    report,
    record['name'],
    [...path, 'name'],
    'El nombre del enumerado',
  )
  const schema = requireTechnicalName(
    report,
    record['schema'],
    [...path, 'schema'],
    'El esquema del enumerado',
  )
  if (schema !== null && !schemaNames.has(schema)) {
    report.add([...path, 'schema'], `El esquema «${schema}» no está declarado en el modelo.`)
  }
  const values = requireList(report, record['values'], [...path, 'values'], 'Los valores del enumerado')
  values?.forEach((item, index) => {
    requireText(report, item, [...path, 'values', index], 'Cada valor del enumerado')
  })
  if (record['comment'] !== undefined) {
    requireText(report, record['comment'], [...path, 'comment'], 'El comentario del enumerado')
  }
  return name
}

/** Comprueba una vista y que sus tablas existan. */
function validateView(
  report: Report,
  value: unknown,
  path: ValuePath,
  schemaNames: Set<string>,
  tables: Map<string, Set<string>>,
): string | null {
  const record = requireRecord(report, value, path, 'Cada vista')
  if (record === null) return null
  rejectUnknownKeys(report, record, path, ALLOWED_KEYS.view)
  const name = requireTechnicalName(report, record['name'], [...path, 'name'], 'El nombre de la vista')
  const schema = requireTechnicalName(
    report,
    record['schema'],
    [...path, 'schema'],
    'El esquema de la vista',
  )
  if (schema !== null && !schemaNames.has(schema)) {
    report.add([...path, 'schema'], `El esquema «${schema}» no está declarado en el modelo.`)
  }
  const names = technicalNameList(report, record['tables'], [...path, 'tables'], 'las tablas de la vista')
  names.forEach((tableName, index) => {
    if (!tables.has(tableName)) {
      report.add([...path, 'tables', index], `La tabla «${tableName}» no está declarada en el modelo.`)
    }
  })
  if (record['comment'] !== undefined) {
    requireText(report, record['comment'], [...path, 'comment'], 'El comentario de la vista')
  }
  return name
}

/** Anota los nombres repetidos de una colección del modelo. */
function rejectDuplicates(
  report: Report,
  names: ReadonlyArray<string | null>,
  path: ValuePath,
  label: string,
  seen: Set<string>,
): void {
  names.forEach((name, index) => {
    if (name === null) return
    if (seen.has(name)) {
      report.add([...path, index, 'name'], `Ya hay ${label} con el nombre «${name}».`)
      return
    }
    seen.add(name)
  })
}

/**
 * Valida un documento ya parseado contra el formato 1.
 *
 * Devuelve la lista de fallos en el orden en que aparecen en el archivo; una
 * lista vacía significa que el documento es un modelo válido. El modelo no se
 * devuelve aquí: lo compone `parse.ts` cuando no hay fallos.
 *
 * @param value Documento ya parseado, tal como salió del YAML.
 * @param locate Cómo situar una ruta del documento en el texto original.
 */
export function validateModel(value: unknown, locate: Locate): ValidationIssue[] {
  const report = new Report(locate)

  const root = requireRecord(report, value, [], 'El archivo del modelo')
  if (root === null) return report.issues

  const formatVersion = root['formatVersion']
  if (formatVersion === undefined) {
    report.add(['formatVersion'], 'Falta «formatVersion»; este archivo no es un modelo.')
  } else if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion)) {
    report.add(['formatVersion'], '«formatVersion» tiene que ser un número entero.')
  } else if (formatVersion > FORMAT_VERSION) {
    report.add(
      ['formatVersion'],
      'Este modelo es de una versión más nueva de SQL Designer.',
      'future_version',
    )
    return report.issues
  } else if (formatVersion !== FORMAT_VERSION) {
    report.add(['formatVersion'], `«formatVersion» tiene que ser ${FORMAT_VERSION}.`)
  }

  rejectUnknownKeys(report, root, [], ALLOWED_KEYS.model)

  const name = root['name']
  if (typeof name !== 'string' || name.length < 1) {
    report.add(['name'], 'El nombre del modelo no puede estar vacío.')
  } else if (name.length > NAME_MAX_LENGTH) {
    report.add(['name'], `El nombre del modelo no puede pasar de ${NAME_MAX_LENGTH} caracteres.`)
  } else if (/[\n\r]/.test(name)) {
    report.add(['name'], 'El nombre del modelo no puede tener saltos de línea.')
  }

  const engine = root['engine']
  if (typeof engine !== 'string' || !ENGINES.includes(engine as Model['engine'])) {
    report.add(['engine'], `El motor tiene que ser uno de ${ENGINES.join(', ')}.`)
  }

  const schemaNames = new Set<string>()
  const schemas = requireList(report, root['schemas'], ['schemas'], 'Un modelo necesita un esquema')
  if (schemas !== null) {
    const names = schemas.map((schema, index) => validateSchema(report, schema, ['schemas', index]))
    rejectDuplicates(report, names, ['schemas'], 'un esquema', schemaNames)
  }

  const tables = new Map<string, Set<string>>()
  const tableList = root['tables']
  if (tableList !== undefined) {
    const list = requireList(report, tableList, ['tables'], '«tables»', 0)
    if (list !== null) {
      const names: Array<string | null> = []
      list.forEach((table, index) => {
        const result = validateTable(report, table, ['tables', index], schemaNames)
        names.push(result.name)
        if (result.name !== null && !tables.has(result.name)) tables.set(result.name, result.fields)
      })
      rejectDuplicates(report, names, ['tables'], 'una tabla', new Set())
    }
  }

  const usedNames = new Set<string>()
  const enumList = root['enums']
  if (enumList !== undefined) {
    const list = requireList(report, enumList, ['enums'], '«enums»', 0)
    if (list !== null) {
      const names = list.map((item, index) =>
        validateEnum(report, item, ['enums', index], schemaNames),
      )
      rejectDuplicates(report, names, ['enums'], 'un enumerado', usedNames)
    }
  }

  const relationList = root['relations']
  if (relationList !== undefined) {
    const list = requireList(report, relationList, ['relations'], '«relations»', 0)
    if (list !== null) {
      const names = list.map((item, index) =>
        validateRelation(report, item, ['relations', index], tables),
      )
      rejectDuplicates(report, names, ['relations'], 'una relación', new Set())
    }
  }

  const viewList = root['views']
  if (viewList !== undefined) {
    const list = requireList(report, viewList, ['views'], '«views»', 0)
    if (list !== null) {
      const names = list.map((item, index) =>
        validateView(report, item, ['views', index], schemaNames, tables),
      )
      rejectDuplicates(report, names, ['views'], 'una vista', new Set())
    }
  }

  return report.issues
}
