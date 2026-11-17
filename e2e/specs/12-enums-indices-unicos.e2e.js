import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { carpetaDePruebas } from '../soporte/entorno.js'
import {
  abrirTabla,
  atajo,
  desdeLaBienvenida,
  elegir,
  enfocarCampo,
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
  filasDeRejilla,
  marcarColumnas,
  menuDeEnum,
  pulsar,
  pulsarEn,
  seleccionar,
  tablas,
} from '../soporte/pantalla.js'

/**
 * Escenario 12 de `specs/006-enums-indices-unicos/quickstart.md`: enums,
 * índices y únicos.
 *
 * Es la demostración del incremento sobre la aplicación de verdad: crear un
 * enum, usarlo en dos campos, renombrarlo, y crear un índice y un único
 * compuesto. Lo que jsdom ya firma —cada regla, cada mensaje— aquí solo se
 * comprueba en el camino; lo que solo existe con la ventana real es el menú
 * de columnas, el foco de las rejillas, el archivo en el disco y la medida de
 * SC-011.
 */
describe('Escenario 12 · Enums, índices y únicos', () => {
  /** Carpeta del recorrido, donde viven los modelos de ejemplo. */
  const carpeta = carpetaDePruebas()

  /** Abre un modelo desde la Bienvenida y encuadra el lienzo. */
  async function abrirModelo(nombre = 'modelo-enums.yaml') {
    await desdeLaBienvenida()
    await pulsar('Abrir modelo')
    await esperarDialogo('Abrir modelo')
    await seleccionar(nombre)
    await pulsarEn('Abrir modelo', 'Abrir')
    await esperarSinDialogo('Abrir modelo')
    await esperarEditor()
    await pulsar('Ajustar')
    await esperarVistaQuieta()
  }

  /** Lo que el archivo del modelo tiene escrito ahora mismo. */
  function archivo(nombre = 'modelo-enums.yaml') {
    return readFileSync(join(carpeta, nombre), 'utf8')
  }

  /** El nombre accesible de la tarjeta de una tabla, que lista campo y tipo. */
  async function tarjeta(nombre) {
    const todas = await tablas()
    return todas.find((item) => item.tabla === nombre)?.nombre ?? ''
  }

  /** Escribe valores en «Nuevo valor», cada uno con Enter, con el teclado de verdad. */
  async function anadirValores(...valores) {
    for (const valor of valores) {
      await enfocarCampo('Nuevo valor')
      await browser.keys([...valor.split(''), 'Enter'])
    }
  }

  /** Abre la ficha de una tabla en el panel inferior. */
  async function ficha(tabla, nombre) {
    await abrirTabla(tabla)
    await esperarTexto('Campos')
    await pulsar(nombre, '[role="tab"]')
  }

  before(async () => {
    await abrirModelo()
  })

  it('1 · crear un enum de cuatro valores con el teclado (FR-001 a FR-010)', async () => {
    await pulsar('Nuevo enum')
    await esperarDialogo('Nuevo enum')
    await escribirEn('Nuevo enum', 'Nombre', 'Canal Aviso')
    await esperarTexto('Se guardará como canal_aviso')

    await anadirValores('correo', 'sms', 'app', 'carta')
    await esperarTexto('4 valores')
    await pulsarEn('Nuevo enum', 'Crear enum')
    await esperarSinDialogo('Nuevo enum')

    expect((await estado('canal_aviso, 4 valores')).deshabilitado).toBe(false)

    // El icono del enum y el de las tablas de su esquema llevan el color de
    // ese esquema, el mismo que su punto en «Esquemas», y no el gris de Aura.
    const colores = await browser.execute(`
      const color = (el) => (el ? getComputedStyle(el).color : null)
      const fila = (prefijo) =>
        [...document.querySelectorAll('.au-side-item')].find((el) =>
          (el.getAttribute('aria-label') || '').startsWith(prefijo),
        )
      const punto = fila('personas,')?.querySelector('span[aria-hidden="true"]')
      return {
        esquema: punto ? getComputedStyle(punto).backgroundColor : null,
        enumerado: color(fila('canal_aviso,')?.querySelector('.au-icon')),
        tabla: color(fila('Tabla residente,')?.querySelector('.au-icon')),
        gris: color(fila('Todos los esquemas')?.querySelector('.au-icon')),
      }
    `)
    expect(colores.esquema).not.toBeNull()
    expect(colores.enumerado).toBe(colores.esquema)
    expect(colores.tabla).toBe(colores.esquema)
    expect(colores.enumerado).not.toBe(colores.gris)
  })

  it('2 · un valor repetido o vacío no deja guardar (FR-007)', async () => {
    await pulsar('Nuevo enum')
    await esperarDialogo('Nuevo enum')
    await escribirEn('Nuevo enum', 'Nombre', 'prueba')
    await anadirValores('uno', 'UNO')
    await esperarTexto('Hay valores repetidos.')
    expect((await estadoEn('Nuevo enum', 'Crear enum')).deshabilitado).toBe(true)

    await escribirEn('Nuevo enum', 'Valor 2', '')
    await esperarTexto('Hay valores vacíos.')
    expect((await estadoEn('Nuevo enum', 'Crear enum')).deshabilitado).toBe(true)

    await pulsarEn('Nuevo enum', 'Cancelar')
    await esperarSinDialogo('Nuevo enum')
  })

  it('3 · usar el enum como tipo de dos campos de tablas distintas (FR-011)', async () => {
    await abrirTabla('residente')
    await esperarTexto('Campos')
    await elegir('Tipo de documento', 'canal_aviso')
    await abrirTabla('unidad')
    await elegir('Tipo de torre', 'canal_aviso')

    expect(await tarjeta('residente')).toContain('documento, canal_aviso')
    expect(await tarjeta('unidad')).toContain('torre, canal_aviso')
    // Un campo de un enum no se avisa como tipo desconocido: el nombre del
    // selector no lleva detrás el aviso «no es un tipo de…».
    expect((await estado('Tipo de torre', '[role="combobox"]')).texto).toBe('Tipo de torre')
  })

  it('4 · renombrar el enum cambia sus campos, y ⌘Z lo devuelve todo (FR-015)', async () => {
    await pulsar('canal_aviso, 4 valores')
    await esperarDialogo('Editar enum')
    await esperarTexto('residente.documento')
    await escribirEn('Editar enum', 'Nombre', 'canal_contacto')
    await pulsarEn('Editar enum', 'Guardar')
    await esperarSinDialogo('Editar enum')

    expect(await tarjeta('residente')).toContain('documento, canal_contacto')
    expect(await tarjeta('unidad')).toContain('torre, canal_contacto')

    await atajo('z')
    await esperarTexto('Deshecho: editar el enum')
    expect(await tarjeta('residente')).toContain('documento, canal_aviso')
    expect(await tarjeta('unidad')).toContain('torre, canal_aviso')
  })

  it('5 · el menú contextual duplica el enum (FR-020)', async () => {
    await menuDeEnum('canal_aviso')
    await esperarTexto('Enum · 4 valores · 2 campos')
    await pulsar('Duplicar enum', '[role="menuitem"]')
    await esperarSinMenu()

    expect((await estado('canal_aviso_copia, 4 valores')).deshabilitado).toBe(false)
  })

  it('6 · eliminar un enum en uso avisa del tipo nuevo, y ⌘Z lo devuelve (FR-016 a FR-018)', async () => {
    await menuDeEnum('canal_aviso')
    await pulsar('Eliminar enum', '[role="menuitem"]')
    await esperarDialogo('¿Eliminar el enum «canal_aviso»?')
    await esperarTexto('2 campos lo usan (residente.documento, unidad.torre) y pasarán a varchar(40).')
    await pulsarEn('¿Eliminar el enum «canal_aviso»?', 'Eliminar enum')
    await esperarSinDialogo('¿Eliminar el enum')

    expect(await tarjeta('residente')).toContain('documento, varchar')
    expect(await tarjeta('unidad')).toContain('torre, varchar')

    await atajo('z')
    await esperarTexto('Deshecho: eliminar el enum')
    expect(await tarjeta('residente')).toContain('documento, canal_aviso')
  })

  it('7 · la ficha Índices lista los que crean las restricciones (FR-021)', async () => {
    await ficha('pago', 'Índices')
    await esperarTexto('Creados por restricciones')
    await esperarTexto('pk_pago')
    await esperarTexto('uq_pago_referencia')
    await esperarTexto('Sin índices adicionales.')
  })

  it('8 · «Añadir índice» propone la clave foránea y la deja «Indexada» (FR-023, FR-031)', async () => {
    await pulsar('Añadir índice')
    await browser.waitUntil(async () => (await filasDeRejilla('Índices de pago')).length === 1, {
      timeout: 5000,
      timeoutMsg: 'No apareció la fila del índice nuevo.',
    })
    expect(await filasDeRejilla('Índices de pago')).toEqual([
      { nombre: 'idx_pago_residente_id', columnas: ['residente_id'], unico: false },
    ])

    await pulsar('Claves foráneas', '[role="tab"]')
    await esperarTexto('Indexada')
    await pulsar('Índices', '[role="tab"]')
  })

  it('9 · el índice único de una columna cuenta como uno a uno (FR-029a)', async () => {
    await pulsar('Índice único idx_pago_residente_id', 'input[type="checkbox"]')
    await esperarTexto('Uno a uno')

    await marcarColumnas('Columnas de idx_pago_residente_id', ['mes'])
    await browser.waitUntil(
      async () => (await filasDeRejilla('Índices de pago'))[0]?.nombre === 'idx_pago_residente_id_mes',
      { timeout: 5000, timeoutMsg: 'El nombre no se repropuso con la segunda columna.' },
    )
    expect((await filasDeRejilla('Índices de pago'))[0]).toEqual({
      nombre: 'idx_pago_residente_id_mes',
      columnas: ['residente_id', 'mes'],
      unico: true,
    })
    await esperarSinTexto('Uno a uno')
  })

  it('10 · un único compuesto nace con dos columnas y no baja de dos (FR-033, FR-035)', async () => {
    await pulsar('Únicos', '[role="tab"]')
    await esperarTexto('Desde la columna Llave (UK)')
    await pulsar('Añadir único')
    await browser.waitUntil(
      async () => (await filasDeRejilla('Únicos compuestos de pago')).length === 1,
      { timeout: 5000, timeoutMsg: 'No apareció la fila del único nuevo.' },
    )
    expect((await filasDeRejilla('Únicos compuestos de pago'))[0]).toEqual({
      nombre: 'uq_pago_referencia_residente_id',
      columnas: ['referencia', 'residente_id'],
      unico: null,
    })

    await marcarColumnas('Columnas de uq_pago_referencia_residente_id', ['residente_id'])
    await esperarTexto('Un único compuesto necesita al menos dos columnas.')
    expect((await filasDeRejilla('Únicos compuestos de pago'))[0]?.columnas).toEqual([
      'referencia',
      'residente_id',
    ])
  })

  it('11 · eliminar un campo del único compuesto lo nombra y se lo lleva (FR-039)', async () => {
    await pulsar('Campos', '[role="tab"]')
    await pulsar('Eliminar referencia')
    await esperarDialogo('¿Eliminar «referencia»?')
    await esperarTexto('El único uq_pago_referencia_residente_id se eliminará con él.')
    await pulsarEn('¿Eliminar «referencia»?', 'Eliminar campo')
    await esperarSinDialogo('¿Eliminar «referencia»?')

    await pulsar('Únicos', '[role="tab"]')
    expect(await filasDeRejilla('Únicos compuestos de pago')).toEqual([])

    await atajo('z')
    await esperarTexto('Deshecho: eliminar el campo')
    expect(await filasDeRejilla('Únicos compuestos de pago')).toHaveLength(1)
  })

  it('12 · el prefijo de Ajustes solo cambia lo que se propone después (FR-043)', async () => {
    await atajo(',')
    await esperarDialogo('General')
    await escribirEn('General', 'Prefijo de índices', 'ix_')
    await browser.keys('Enter')
    await esperarTexto('Ejemplo: ix_pago_residente_id')
    await browser.keys('Escape')
    await esperarSinDialogo('General')

    await ficha('cuota', 'Índices')
    await pulsar('Añadir índice')
    await browser.waitUntil(
      async () => (await filasDeRejilla('Índices de cuota')).some((fila) => fila.nombre.startsWith('ix_')),
      { timeout: 5000, timeoutMsg: 'El índice nuevo no llevó el prefijo de Ajustes.' },
    )
    expect((await filasDeRejilla('Índices de cuota')).map((fila) => fila.nombre)).toEqual([
      'ix_cuota_unidad_id',
    ])
  })

  it('13 · guardar y reabrir conserva enums, índices y únicos (SC-007)', async () => {
    await atajo('s')
    await esperarTexto('Guardado')
    const guardado = archivo()
    expect(guardado).toContain('  - name: canal_aviso\n    schema:')
    expect(guardado).toMatch(/values:\n {6}- correo\n {6}- sms\n {6}- app\n {6}- carta/)
    expect(guardado).toContain('name: idx_pago_residente_id_mes')
    expect(guardado).toContain('unique: true')
    expect(guardado).toContain('name: uq_pago_referencia_residente_id')
    expect(guardado).toContain('name: ix_cuota_unidad_id')

    await atajo('w')
    await esperarTexto('Nuevo modelo…')
    await abrirModelo()
    expect((await estado('canal_aviso, 4 valores')).deshabilitado).toBe(false)
    expect(await tarjeta('residente')).toContain('documento, canal_aviso')
  })

  it('14 · renombrar un enum de 100 campos se ve en menos de 200 ms (SC-011)', async () => {
    await atajo('w')
    await esperarTexto('Nuevo modelo…')
    await abrirModelo('modelo-50-tablas.yaml')

    await pulsar('estado_general, 4 valores')
    await esperarDialogo('Editar enum')
    await escribirEn('Editar enum', 'Nombre', 'estado_vivo')
    await esperarTexto('Usado por')

    // Se mide dentro de la página: el viaje de WebDriver no es parte de lo que
    // ve quien usa la aplicación.
    // WebDriver espera a la promesa que devuelve el guion.
    const ms = await browser.execute(`
      return new Promise((listo) => {
        const boton = [...document.querySelectorAll('button')].find(
          (el) => el.textContent.trim() === 'Guardar',
        )
        const desde = performance.now()
        boton.click()
        const mirar = () => {
          const visto = [...document.querySelectorAll('.sm-field-type')].some((el) =>
            el.textContent.startsWith('estado_vivo'),
          )
          if (visto) listo(Math.round(performance.now() - desde))
          else requestAnimationFrame(mirar)
        }
        requestAnimationFrame(mirar)
      })
    `)
    console.log(`SC-011: renombrar el enum de 100 campos se vio en ${ms} ms`)
    // Los 200 ms de SC-011 se miden en la compilación de desarrollo de una
    // máquina local (spec, Assumptions). Las máquinas virtuales de macOS de la
    // CI van varias veces más lentas —359 ms la primera vez—, así que allí el
    // tope solo caza una regresión seria; la cifra queda en el registro.
    expect(ms).toBeLessThan(process.env.CI ? 600 : 200)

    // El modelo de carga no se guarda: el recorrido no deja cambios en él.
    await atajo('z')
    await esperarTexto('Deshecho: editar el enum')
  })
})
