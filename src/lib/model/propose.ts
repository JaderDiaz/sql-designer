import { TECHNICAL_NAME_MAX_LENGTH } from '@/lib/model/types'

/**
 * Propuesta del nombre técnico y de la abreviatura de un esquema (FR-016).
 *
 * El usuario escribe «Unidad residencial» y el diálogo propone
 * `unidad_residencial` y `URE`, que puede cambiar a mano (FR-017). Las dos
 * funciones son puras y deterministas: el mismo nombre propone siempre lo
 * mismo, y ninguna de las dos toca el modelo.
 */

/** Palabras del nombre: letras y números, ya sin acentos y en minúsculas. */
function words(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')
}

/**
 * Propone el nombre técnico de un esquema a partir de su nombre legible
 * (FR-016, RS-03).
 *
 * Pasos: separa los acentos de sus letras y los quita, pasa a minúsculas, une
 * las palabras con guion bajo y, si el resultado empieza por un número,
 * antepone un guion bajo, porque un nombre técnico no puede empezar por
 * número. El largo se corta a {@link TECHNICAL_NAME_MAX_LENGTH} (FR-043).
 *
 * @param name Nombre legible, tal como lo escribe el usuario.
 * @returns El nombre técnico propuesto, o cadena vacía si el nombre no deja
 * ninguna letra ni número; entonces el diálogo no propone nada (FR-018).
 */
export function toTechnicalName(name: string): string {
  const parts = words(name)
  if (parts.length === 0) return ''

  const joined = parts.join('_')
  const prefixed = /^[0-9]/.test(joined) ? `_${joined}` : joined
  return prefixed.slice(0, TECHNICAL_NAME_MAX_LENGTH).replace(/_+$/g, '')
}

/** Letras y números de la abreviatura, siempre tres (RS-04). */
const ABBREVIATION_LENGTH = 3

/** Con qué se rellena una abreviatura que no llega a tres caracteres. */
const ABBREVIATION_FILLER = 'X'

/**
 * Propone la abreviatura de tres letras de un esquema (FR-016, RS-04).
 *
 * Toma la inicial de cada una de las tres primeras palabras; si el nombre no
 * tiene tres palabras, sigue tomando letras de la última hasta llegar a tres,
 * y si aun así no llegan, rellena con {@link ABBREVIATION_FILLER}. Así
 * «Cartera» propone `CAR`, «Unidad residencial» propone `URE` y «Área 51»
 * propone `A51`.
 *
 * @param name Nombre legible, tal como lo escribe el usuario.
 * @returns Tres caracteres en mayúsculas, o cadena vacía si el nombre no deja
 * ninguna letra ni número (FR-018).
 */
export function toAbbreviation(name: string): string {
  const parts = words(name)
  if (parts.length === 0) return ''

  const taken = parts.slice(0, ABBREVIATION_LENGTH).map((word) => word[0] ?? '')
  const last = parts[parts.length - 1] ?? ''
  // Lo que falte sale de la última palabra, letra a letra, para que un nombre
  // de una o dos palabras no acabe en relleno si tiene letras de sobra.
  for (let index = 1; taken.length < ABBREVIATION_LENGTH; index += 1) {
    const letter = last[index]
    if (letter === undefined) break
    taken.push(letter)
  }
  while (taken.length < ABBREVIATION_LENGTH) taken.push(ABBREVIATION_FILLER)

  return taken.join('').toUpperCase()
}
