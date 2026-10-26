import { join } from 'node:path'

import { carpetaDePruebas } from '../soporte/entorno.js'
import {
  alerta,
  esperarDialogo,
  esperarSinDialogo,
  esperarTexto,
  estadoEn,
  filaDeshabilitada,
  abrirFila,
  pulsar,
  pulsarEn,
  seleccionar,
  texto,
} from '../soporte/pantalla.js'

/**
 * Escenario 3 de `quickstart.md`: abrir un modelo y el archivo con errores
 * (FR-012 a FR-017).
 *
 * La carpeta del recorrido trae `modelo.yaml` válido, `roto.yaml` con un
 * tabulador en la línea 8 y `notas.md`, que no es un modelo.
 */
describe('Escenario 3 · Abrir un modelo', () => {
  /** Carpeta donde el recorrido guarda sus archivos. */
  const carpeta = carpetaDePruebas()

  it('sin selección, «Abrir» está deshabilitado', async () => {
    await pulsar('Abrir modelo')
    await esperarDialogo('Abrir modelo')

    expect((await estadoEn('Abrir modelo', 'Abrir')).deshabilitado).toBe(true)
  })

  it('la vista previa de un modelo válido trae sus cinco datos', async () => {
    await seleccionar('modelo.yaml')

    await esperarTexto('Livy · Reservas')
    for (const dato of ['Motor', 'Tablas', 'Relaciones', 'Tamaño', 'Modificado']) {
      await esperarTexto(dato)
    }
    await esperarTexto('PostgreSQL')
    expect((await estadoEn('Abrir modelo', 'Abrir')).deshabilitado).toBe(false)
  })

  it('lo que no es un modelo no aparece en la lista', async () => {
    // El listado de Rust ya deja fuera lo que no es `.yaml`
    // (`ListOnly::Models` en `src-tauri/src/files.rs`), así que `notas.md` no
    // llega a verse. `quickstart.md` esperaba verlo atenuado: esa frase es la
    // que está desactualizada, no el código.
    expect((await texto()).includes('notas.md')).toBe(false)
    expect(await filaDeshabilitada('modelo.yaml')).toBe(false)
  })

  it('el doble clic abre el modelo tal como se guardó', async () => {
    await abrirFila('modelo.yaml')

    await esperarSinDialogo('Abrir modelo')
    await esperarTexto('Livy · Reservas')
    await esperarTexto('Guardado')
    expect((await texto()).includes('PostgreSQL')).toBe(true)
  })

  it('un archivo con errores se marca en la vista previa', async () => {
    await browser.keys(['Meta', 'w'])
    await esperarTexto('Nuevo modelo…')

    await pulsar('Abrir modelo')
    await esperarDialogo('Abrir modelo')
    await seleccionar('roto.yaml')

    expect(await alerta()).toBe('Este archivo tiene errores y no se puede abrir.')
    await esperarTexto('roto.yaml')
  })

  it('al intentar abrirlo, el diálogo dice la línea del error y se sigue en Abrir modelo', async () => {
    // «Abrir» está deshabilitado para un archivo con errores, así que la vía
    // que queda —y la que usaría cualquiera— es el doble clic.
    expect((await estadoEn('Abrir modelo', 'Abrir')).deshabilitado).toBe(true)
    await abrirFila('roto.yaml')

    await esperarDialogo('No se pudo abrir «roto.yaml»')
    await esperarTexto('Línea 8')
    await esperarTexto('Mostrar en Finder')

    await pulsarEn('No se pudo abrir', 'Aceptar')
    await esperarSinDialogo('No se pudo abrir')
    await esperarDialogo('Abrir modelo')

    await pulsarEn('Abrir modelo', 'Cancelar')
    await esperarSinDialogo('Abrir modelo')
  })

  it('el modelo abierto quedó anotado como último en las preferencias', async () => {
    const { readFileSync } = await import('node:fs')
    const { CONFIG } = await import('../soporte/entorno.js')
    const preferencias = JSON.parse(readFileSync(join(CONFIG, 'preferences.json'), 'utf8'))

    expect(preferencias.lastModelPath).toBe(join(carpeta, 'modelo.yaml'))
  })
})
