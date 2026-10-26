/**
 * Derivación del nombre de archivo a partir del nombre del modelo.
 *
 * El usuario escribe «Livy · Reservas» y el archivo se llama
 * `livy-reservas.yaml` (FR-002). La ruta final la arma Rust con
 * `path_build_model`: aquí solo se decide el nombre, sin separadores ni
 * extensión (`research.md` R9, R10).
 */

/** Largo máximo del nombre de archivo, sin la extensión. */
export const FILE_STEM_MAX_LENGTH = 80

/** Lo que se dice cuando el nombre no deja ninguna letra ni número. */
export const EMPTY_STEM_MESSAGE = 'Usa al menos una letra o un número.'

/** Prefijo con el que se salva un nombre que Windows tiene reservado. */
export const RESERVED_PREFIX = 'modelo-'

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
  return RESERVED_STEMS.has(stem) ? `${RESERVED_PREFIX}${stem}` : stem
}
