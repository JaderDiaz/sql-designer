import { describe, expect, it } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import {
  fileNameOf,
  folderOf,
  previewLine,
  summarizeModel,
  type SummaryInput,
} from '@/lib/model/summary'

/**
 * Arma la entrada del resumen con el sello de ejemplo.
 *
 * @param path Ruta del archivo.
 * @param text Texto del archivo.
 */
function input(path: string, text: string): SummaryInput {
  return { path, text, sizeBytes: text.length, modifiedMs: 1_761_000_000_000 }
}

describe('resumen de un archivo de modelo (FR-013)', () => {
  it('cuenta motor, tablas y relaciones del ejemplo de PostgreSQL', () => {
    const text = readFixture('modelo-postgres')

    const preview = summarizeModel(input('/Users/ada/livy/modelo-postgres.yaml', text))

    expect(preview).toMatchObject({
      fileName: 'modelo-postgres.yaml',
      engine: 'postgres',
      tables: 6,
      relations: 6,
      invalid: false,
      error: null,
      sizeBytes: text.length,
      modifiedMs: 1_761_000_000_000,
    })
  })

  it('resume también MySQL y SQLite', () => {
    const mysql = summarizeModel(input('/x/modelo-mysql.yaml', readFixture('modelo-mysql')))
    const sqlite = summarizeModel(input('/x/modelo-sqlite.yaml', readFixture('modelo-sqlite')))

    expect(mysql.engine).toBe('mysql')
    expect(sqlite.engine).toBe('sqlite')
  })

  it('un archivo con un error de sintaxis vuelve inválido con su línea', () => {
    const preview = summarizeModel(input('/x/modelo-roto.yaml', readFixture('modelo-roto')))

    expect(preview.invalid).toBe(true)
    expect(preview.engine).toBeNull()
    expect(preview.name).toBe('modelo-roto.yaml')
    expect(preview.error?.line).toBe(8)
    expect(preview.error?.code).toBe('syntax')
  })

  it('un archivo con una clave desconocida vuelve inválido con su línea', () => {
    const preview = summarizeModel(
      input('/x/modelo-clave-desconocida.yaml', readFixture('modelo-clave-desconocida')),
    )

    expect(preview.invalid).toBe(true)
    expect(preview.error?.line).toBe(7)
    expect(preview.error?.message).toContain('colour')
  })

  it('la línea del resumen concuerda el singular y el plural', () => {
    expect(previewLine('postgres', 6)).toBe('PostgreSQL · 6 tablas')
    expect(previewLine('mysql', 1)).toBe('MySQL · 1 tabla')
    expect(previewLine(null, 0)).toBe('Modelo · 0 tablas')
  })

  it('parte la ruta en carpeta y nombre de archivo con los dos separadores', () => {
    expect(fileNameOf('/Users/ada/livy/modelo.yaml')).toBe('modelo.yaml')
    expect(fileNameOf('C:\\Users\\ada\\modelo.yaml')).toBe('modelo.yaml')
    expect(folderOf('/Users/ada/livy/modelo.yaml')).toBe('/Users/ada/livy')
    expect(folderOf('/modelo.yaml')).toBe('/')
    expect(folderOf('C:\\Users\\ada\\modelo.yaml')).toBe('C:\\Users\\ada')
  })
})
