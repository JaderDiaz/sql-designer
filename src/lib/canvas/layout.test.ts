import { describe, expect, it } from 'vitest'

import { TABLE_WIDTH, tableHeight } from '@/lib/canvas/constants'
import { schemaZones } from '@/lib/canvas/geometry'
import { resolveLayout } from '@/lib/canvas/layout'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model } from '@/lib/model/types'

/**
 * Pruebas de la colocación de las tablas (FR-013, FR-028).
 *
 * Lo que se protege aquí es que abrir un modelo sin posiciones no mezcle los
 * esquemas y que abrir uno con posiciones no las toque: son las del usuario.
 */

/** Lee un modelo de ejemplo y falla la prueba si no es válido. */
function model(name: Parameters<typeof readFixture>[0]): Model {
  const result = parseModel(readFixture(name))
  if (!result.ok) throw new Error(`El ejemplo ${name} no es un modelo válido.`)
  return result.model
}

/** ¿Se pisan estos dos rectángulos? */
function overlaps(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    left.x < right.x + right.width &&
    right.x < left.x + left.width &&
    left.y < right.y + right.height &&
    right.y < left.y + left.height
  )
}

describe('resolveLayout', () => {
  it('coloca todas las tablas del modelo', () => {
    const current = model('modelo-tres-esquemas')

    const layout = resolveLayout(current)

    expect(layout.size).toBe(current.tables?.length)
    for (const table of current.tables ?? []) {
      expect(layout.get(table.name)).toBeDefined()
    }
  })

  it('es determinista: el mismo modelo da el mismo mapa', () => {
    const current = model('modelo-tres-esquemas')

    const first = resolveLayout(current)
    const second = resolveLayout(current)

    expect([...second.entries()]).toEqual([...first.entries()])
  })

  it('respeta sin tocar la posición que trae el archivo', () => {
    const current = model('modelo-posiciones')

    const layout = resolveLayout(current)

    expect(layout.get('facturas')).toEqual({ x: 120, y: 160 })
    expect(layout.get('pagos')).toEqual({ x: 120, y: 320 })
    expect(layout.get('productos')).toEqual({ x: 520, y: 160 })
  })

  it('no muta el modelo', () => {
    const current = model('modelo-tres-esquemas')
    const before = JSON.stringify(current)

    resolveLayout(current)

    expect(JSON.stringify(current)).toBe(before)
  })

  it('deja cada esquema en su banda, sin que dos zonas se solapen (FR-028)', () => {
    const current = model('modelo-tres-esquemas')

    const zones = schemaZones(current, resolveLayout(current))

    expect(zones).toHaveLength(4)
    for (let i = 0; i < zones.length; i += 1) {
      for (let j = i + 1; j < zones.length; j += 1) {
        const one = zones[i]
        const other = zones[j]
        if (one === undefined || other === undefined) continue
        expect(overlaps(one.rect, other.rect)).toBe(false)
      }
    }
  })

  it('reparte las tablas de un esquema en una rejilla de tres columnas', () => {
    const current: Model = {
      formatVersion: 1,
      name: 'Rejilla',
      engine: 'postgres',
      schemas: [{ name: 'ventas', abbreviation: 'VEN' }],
      tables: Array.from({ length: 4 }, (_, index) => ({
        name: `tabla_${index}`,
        schema: 'ventas',
        fields: [{ name: 'id', type: 'integer' }],
      })),
    }

    const layout = resolveLayout(current)

    const first = layout.get('tabla_0')
    const third = layout.get('tabla_2')
    const fourth = layout.get('tabla_3')
    expect(first).toEqual({ x: 0, y: 0 })
    // La tercera cierra la fila y la cuarta baja a la siguiente, en la primera
    // columna otra vez.
    expect(third?.y).toBe(first?.y)
    expect(third?.x).toBeGreaterThan(TABLE_WIDTH)
    expect(fourth?.x).toBe(first?.x)
    expect(fourth?.y).toBeGreaterThan(first?.y ?? 0)
  })
})

describe('resolveLayout con tablas de distinto alto', () => {
  it('la fila siguiente baja el alto de la tabla más alta de la anterior', () => {
    // Cuatro tablas en una rejilla de tres columnas: la cuarta baja a la
    // segunda fila, y no puede solaparse con la primera por mucho que la
    // primera liste cuarenta campos (research R1).
    const current: Model = {
      formatVersion: 1,
      name: 'Alturas',
      engine: 'postgres',
      schemas: [{ name: 'ventas', abbreviation: 'VEN' }],
      tables: [
        {
          name: 'alta',
          schema: 'ventas',
          fields: Array.from({ length: 40 }, (_, index) => ({
            name: `campo_${index}`,
            type: 'integer',
          })),
        },
        { name: 'baja_1', schema: 'ventas', fields: [{ name: 'id', type: 'integer' }] },
        { name: 'baja_2', schema: 'ventas', fields: [{ name: 'id', type: 'integer' }] },
        { name: 'segunda_fila', schema: 'ventas', fields: [{ name: 'id', type: 'integer' }] },
      ],
    }

    const layout = resolveLayout(current)

    const alta = layout.get('alta')
    const siguiente = layout.get('segunda_fila')
    expect(alta).toEqual({ x: 0, y: 0 })
    expect(siguiente?.x).toBe(0)
    expect(siguiente?.y).toBeGreaterThanOrEqual(tableHeight(40))
  })
})
