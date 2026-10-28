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

/** Largo máximo de la descripción de una tabla (FR-043). */
export const TABLE_COMMENT_MAX_LENGTH = 280

/** Forma de un nombre técnico: minúsculas, números y guion bajo (RS-03). */
export const TECHNICAL_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/

/** Forma de la abreviatura de un esquema: tres letras mayúsculas (RS-04). */
export const ABBREVIATION_PATTERN = /^[A-Z]{3}$/

/**
 * Qué hace el motor con las filas dependientes.
 *
 * El valor por defecto sigue siendo `no_action`, así que un archivo que no
 * declara la acción se lee igual que antes. `set_default` entra en el
 * Incremento 4 y **no** sube {@link FORMAT_VERSION}: ampliar los valores que
 * un campo admite no rompe a un lector viejo que ya validaba el enum, y
 * cualquier archivo escrito antes sigue siendo válido (research R11, FR-028).
 */
export type ReferentialAction =
  | 'cascade'
  | 'restrict'
  | 'set_null'
  | 'set_default'
  | 'no_action'

/** Acción referencial por defecto cuando el archivo no la declara. */
export const DEFAULT_REFERENTIAL_ACTION: ReferentialAction = 'no_action'

/**
 * Acciones referenciales válidas, en el orden en que se ofrecen al usuario
 * (FR-028). Las usan el validador y los selectores de la ficha.
 */
export const REFERENTIAL_ACTIONS: ReferentialAction[] = [
  'no_action',
  'restrict',
  'cascade',
  'set_null',
  'set_default',
]

/** Las acciones tal como se escriben en SQL, que es como se muestran. */
export const REFERENTIAL_ACTION_LABELS: Record<ReferentialAction, string> = {
  no_action: 'NO ACTION',
  restrict: 'RESTRICT',
  cascade: 'CASCADE',
  set_null: 'SET NULL',
  set_default: 'SET DEFAULT',
}

/** Esquema del modelo; un modelo puede no tener ninguno (FR-005a). */
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
  /**
   * Nombre del tipo, sin paréntesis ni números dentro.
   *
   * La longitud y la escala viajan aparte, en {@link Field.length} y
   * {@link Field.scale}, para que se puedan leer y cambiar sin analizar texto
   * (FR-051a). Un archivo antiguo con `numeric(10,2)` sigue siendo válido: el
   * validador comprueba la forma de los dos campos nuevos, no el catálogo de
   * tipos del motor.
   */
  type: string
  /**
   * Longitud del tipo, cuando el tipo la admite.
   *
   * Entero mayor que cero. Solo la llevan los tipos con longitud del motor
   * —`varchar`, `char`, `numeric`…—; ver `src/lib/model/engines.ts` (FR-015).
   */
  length?: number
  /**
   * Escala del tipo, cuando el tipo la admite.
   *
   * Entero de cero o más, y nunca mayor que {@link Field.length}. Solo la
   * llevan los tipos decimales del motor (FR-016).
   */
  scale?: number
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
  /** Esquemas; puede estar vacía en un modelo recién creado (FR-005a). */
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
