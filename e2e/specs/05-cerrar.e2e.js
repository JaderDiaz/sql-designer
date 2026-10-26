import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { carpetaDePruebas } from '../soporte/entorno.js'
import {
  escribir,
  esperarDialogo,
  esperarSinDialogo,
  esperarTexto,
  filas,
  pulsar,
  pulsarEn,
  seleccionar,
  texto,
} from '../soporte/pantalla.js'

/**
 * Escenario 5 de `quickstart.md`: cerrar el modelo y la ventana preguntando
 * por los cambios (FR-027 a FR-030).
 */
describe('Escenario 5 · Cerrar', () => {
  /** Modelo con el que se trabaja. */
  const ruta = join(carpetaDePruebas(), 'modelo.yaml')

  /**
   * Abre `modelo.yaml` desde la Bienvenida.
   */
  async function abrirModelo() {
    await pulsar('Abrir modelo')
    await esperarDialogo('Abrir modelo')
    await seleccionar('modelo.yaml')
    await pulsarEn('Abrir modelo', 'Abrir')
    await esperarSinDialogo('Abrir modelo')
    await esperarTexto('Empieza a diseñar tu modelo')
  }

  /**
   * Renombra el modelo abierto para dejarlo con cambios sin guardar.
   *
   * @param nombre Nombre nuevo.
   */
  async function renombrar(nombre) {
    await pulsar('Renombrar modelo')
    await esperarDialogo('Renombrar modelo')
    await escribir('Nombre', nombre)
    await pulsarEn('Renombrar modelo', 'Renombrar')
    await esperarSinDialogo('Renombrar modelo')
    await esperarTexto('Editado')
  }

  it('sin cambios, cerrar vuelve a la Bienvenida y deja el modelo en Recientes', async () => {
    await abrirModelo()
    await browser.keys(['Meta', 'w'])

    await esperarTexto('Nuevo modelo…')
    const recientes = await filas('Modelos recientes')
    expect(recientes.length).toBeGreaterThan(0)
    expect(recientes[0]).toContain('modelo.yaml')
  })

  it('con cambios, cerrar pregunta nombrando el modelo', async () => {
    await abrirModelo()
    await renombrar('Livy · Reservas A')
    await browser.keys(['Meta', 'w'])

    await esperarDialogo('¿Guardar los cambios de «Livy · Reservas A»?')
    await esperarTexto('Si no guardas, se perderán los cambios hechos desde la última vez')
    for (const accion of ['Guardar', 'No guardar', 'Cancelar']) {
      expect((await texto()).includes(accion)).toBe(true)
    }
  })

  it('«Cancelar» deja el Editor con sus cambios', async () => {
    await pulsarEn('¿Guardar los cambios', 'Cancelar')
    await esperarSinDialogo('¿Guardar los cambios')

    await esperarTexto('Editado')
    await esperarTexto('Livy · Reservas A')
  })

  it('«No guardar» vuelve y deja el archivo como el último guardado', async () => {
    const antes = readFileSync(ruta, 'utf8')

    await browser.keys(['Meta', 'w'])
    await esperarDialogo('¿Guardar los cambios')
    await pulsarEn('¿Guardar los cambios', 'No guardar')

    await esperarTexto('Nuevo modelo…')
    expect(readFileSync(ruta, 'utf8')).toBe(antes)
  })

  it('«Guardar» escribe el archivo y vuelve a la Bienvenida', async () => {
    await abrirModelo()
    await renombrar('Livy · Reservas B')

    await browser.keys(['Meta', 'w'])
    await esperarDialogo('¿Guardar los cambios')
    await pulsarEn('¿Guardar los cambios', 'Guardar')

    await esperarTexto('Nuevo modelo…')
    expect(readFileSync(ruta, 'utf8')).toContain('name: Livy · Reservas B')
  })

  it('pedir un modelo nuevo con cambios pregunta antes de reemplazar', async () => {
    await abrirModelo()
    await renombrar('Livy · Reservas C')

    await browser.keys(['Meta', 'n'])
    await esperarDialogo('¿Guardar los cambios de «Livy · Reservas C»?')

    await pulsarEn('¿Guardar los cambios', 'No guardar')
    await esperarDialogo('Nuevo modelo')
    await pulsarEn('Nuevo modelo', 'Cancelar')
    await esperarSinDialogo('Nuevo modelo')
  })
})
