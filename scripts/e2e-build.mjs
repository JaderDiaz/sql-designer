import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Compila el binario que conduce el recorrido automatizado.
 *
 * Son dos cosas que no van en la configuración del producto:
 *
 * 1. `--features webdriver`, que mete el servidor de WebDriver dentro de la
 *    aplicación. Abre automatización por HTTP en 127.0.0.1:4445, así que no
 *    entra en ninguna compilación normal ni en la de publicación.
 * 2. `withGlobalTauri`, que expone la API de Tauri en `window`. El servicio de
 *    WebdriverIO la usa para saber qué ventana está activa; sin ella pierde
 *    cinco segundos en cada comando esperándola.
 *
 * La configuración se lee del `tauri.conf.json` de verdad y solo se le cambia
 * esa bandera: `TAURI_CONFIG` reemplaza secciones enteras, y pasar un `app`
 * recortado dejaría la aplicación sin su ventana.
 */

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const configuracion = JSON.parse(readFileSync(join(raiz, 'src-tauri', 'tauri.conf.json'), 'utf8'))

const resultado = spawnSync(
  'cargo',
  ['build', '--manifest-path', join(raiz, 'src-tauri', 'Cargo.toml'), '--features', 'webdriver'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      TAURI_CONFIG: JSON.stringify({
        app: {
          ...configuracion.app,
          withGlobalTauri: true,
          security: {
            ...configuracion.app.security,
            // Los permisos del recorrido van aquí y no en `capabilities/`:
            // ese directorio lo lee cualquier compilación, y una sin la
            // bandera `webdriver` no tendría los plugins que los declaran.
            capabilities: [
              {
                identifier: 'recorrido',
                windows: ['main'],
                permissions: ['wdio:default', 'wdio-webdriver:default'],
              },
            ],
          },
        },
      }),
    },
  },
)

process.exit(resultado.status ?? 1)
