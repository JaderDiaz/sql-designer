import { TECHNICAL_NAME_MAX_LENGTH } from '@/lib/model/types'
import type { Field, Model, Table } from '@/lib/model/types'

/**
 * Lo que el dominio sabe de una clave foránea antes de que exista: qué columna
 * se va a crear, cómo se va a llamar la relación, qué tablas sirven de destino
 * y si la columna está indexada.
 *
 * Son funciones puras sobre el modelo, sin estado ni pantalla, porque las tres
 * pantallas que las usan —la ficha, el lienzo y Ajustes— tienen que proponer
 * exactamente lo mismo (contracts/relations.md §1.2).
 */

/** Patrón de nombre de clave foránea que trae Ajustes por defecto (R15). */
export const DEFAULT_FOREIGN_KEY_PATTERN = '{tabla}_{pk}'

/** Qué columna se crearía y a qué campo apuntaría. */
export interface ForeignKeyProposal {
  /** Campo nuevo de la tabla que llevará la clave. */
  field: Field
  /** Campo de la tabla destino al que apunta: su llave primaria. */
  toField: string
}

/** Una tabla como destino posible de una clave foránea. */
export interface ForeignKeyTarget {
  /** Nombre técnico de la tabla. */
  name: string
  /** Si se puede elegir. */
  enabled: boolean
  /** Por qué no se puede, cuando no se puede (contracts/relations.md §6). */
  reason?: string
  /** Si es la tabla abierta, que puede referenciarse a sí misma (FR-013a). */
  self?: boolean
}

/** Si la columna de una clave foránea abre algún índice (FR-033). */
export type IndexState = 'indexed' | 'missing'

/** La llave primaria de una tabla, si es de una sola columna. */
function singleKeyOf(table: Table): string | null {
  const key = table.primaryKey ?? []
  return key.length === 1 ? (key[0] as string) : null
}

/** Añade el sufijo `_2`, `_3`… hasta que el nombre no esté usado. */
function freeName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let index = 2; ; index += 1) {
    const suffix = `_${index}`
    const name = `${base.slice(0, TECHNICAL_NAME_MAX_LENGTH - suffix.length)}${suffix}`
    if (!taken.has(name)) return name
  }
}

/**
 * Qué columna se crea al relacionar dos tablas (FR-004, FR-009).
 *
 * El nombre sale del patrón de Ajustes, con `{tabla}` y `{pk}` resueltos
 * contra la tabla destino; si ese nombre ya está en la tabla, se le pone
 * sufijo. El tipo y la longitud se copian de la llave primaria referenciada,
 * porque una clave foránea de otro tipo no la podría apuntar, y la columna
 * nace **no nula**: lo decidió la clarificación 4. «No nulo» es la ausencia de
 * `nullable`, como en todo el formato, así que la clave no se escribe.
 *
 * @param model Modelo completo.
 * @param from Tabla que llevará la clave foránea.
 * @param to Tabla destino.
 * @param pattern Patrón de nombre de Ajustes.
 * @returns La propuesta, o `null` si el destino no tiene llave primaria de
 * exactamente una columna (research R13).
 */
export function proposeForeignKey(
  model: Model,
  from: string,
  to: string,
  pattern: string,
): ForeignKeyProposal | null {
  const tables = model.tables ?? []
  const source = tables.find((table) => table.name === from)
  const target = tables.find((table) => table.name === to)
  if (source === undefined || target === undefined) return null

  const key = singleKeyOf(target)
  if (key === null) return null
  const keyField = target.fields.find((field) => field.name === key)
  if (keyField === undefined) return null

  const base = pattern.replace('{tabla}', target.name).replace('{pk}', key)
  const name = freeName(base.slice(0, TECHNICAL_NAME_MAX_LENGTH), new Set(source.fields.map((field) => field.name)))

  return {
    field: {
      name,
      type: keyField.type,
      ...(keyField.length === undefined ? {} : { length: keyField.length }),
      ...(keyField.scale === undefined ? {} : { scale: keyField.scale }),
    },
    toField: key,
  }
}

/**
 * Nombre técnico de una relación (FR-011, research R10).
 *
 * Nunca se le pide al usuario: se deduce de la tabla y la columna, se recorta
 * a {@link TECHNICAL_NAME_MAX_LENGTH} y lleva sufijo numérico si choca con uno
 * que ya existe.
 *
 * @param table Tabla que lleva la clave foránea.
 * @param field Columna de la clave foránea.
 * @param existing Nombres de relación ya usados en el modelo.
 * @returns El nombre técnico de la relación.
 */
export function relationName(table: string, field: string, existing: string[]): string {
  const base = `fk_${table}_${field}`.slice(0, TECHNICAL_NAME_MAX_LENGTH)
  return freeName(base, new Set(existing))
}

/**
 * Qué tablas puede referenciar la tabla abierta (FR-009).
 *
 * Están **todas**, incluida la abierta, porque una tabla puede referenciarse a
 * sí misma (FR-013a). Las que no sirven vienen deshabilitadas y con su motivo,
 * para que la lista enseñe por qué en lugar de esconder la opción.
 *
 * @param model Modelo completo.
 * @param table Tabla abierta en la ficha.
 * @returns Las tablas del modelo en su orden, con su estado.
 */
export function foreignKeyTargets(model: Model, table: string): ForeignKeyTarget[] {
  return (model.tables ?? []).map((candidate) => {
    const key = candidate.primaryKey ?? []
    if (key.length === 0) {
      return {
        name: candidate.name,
        enabled: false,
        reason: `${candidate.name} no tiene llave primaria.`,
      }
    }
    if (key.length > 1) {
      return {
        name: candidate.name,
        enabled: false,
        reason: `${candidate.name} tiene llave primaria de varias columnas.`,
      }
    }
    return {
      name: candidate.name,
      enabled: true,
      ...(candidate.name === table ? { self: true } : {}),
    }
  })
}

/**
 * Si la columna de una clave foránea abre algún índice (FR-033).
 *
 * Una clave foránea sin índice hace lentas las búsquedas por ella, así que la
 * ficha lo avisa. Cuenta como indexada la columna que está sola o en primera
 * posición de un índice, de un único o de la llave primaria: en un índice
 * compuesto solo la primera columna sirve para buscar por ella sola. Crear el
 * índice que falta es del incremento de índices, no de este.
 *
 * @param table Tabla de la columna.
 * @param field Nombre de la columna.
 * @returns `'indexed'` o `'missing'`.
 */
export function indexStateOf(table: Table, field: string): IndexState {
  const heads = [
    ...(table.primaryKey === undefined ? [] : [table.primaryKey]),
    ...(table.uniques ?? []).map((item) => item.fields),
    ...(table.indexes ?? []).map((item) => item.fields),
  ].map((fields) => fields[0])

  return heads.includes(field) ? 'indexed' : 'missing'
}
