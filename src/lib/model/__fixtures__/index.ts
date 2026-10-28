import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Modelos de ejemplo de las pruebas.
 *
 * Viven como archivos `.yaml` de verdad para que las pruebas midan el texto
 * que se guardaría en el disco, con sus líneas, y no una cadena escrita a mano
 * dentro de la prueba.
 *
 * La ruta se arma desde el directorio del proyecto y no desde
 * `import.meta.url`: en las pruebas el módulo lo sirve Vite y esa URL no
 * apunta al disco.
 */

/** Directorio de los ejemplos, relativo al directorio del proyecto. */
const FIXTURES_DIR = resolve(process.cwd(), 'src/lib/model/__fixtures__')

/** Nombres de los archivos de ejemplo. */
export type FixtureName =
  | 'modelo-postgres'
  | 'modelo-mysql'
  | 'modelo-sqlite'
  | 'modelo-roto'
  | 'modelo-clave-desconocida'
  | 'modelo-50-tablas'
  | 'modelo-tres-esquemas'
  | 'modelo-posiciones'
  | 'modelo-posiciones-extremas'
  | 'modelo-tipos-ajenos'

/**
 * Lee un modelo de ejemplo.
 *
 * @param name Nombre del archivo, sin extensión.
 */
export function readFixture(name: FixtureName): string {
  return readFileSync(resolve(FIXTURES_DIR, `${name}.yaml`), 'utf8')
}
