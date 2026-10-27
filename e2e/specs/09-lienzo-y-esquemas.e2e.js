import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { carpetaDePruebas } from '../soporte/entorno.js'
import {
  arrastrar,
  atajo,
  desdeLaBienvenida,
  escribir,
  esperarDialogo,
  esperarSinDialogo,
  esperarSinMenu,
  esperarSinTexto,
  esperarTexto,
  estado,
  estadoEn,
  filas,
  menuDeZona,
  pulsar,
  pulsarElFondo,
  pulsarEn,
  rueda,
  seleccionar,
  tecla,
  texto,
  valor,
  vistaDelLienzo,
  zonas,
} from '../soporte/pantalla.js'

/**
 * Escenario 9 de `specs/003-lienzo-esquemas/quickstart.md`: el lienzo y los
 * esquemas.
 *
 * Es el escenario que necesita navegador de verdad: los gestos de puntero, la
 * rueda con modificador y la medida real de las zonas en pantalla no se pueden
 * firmar desde jsdom (research R17).
 */
describe('Escenario 9 · Lienzo y esquemas', () => {
  /** Carpeta del recorrido, donde vive el modelo de ejemplo. */
  const carpeta = carpetaDePruebas()

  /** Nombre del lienzo, que es por donde lo agarran los gestos. */
  const LIENZO = 'Lienzo del modelo'

  /** La escala que anuncia la transformación del nodo del modelo. */
  function escalaDe(transformacion) {
    const numero = /scale\(([\d.]+)\)/.exec(transformacion)
    return numero === null ? null : Number(numero[1])
  }

  /** Abre `modelo-esquemas.yaml` desde la Bienvenida. */
  async function abrirModelo() {
    await desdeLaBienvenida()
    await pulsar('Abrir modelo')
    await esperarDialogo('Abrir modelo')
    await seleccionar('modelo-esquemas.yaml')
    await pulsarEn('Abrir modelo', 'Abrir')
    await esperarSinDialogo('Abrir modelo')
    await esperarTexto('Esquemas')
  }

  /** Lo que el archivo tiene escrito ahora mismo. */
  function archivo() {
    return readFileSync(join(carpeta, 'modelo-esquemas.yaml'), 'utf8')
  }

  it('1 · el Editor muestra las cinco zonas (FR-001 a FR-004)', async () => {
    await abrirModelo()

    const visible = await texto()
    // Barra superior, barra lateral, inspector y barra de estado.
    expect(visible).toContain('Esquemas')
    expect(visible).toContain('Tablas')
    expect(visible).toContain('PostgreSQL')
    expect(visible).toContain('4 esquemas')
    expect(visible).toContain('4 tablas')
    // El modelo abre encuadrado, así que el porcentaje es el que deja
    // «Ajustar», no necesariamente el 100 % (FR-014).
    expect(visible).toMatch(/\d+ %/)

    // Y el lienzo, con una zona por esquema.
    const lista = await zonas()
    expect(lista).toHaveLength(4)
    expect(lista.map((zona) => zona.nombre)).toContain('Esquema REP · reportes, sin tablas')
  })

  it('2 · esconder y recuperar la barra lateral y el inspector (FR-006)', async () => {
    await browser.keys(['Alt', 'Meta', 's'])
    await esperarSinTexto('Todos los esquemas')

    await browser.keys(['Alt', 'Meta', 's'])
    await esperarTexto('Todos los esquemas')

    // Y con los botones de la barra superior, que es la otra vía.
    await pulsar('Ocultar inspector')
    await esperarSinTexto('Motor')
    await pulsar('Mostrar inspector')
    await esperarTexto('Motor')
  })

  it('3 · la vista se mueve de las tres formas (FR-007)', async () => {
    const inicio = await vistaDelLienzo()

    await arrastrar(LIENZO, 80, 60)
    const trasArrastre = await vistaDelLienzo()
    expect(trasArrastre).not.toBe(inicio)

    await arrastrar('Esquema VEN · ventas', -40, -30, { boton: 1 })
    expect(await vistaDelLienzo()).not.toBe(trasArrastre)
    // La rueda pulsada mueve la vista, no el esquema: el modelo sigue limpio.
    expect(await texto()).not.toContain('Cambios sin guardar')

    const antesDeEspacio = await vistaDelLienzo()
    await tecla(LIENZO, 'keydown', { key: ' ', code: 'Space' })
    await arrastrar('Esquema VEN · ventas', 50, 0)
    await tecla(LIENZO, 'keyup', { key: ' ', code: 'Space' })
    expect(await vistaDelLienzo()).not.toBe(antesDeEspacio)
    expect(await texto()).not.toContain('Cambios sin guardar')
  })

  it('4 · el zoom cambia, se para en los topes y «Ajustar» lo encuadra (FR-008 a FR-011)', async () => {
    // El modelo se abrió encuadrado, así que el zoom de partida es el que
    // dejó ese encuadre y no se puede nombrar un porcentaje fijo.
    const inicio = escalaDe(await vistaDelLienzo())
    await pulsar('Acercar')
    await browser.waitUntil(async () => escalaDe(await vistaDelLienzo()) > inicio, {
      timeout: 5000,
      timeoutMsg: '«Acercar» no cambió la escala.',
    })

    const trasBoton = escalaDe(await vistaDelLienzo())
    await rueda(LIENZO, { dy: -300, meta: true })
    await browser.waitUntil(async () => escalaDe(await vistaDelLienzo()) > trasBoton, {
      timeout: 5000,
      timeoutMsg: 'La rueda con el modificador no acercó.',
    })

    // Se aleja hasta el tope y no más: el botón se apaga al llegar, y pulsar
    // de más fallaría porque `pulsar` solo mira controles habilitados.
    while (!(await estado('Alejar')).deshabilitado) await pulsar('Alejar')
    await esperarTexto('40 %')

    while (!(await estado('Acercar')).deshabilitado) await pulsar('Acercar')
    await esperarTexto('200 %')

    // «Ajustar» se prueba desde el tope de acercamiento, no desde el de
    // alejamiento: con el lienzo estrecho el encuadre de este modelo cae en el
    // 40 %, que es el suelo, y entonces «Ajustar» no tendría nada que cambiar.
    await pulsar('Ajustar')
    await browser.waitUntil(async () => escalaDe(await vistaDelLienzo()) < 2, {
      timeout: 5000,
      timeoutMsg: '«Ajustar» no encuadró el modelo.',
    })

    // Y las cuatro zonas caben en el lienzo.
    const lista = await zonas()
    expect(lista).toHaveLength(4)
  })

  it('5 · crear tres esquemas con nombre propuesto y color (FR-015 a FR-021)', async () => {
    await pulsar('Nuevo esquema')
    await esperarDialogo('Nuevo esquema')
    await escribir('Nombre', 'Contabilidad general')
    expect(await valor('Nombre técnico')).toBe('contabilidad_general')
    expect(await valor('Abreviatura')).toBe('CGE')
    await pulsar('Teal', '[role="radio"]')
    await pulsarEn('Nuevo esquema', 'Crear esquema')
    await esperarSinDialogo('Nuevo esquema')
    await esperarTexto('contabilidad_general')

    // Un nombre técnico repetido no deja guardar (FR-018).
    await pulsar('Nuevo esquema')
    await esperarDialogo('Nuevo esquema')
    await escribir('Nombre', 'ventas')
    await esperarTexto('Ya existe un esquema con este nombre técnico.')
    expect((await estadoEn('Nuevo esquema', 'Crear esquema')).deshabilitado).toBe(true)

    await escribir('Nombre', 'Auditoría')
    await pulsarEn('Nuevo esquema', 'Crear esquema')
    await esperarSinDialogo('Nuevo esquema')

    await pulsar('Nuevo esquema')
    await esperarDialogo('Nuevo esquema')
    await escribir('Nombre', 'Mensajería')
    await pulsarEn('Nuevo esquema', 'Crear esquema')
    await esperarSinDialogo('Nuevo esquema')

    await esperarTexto('7 esquemas')
    await esperarTexto('Cambios sin guardar')

    // Las tres son zonas vacías en el lienzo (FR-025).
    await pulsar('Ajustar')
    const vacias = (await zonas()).filter((zona) => zona.nombre.endsWith('sin tablas'))
    expect(vacias.length).toBeGreaterThanOrEqual(4)
  })

  it('6 · arrastrar una zona con tablas, guardar y reabrir (FR-026, FR-027, SC-007)', async () => {
    await atajo('z')
    await atajo('z')
    await atajo('z')
    await esperarTexto('4 esquemas')

    const antes = (await zonas()).find((zona) => zona.nombre.includes('ventas'))
    await arrastrar('Esquema VEN · ventas', 120, 90)
    await esperarTexto('Cambios sin guardar')

    const despues = (await zonas()).find((zona) => zona.nombre.includes('ventas'))
    expect(despues.modelo.x).toBeGreaterThan(antes.modelo.x)
    expect(despues.modelo.y).toBeGreaterThan(antes.modelo.y)
    // La zona sigue rodeando a sus dos tablas: su tamaño no cambió.
    expect(despues.modelo.ancho).toBe(antes.modelo.ancho)

    // ⌘Z devuelve el gesto entero en un paso (SC-006).
    await atajo('z')
    await esperarTexto('Deshecho: mover las tablas del esquema')
    const vuelta = (await zonas()).find((zona) => zona.nombre.includes('ventas'))
    expect(vuelta.modelo.x).toBe(antes.modelo.x)

    // Se mueve otra vez, se guarda y se reabre.
    await arrastrar('Esquema VEN · ventas', 120, 90)
    await atajo('s')
    await esperarTexto('Guardado')
    expect(archivo()).toContain('position:')

    await atajo('w')
    await esperarTexto('Nuevo modelo…')
    await abrirModelo()
    await pulsar('Ajustar')
    const reabierta = (await zonas()).find((zona) => zona.nombre.includes('ventas'))
    expect(reabierta.modelo.ancho).toBe(antes.modelo.ancho)
  })

  it('7 · arrastrar la zona de un esquema vacío y guardar (FR-026a)', async () => {
    const antes = (await zonas()).find((zona) => zona.nombre.includes('reportes'))
    await arrastrar('Esquema REP · reportes', -60, 70)
    await esperarTexto('Cambios sin guardar')

    const despues = (await zonas()).find((zona) => zona.nombre.includes('reportes'))
    expect(despues.modelo.x).toBeLessThan(antes.modelo.x)

    await atajo('s')
    await esperarTexto('Guardado')

    // La posición del esquema solo se escribe en el que no tiene tablas.
    const escrito = archivo()
    const esquemas = escrito.slice(escrito.indexOf('schemas:'), escrito.indexOf('tables:'))
    expect(esquemas).toContain('position:')
    expect(esquemas.split('position:').length - 1).toBe(1)
  })

  it('8 · enfocar un esquema y las tres formas de soltarlo (FR-029 a FR-031)', async () => {
    const escalaAntes = escalaDe(await vistaDelLienzo())

    await seleccionar('ventas')
    await esperarTexto('Enfocado: ventas')
    await esperarTexto('Tablas de ventas')

    // Enfocar centra la zona, pero no toca el porcentaje (FR-029).
    expect(escalaDe(await vistaDelLienzo())).toBe(escalaAntes)

    // La lista de tablas trae solo las suyas y el resto se atenúa.
    const atenuadas = (await zonas()).filter((zona) => zona.atenuada)
    expect(atenuadas).toHaveLength(3)

    await tecla(LIENZO, 'keydown', { key: 'Escape' })
    await esperarSinTexto('Enfocado: ventas')

    // Pulsar el fondo del lienzo también lo suelta (FR-031).
    await seleccionar('ventas')
    await esperarTexto('Enfocado: ventas')
    await pulsarElFondo()
    await esperarSinTexto('Enfocado: ventas')

    await seleccionar('inventario')
    await esperarTexto('Enfocado: inventario')
    await seleccionar('Todos los esquemas')
    await esperarSinTexto('Enfocado:')
    expect((await zonas()).filter((zona) => zona.atenuada)).toHaveLength(0)

    // Y la lista vuelve a traer las cuatro tablas del modelo.
    expect(await filas('Esquemas del modelo')).toHaveLength(5)
  })

  it('9 · eliminar un esquema con y sin sus tablas (FR-033 a FR-037)', async () => {
    await menuDeZona('ventas')
    await pulsar('Eliminar esquema…')
    await esperarDialogo('¿Eliminar «ventas»?')
    expect((await estadoEn('¿Eliminar «ventas»?', 'Eliminar también')).marcado).toBe(false)
    await pulsarEn('¿Eliminar «ventas»?', 'Eliminar esquema')
    await esperarSinDialogo('¿Eliminar «ventas»?')
    await esperarTexto('3 esquemas')
    await esperarTexto('4 tablas')

    // ⌘Z devuelve el esquema con sus tablas en un paso (FR-037, SC-006).
    await atajo('z')
    await esperarTexto('Deshecho: eliminar el esquema')
    await esperarTexto('4 esquemas')

    // Con el interruptor encendido las tablas se van con el esquema.
    await menuDeZona('ventas')
    await pulsar('Eliminar esquema…')
    await esperarDialogo('¿Eliminar «ventas»?')
    await pulsarEn('¿Eliminar «ventas»?', 'Eliminar también', '[role="switch"]')
    await pulsarEn('¿Eliminar «ventas»?', 'Eliminar esquema y tablas')
    await esperarSinDialogo('¿Eliminar «ventas»?')
    await esperarTexto('2 tablas')

    await atajo('z')
    await esperarTexto('4 tablas')
    await esperarSinMenu()
  })

  it('9b · el único esquema del modelo también se elimina (FR-035, FR-005a)', async () => {
    // Lo que haya quedado abierto se cierra sin guardar nada.
    await desdeLaBienvenida()

    await pulsar('Nuevo modelo')
    await esperarDialogo('Nuevo modelo')
    await escribir('Nombre del modelo', 'Un solo esquema')
    await pulsarEn('Nuevo modelo', 'Crear modelo')
    await esperarTexto('Empieza a diseñar tu modelo')

    // El modelo nace en blanco, así que el único esquema hay que crearlo.
    await pulsar('Agregar un esquema')
    await esperarDialogo('Nuevo esquema')
    await escribir('Nombre', 'ventas')
    await pulsarEn('Nuevo esquema', 'Crear esquema')
    await esperarSinDialogo('Nuevo esquema')
    await esperarSinTexto('Empieza a diseñar tu modelo')
    expect(await zonas()).toHaveLength(1)

    await menuDeZona('ventas')
    await pulsar('Eliminar esquema…')
    await esperarDialogo('¿Eliminar «ventas»?')
    await pulsarEn('¿Eliminar «ventas»?', 'Eliminar esquema')
    await esperarSinDialogo('¿Eliminar «ventas»?')

    // Y el modelo vuelve a estar en blanco.
    await esperarTexto('Empieza a diseñar tu modelo')
    expect(await zonas()).toHaveLength(0)
  })
})
