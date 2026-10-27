import { appendFileSync, chmodSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { WINDOWS, carpetaDePruebas } from '../soporte/entorno.js'
import {
  atajo,
  escribir,
  esperarDialogo,
  esperarEditor,
  esperarSinDialogo,
  esperarTexto,
  pulsar,
  pulsarEn,
  seleccionar,
  texto,
} from '../soporte/pantalla.js'

/**
 * Escenario 4 de `quickstart.md`: guardar, estado de cambios y archivo
 * cambiado por fuera (FR-018 a FR-026).
 */
describe('Escenario 4 · Guardar y estado de cambios', () => {
  /** Carpeta del recorrido. */
  const carpeta = carpetaDePruebas()

  /** Modelo con el que se trabaja durante todo el escenario. */
  const ruta = join(carpeta, 'modelo.yaml')

  /**
   * Renombra el modelo abierto, que es el único cambio que el Incremento 1
   * sabe hacer y por tanto la forma de ensuciarlo.
   *
   * @param nombre Nombre nuevo.
   */
  async function renombrar(nombre) {
    await pulsar('Renombrar modelo')
    await esperarDialogo('Renombrar modelo')
    await escribir('Nombre', nombre)
    await pulsarEn('Renombrar modelo', 'Renombrar')
    await esperarSinDialogo('Renombrar modelo')
  }

  before(async () => {
    await pulsar('Abrir modelo')
    await esperarDialogo('Abrir modelo')
    await seleccionar('modelo.yaml')
    await pulsarEn('Abrir modelo', 'Abrir')
    await esperarSinDialogo('Abrir modelo')
    await esperarEditor()
  })

  it('un cambio deja el modelo en «Editado» y no toca el nombre del archivo', async () => {
    await esperarTexto('Guardado')

    await renombrar('Livy · Reservas 2026')

    await esperarTexto('Editado')
    await esperarTexto('Livy · Reservas 2026')
    expect(readFileSync(ruta, 'utf8')).toContain('name: Livy · Reservas\n')
  })

  it('⌘S guarda, avisa y vuelve a «Guardado»', async () => {
    await atajo('s')

    await esperarTexto('Guardado')
    expect(readFileSync(ruta, 'utf8')).toContain('name: Livy · Reservas 2026')
  })

  it('⌘S sin cambios no vuelve a escribir el archivo', async () => {
    const antes = statSync(ruta).mtimeMs

    await atajo('s')
    await browser.pause(500)

    expect(statSync(ruta).mtimeMs).toBe(antes)
  })

  it('si el archivo cambió por fuera, cancelar no escribe nada', async () => {
    appendFileSync(ruta, '\n# tocado por fuera\n')
    await renombrar('Livy · Reservas 2027')
    await atajo('s')

    await esperarDialogo('«modelo.yaml» cambió en el disco')
    await pulsarEn('«modelo.yaml» cambió en el disco', 'Cancelar')
    await esperarSinDialogo('«modelo.yaml» cambió en el disco')

    await esperarTexto('Editado')
    expect(readFileSync(ruta, 'utf8')).toContain('# tocado por fuera')
  })

  it('sobrescribir guarda y se lleva por delante lo de fuera', async () => {
    await atajo('s')
    await esperarDialogo('«modelo.yaml» cambió en el disco')
    await pulsarEn('«modelo.yaml» cambió en el disco', 'Sobrescribir')
    await esperarSinDialogo('«modelo.yaml» cambió en el disco')

    await esperarTexto('Guardado')
    const escrito = readFileSync(ruta, 'utf8')
    expect(escrito).toContain('name: Livy · Reservas 2027')
    expect(escrito).not.toContain('# tocado por fuera')
  })

  it('sin permiso de escritura avisa y no pierde el cambio', async () => {
    await renombrar('Livy · Reservas 2028')
    // La escritura es atómica: se escribe un temporal al lado y se renombra
    // encima. Así que el permiso se quita donde cada sistema impide ese
    // renombrado: en macOS a la carpeta, porque renombrar sobre un archivo de
    // solo lectura funciona igual; en Windows al archivo, porque es el que
    // bloquea el renombrado y el permiso de la carpeta no se toca con `chmod`.
    const objetivo = WINDOWS ? ruta : carpeta
    chmodSync(objetivo, WINDOWS ? 0o444 : 0o555)
    try {
      await atajo('s')
      await esperarTexto('No se pudo guardar')
      await esperarTexto('Editado')
      expect((await texto()).includes('Livy · Reservas 2028')).toBe(true)
    } finally {
      chmodSync(objetivo, WINDOWS ? 0o666 : 0o755)
    }
  })

  after(async () => {
    // Se deja el modelo guardado para que el escenario siguiente arranque
    // desde un estado limpio.
    await atajo('s')
    await esperarTexto('Guardado')
  })
})
