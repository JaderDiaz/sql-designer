import { TECHNICAL_NAME_MAX_LENGTH, FORMAT_VERSION } from '@/lib/model/types'
import type { Engine, Model } from '@/lib/model/types'
import { toFileStem } from '@/lib/model/slug'

/**
 * Modelo vacío de un modelo recién creado.
 *
 * Un modelo puede no tener ningún esquema, y así es como nace: el primero lo
 * crea quien modela, con el nombre y el color que quiera (FR-005, FR-005a).
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
 * Modelo vacío, listo para escribir al disco.
 *
 * No trae nada: ni esquemas, ni tablas, ni relaciones, enums o vistas. Un
 * modelo nuevo llega en blanco y el primer esquema lo crea quien modela, con
 * el nombre y el color que quiera; proponer uno por el motor obligaba a
 * borrarlo o a convivir con un «public» que nadie pidió.
 *
 * @param name Nombre legible del modelo.
 * @param engine Motor elegido.
 */
export function emptyModel(name: string, engine: Engine): Model {
  return {
    formatVersion: FORMAT_VERSION,
    name,
    engine,
    schemas: [],
  }
}

/**
 * Si el modelo sigue como salió de {@link emptyModel}: sin esquemas y sin
 * tablas.
 *
 * El lienzo de un modelo así llega en blanco y en su lugar se pone la tarjeta
 * «Empieza a diseñar tu modelo», que dice por dónde empezar. En cuanto hay un
 * elemento, un esquema o una tabla, el modelo deja de estar en blanco: la
 * tarjeta se quita y el lienzo dibuja lo que ya hay.
 *
 * @param model Modelo abierto, o `null` si no hay ninguno.
 */
export function isBlankModel(model: Model | null): boolean {
  if (model === null) return false
  return (model.tables ?? []).length === 0 && model.schemas.length === 0
}
