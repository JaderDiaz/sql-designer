import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'

import { carpetaDePruebas } from '../soporte/entorno.js'
import {
  abrirFila,
  escribir,
  esperarDialogo,
  esperarSinDialogo,
  esperarTexto,
  estado,
  pulsar,
  pulsarEn,
  texto,
} from '../soporte/pantalla.js'

/**
 * Escenario 2 de `quickstart.md`: elegir la carpeta (FR-007 a FR-011).
 */
describe('Escenario 2 · Elegir la carpeta', () => {
  /** Carpeta donde el recorrido escribe sus modelos. */
  const carpeta = carpetaDePruebas()

  before(async () => {
    await pulsar('Nuevo modelo')
    await esperarDialogo('Nuevo modelo')
    await escribir('Nombre del modelo', 'Reservas 2026')
    await pulsar('Cambiar…')
    await esperarDialogo('Elegir carpeta para el nuevo modelo')
  })

  it('cambiar de ubicación cambia el contenido y activa Atrás', async () => {
    expect((await estado('Adelante')).deshabilitado).toBe(true)

    await pulsar('Documentos')
    await esperarTexto('Documentos')
    expect((await estado('Atrás')).deshabilitado).toBe(false)

    await pulsar('Atrás')
    await esperarTexto(basename(carpeta))
    expect((await estado('Adelante')).deshabilitado).toBe(false)
  })

  it('una búsqueda sin coincidencias dice que no hay resultados', async () => {
    await escribir('Buscar carpetas', 'zzzz')
    await esperarTexto('Sin resultados')
    await esperarTexto('Ninguna carpeta coincide con «zzzz».')

    await escribir('Buscar carpetas', '')
    await esperarTexto('vacia')
  })

  it('una carpeta sin nada dentro lo dice', async () => {
    await abrirFila('vacia')
    await esperarTexto('Carpeta vacía')
    await esperarTexto('Crea una carpeta nueva o elige otra ubicación.')
  })

  it('«Nueva carpeta» propone un nombre escrito y seleccionado', async () => {
    await pulsar('Nueva carpeta')

    const enEdicion = await browser.execute(`
      const el = document.activeElement
      return el && el.tagName === 'INPUT'
        ? { valor: el.value, seleccion: el.selectionEnd - el.selectionStart }
        : null
    `)
    expect(enEdicion).not.toBe(null)
    expect(enEdicion.valor).toBe('carpeta sin título')
    expect(enEdicion.seleccion).toBe('carpeta sin título'.length)

    await browser.keys('Enter')
    await esperarTexto('carpeta sin título')
    expect(existsSync(join(carpeta, 'vacia', 'carpeta sin título'))).toBe(true)
  })

  it('la segunda carpeta nueva sale numerada', async () => {
    await pulsar('Nueva carpeta')
    await browser.keys('Enter')

    await esperarTexto('carpeta sin título 2')
    expect(existsSync(join(carpeta, 'vacia', 'carpeta sin título 2'))).toBe(true)
  })

  it('«Elegir» vuelve a Nuevo modelo con esa carpeta y el nombre intacto', async () => {
    await pulsar('Atrás')
    await esperarTexto('vacia')
    await pulsar('Elegir')
    await esperarDialogo('Nuevo modelo')

    await esperarTexto(`Se creará ${join(carpeta, 'reservas-2026.yaml')}`)
  })

  it('«Cancelar» en el explorador conserva la carpeta anterior', async () => {
    await pulsar('Cambiar…')
    await esperarDialogo('Elegir carpeta para el nuevo modelo')
    await pulsar('Documentos')
    await pulsarEn('Elegir carpeta', 'Cancelar')
    await esperarSinDialogo('Elegir carpeta')

    await esperarTexto(`Se creará ${join(carpeta, 'reservas-2026.yaml')}`)
  })

  it('el modelo se crea en la carpeta elegida', async () => {
    await pulsar('Crear modelo')
    await esperarTexto('Empieza a diseñar tu modelo')

    expect(existsSync(join(carpeta, 'reservas-2026.yaml'))).toBe(true)
    expect((await texto()).includes('Reservas 2026')).toBe(true)
  })

  after(async () => {
    await esperarSinDialogo('Nuevo modelo')
  })
})
