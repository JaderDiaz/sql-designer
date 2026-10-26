/**
 * Derivación y validación del nombre de archivo de un modelo.
 *
 * El usuario escribe «Livy · Reservas» y el archivo se propone como
 * `livy-reservas.yaml` (FR-002), pero puede escribir otro nombre a mano en el
 * propio diálogo. La ruta final la arma Rust con `path_build_model`: aquí solo
 * se decide el nombre, sin separadores ni extensión (`research.md` R9, R10).
 */

/** Largo máximo del nombre de archivo, sin la extensión. */
export const FILE_STEM_MAX_LENGTH = 80

/** Lo que se dice cuando el nombre del modelo no deja ninguna letra ni número. */
export const EMPTY_STEM_MESSAGE = 'Usa al menos una letra o un número en el nombre.'

/** Lo que se dice cuando el campo del archivo se deja en blanco. */
export const EMPTY_FILE_MESSAGE = 'Escribe un nombre para el archivo.'

/** Lo que se dice cuando el nombre escrito a mano trae caracteres que no valen. */
export const INVALID_STEM_MESSAGE = 'Usa letras, números, guion o guion bajo, sin espacios.'

/** Lo que se dice cuando el nombre escrito a mano es uno que Windows reserva. */
export const RESERVED_STEM_MESSAGE = 'Ese nombre lo reserva el sistema. Elige otro.'

/** Lo que se dice cuando el nombre escrito a mano se pasa de largo. */
export const LONG_STEM_MESSAGE = `El nombre del archivo no puede pasar de ${FILE_STEM_MAX_LENGTH} caracteres.`

/** Prefijo con el que se salva un nombre que Windows tiene reservado. */
export const RESERVED_PREFIX = 'modelo-'

/**
 * Forma que ha de tener un nombre de archivo escrito a mano: empieza por letra
 * o número y sigue con letras, números, punto, guion o guion bajo.
 */
export const FILE_STEM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** Nombres de archivo que Windows reserva para sus dispositivos. */
const RESERVED_STEMS = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
])

/**
 * Convierte el nombre del modelo en el nombre de su archivo.
 *
 * Pasos: separa los acentos de sus letras y los quita, pasa a minúsculas,
 * cambia por un guion todo lo que no sea una letra o un número ASCII, colapsa
 * los guiones seguidos, recorta los de los extremos y corta a
 * {@link FILE_STEM_MAX_LENGTH} caracteres. Un nombre reservado por Windows
 * sale con el prefijo {@link RESERVED_PREFIX}, para que el archivo se pueda
 * crear también allí.
 *
 * @param name Nombre legible del modelo, tal como lo escribe el usuario.
 * @returns El nombre del archivo sin extensión, o cadena vacía si el nombre no
 * deja ninguna letra ni número.
 */
export function toFileStem(name: string): string {
  const stem = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, FILE_STEM_MAX_LENGTH)
    .replace(/-+$/g, '')

  if (stem === '') return ''
  return isReservedStem(stem) ? `${RESERVED_PREFIX}${stem}` : stem
}

/**
 * Limpia el nombre de archivo que el usuario escribe a mano.
 *
 * Quita los espacios de los extremos y la extensión si la escribió: el `.yaml`
 * lo pone el diálogo, así que escribirlo no debe acabar en `modelo.yaml.yaml`.
 *
 * @param value Lo que hay en el campo del archivo.
 * @returns El nombre sin espacios sobrantes ni extensión.
 */
export function normalizeTypedStem(value: string): string {
  return value.trim().replace(/\.yaml$/i, '')
}

/**
 * Si un nombre es de los que Windows reserva para sus dispositivos.
 *
 * @param stem Nombre de archivo sin extensión.
 */
export function isReservedStem(stem: string): boolean {
  return RESERVED_STEMS.has(stem.toLowerCase())
}

/**
 * Comprueba el nombre de archivo escrito a mano (FR-003).
 *
 * Solo se ocupa de la forma del nombre; que el archivo ya exista lo sabe el
 * disco y lo pregunta el diálogo con `path_build_model`.
 *
 * @param stem Nombre ya limpio por {@link normalizeTypedStem}.
 * @returns El mensaje del problema, o `null` si el nombre vale.
 */
export function fileStemProblem(stem: string): string | null {
  if (!FILE_STEM_PATTERN.test(stem)) return INVALID_STEM_MESSAGE
  if (stem.length > FILE_STEM_MAX_LENGTH) return LONG_STEM_MESSAGE
  if (isReservedStem(stem)) return RESERVED_STEM_MESSAGE
  return null
}
