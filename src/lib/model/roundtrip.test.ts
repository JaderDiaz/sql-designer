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

  it('omite del archivo las colecciones vacías', () => {
    const result = parseModel(readFixture('modelo-sqlite'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const text = serializeModel({ ...result.model, enums: [], views: [] })

    expect(text).not.toContain('enums:')
    expect(text).not.toContain('views:')
  })
})
