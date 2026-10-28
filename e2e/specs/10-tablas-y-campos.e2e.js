import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CONFIG, carpetaDePruebas } from '../soporte/entorno.js'
import {
  abrirTabla,
  dialogos,
  altoDelPanel,
  arrastrarTabla,
  arrastrarTirador,
  atajo,
  desdeLaBienvenida,
  dobleClicEnLienzo,
  elegir,
  enfocado,
  enfocarCampo,
  escribir,
  escribirConTeclado,
  escribirEn,
  esperarDialogo,
  esperarEditor,
  esperarSinDialogo,
  esperarSinMenu,
  esperarSinTexto,
  esperarTexto,
  esperarVistaQuieta,
  estado,
  estadoEn,
  menuDeTabla,
  pulsar,
  pulsarEn,
  pulsarPuntero,
  seleccionar,
  tablas,
  texto,
  valor,
  valorEn,
  zonas,
} from '../soporte/pantalla.js'

/**
 * Escenario 10 de `specs/004-tablas-campos/quickstart.md`: las tablas y sus
 * campos.
 *
 * Es el escenario que necesita navegador de verdad: crear una tabla con doble
 * clic, arrastrarla a la zona de otro esquema, el tirador del panel inferior y
 * el teclado que escribe celda a celda no se pueden firmar desde jsdom
 * (research R17).
 */
describe('Escenario 10 · Tablas y campos', () => {
  /** Carpeta del recorrido, donde vive el modelo de ejemplo. */
  const carpeta = carpetaDePruebas()

  /** Abre `modelo-tablas.yaml` desde la Bienvenida y encuadra el modelo. */
  async function abrirModelo() {
    await desdeLaBienvenida()
    await pulsar('Abrir modelo')
    await esperarDialogo('Abrir modelo')
    await seleccionar('modelo-tablas.yaml')
    await pulsarEn('Abrir modelo', 'Abrir')
    await esperarSinDialogo('Abrir modelo')
    await esperarEditor()
    await pulsar('Ajustar')
    await esperarVistaQuieta()
  }

  /** Lo que el archivo del modelo tiene escrito ahora mismo. */
  function archivo() {
    return readFileSync(join(carpeta, 'modelo-tablas.yaml'), 'utf8')
  }

  /** Las preferencias que la aplicación tiene escritas en el disco. */
  function preferencias() {
    return JSON.parse(readFileSync(join(CONFIG, 'preferences.json'), 'utf8'))
  }

  /** La tarjeta de una tabla del lienzo, por su nombre técnico. */
  async function tarjeta(nombre) {
    const todas = await tablas()
    return todas.find((item) => item.tabla === nombre)
  }

  /** La zona de un esquema, por su nombre técnico. */
  async function zona(nombre) {
    const todas = await zonas()
    return todas.find((item) => item.nombre.includes(nombre))
  }

  /**
   * Un punto de la pantalla dentro de la zona de un esquema donde soltar algo
   * lo deja en ese esquema.
   *
   * Las zonas se solapan en cuanto un esquema tiene tablas repartidas por el
   * lienzo, y la aplicación resuelve el solape quedándose con la última zona
   * que contiene el punto (FR-031): el punto que se busca aquí es uno donde
   * esa última zona sea la que se quiere.
   *
   * @param nombre Nombre técnico del esquema.
   */
  async function puntoDeZona(nombre) {
    const lista = await zonas()
    const destino = lista.find((item) => item.nombre.includes(nombre))
    const partes = [0.5, 0.3, 0.7, 0.15, 0.85]
    for (const alto of partes) {
      for (const ancho of partes) {
        const punto = {
          x: destino.x + destino.ancho * ancho,
          y: destino.y + destino.alto * alto,
        }
        const dentro = lista.filter(
          (item) =>
            punto.x >= item.x &&
            punto.x <= item.x + item.ancho &&
            punto.y >= item.y &&
            punto.y <= item.y + item.alto,
        )
        if (dentro[dentro.length - 1] === destino) return punto
      }
    }
    throw new Error(`No hay ningún punto que caiga solo en la zona de «${nombre}».`)
  }

  /** Cierra el editor de campos si quedó abierto del escenario anterior. */
  async function cerrarPanel() {
    if ((await texto()).includes('Añadir campo')) {
      await pulsar('Cerrar el editor de campos')
      await esperarSinTexto('Añadir campo')
    }
  }

  /**
   * Espera a que «Crear tabla» se encienda y, si no lo hace, cuenta cómo
   * estaba el diálogo: es la única forma de saber qué lo dejó apagado.
   *
   * @param cuando Momento del escenario, para el mensaje.
   */
  async function esperarCrearTablaEncendida(cuando) {
    const estadoDelBoton = await estadoEn('Nueva tabla', 'Crear tabla')
    if (!estadoDelBoton.deshabilitado) return
    const abiertos = await dialogos()
    throw new Error(
      `«Crear tabla» seguía apagada ${cuando}. El diálogo decía: ${abiertos.join(' / ')}`,
    )
  }

  /** Lo que el modelo tenía justo antes de guardarse, para el último paso. */
  let guardado = null

  it('1 · crear tres tablas por las tres vías (FR-001 a FR-009)', async () => {
    await abrirModelo()

    // Doble clic en el lienzo: la tabla nace donde cayó el gesto (FR-006).
    const punto = await dobleClicEnLienzo(-220, -180)
    await esperarDialogo('Nueva tabla')
    await escribirEn('Nueva tabla', 'Nombre', 'Pagos pendientes')
    expect(await valorEn('Nueva tabla', 'Nombre técnico')).toBe('pagos_pendientes')

    // Un nombre repetido no deja crear (FR-004, RS-03).
    await escribirEn('Nueva tabla', 'Nombre', 'facturas')
    await esperarTexto('Ya existe una tabla llamada')
    expect((await estadoEn('Nueva tabla', 'Crear tabla')).deshabilitado).toBe(true)

    await escribirEn('Nueva tabla', 'Nombre', 'Pagos pendientes')
    await pulsarEn('Nueva tabla', 'Crear tabla')
    await esperarSinDialogo('Nueva tabla')

    // Queda seleccionada, con el editor de campos abierto (FR-007).
    await esperarTexto('Añadir campo')
    const primera = await tarjeta('pagos_pendientes')
    expect(primera.seleccionada).toBe(true)
    // Nace con `id` y los dos campos de auditoría, que son las dos casillas
    // marcadas del diálogo (FR-008).
    expect(primera.nombre).toContain('3 campos')
    expect(primera.nombre).toContain('id, uuid, llave primaria')
    expect(primera.nombre).toContain('created_at, timestamptz')
    // Y aparece donde se hizo el doble clic, no en el centro de la vista.
    expect(Math.abs(primera.x - punto.x)).toBeLessThan(24)
    expect(Math.abs(primera.y - punto.y)).toBeLessThan(24)

    // La tecla `T` es la segunda vía (FR-001).
    await cerrarPanel()
    await browser.keys('t')
    await esperarDialogo('Nueva tabla')
    await escribirEn('Nueva tabla', 'Nombre', 'Cobros')
    await pulsarEn('Nueva tabla', 'Crear tabla')
    await esperarSinDialogo('Nueva tabla')
    expect((await tarjeta('cobros')).seleccionada).toBe(true)

    // Y el botón de la barra superior, la tercera.
    await cerrarPanel()
    await pulsar('Nueva tabla')
    await esperarDialogo('Nueva tabla')
    await escribirEn('Nueva tabla', 'Nombre', 'Proveedores')
    await esperarCrearTablaEncendida('tras escribir el nombre')
    await elegir('Esquema de la tabla', 'PER · personas')
    await esperarCrearTablaEncendida('tras elegir el esquema')
    await pulsarEn('Nueva tabla', 'Crear tabla')
    await esperarSinDialogo('Nueva tabla')
    expect((await tarjeta('proveedores')).nombre).toContain('esquema PER · personas')

    await esperarTexto('8 tablas')
    await esperarTexto('Cambios sin guardar')
  })

  it('2 · definir campos con marcas y plantilla (FR-011 a FR-028)', async () => {
    await abrirTabla('pagos_pendientes')
    await esperarTexto('Añadir campo')

    // Un campo nuevo nace enfocado y con nombre libre (FR-013).
    await pulsar('Añadir campo')
    expect(await valor('Nombre de nuevo_campo')).toBe('nuevo_campo')

    await escribir('Nombre de nuevo_campo', 'importe')
    await elegir('Tipo de importe', 'numeric')
    await escribir('Longitud de importe', '12')
    await escribir('Escala de importe', '2')

    // Un tipo que no admite longitud ni escala no las pide (FR-015).
    expect((await estado('Longitud de created_at, no aplica a este tipo', 'input')).deshabilitado).toBe(
      true,
    )

    // La marca se elige en la celda de llave y se ve en el lienzo (FR-025).
    await elegir('Llave de importe', 'UK')
    await browser.waitUntil(
      async () => (await tarjeta('pagos_pendientes')).nombre.includes('importe, numeric, única'),
      { timeout: 15000, timeoutMsg: 'La marca única no llegó a la tarjeta del lienzo.' },
    )

    // «Plantillas» añade un grupo entero, y apaga el que la tabla ya tiene
    // (FR-027, FR-028).
    await pulsarPuntero('Plantillas')
    expect((await estado('Campos de auditoría', '[role="menuitem"]')).deshabilitado).toBe(true)
    await pulsar('Borrado lógico')
    await esperarSinMenu()

    await esperarTexto('5 campos')
    const conCampos = await tarjeta('pagos_pendientes')
    expect(conCampos.nombre).toContain('deleted_at, timestamptz, admite nulos')
    // El alto de la tarjeta sigue al número de campos (FR-047).
    expect(conCampos.modelo.alto).toBe(42 + 24 * 5)
  })

  it('3 · mover una tabla a la zona de otro esquema (FR-030, FR-031, FR-035)', async () => {
    await cerrarPanel()
    await pulsar('Ajustar')
    await esperarVistaQuieta()

    const antesInventario = await zona('inventario')
    const card = await tarjeta('articulos')
    const destino = await puntoDeZona('ventas')

    // El esquema de destino es el de la zona donde cae el puntero (FR-035).
    await arrastrarTabla(
      'articulos',
      destino.x - (card.x + card.ancho / 2),
      destino.y - (card.y + card.alto / 2),
    )

    await browser.waitUntil(
      async () => (await tarjeta('articulos')).nombre.includes('esquema VEN · ventas'),
      { timeout: 15000, timeoutMsg: 'La tabla no cambió de esquema al soltarla.' },
    )

    // La tarjeta queda dentro de la zona de destino y la de origen se encoge
    // al quedarse sin ella (FR-031).
    const despuesVentas = await zona('ventas')
    const despuesInventario = await zona('inventario')
    const movida = await tarjeta('articulos')
    expect(movida.modelo.x).toBeGreaterThanOrEqual(despuesVentas.modelo.x)
    expect(movida.modelo.y).toBeGreaterThanOrEqual(despuesVentas.modelo.y)
    expect(movida.modelo.x + movida.modelo.ancho).toBeLessThanOrEqual(
      despuesVentas.modelo.x + despuesVentas.modelo.ancho,
    )
    expect(movida.modelo.y + movida.modelo.alto).toBeLessThanOrEqual(
      despuesVentas.modelo.y + despuesVentas.modelo.alto,
    )
    expect(despuesInventario.modelo.ancho * despuesInventario.modelo.alto).toBeLessThan(
      antesInventario.modelo.ancho * antesInventario.modelo.alto,
    )

    // Y ⌘Z devuelve el gesto entero en un paso (FR-041).
    await atajo('z')
    await esperarTexto('Deshecho: cambiar la tabla de esquema')
    expect((await tarjeta('articulos')).nombre).toContain('esquema INV · inventario')
  })

  it('4 · con la cuadrícula activa la posición se ajusta (FR-032)', async () => {
    // En el Editor, Ajustes no tiene botón: se abre con su atajo (FR-020 del
    // Incremento 1).
    await atajo(',')
    await esperarDialogo('General')
    await pulsarEn('General', 'Ajustar a la cuadrícula', '[role="switch"]')
    await browser.waitUntil(async () => preferencias().snapToGrid === true, {
      timeout: 15000,
      timeoutMsg: 'La preferencia de la cuadrícula no se guardó.',
    })
    await browser.keys('Escape')
    await esperarSinDialogo('General')

    await arrastrarTabla('articulos', 37, 23)
    await browser.waitUntil(
      async () => {
        const movida = await tarjeta('articulos')
        return movida.modelo.x % 24 === 0 && movida.modelo.y % 24 === 0
      },
      { timeout: 15000, timeoutMsg: 'La posición no quedó en un múltiplo de 24.' },
    )
  })

  it('5 · renombrar y duplicar una tabla (FR-036 a FR-038)', async () => {
    await menuDeTabla('articulos')
    await pulsar('Renombrar…')
    await esperarDialogo('Renombrar tabla')
    await escribirEn('Renombrar tabla', 'Nombre', 'Artículos del almacén')
    expect(await valorEn('Renombrar tabla', 'Nombre técnico')).toBe('articulos_del_almacen')
    await pulsarEn('Renombrar tabla', 'Renombrar')
    await esperarSinDialogo('Renombrar tabla')

    // El nombre nuevo está en la tarjeta, en la barra lateral, en la barra de
    // estado y en el inspector (FR-036, FR-042).
    await esperarTexto('articulos_del_almacen')
    expect((await tarjeta('articulos_del_almacen')).nombre).toContain('3 campos')

    // ⌘D duplica la seleccionada, con nombre libre y sin solapar (FR-038).
    await pulsar('Tabla articulos_del_almacen,')
    await atajo('d')
    await esperarTexto('articulos_del_almacen_copia')

    const original = await tarjeta('articulos_del_almacen')
    const copia = await tarjeta('articulos_del_almacen_copia')
    expect(copia.nombre).toContain('3 campos')
    const seSolapan =
      original.modelo.x < copia.modelo.x + copia.modelo.ancho &&
      copia.modelo.x < original.modelo.x + original.modelo.ancho &&
      original.modelo.y < copia.modelo.y + copia.modelo.alto &&
      copia.modelo.y < original.modelo.y + original.modelo.alto
    expect(seSolapan).toBe(false)
  })

  it('6 · eliminar una tabla con relaciones y deshacerlo (FR-039, FR-041)', async () => {
    await menuDeTabla('facturas')
    await pulsar('Eliminar tabla…')
    await esperarDialogo('¿Eliminar «facturas»?')
    // La confirmación dice cuántas relaciones se van con la tabla (RS-08).
    await esperarTexto('Se eliminarán también sus 2 relaciones.')
    await pulsarEn('¿Eliminar «facturas»?', 'Eliminar tabla y relaciones')
    await esperarSinDialogo('¿Eliminar «facturas»?')

    await browser.waitUntil(async () => (await tarjeta('facturas')) === undefined, {
      timeout: 15000,
      timeoutMsg: 'La tarjeta de «facturas» siguió en el lienzo.',
    })

    // Deshacer la devuelve entera, con sus campos y sus relaciones.
    await atajo('z')
    await esperarTexto('Deshecho: eliminar la tabla')
    const vuelta = await tarjeta('facturas')
    expect(vuelta.nombre).toContain('5 campos')
    expect(vuelta.nombre).toContain('cliente_id, uuid, clave foránea')
  })

  it('7 · el alto del panel se mueve entre sus topes y se guarda (FR-022, FR-023)', async () => {
    await abrirTabla('clientes')
    await esperarTexto('Añadir campo')
    expect(await altoDelPanel()).toBe(320)

    // Hacia arriba se para en 560 y hacia abajo en 200, por mucho que se tire.
    await arrastrarTirador(-600)
    expect(await altoDelPanel()).toBe(560)
    await arrastrarTirador(600)
    expect(await altoDelPanel()).toBe(200)

    // Lo que sobrevive al reinicio es la preferencia escrita en el disco, que
    // es lo que la aplicación lee al arrancar.
    await browser.waitUntil(async () => preferencias().fieldsPanelHeight === 200, {
      timeout: 15000,
      timeoutMsg: 'El alto del panel no se guardó en las preferencias.',
    })

    // Y cerrarlo conserva la selección (FR-023).
    await pulsar('Cerrar el editor de campos')
    await esperarSinTexto('Añadir campo')
    expect((await tarjeta('clientes')).seleccionada).toBe(true)
  })

  it('8 · deshacer devuelve la celda entera, no letra a letra (FR-024a)', async () => {
    await abrirTabla('clientes')
    await esperarTexto('Añadir campo')

    // Se escribe con el teclado, pulsación a pulsación, que es lo que fusiona
    // el historial en un solo paso.
    await escribirConTeclado('Nombre de correo', '_alterno')
    await browser.waitUntil(async () => (await valor('Nombre de correo_alterno')) === 'correo_alterno', {
      timeout: 15000,
      timeoutMsg: 'El nombre del campo no llegó a «correo_alterno».',
    })

    // Salir de la celda cierra el paso.
    await browser.keys('Tab')
    await atajo('z')
    await esperarTexto('Deshecho: editar el campo')
    expect(await valor('Nombre de correo')).toBe('correo')
    expect((await tarjeta('clientes')).nombre).toContain('correo, varchar')
  })

  it('9 · crear una tabla y reordenar sus campos solo con el teclado (SC-009)', async () => {
    await cerrarPanel()

    // Desde aquí no se toca el ratón: `T` abre el diálogo, que nace con el
    // foco en «Nombre», e Intro lo envía (FR-001, FR-046).
    await browser.keys('t')
    await esperarDialogo('Nueva tabla')
    const enElNombre = await enfocado()
    expect(enElNombre.nombre).toBe('Nombre')
    await browser.keys('traslados'.split(''))
    expect(await valorEn('Nueva tabla', 'Nombre')).toBe('traslados')
    await browser.keys('Enter')
    await esperarSinDialogo('Nueva tabla')
    await esperarTexto('Añadir campo')

    // Crear la tabla deja el foco en la primera celda de la rejilla, así que
    // no hay que tabular hasta ella (FR-044, FR-046a).
    const enLaRejilla = await enfocado()
    expect(enLaRejilla.nombre).toBe('Nombre de id')
    expect(enLaRejilla.visible).toBe(true)

    // Dentro se navega con las flechas y se reordena con ⌥↑ y ⌥↓.
    await browser.keys('ArrowLeft')
    expect((await enfocado()).nombre).toMatch(/^Llave de /)

    await enfocarCampo('Nombre de created_at')
    await browser.keys(['Alt', 'ArrowDown'])
    await browser.waitUntil(
      async () => {
        const card = await tarjeta('traslados')
        return card.nombre.indexOf('updated_at') < card.nombre.indexOf('created_at')
      },
      { timeout: 15000, timeoutMsg: '⌥↓ no reordenó los campos.' },
    )
    expect((await enfocado()).nombre).toBe('Nombre de created_at')

    await esperarTexto('10 tablas')
  })

  it('10 · guardar y reabrir deja todo como estaba (SC-008)', async () => {
    await cerrarPanel()
    await atajo('s')
    await esperarTexto('Guardado')

    // Lo que el archivo guarda: los campos nuevos con su longitud y su
    // escala, la marca única y la posición de cada tabla (FR-051).
    const escrito = archivo()
    expect(escrito).toContain('pagos_pendientes')
    expect(escrito).toContain('length: 12')
    expect(escrito).toContain('scale: 2')
    expect(escrito).toContain('uq_pagos_pendientes_importe')

    guardado = await tablas()

    await atajo('w')
    await esperarTexto('Nuevo modelo…')
    await abrirModelo()

    const reabierto = await tablas()
    expect(reabierto).toHaveLength(guardado.length)
    for (const antes of guardado) {
      const ahora = reabierto.find((item) => item.tabla === antes.tabla)
      expect(ahora).not.toBe(undefined)
      expect(ahora.nombre).toBe(antes.nombre)
      expect(ahora.modelo.x).toBe(antes.modelo.x)
      expect(ahora.modelo.y).toBe(antes.modelo.y)
    }

    // Y la pantalla vuelve a decir lo mismo que antes de cerrar.
    expect(await texto()).toContain('10 tablas')
    expect(await texto()).not.toContain('Cambios sin guardar')
  })

  after(async () => {
    // El interruptor de la cuadrícula queda como estaba para los escenarios
    // que vengan detrás.
    await atajo(',')
    await esperarDialogo('General')
    if ((await estadoEn('General', 'Ajustar a la cuadrícula', '[role="switch"]')).marcado) {
      await pulsarEn('General', 'Ajustar a la cuadrícula', '[role="switch"]')
    }
    await browser.keys('Escape')
    await esperarSinDialogo('General')
  })
})
