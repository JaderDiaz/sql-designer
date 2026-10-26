import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { carpetaDePruebas } from '../soporte/entorno.js'
import {
  abrirFila,
  escribir,
  esperarDialogo,
  esperarSinDialogo,
  esperarTexto,
  filas,
  esperarSinMenu,
  menuDeFila,
  pulsar,
  pulsarEn,
  seleccionar,
  texto,
} from '../soporte/pantalla.js'

/**
 * Escenario 6 de `quickstart.md`: Recientes y sus acciones (FR-031 a FR-036).
 *
 * Los escenarios anteriores dejan ya varios modelos en la lista; este añade
 * los que le faltan y trabaja sobre ellos.
 */
describe('Escenario 6 · Recientes y sus acciones', () => {
  /** Carpeta del recorrido. */
  const carpeta = carpetaDePruebas()

  /**
   * Crea un modelo desde la Bienvenida y lo cierra, para que quede en la
   * lista de recientes.
   *
   * @param nombre Nombre del modelo.
   */
  async function crearYCerrar(nombre) {
    await pulsar('Nuevo modelo')
    await esperarDialogo('Nuevo modelo')
    await escribir('Nombre del modelo', nombre)
    await pulsarEn('Nuevo modelo', 'Crear modelo')
    await esperarTexto('Empieza a diseñar tu modelo')
    await browser.keys(['Meta', 'w'])
    await esperarTexto('Nuevo modelo…')
  }

  /** Vuelve a la Bienvenida pasando por el Editor, para que la lista se relea. */
  async function refrescarLista() {
    await abrirFila('modelo.yaml')
    await esperarTexto('Empieza a diseñar tu modelo')
    await browser.keys(['Meta', 'w'])
    await esperarTexto('Nuevo modelo…')
  }

  before(async () => {
    // El escenario trabaja sobre `modelo.yaml`, así que se asegura de que esté
    // en la lista: corriendo solo este archivo, los recientes están vacíos.
    await pulsar('Abrir modelo')
    await esperarDialogo('Abrir modelo')
    await seleccionar('modelo.yaml')
    await pulsarEn('Abrir modelo', 'Abrir')
    await esperarSinDialogo('Abrir modelo')
    await esperarTexto('Empieza a diseñar tu modelo')
    await browser.keys(['Meta', 'w'])
    await esperarTexto('Nuevo modelo…')
  })

  it('los modelos cerrados salen en la lista, el último primero', async () => {
    await crearYCerrar('Inventario bodega')

    const lista = await filas('Modelos recientes')
    expect(lista[0]).toContain('inventario-bodega.yaml')
    expect(lista.length).toBeGreaterThan(1)
    expect(lista[0]).toContain('PostgreSQL')
    expect((await texto()).includes(`${lista.length} modelos`)).toBe(true)
  })

  it('el doble clic abre el modelo y lo sube al primer lugar', async () => {
    await abrirFila('modelo.yaml')
    await esperarTexto('Empieza a diseñar tu modelo')
    await browser.keys(['Meta', 'w'])
    await esperarTexto('Nuevo modelo…')

    const lista = await filas('Modelos recientes')
    expect(lista[0]).toContain('modelo.yaml')
  })

  it('con el teclado, Enter abre el que esté seleccionado', async () => {
    await seleccionar('inventario-bodega.yaml')
    await browser.keys('Enter')

    await esperarTexto('Empieza a diseñar tu modelo')
    await esperarTexto('Inventario bodega')
    await browser.keys(['Meta', 'w'])
    await esperarTexto('Nuevo modelo…')
  })

  it('un archivo movido por fuera sale como «No encontrado»', async () => {
    renameSync(join(carpeta, 'inventario-bodega.yaml'), join(carpeta, 'otra-carpeta', 'inventario-bodega.yaml'))
    await refrescarLista()

    await esperarTexto('No encontrado')
  })

  it('al abrir uno que no está, se puede quitar de la lista sin tocar el archivo', async () => {
    await abrirFila('inventario-bodega.yaml')
    await esperarDialogo('No se encontró «inventario-bodega.yaml»')

    await pulsarEn('No se encontró', 'Quitar de recientes')
    await esperarSinDialogo('No se encontró')

    const lista = await filas('Modelos recientes')
    expect(lista.some((fila) => fila.includes('inventario-bodega.yaml'))).toBe(false)
    expect(existsSync(join(carpeta, 'otra-carpeta', 'inventario-bodega.yaml'))).toBe(true)
  })

  it('un archivo roto por fuera sale como «Archivo con errores» y dice la línea', async () => {
    await crearYCerrar('Livy · Facturación')
    writeFileSync(join(carpeta, 'livy-facturacion.yaml'), 'formatVersion: 1\nname: Roto\nengine: postgres\nschemas\n  - name: public\n')
    await refrescarLista()

    await esperarTexto('Archivo con errores')

    await abrirFila('livy-facturacion.yaml')
    await esperarDialogo('No se pudo abrir «livy-facturacion.yaml»')
    await esperarTexto('Línea')
    await pulsarEn('No se pudo abrir', 'Aceptar')
    await esperarSinDialogo('No se pudo abrir')
  })

  it('el menú de una fila trae sus cinco acciones y se cierra con Esc', async () => {
    await menuDeFila('modelo.yaml')
    await esperarTexto('Copiar ruta')

    const acciones = await browser.execute(`
      return [...document.querySelectorAll('[role="menuitem"]')].map((e) => e.innerText.trim())
    `)
    for (const accion of ['Abrir', 'Renombrar…', 'Copiar ruta', 'Quitar de recientes', 'Mover a la papelera…']) {
      expect(acciones.some((texto) => texto.startsWith(accion))).toBe(true)
    }

    await browser.keys('Escape')
    await esperarSinMenu()
  })

  it('«Renombrar…» cambia el nombre del modelo y no el del archivo', async () => {
    await menuDeFila('modelo.yaml')
    await pulsar('Renombrar…', '[role="menuitem"]')
    await esperarDialogo('Renombrar modelo')
    await esperarTexto('El archivo sigue siendo modelo.yaml')

    await escribir('Nombre', 'Livy · Reservas D')
    await pulsarEn('Renombrar modelo', 'Renombrar')
    await esperarSinDialogo('Renombrar modelo')

    await esperarTexto('Livy · Reservas D')
    expect(readFileSync(join(carpeta, 'modelo.yaml'), 'utf8')).toContain('name: Livy · Reservas D')
    expect(existsSync(join(carpeta, 'modelo.yaml'))).toBe(true)
  })

  it('«Copiar ruta» avisa de que la copió', async () => {
    await menuDeFila('modelo.yaml')
    await pulsar('Copiar ruta', '[role="menuitem"]')

    await esperarTexto('Ruta copiada')
  })

  it('«Mover a la papelera…» confirma y se lleva el archivo de la carpeta', async () => {
    await menuDeFila('livy-facturacion.yaml')
    await pulsar('Mover a la papelera…', '[role="menuitem"]')

    await esperarDialogo('¿Mover «livy-facturacion.yaml» a la papelera?')
    await pulsarEn('¿Mover', 'Mover a la papelera')
    await esperarSinDialogo('¿Mover')

    expect(existsSync(join(carpeta, 'livy-facturacion.yaml'))).toBe(false)
    const lista = await filas('Modelos recientes')
    expect(lista.some((fila) => fila.includes('livy-facturacion.yaml'))).toBe(false)
  })

  it('la lista se queda en diez y suelta el más antiguo', async () => {
    for (let numero = 1; numero <= 11; numero += 1) {
      await crearYCerrar(`Tope ${numero}`)
    }

    const lista = await filas('Modelos recientes')
    expect(lista.length).toBe(10)
    expect(lista[0]).toContain('tope-11.yaml')
    expect(lista.some((fila) => fila.includes('tope-1.yaml'))).toBe(false)
  })
})
