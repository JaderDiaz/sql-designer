/**
 * Tipos del archivo del modelo, formato 1.
 *
 * Son los mismos que usan el validador, el serializador y el almacén: el
 * archivo `.yaml` es la única fuente de verdad del modelo (principio II), y
 * aquí se describe su forma. La referencia normativa es
 * `specs/002-archivos-modelo/contracts/model.schema.json`.
 */

/** Motor de base de datos del modelo. Viaja con el archivo (RS-10). */
export type Engine = 'postgres' | 'mysql' | 'sqlite'

/** Versión del formato que escribe y lee este incremento. */
export const FORMAT_VERSION = 1

/** Largo máximo del nombre legible del modelo. */
export const NAME_MAX_LENGTH = 120

/** Largo máximo de un nombre técnico (RS-03). */
export const TECHNICAL_NAME_MAX_LENGTH = 63

/** Forma de un nombre técnico: minúsculas, números y guion bajo (RS-03). */
export const TECHNICAL_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/

/** Forma de la abreviatura de un esquema: tres letras mayúsculas (RS-04). */
export const ABBREVIATION_PATTERN = /^[A-Z]{3}$/

/** Qué hace el motor con las filas dependientes. */
export type ReferentialAction = 'cascade' | 'restrict' | 'set_null' | 'no_action'

/** Acción referencial por defecto cuando el archivo no la declara. */
export const DEFAULT_REFERENTIAL_ACTION: ReferentialAction = 'no_action'

/** Esquema del modelo; siempre hay al menos uno (RS-02). */
export interface Schema {
  /** Nombre técnico, único en el modelo (RS-03). */
  name: string
  /** Exactamente tres letras mayúsculas (RS-04). */
  abbreviation: string
  /** Identificador de token de color; lo fija el Incremento 2. */
  color?: string
  /**
   * Posición de su zona en el lienzo.
   *
   * Solo existe mientras el esquema no tiene ninguna tabla: entonces la zona
   * no se puede deducir de nada y hay que recordar dónde la dejó el usuario.
   * En cuanto el esquema recibe una tabla, la zona se deduce de sus tablas y
   * este campo se descarta al leer el archivo (FR-026a).
   */
  position?: Position
  /** Descripción libre. */
  comment?: string
}

/** Campo de una tabla. */
export interface Field {
  /** Nombre técnico, único dentro de la tabla (RS-03). */
  name: string
  /** Tipo tal como lo escribe el usuario para su motor. */
  type: string
  /** Si admite nulos. Por defecto `false`. */
  nullable?: boolean
  /** Valor por defecto, tal como se escribe en SQL. */
  default?: string
  /** Descripción libre. */
  comment?: string
}

/** Posición de una tabla en el lienzo; la usa el Incremento 2. */
export interface Position {
  x: number
  y: number
}

/** Índice o restricción de unicidad con nombre propio. */
export interface NamedFields {
  /** Nombre técnico del índice o de la restricción. */
  name: string
  /** Campos de la tabla que lo componen; al menos uno. */
  fields: string[]
}

/** Tabla del modelo. */
export interface Table {
  /** Nombre técnico, único en el modelo (RS-03). */
  name: string
  /** Nombre de un esquema existente. */
  schema: string
  /** Descripción libre. */
  comment?: string
  /** Campos de la tabla; al menos uno, con nombres únicos. */
  fields: Field[]
  /** Campos de esta tabla que forman la llave primaria. */
  primaryKey?: string[]
  /** Restricciones de unicidad. */
  uniques?: NamedFields[]
  /** Índices. */
  indexes?: NamedFields[]
  /** Posición en el lienzo. */
  position?: Position
}

/** Relación entre dos tablas por llave foránea. */
export interface Relation {
  /** Nombre técnico, único en el modelo. */
  name: string
  /** Tabla que lleva la llave foránea. */
  fromTable: string
  /** Campos de `fromTable` que la forman. */
  fromFields: string[]
  /** Tabla referenciada. */
  toTable: string
  /** Campos de `toTable` referenciados. */
  toFields: string[]
  /** Qué pasa al borrar la fila referenciada. Por defecto `no_action`. */
  onDelete?: ReferentialAction
  /** Qué pasa al cambiarla. Por defecto `no_action`. */
  onUpdate?: ReferentialAction
}

/** Tipo enumerado del modelo. */
export interface Enum {
  /** Nombre técnico, único en el modelo. */
  name: string
  /** Nombre de un esquema existente. */
  schema: string
  /** Valores del enumerado; al menos uno. */
  values: string[]
  /** Descripción libre. */
  comment?: string
}

/** Vista del modelo. */
export interface View {
  /** Nombre técnico, único en el modelo. */
  name: string
  /** Nombre de un esquema existente. */
  schema: string
  /** Tablas existentes que participan en la vista. */
  tables: string[]
  /** Descripción libre. */
  comment?: string
}

/**
 * Documento raíz del archivo del modelo.
 *
 * El orden de los campos es el que escribe el serializador, para que la ida y
 * vuelta de la puerta 3 compare textos iguales.
 */
export interface Model {
  /** Debe ser {@link FORMAT_VERSION}; un valor mayor es «versión más nueva». */
  formatVersion: number
  /** Nombre legible, 1–{@link NAME_MAX_LENGTH} caracteres, sin saltos de línea. */
  name: string
  /** Motor del modelo (RS-10). */
  engine: Engine
  /** Esquemas; al menos uno (RS-02). */
  schemas: Schema[]
  /** Enumerados; se omite del archivo cuando está vacío. */
  enums?: Enum[]
  /** Tablas; se omite del archivo cuando está vacío. */
  tables?: Table[]
  /** Relaciones; se omite del archivo cuando está vacío. */
  relations?: Relation[]
  /** Vistas; se omite del archivo cuando está vacío. */
  views?: View[]
}

/**
 * Sello del archivo en disco: con qué fecha y tamaño se leyó.
 *
 * Guardar compara el sello esperado con el real para avisar de que el archivo
 * cambió por fuera antes de sobrescribirlo (FR-025).
 */
export interface FileStamp {
  /** Fecha de modificación en milisegundos desde el epoch. */
  modifiedMs: number
  /** Tamaño del archivo en bytes. */
  sizeBytes: number
}

/** Nombres de los motores tal como se muestran al usuario. */
export const ENGINE_LABELS: Record<Engine, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
}

/** Motores válidos, para validar el archivo y poblar los selectores. */
export const ENGINES: Engine[] = ['postgres', 'mysql', 'sqlite']
