import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { carpetaDePruebas } from '../soporte/entorno.js'
import {
  alerta,
  atajo,
  escribir,
  esperarDialogo,
  esperarSinAlerta,
  esperarSinDialogo,
  esperarTexto,
  estado,
  pulsar,
  valor,
} from '../soporte/pantalla.js'

/**
 * Escenario 1 de `quickstart.md`: crear un modelo (FR-001 a FR-006).
 *
 * La carpeta de partida es la temporal del recorrido, porque el diálogo trae
 * la última carpeta de las preferencias y el entorno las deja apuntando ahí.
 */
describe('Escenario 1 · Crear un modelo', () => {
  /** Carpeta donde el recorrido escribe sus modelos. */
  const carpeta = carpetaDePruebas()

  it('la ruta final sigue al nombre y «Crear modelo» se activa', async () => {
    await pulsar('Nuevo modelo')
    await esperarDialogo('Nuevo modelo')

    await escribir('Nombre del modelo', 'Livy · Reservas')

    await esperarTexto(`Se creará ${join(carpeta, 'livy-reservas.yaml')}`)
    await esperarSinAlerta()
    expect((await estado('Crear modelo')).deshabilitado).toBe(false)
  })

  it('un nombre vacío y uno sin letras ni números dicen por qué y no dejan crear', async () => {
    await escribir('Nombre del modelo', '')
    expect(await alerta()).toBe('Escribe un nombre para el modelo.')
    expect((await estado('Crear modelo')).deshabilitado).toBe(true)

    await escribir('Nombre del modelo', '··· ---')
    expect(await alerta()).toBe('Usa al menos una letra o un número en el nombre.')
    expect((await estado('Crear modelo')).deshabilitado).toBe(true)
  })

  it('el nombre del archivo se propone, se puede cambiar y se puede devolver', async () => {
    await escribir('Nombre del modelo', 'Livy · Reservas')
    expect(await valor('Nombre del archivo')).toBe('livy-reservas')

    await escribir('Nombre del archivo', 'reservas_v2')
    await esperarTexto(`Se creará ${join(carpeta, 'reservas_v2.yaml')}`)
    await esperarTexto('Nombre personalizado.')

    await pulsar('Usar el nombre del modelo')
    expect(await valor('Nombre del archivo')).toBe('livy-reservas')
  })

  it('un nombre de archivo con espacios dice qué se admite y no deja crear', async () => {
    await escribir('Nombre del archivo', 'livy reservas')
    expect(await alerta()).toBe('Usa letras, números, guion o guion bajo, sin espacios.')
    expect((await estado('Crear modelo')).deshabilitado).toBe(true)

    await pulsar('Usar el nombre del modelo')
    await esperarSinAlerta()
  })

  it('cada motor trae su frase y el inicial es el de Ajustes', async () => {
    expect((await estado('PostgreSQL')).marcado).toBe(true)
    await esperarTexto('Esquemas, enums nativos, JSONB y secuencias.')

    await pulsar('MySQL')
    await esperarTexto('InnoDB, enums por columna y AUTO_INCREMENT.')

    await pulsar('SQLite')
    await esperarTexto('Un solo archivo, tipos flexibles. Ideal para apps locales.')

    await pulsar('PostgreSQL')
    await esperarTexto('Esquemas, enums nativos, JSONB y secuencias.')
  })

  it('«Crear modelo» abre el Editor y deja el archivo escrito en el disco', async () => {
    await pulsar('Crear modelo')

    await esperarTexto('Empieza a diseñar tu modelo')
    await esperarTexto('Guardado')

    const ruta = join(carpeta, 'livy-reservas.yaml')
    expect(existsSync(ruta)).toBe(true)
    const escrito = readFileSync(ruta, 'utf8')
    expect(escrito).toContain('formatVersion: 1')
    expect(escrito).toContain('name: Livy · Reservas')
    expect(escrito).toContain('engine: postgres')
    expect(escrito).toContain('name: public')
  })

  it('el mismo nombre en la misma carpeta dice que ya existe y no deja crear', async () => {
    await atajo('n')
    await esperarDialogo('Nuevo modelo')

    await escribir('Nombre del modelo', 'Livy · Reservas')

    expect(await alerta()).toBe('Ya existe livy-reservas.yaml en esta carpeta. Elige otro nombre.')
    expect((await estado('Crear modelo')).deshabilitado).toBe(true)

    await pulsar('Cancelar')
    await esperarSinDialogo()
  })
})
