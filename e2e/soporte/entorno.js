import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Entorno del recorrido automatizado: deja la aplicación en un estado conocido
 * antes de cada ejecución y devuelve el del usuario al terminar.
 *
 * La aplicación guarda sus preferencias y su lista de recientes en el
 * directorio de configuración del sistema, que es el mismo que usa la
 * instalación de verdad. Las pruebas escriben ahí, así que lo que había se
 * aparta antes y se repone después; si una ejecución se corta a la mitad, la
 * siguiente encuentra la copia y la repone antes de empezar.
 */

/** Raíz del repositorio, calculada desde este archivo. */
export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Binario que conduce WebdriverIO; se compila con `--features webdriver`. */
export const BINARIO = join(RAIZ, 'src-tauri', 'target', 'debug', 'sql-designer')

/** Directorio de configuración de la aplicación en macOS. */
export const CONFIG = join(
  homedir(),
  'Library',
  'Application Support',
  'com.jaderdiaz.sql-designer',
)

/** Sufijo de la copia que guarda el estado del usuario mientras se prueba. */
const COPIA = '.antes-del-recorrido'

/** Archivos de estado que el recorrido pisa. */
const ESTADO = ['preferences.json', 'recents.json', '.window-state.json']

/** Registro local donde la aplicación anota los errores y las medidas. */
export const REGISTRO = join(
  homedir(),
  'Library',
  'Logs',
  'com.jaderdiaz.sql-designer',
  'sql-designer.log',
)

/** Dirección del servidor del frontend, la misma que `devUrl`. */
const SERVIDOR = 'http://localhost:5173'

/** Carpeta temporal donde viven los modelos de cada ejecución. */
let carpeta = null

/** Proceso de Vite que sirve el frontend mientras corre el recorrido. */
let servidor = null

/**
 * Carpeta de trabajo de la ejecución en curso.
 *
 * Viaja por el entorno y no por una variable del módulo: las pruebas corren en
 * otro proceso que el que prepara el recorrido, y ahí este módulo se carga de
 * cero.
 *
 * @returns Ruta de la carpeta temporal con los archivos de prueba.
 */
export function carpetaDePruebas() {
  const ruta = process.env.SQLD_CARPETA_PRUEBAS
  if (ruta === undefined) throw new Error('El entorno no está preparado todavía.')
  return ruta
}

/**
 * Aparta el estado del usuario y escribe el de partida del recorrido.
 *
 * @param preferencias Preferencias con las que arranca la aplicación.
 */
export function prepararEntorno(preferencias = {}) {
  reponerEstado()
  mkdirSync(CONFIG, { recursive: true })
  for (const nombre of ESTADO) {
    const origen = join(CONFIG, nombre)
    if (existsSync(origen)) cpSync(origen, origen + COPIA)
  }

  carpeta = mkdtempSync(join(tmpdir(), 'sql-designer-recorrido-'))
  process.env.SQLD_CARPETA_PRUEBAS = carpeta
  // Las medidas de SC-001, SC-002 y SC-003 solo se anotan con esta bandera
  // puesta; el escenario 8 las lee del registro.
  process.env.SQL_DESIGNER_MEDIR = '1'
  mkdirSync(join(carpeta, 'vacia'))
  mkdirSync(join(carpeta, 'otra-carpeta'))
  cpSync(join(RAIZ, 'src/lib/model/__fixtures__/modelo-postgres.yaml'), join(carpeta, 'modelo.yaml'))
  cpSync(join(RAIZ, 'src/lib/model/__fixtures__/modelo-roto.yaml'), join(carpeta, 'roto.yaml'))
  cpSync(
    join(RAIZ, 'src/lib/model/__fixtures__/modelo-50-tablas.yaml'),
    join(carpeta, 'modelo-50-tablas.yaml'),
  )
  writeFileSync(join(carpeta, 'notas.md'), '# notas sueltas\n')

  writeFileSync(
    join(CONFIG, 'preferences.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        theme: 'light',
        showWelcomeOnStart: true,
        window: null,
        lastModelPath: null,
        engine: 'postgres',
        lastFolder: carpeta,
        ...preferencias,
      },
      null,
      2,
    ),
  )
  writeFileSync(join(CONFIG, 'recents.json'), JSON.stringify({ formatVersion: 1, entries: [] }, null, 2))
  rmSync(join(CONFIG, '.window-state.json'), { force: true })
}

/**
 * Arranca el servidor del frontend y espera a que responda.
 *
 * Una compilación de depuración carga la interfaz desde `devUrl`, no desde
 * `dist`: sin este servidor la ventana abre en blanco y ningún selector
 * encuentra nada.
 */
export async function arrancarServidor() {
  // Se llama al binario de Vite y no a `npx`, para que `pararServidor` mate
  // al servidor y no a un envoltorio que lo deja vivo en el puerto.
  servidor = spawn(join(RAIZ, 'node_modules', '.bin', 'vite'), ['--port', '5173', '--strictPort'], {
    cwd: RAIZ,
    stdio: 'ignore',
  })

  const limite = Date.now() + 30000
  for (;;) {
    try {
      const respuesta = await fetch(SERVIDOR)
      if (respuesta.ok) return
    } catch {
      // Todavía no escucha.
    }
    if (Date.now() > limite) throw new Error(`El servidor del frontend no respondió en ${SERVIDOR}.`)
    await new Promise((listo) => setTimeout(listo, 300))
  }
}

/** Para el servidor del frontend. */
export function pararServidor() {
  servidor?.kill()
  servidor = null
}

/**
 * Devuelve el estado del usuario y borra la carpeta temporal.
 */
export function restaurarEntorno() {
  reponerEstado()
  if (carpeta !== null) rmSync(carpeta, { recursive: true, force: true })
  carpeta = null
}

/** Repone los archivos apartados, si los hay. */
function reponerEstado() {
  for (const nombre of ESTADO) {
    const copia = join(CONFIG, nombre + COPIA)
    if (!existsSync(copia)) continue
    cpSync(copia, join(CONFIG, nombre))
    rmSync(copia, { force: true })
  }
}
