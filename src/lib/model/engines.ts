import type { Engine, Field } from '@/lib/model/types'

/**
 * Catálogo de tipos de cada motor, y los campos que el producto propone.
 *
 * Son datos puros: la lista de tipos que ofrece el selector del editor de
 * campos (FR-018), qué tipos admiten longitud y escala (FR-015), el campo `id`
 * del diálogo Nueva tabla (FR-008) y los grupos de campos de las plantillas
 * (FR-027). Vive aquí, en un solo sitio, porque el generador de SQL de un
 * incremento posterior volverá a esta misma tabla.
 *
 * El archivo del modelo manda sobre este catálogo: un campo con un tipo que su
 * motor no reconoce es un archivo válido, y la pantalla solo lo avisa
 * (FR-018a). Las tablas son las de `specs/004-tablas-campos/research.md` R2.
 */

/** Tipos de PostgreSQL, en el orden en que se ofrecen. */
const POSTGRES_TYPES = [
  'uuid',
  'smallint',
  'integer',
  'bigint',
  'serial',
  'bigserial',
  'numeric',
  'real',
  'double precision',
  'boolean',
  'varchar',
  'char',
  'text',
  'date',
  'time',
  'timestamp',
  'timestamptz',
  'interval',
  'json',
  'jsonb',
  'bytea',
  'inet',
] as const

/** Tipos de MySQL, en el orden en que se ofrecen. */
const MYSQL_TYPES = [
  'char',
  'varchar',
  'text',
  'mediumtext',
  'longtext',
  'tinyint',
  'smallint',
  'int',
  'bigint',
  'decimal',
  'float',
  'double',
  'boolean',
  'date',
  'datetime',
  'timestamp',
  'time',
  'json',
  'blob',
  'binary',
] as const

/** Tipos de SQLite, en el orden en que se ofrecen. */
const SQLITE_TYPES = ['integer', 'real', 'text', 'blob', 'numeric'] as const

/** Qué tipos admiten longitud y escala en cada motor. */
const CATALOG: Record<Engine, { types: readonly string[]; length: string[]; scale: string[] }> = {
  postgres: {
    types: POSTGRES_TYPES,
    length: ['varchar', 'char', 'numeric'],
    scale: ['numeric'],
  },
  mysql: {
    types: MYSQL_TYPES,
    length: ['char', 'varchar', 'decimal', 'binary'],
    scale: ['decimal'],
  },
  sqlite: { types: SQLITE_TYPES, length: [], scale: [] },
}

/** Longitud que se propone al elegir un tipo que la admite. */
const DEFAULT_LENGTHS: Record<string, number> = {
  varchar: 120,
  char: 1,
  numeric: 12,
  decimal: 12,
  binary: 16,
}

/** Escala que se propone al elegir un tipo que la admite. */
const DEFAULT_SCALE = 2

/** Tipo de texto corto de cada motor, para el campo que nace al añadir. */
const TEXT_TYPE: Record<Engine, string> = {
  postgres: 'text',
  mysql: 'varchar',
  sqlite: 'text',
}

/** Qué admite un tipo del motor. */
export interface TypeTraits {
  /** Si el tipo lleva longitud (FR-015). */
  hasLength: boolean
  /** Si el tipo lleva escala (FR-016). */
  hasScale: boolean
  /** Longitud que se propone al elegirlo, cuando la admite. */
  defaultLength?: number
  /** Escala que se propone al elegirlo, cuando la admite. */
  defaultScale?: number
  /** Si el motor del modelo no conoce este tipo (FR-018a). */
  isUnknown: boolean
}

/** Un grupo de campos de la lista «Plantillas» (FR-027). */
export interface FieldTemplate {
  /** Clave estable del grupo. */
  key: 'audit' | 'softDelete' | 'authorship' | 'active'
  /** Nombre del grupo tal como se muestra. */
  label: string
  /** Icono del grupo en el menú. */
  icon: 'clock' | 'archive' | 'user-round' | 'toggle-right'
  /** Campos que añade, en orden. */
  fields: Field[]
}

/**
 * Tipos que ofrece el selector del motor del modelo.
 *
 * @param engine Motor del modelo.
 */
export function typesOf(engine: Engine): readonly string[] {
  return CATALOG[engine].types
}

/**
 * Tipo de texto corto del motor, el que lleva un campo recién añadido.
 *
 * @param engine Motor del modelo.
 */
export function textTypeOf(engine: Engine): string {
  return TEXT_TYPE[engine]
}

/**
 * Qué admite un tipo en un motor, y si el motor lo conoce.
 *
 * Un tipo que el motor no conoce no admite longitud ni escala, pero tampoco
 * las pierde: lo que el archivo trae se conserva (FR-018a).
 *
 * @param engine Motor del modelo.
 * @param type Nombre del tipo, sin paréntesis.
 */
export function typeTraits(engine: Engine, type: string): TypeTraits {
  const catalog = CATALOG[engine]
  const isUnknown = !catalog.types.includes(type)
  if (isUnknown) return { hasLength: false, hasScale: false, isUnknown: true }
  const hasLength = catalog.length.includes(type)
  const hasScale = catalog.scale.includes(type)
  return {
    hasLength,
    hasScale,
    ...(hasLength ? { defaultLength: DEFAULT_LENGTHS[type] ?? 1 } : {}),
    ...(hasScale ? { defaultScale: DEFAULT_SCALE } : {}),
    isUnknown: false,
  }
}

/**
 * Campo `id` de llave primaria que propone el diálogo Nueva tabla (FR-008).
 *
 * @param engine Motor del modelo.
 */
export function idField(engine: Engine): Field {
  if (engine === 'postgres') return { name: 'id', type: 'uuid', default: 'gen_random_uuid()' }
  if (engine === 'mysql') return { name: 'id', type: 'char', length: 36, default: '(uuid())' }
  return { name: 'id', type: 'text' }
}

/** Tipo de fecha y hora de cada motor, el de los campos de auditoría. */
function timestampType(engine: Engine): string {
  if (engine === 'postgres') return 'timestamptz'
  if (engine === 'mysql') return 'timestamp'
  return 'text'
}

/** Valor «ahora» de cada motor. */
function nowValue(engine: Engine): string {
  if (engine === 'postgres') return 'now()'
  return 'CURRENT_TIMESTAMP'
}

/** Tipo del identificador ajeno de cada motor, el de los campos de autoría. */
function actorType(engine: Engine): Field {
  if (engine === 'postgres') return { name: '', type: 'uuid' }
  if (engine === 'mysql') return { name: '', type: 'char', length: 36 }
  return { name: '', type: 'text' }
}

/**
 * Campos de auditoría que propone el diálogo Nueva tabla (FR-008).
 *
 * Son los mismos dos campos que la plantilla «Campos de auditoría», para que
 * crear la tabla con la casilla marcada y aplicar la plantilla después dejen
 * la misma tabla.
 *
 * @param engine Motor del modelo.
 */
export function auditFields(engine: Engine): Field[] {
  const type = timestampType(engine)
  const value = nowValue(engine)
  return [
    { name: 'created_at', type, default: value },
    { name: 'updated_at', type, default: value },
  ]
}

/**
 * Los cuatro grupos de campos comunes de «Plantillas» (FR-027).
 *
 * @param engine Motor del modelo.
 */
export function templatesOf(engine: Engine): FieldTemplate[] {
  const stamp = timestampType(engine)
  const actor = actorType(engine)
  return [
    {
      key: 'audit',
      label: 'Campos de auditoría',
      icon: 'clock',
      fields: auditFields(engine),
    },
    {
      key: 'softDelete',
      label: 'Borrado lógico',
      icon: 'archive',
      fields: [{ name: 'deleted_at', type: stamp, nullable: true }],
    },
    {
      key: 'authorship',
      label: 'Autoría',
      icon: 'user-round',
      fields: [
        { ...actor, name: 'created_by', nullable: true },
        { ...actor, name: 'updated_by', nullable: true },
      ],
    },
    {
      key: 'active',
      label: 'Activo',
      icon: 'toggle-right',
      fields: [
        {
          name: 'activo',
          type: engine === 'sqlite' ? 'integer' : 'boolean',
          default: engine === 'postgres' ? 'true' : '1',
        },
      ],
    },
  ]
}
