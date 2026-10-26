import { TECHNICAL_NAME_MAX_LENGTH, FORMAT_VERSION } from '@/lib/model/types'
import type { Engine, Model, Schema } from '@/lib/model/types'
import { toFileStem } from '@/lib/model/slug'

/**
 * Modelo vacío de un modelo recién creado.
 *
 * Un modelo necesita al menos un esquema (RS-02), así que crear no deja nunca
 * la lista vacía: cada motor trae el esquema que le es natural (FR-005).
 */

/** Carácter con el que se rellena una abreviatura de menos de tres letras. */
const ABBREVIATION_FILLER = 'X'

/** Letras de una abreviatura de esquema (RS-04). */
const ABBREVIATION_LENGTH = 3

/**
 * Nombre técnico del esquema que MySQL hereda del nombre del modelo.
 *
 * Es el mismo texto que el nombre del archivo con los guiones convertidos en
 * guion bajo. Si empieza por un número se le añade un guion bajo delante,
 * porque un nombre técnico no puede empezar por número (RS-03).
 *
 * @param name Nombre legible del modelo.
 */
export function toTechnicalName(name: string): string {
  const base = toFileStem(name).replace(/-/g, '_').slice(0, TECHNICAL_NAME_MAX_LENGTH)
  if (base === '') return 'modelo'
  return /^[0-9]/.test(base) ? `_${base}`.slice(0, TECHNICAL_NAME_MAX_LENGTH) : base
}

/**
 * Abreviatura de tres letras mayúsculas de un nombre técnico (RS-04).
 *
 * Toma sus tres primeras letras, saltándose números y guiones bajos, y
 * rellena con `X` lo que falte.
 *
 * @param technicalName Nombre técnico del esquema.
 */
export function toAbbreviation(technicalName: string): string {
  const letters = technicalName.replace(/[^a-z]/g, '').slice(0, ABBREVIATION_LENGTH).toUpperCase()
  return letters.padEnd(ABBREVIATION_LENGTH, ABBREVIATION_FILLER)
}

/**
 * Esquema por defecto de un modelo nuevo, según su motor (FR-005).
 *
 * @param name Nombre legible del modelo.
 * @param engine Motor elegido.
 */
export function defaultSchema(name: string, engine: Engine): Schema {
  if (engine === 'postgres') return { name: 'public', abbreviation: 'PUB' }
  if (engine === 'sqlite') return { name: 'main', abbreviation: 'MAI' }
  const technicalName = toTechnicalName(name)
  return { name: technicalName, abbreviation: toAbbreviation(technicalName) }
}

/**
 * Modelo vacío con su esquema por defecto, listo para escribir al disco.
 *
 * No trae tablas, relaciones, enums ni vistas: esas colecciones se omiten del
 * archivo mientras estén vacías, para que un modelo nuevo se lea a ojo.
 *
 * @param name Nombre legible del modelo.
 * @param engine Motor elegido.
 */
export function emptyModel(name: string, engine: Engine): Model {
  return {
    formatVersion: FORMAT_VERSION,
    name,
    engine,
    schemas: [defaultSchema(name, engine)],
  }
}
