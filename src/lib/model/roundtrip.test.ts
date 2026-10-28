import { describe, expect, it } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import type { FixtureName } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { serializeModel } from '@/lib/model/serialize'

/**
 * Ida y vuelta del archivo del modelo (puerta 3 de la constitución, FR-023,
 * SC-004): leer, escribir y volver a leer no cambia ni el modelo ni el texto.
 *
 * Es la prueba que protege de perder datos del usuario al guardar: si el
 * serializador olvidara un campo, el segundo modelo no sería igual al primero.
 */
const FIXTURES: FixtureName[] = [
  'modelo-postgres',
  'modelo-mysql',
  'modelo-sqlite',
  'modelo-50-tablas',
  'modelo-posiciones',
  'modelo-posiciones-extremas',
  'modelo-tipos-ajenos',
]

describe('ida y vuelta del modelo', () => {
  it.each(FIXTURES)('%s conserva el modelo y el texto', (name) => {
    const original = parseModel(readFixture(name))
    expect(original.ok).toBe(true)
    if (!original.ok) return

    const text = serializeModel(original.model)
    const again = parseModel(text)
    expect(again.ok).toBe(true)
    if (!again.ok) return

    expect(again.model).toEqual(original.model)
    expect(serializeModel(again.model)).toBe(text)
  })

  it('escribe el mismo texto que ya tenía el archivo', () => {
    const file = readFixture('modelo-postgres')
    const result = parseModel(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(serializeModel(result.model)).toBe(file)
  })

  it('conserva la longitud, la escala, las llaves y las posiciones de las tablas', () => {
    // La puerta 3 con los campos que estrena el Incremento 3: `length` y
    // `scale` viajan aparte del tipo, la llave primaria de dos campos no se
    // reordena y ninguna posición se pierde (FR-051, FR-051a).
    const file = readFixture('modelo-postgres')
    const result = parseModel(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const tables = result.model.tables ?? []
    const importe = tables
      .find((table) => table.name === 'pagos')
      ?.fields.find((field) => field.name === 'importe')
    expect(importe).toMatchObject({ type: 'numeric', length: 10, scale: 2 })
    expect(
      tables.find((table) => table.name === 'hoteles')?.fields.find((f) => f.name === 'nombre'),
    ).toMatchObject({ type: 'varchar', length: 120 })
    expect(tables.find((table) => table.name === 'resenas')?.primaryKey).toEqual([
      'reserva_id',
      'cliente_id',
    ])
    expect(tables.map((table) => table.position)).toEqual([
      { x: 120, y: 160 },
      { x: 384, y: 160 },
      { x: 648, y: 160 },
      { x: 120, y: 408 },
      { x: 384, y: 408 },
      { x: 648, y: 408 },
    ])

    expect(serializeModel(result.model)).toBe(file)
  })

  it('conserva la posición del esquema vacío y la de cada tabla', () => {
    // La puerta 3 con el campo que estrena el Incremento 2: el esquema sin
    // tablas lleva su `position` y las tablas la suya, y ninguna de las dos se
    // pierde ni se mueve al escribir.
    const file = readFixture('modelo-posiciones')
    const result = parseModel(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const empty = result.model.schemas.find((schema) => schema.name === 'reportes')
    expect(empty?.position).toEqual({ x: 900, y: 120 })
    expect(result.model.tables?.map((table) => table.position)).toEqual([
      { x: 120, y: 160 },
      { x: 120, y: 320 },
      { x: 520, y: 160 },
    ])
    expect(serializeModel(result.model)).toBe(file)
  })

  it('omite del archivo las colecciones vacías', () => {
    const result = parseModel(readFixture('modelo-sqlite'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const text = serializeModel({ ...result.model, enums: [], views: [] })

    expect(text).not.toContain('enums:')
    expect(text).not.toContain('views:')
  })
})
