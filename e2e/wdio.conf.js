import {
  BINARIO,
  arrancarServidor,
  pararServidor,
  prepararEntorno,
  restaurarEntorno,
} from './soporte/entorno.js'
import { desdeLaBienvenida } from './soporte/pantalla.js'

/**
 * Recorrido automatizado de `specs/002-archivos-modelo/quickstart.md`.
 *
 * Conduce la aplicación de verdad —no una maqueta— con el servidor de
 * WebDriver que el binario monta cuando se compila con `--features webdriver`.
 * Por eso lo que las pruebas comprueban en el disco es el disco real: los
 * archivos que escribe la aplicación, su lista de recientes y sus
 * preferencias.
 *
 * Antes de cada ejecución el estado del usuario se aparta y se repone al
 * terminar; los modelos de prueba viven en una carpeta temporal que se borra
 * sola.
 */
export const config = {
  runner: 'local',
  specs: ['./specs/**/*.e2e.js'],
  // Una sola ventana a la vez: la aplicación es de documento único y las
  // pruebas comparten el directorio de configuración.
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'tauri',
      // `driverProvider` explícito: el servicio lo autodetecta en macOS, pero
      // en Windows elegiría el `tauri-driver` externo, y el servidor que las
      // pruebas usan es el que el propio binario monta.
      'tauri:options': { application: BINARIO, driverProvider: 'embedded' },
    },
  ],
  services: ['@wdio/tauri-service'],
  framework: 'mocha',
  reporters: ['spec'],
  logLevel: 'warn',
  // El arranque tiene un suelo de 650 ms para la pantalla de carga y la
  // ventana se mueve con su animación, así que los esperas van holgadas.
  waitforTimeout: 15000,
  mochaOpts: { ui: 'bdd', timeout: 120000 },

  async onPrepare() {
    prepararEntorno()
    await arrancarServidor()
  },

  // Cada archivo de escenario arranca su propia ventana, y el arranque reabre
  // el último modelo que recuerdan las preferencias: sin esto, el escenario
  // hereda el Editor del anterior en vez de la Bienvenida.
  async before() {
    await desdeLaBienvenida()
  },

  onComplete() {
    pararServidor()
    restaurarEntorno()
  },
}
