import { appendFileSync, chmodSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { carpetaDePruebas } from '../soporte/entorno.js'
import {
  escribir,
  esperarDialogo,
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
    await esperarTexto('Empieza a diseñar tu modelo')
  })

  it('un cambio deja el modelo en «Editado» y no toca el nombre del archivo', async () => {
    await esperarTexto('Guardado')

    await renombrar('Livy · Reservas 2026')

    await esperarTexto('Editado')
    await esperarTexto('Livy · Reservas 2026')
    expect(readFileSync(ruta, 'utf8')).toContain('name: Livy · Reservas\n')
  })

  it('⌘S guarda, avisa y vuelve a «Guardado»', async () => {
    await browser.keys(['Meta', 's'])

    await esperarTexto('Guardado')
    expect(readFileSync(ruta, 'utf8')).toContain('name: Livy · Reservas 2026')
  })

  it('⌘S sin cambios no vuelve a escribir el archivo', async () => {
    const antes = statSync(ruta).mtimeMs

    await browser.keys(['Meta', 's'])
    await browser.pause(500)

    expect(statSync(ruta).mtimeMs).toBe(antes)
  })

  it('si el archivo cambió por fuera, cancelar no escribe nada', async () => {
    appendFileSync(ruta, '\n# tocado por fuera\n')
    await renombrar('Livy · Reservas 2027')
    await browser.keys(['Meta', 's'])

    await esperarDialogo('«modelo.yaml» cambió en el disco')
    await pulsarEn('«modelo.yaml» cambió en el disco', 'Cancelar')
    await esperarSinDialogo('«modelo.yaml» cambió en el disco')

    await esperarTexto('Editado')
    expect(readFileSync(ruta, 'utf8')).toContain('# tocado por fuera')
  })

  it('sobrescribir guarda y se lleva por delante lo de fuera', async () => {
    await browser.keys(['Meta', 's'])
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
    // El permiso se le quita a la carpeta y no al archivo: la escritura es
    // atómica —se escribe un temporal al lado y se renombra encima—, y
    // renombrar encima de un archivo de solo lectura funciona igual mientras
    // la carpeta deje escribir.
    chmodSync(carpeta, 0o555)
    try {
      await browser.keys(['Meta', 's'])
      await esperarTexto('No se pudo guardar')
      await esperarTexto('Editado')
      expect((await texto()).includes('Livy · Reservas 2028')).toBe(true)
    } finally {
      chmodSync(carpeta, 0o755)
    }
  })

  after(async () => {
    // Se deja el modelo guardado para que el escenario siguiente arranque
    // desde un estado limpio.
    await browser.keys(['Meta', 's'])
    await esperarTexto('Guardado')
  })
})
