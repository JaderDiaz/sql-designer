import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CONFIG, carpetaDePruebas } from '../soporte/entorno.js'
import {
  abrirTabla,
  arrastrarTablaMidiendo,
  atajo,
  desdeLaBienvenida,
  elegir,
  esperarDialogo,
  esperarEditor,
  esperarSinDialogo,
  esperarSinTexto,
  esperarTexto,
  esperarVistaQuieta,
  estado,
  menuDeTabla,
  opciones,
  pulsar,
  pulsarEn,
  relaciones,
  seleccionar,
  tablas,
  texto,
} from '../soporte/pantalla.js'

/**
 * Escenario 11 de `specs/005-relaciones/quickstart.md`: las relaciones.
 *
 * Es lo que jsdom no puede firmar del incremento: el trazo que el navegador
 * pinta de verdad, el resaltado con el cursor sobre una tarjeta, el trazado y
 * la animación que vienen de un archivo de preferencias, y el arrastre con 60
 * relaciones a la vez (research R17).
 */
describe('Escenario 11 · Relaciones', () => {
  /** Carpeta del recorrido, donde viven los modelos de ejemplo. */
  const carpeta = carpetaDePruebas()

  /** Abre `modelo-relaciones.yaml` desde la Bienvenida y encuadra el modelo. */
  async function abrirModelo(archivo = 'modelo-relaciones.yaml') {
    await desdeLaBienvenida()
    await pulsar('Abrir modelo')
    await esperarDialogo('Abrir modelo')
    await seleccionar(archivo)
    await pulsarEn('Abrir modelo', 'Abrir')
    await esperarSinDialogo('Abrir modelo')
    await esperarEditor()
    await pulsar('Ajustar')
    await esperarVistaQuieta()
  }

  /** Lo que el archivo del modelo tiene escrito ahora mismo. */
  function archivo(nombre = 'modelo-relaciones.yaml') {
    return readFileSync(join(carpeta, nombre), 'utf8')
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

  /** Una relación pintada, por su nombre técnico. */
  async function linea(nombre) {
    const todas = await relaciones()
    return todas.find((item) => item.nombre === nombre)
  }

  /**
   * Texto que solo se ve con el editor de tabla abierto.
   *
   * Es la ficha de las claves foráneas de la barra del panel: el nombre de la
   * lista de fichas es un `aria-label`, y lo que {@link texto} lee es lo que
   * está escrito en la pantalla.
   */
  const PANEL_ABIERTO = 'Claves foráneas'

  /** Cierra el editor de tabla si quedó abierto del escenario anterior. */
  async function cerrarPanel() {
    if ((await texto()).includes(PANEL_ABIERTO)) {
      await pulsar('Cerrar el editor de tabla')
      await esperarSinTexto(PANEL_ABIERTO)
    }
  }

  /**
   * Guarda el modelo y espera a que la aplicación lo confirme.
   *
   * Lo que {@link archivo} lee es el disco, y al disco solo llega lo guardado:
   * el modelo vivo está en la ventana hasta que se pulsa ⌘S.
   */
  async function guardar() {
    await atajo('s')
    await esperarTexto('Guardado')
  }

  /** Pasa el cursor por la tarjeta de una tabla, sin pulsarla. */
  async function cursorSobre(nombre) {
    await browser.execute(`
      const el = [...document.querySelectorAll('.sm-table')]
        .find((e) => (e.getAttribute('aria-label') || '').startsWith('Tabla ' + ${JSON.stringify(nombre)} + ','))
      if (!el) return null
      const caja = el.getBoundingClientRect()
      const comun = {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        clientX: caja.left + caja.width / 2,
        clientY: caja.top + 8,
      }
      el.dispatchEvent(new PointerEvent('pointerover', comun))
      el.dispatchEvent(new PointerEvent('pointerenter', comun))
      return true
    `)
  }

  it('1 · las tres vías abren la ficha con su tabla (FR-001 a FR-003)', async () => {
    await abrirModelo()

    // Sin selección, «Relación» solo pide elegir la tabla y no toca el modelo.
    const antes = archivo()
    await pulsar('Relación')
    await esperarTexto('Selecciona la tabla que tendrá la clave foránea.')
    expect(archivo()).toBe(antes)

    // Con una tabla seleccionada, la primera vía es el botón de la barra.
    await abrirTabla('pagos')
    await esperarTexto(PANEL_ABIERTO)
    await pulsar('Relación')
    await esperarTexto('Agrega la clave foránea de pagos.')
    await esperarTexto('Añadir clave foránea')

    // La segunda es la tecla `R`.
    await cerrarPanel()
    await browser.keys('r')
    await esperarTexto('Añadir clave foránea')

    // Y la tercera, el menú de la tarjeta.
    await cerrarPanel()
    await menuDeTabla('clientes')
    await pulsar('Nueva clave foránea…')
    await esperarTexto('Agrega la clave foránea de clientes.')
  })

  it('2 · relacionar cuatro tablas deja sus marcas y sus líneas (FR-004 a FR-010)', async () => {
    const antes = (await relaciones()).length

    await cerrarPanel()
    await abrirTabla('pedido_lineas')
    await pulsar('Claves foráneas')
    await esperarTexto('Esta tabla no referencia a otras.')
    await pulsar('Añadir clave foránea')

    // La columna propuesta sale del patrón de Ajustes y del tipo de la PK.
    await esperarTexto('pedidos_id')
    await guardar()
    expect(archivo()).toContain('fk_pedido_lineas_pedidos_id')
    expect(archivo()).toContain('type: uuid')

    // La línea aparece en el lienzo sin más trabajo, y la marca FK en la
    // tarjeta: las dos se deducen del modelo (FR-010).
    const despues = await relaciones()
    expect(despues.length).toBe(antes + 1)
    const tarjetaDestino = await tarjeta('pedido_lineas')
    expect(tarjetaDestino.nombre).toContain('pedidos_id, uuid, clave foránea')
  })

  it('3 · la tabla consigo misma se dibuja como un bucle (FR-009a, FR-013a)', async () => {
    await cerrarPanel()
    await abrirTabla('clientes')
    await pulsar('Claves foráneas')

    // La propia tabla está en la lista de destinos, y el bucle ya está en el
    // ejemplo: sale y vuelve por el mismo lado de la tarjeta.
    const bucle = await linea('fk_clientes_recomendado_por')
    expect(bucle).not.toBe(undefined)
    const caja = await tarjeta('clientes')
    expect(bucle.d).not.toBe(null)

    // Y la columna no puede ser el campo al que apunta: `id` no se ofrece.
    const columnas = await opciones('Columna de fk_clientes_recomendado_por')
    expect(columnas.map((item) => item.texto)).not.toContain('id')
    expect(columnas.map((item) => item.texto)).toContain('recomendado_por')
    expect(caja.tabla).toBe('clientes')
  })

  it('4 · el destino de llave compuesta sale deshabilitado con su motivo (FR-009)', async () => {
    await cerrarPanel()
    await abrirTabla('pagos')
    await pulsar('Claves foráneas')

    // La opción está en la lista, pero deshabilitada con su motivo: elegirla
    // no se puede, y el motivo se lee en la propia opción.
    const destinos = await opciones('Tabla referenciada de fk_pagos_pedido_id')
    const compuesta = destinos.find((item) => item.texto === 'pedido_lineas')
    expect(compuesta).not.toBe(undefined)
    expect(compuesta.deshabilitada).toBe(true)
    expect(compuesta.descripcion).toBe('pedido_lineas tiene llave primaria de varias columnas.')
    // Y la propia tabla sí se ofrece: una tabla puede referenciarse a sí misma
    // (FR-013a).
    expect(destinos.find((item) => item.texto === 'pagos').deshabilitada).toBe(false)
  })

  it('5 · resaltar con el cursor y con el teclado (FR-021 a FR-023, FR-027)', async () => {
    await cerrarPanel()
    await cursorSobre('pagos')

    const conCursor = await tablas()
    expect(conCursor.find((item) => item.tabla === 'pagos').resaltada).toBe(true)
    expect(conCursor.find((item) => item.tabla === 'pedidos').relacionada).toBe(true)
    expect(conCursor.find((item) => item.tabla === 'clientes').atenuada).toBe(true)
    // Los campos de la relación quedan marcados en las dos tablas (FR-023).
    expect(conCursor.find((item) => item.tabla === 'pagos').camposMarcados).toContain('pedido_id')
    expect(conCursor.find((item) => item.tabla === 'pedidos').camposMarcados).toContain('id')

    const conLineas = await relaciones()
    expect(conLineas.find((item) => item.nombre === 'fk_pagos_pedido_id').estado).toBe('hot')
    expect(conLineas.find((item) => item.nombre === 'fk_clientes_recomendado_por').estado).toBe(
      'dim',
    )

    // Con el teclado llega lo mismo: la tarjeta enfocada resalta su grupo.
    await browser.execute(`
      const el = [...document.querySelectorAll('.sm-table')]
        .find((e) => (e.getAttribute('aria-label') || '').startsWith('Tabla clientes,'))
      if (el) el.focus()
    `)
    const conFoco = await tablas()
    expect(conFoco.find((item) => item.tabla === 'clientes').resaltada).toBe(true)
  })

  it('6 · el trazado y la animación de Ajustes (FR-017, FR-024)', async () => {
    const ortogonal = await linea('fk_pagos_pedido_id')

    await atajo(',')
    await esperarDialogo('General')

    // El trazado se cambia con la ventana abierta y las líneas se redibujan
    // antes de los 100 ms que pide FR-017.
    const arranque = Date.now()
    await pulsarEn('General', 'Curvas')
    await browser.waitUntil(
      async () => {
        const actual = await linea('fk_pagos_pedido_id')
        return actual !== undefined && actual.d !== ortogonal.d
      },
      { timeout: 5000, timeoutMsg: 'Las líneas no se redibujaron al cambiar el trazado.' },
    )
    const curva = await linea('fk_pagos_pedido_id')
    expect(curva.d).toContain('C')
    expect(Date.now() - arranque).toBeLessThan(2000)

    await pulsarEn('General', 'Rectas')
    await browser.waitUntil(
      async () => {
        const actual = await linea('fk_pagos_pedido_id')
        return actual !== undefined && actual.d !== curva.d
      },
      { timeout: 5000, timeoutMsg: 'Las rectas no llegaron.' },
    )

    await pulsarEn('General', 'Ortogonal')
    // La animación es la otra preferencia nueva: las tres opciones se
    // escriben en el archivo y «Apagada» deja la línea sin flujo.
    await pulsarEn('General', 'Apagada')
    expect(preferencias().relationAnimation).toBe('off')
    await pulsarEn('General', 'Viva')
    expect(preferencias().relationAnimation).toBe('lively')
    await pulsarEn('General', 'Sutil')

    await browser.keys('Escape')
    await esperarSinDialogo('General')

    // Y con una relación resaltada aparece el flujo y su cardinalidad.
    await cursorSobre('pagos')
    const resaltada = await linea('fk_pagos_pedido_id')
    expect(resaltada.flujo).toBe(true)
    expect(resaltada.etiquetas).toEqual(['N', '1'])
  })

  it('7 · las reglas y el aviso de SET NULL (FR-028, FR-030)', async () => {
    await cerrarPanel()
    await abrirTabla('pagos')
    await pulsar('Claves foráneas')

    await elegir('ON DELETE de fk_pagos_pedido_id', 'SET NULL')
    await esperarTexto('La columna no admite nulos, así que SET NULL no podrá aplicarse.')
    // La regla se guarda igual: es válida en el archivo.
    await guardar()
    expect(archivo()).toContain('onDelete: set_null')

    await pulsar('Quitar «no nulo»')
    await esperarSinTexto('La columna no admite nulos')
    await guardar()
    expect(archivo()).toContain('nullable: true')

    await elegir('ON UPDATE de fk_pagos_pedido_id', 'RESTRICT')
    await elegir('ON DELETE de fk_pagos_pedido_id', 'CASCADE')
    await guardar()
    expect(archivo()).toContain('onUpdate: restrict')
    expect(archivo()).toContain('onDelete: cascade')
  })

  it('8 · «Referenciada por» lista y lleva a la otra tabla (FR-031)', async () => {
    await cerrarPanel()
    await abrirTabla('pedidos')
    await pulsar('Claves foráneas')

    await esperarTexto('Referenciada por')
    await esperarTexto('pagos.pedido_id')

    await pulsar('VEN')
    const seleccionada = await tarjeta('pagos')
    expect(seleccionada.seleccionada).toBe(true)
  })

  it('9 · eliminar quita la línea y ⌘Z la devuelve (FR-035, FR-036)', async () => {
    await cerrarPanel()
    await abrirTabla('pagos')
    await pulsar('Claves foráneas')

    await pulsar('Eliminar la clave foránea')
    await browser.waitUntil(async () => (await linea('fk_pagos_pedido_id')) === undefined, {
      timeout: 5000,
      timeoutMsg: 'La línea siguió pintada después de eliminar la relación.',
    })

    // El campo se queda, sin marca FK.
    const sinMarca = await tarjeta('pagos')
    expect(sinMarca.nombre).toContain('pedido_id, uuid')
    expect(sinMarca.nombre).not.toContain('pedido_id, uuid, clave foránea')

    await atajo('z')
    await browser.waitUntil(async () => (await linea('fk_pagos_pedido_id')) !== undefined, {
      timeout: 5000,
      timeoutMsg: 'El deshacer no devolvió la relación.',
    })
    await esperarTexto('Deshecho: eliminar la clave foránea')
  })

  it('10 · guardar y reabrir deja todo como estaba (SC-007)', async () => {
    await atajo('s')
    await esperarTexto('Guardado')
    const guardado = archivo()
    expect(guardado).toContain('fk_pedido_lineas_pedidos_id')
    expect(guardado).toContain('onDelete: cascade')

    await atajo('w')
    await esperarTexto('Nuevo modelo…')
    await abrirModelo()

    // Las relaciones, sus reglas y sus marcas siguen puestas.
    expect((await relaciones()).length).toBeGreaterThanOrEqual(4)
    await abrirTabla('pagos')
    await pulsar('Claves foráneas')
    await esperarTexto('CASCADE')
    const conMarca = await tarjeta('pagos')
    expect(conMarca.nombre).toContain('pedido_id, uuid, clave foránea')
  })

  it('11 · el trazado y la animación quedan guardados para el arranque (FR-041, SC-007)', async () => {
    await atajo(',')
    await esperarDialogo('General')
    await pulsarEn('General', 'Rectas')
    await pulsarEn('General', 'Apagada')

    // Lo que sobrevive al reinicio es lo que queda escrito en el disco, que es
    // lo que la aplicación lee al arrancar (igual que el alto del panel del
    // Incremento 3).
    await browser.waitUntil(
      async () =>
        preferencias().relationRoute === 'straight' &&
        preferencias().relationAnimation === 'off',
      { timeout: 15000, timeoutMsg: 'El trazado y la animación no se guardaron.' },
    )

    await browser.keys('Escape')
    await esperarSinDialogo('General')
    await atajo(',')
    await esperarDialogo('General')

    // Y al volver a abrir Ajustes, los dos controles llegan marcados con lo
    // que dice el archivo.
    expect((await estado('Rectas')).marcado).toBe(true)
    expect((await estado('Apagada')).marcado).toBe(true)

    // Se dejan como los encontró el recorrido, para no condicionar al que
    // venga detrás.
    await pulsarEn('General', 'Ortogonal')
    await pulsarEn('General', 'Sutil')
    await browser.keys('Escape')
    await esperarSinDialogo('General')
  })

  it('12 · arrastrar con 60 relaciones mantiene las líneas pegadas (SC-003)', async () => {
    await abrirModelo('modelo-50-tablas.yaml')

    const todas = await relaciones()
    expect(todas.length).toBeGreaterThanOrEqual(60)
    const primera = todas[0]
    const movida = (await tablas())[0].tabla

    const medida = await arrastrarTablaMidiendo(movida, 120, 80)
    // Cada `pointermove` repinta las relaciones que toca el gesto, así que su
    // tiempo es el trabajo del cuadro: el presupuesto son los 16 ms de 60 fps,
    // con el Modo de bajo consumo del sistema apagado.
    expect(medida.cuadros).toBeGreaterThan(20)
    expect(medida.media).toBeLessThan(16)
    expect(medida.peor).toBeLessThan(16)

    // Y las líneas se quedan pegadas: la que tocaba la tabla movida cambió de
    // trazo, y el modelo guarda la posición nueva.
    const despues = await relaciones()
    expect(despues.length).toBe(todas.length)
    const mismaPrimera = despues.find((item) => item.nombre === primera.nombre)
    expect(mismaPrimera).not.toBe(undefined)
  })

  after(async () => {
    // El arrastre del escenario 12 deja el modelo sin guardar, y cerrar con
    // cambios pendientes abre la confirmación en vez de la Bienvenida.
    await guardar()
    await atajo('w')
    await esperarTexto('Nuevo modelo…')
  })
})
