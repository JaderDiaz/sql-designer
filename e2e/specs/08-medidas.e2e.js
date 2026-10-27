import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { REGISTRO, carpetaDePruebas } from '../soporte/entorno.js'
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
} from '../soporte/pantalla.js'

/**
 * Escenario 8 de `quickstart.md`: las medidas de SC-002 y SC-003.
 *
 * El binario solo las anota con `SQL_DESIGNER_MEDIR=1`, que el recorrido pone
 * en el entorno antes de arrancar la aplicación. Que sin la bandera no se
 * anote nada lo prueba `enabled_from` en `src-tauri/src/measure.rs`.
 */
describe('Escenario 8 · Medidas de SC-002 y SC-003', () => {
  /** Carpeta del recorrido. */
  const carpeta = carpetaDePruebas()

  /**
   * Espera a que el registro traiga una línea con el texto dado y devuelve
   * los milisegundos que anota.
   *
   * @param marca Parte de la línea que identifica la medida.
   */
  async function milisegundos(marca) {
    let linea = null
    await browser.waitUntil(
      () => {
        const registro = readFileSync(REGISTRO, 'utf8')
        linea = registro
          .split('\n')
          .filter((fila) => fila.includes(marca))
          .pop()
        return linea !== undefined && linea !== null
      },
      { timeout: 15000, timeoutMsg: `El registro no trajo ninguna línea con «${marca}».` },
    )
    const numero = /en (\d+) ms/.exec(linea)
    expect(numero).not.toBe(null)
    return Number(numero[1])
  }

  before(() => {
    writeFileSync(REGISTRO, '')
  })

  it('crear un modelo deja el Editor pintado en menos de 1 000 ms (SC-002)', async () => {
    await pulsar('Nuevo modelo')
    await esperarDialogo('Nuevo modelo')
    await escribir('Nombre del modelo', 'Medida vacía')
    await pulsarEn('Nuevo modelo', 'Crear modelo')
    await esperarTexto('Empieza a diseñar tu modelo')

    expect(await milisegundos('SC-002 modelo abierto')).toBeLessThan(1000)

    await atajo('w')
    await esperarTexto('Nuevo modelo…')
  })

  it('abrir un modelo de 50 tablas tarda menos de 2 000 ms (SC-003)', async () => {
    writeFileSync(REGISTRO, '')

    await pulsar('Abrir modelo')
    await esperarDialogo('Abrir modelo')
    await seleccionar('modelo-50-tablas.yaml')
    await pulsarEn('Abrir modelo', 'Abrir')
    await esperarSinDialogo('Abrir modelo')
    await esperarEditor()

    expect(await milisegundos('SC-002 modelo abierto')).toBeLessThan(2000)
  })

  it('guardarlo tarda menos de 1 000 ms (SC-003)', async () => {
    writeFileSync(REGISTRO, '')

    await pulsar('Renombrar modelo')
    await esperarDialogo('Renombrar modelo')
    await escribir('Nombre', 'Medida de guardado')
    await pulsarEn('Renombrar modelo', 'Renombrar')
    await esperarSinDialogo('Renombrar modelo')

    await atajo('s')
    await esperarTexto('Guardado')

    expect(await milisegundos('SC-003 modelo guardado')).toBeLessThan(1000)
    expect(readFileSync(join(carpeta, 'modelo-50-tablas.yaml'), 'utf8')).toContain(
      'name: Medida de guardado',
    )
  })

  after(async () => {
    await atajo('w')
    await esperarTexto('Nuevo modelo…')
  })
})
