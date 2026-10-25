import { readdir, readFile } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Puerta 7 de la constitución: verifica la dirección de las dependencias.
 *
 * Comprueba dos reglas y falla con código 1 si alguna se rompe:
 * 1. Ningún archivo de `src/components/ui/` importa de `src/store/` ni de
 *    `src/components/features/`: el sistema de diseño es puro.
 * 2. `invoke` solo aparece en `src/lib/tauri/`, que es la única frontera.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []

/**
 * Lista los archivos TypeScript de un directorio, recursivamente.
 *
 * @param directory Directorio a recorrer.
 * @returns Rutas absolutas de los archivos `.ts` y `.tsx`.
 */
async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const found = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...(await sources(path)))
    else if (/\.tsx?$/.test(entry.name)) found.push(path)
  }
  return found
}

const uiFiles = await sources(join(root, 'src', 'components', 'ui'))
for (const file of uiFiles) {
  const code = await readFile(file, 'utf8')
  if (/from '@\/store\//.test(code) || /from '@\/components\/features\//.test(code)) {
    problems.push(`${relative(root, file)}: un componente de ui importa del almacén o de features`)
  }
}

const allFiles = await sources(join(root, 'src'))
for (const file of allFiles) {
  const code = await readFile(file, 'utf8')
  const isBoundary = relative(root, file).startsWith(join('src', 'lib', 'tauri'))
  if (!isBoundary && /\binvoke\b/.test(code)) {
    problems.push(`${relative(root, file)}: \`invoke\` fuera de src/lib/tauri/`)
  }
}

if (problems.length > 0) {
  console.error('Puerta 7 incumplida:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(`Puerta 7 cumplida: ${allFiles.length} archivos revisados.`)
