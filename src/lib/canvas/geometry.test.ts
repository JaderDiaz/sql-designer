import { describe, expect, it } from 'vitest'

import {
  EMPTY_ZONE_HEIGHT,
  EMPTY_ZONE_WIDTH,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  ZONE_HEADER,
  ZONE_PADDING,
} from '@/lib/canvas/constants'
import { contentBounds, schemaZones } from '@/lib/canvas/geometry'
import { resolveLayout } from '@/lib/canvas/layout'
import { DEFAULT_SCHEMA_COLOR } from '@/lib/model/colors'
import type { Model, Position } from '@/lib/model/types'

/**
 * Pruebas de las zonas de esquema (FR-023 a FR-026a).
 *
 * La zona no se guarda: se deriva. Lo que se comprueba aquí es que el margen
 * sea el exacto, que el rótulo nunca se quede sin sitio y que una zona vacía
 * tenga su tamaño propio.
 */

/** Modelo de dos esquemas, uno con tablas y otro sin ellas. */
function twoSchemas(position?: Position): Model {
  return {
    formatVersion: 1,
    name: 'Dos esquemas',
    engine: 'postgres',
    schemas: [
      { name: 'ventas', abbreviation: 'VEN', color: 'blue' },
      { name: 'reportes', abbreviation: 'REP', ...(position ? { position } : {}) },
    ],
    tables: [
      {
        name: 'facturas',
        schema: 'ventas',
        fields: [{ name: 'id', type: 'integer' }],
        position: { x: 100, y: 200 },
      },
      {
        name: 'pagos',
        schema: 'ventas',
        fields: [{ name: 'id', type: 'integer' }],
        position: { x: 400, y: 500 },
      },
    ],
  }
}

describe('schemaZones', () => {
  it('envuelve las tablas con el margen exacto', () => {
    const model = twoSchemas()

    const [zone] = schemaZones(model, resolveLayout(model))

    expect(zone?.schema).toBe('ventas')
    expect(zone?.rect).toEqual({
      x: 100 - ZONE_PADDING,
      y: 200 - ZONE_HEADER,
      width: 400 + TABLE_WIDTH - 100 + ZONE_PADDING * 2,
      height: 500 + TABLE_HEIGHT - 200 + ZONE_HEADER + ZONE_PADDING,
    })
  })

  it('deja sitio al rótulo aunque el esquema tenga una sola tabla', () => {
    const model: Model = {
      formatVersion: 1,
      name: 'Una tabla',
      engine: 'postgres',
      schemas: [{ name: 'ventas', abbreviation: 'VEN' }],
      tables: [{ name: 'facturas', schema: 'ventas', fields: [{ name: 'id', type: 'integer' }] }],
    }

    const [zone] = schemaZones(model, resolveLayout(model))

    expect(zone?.rect.height).toBeGreaterThanOrEqual(ZONE_HEADER + ZONE_PADDING)
    expect(zone?.rect.height).toBe(TABLE_HEIGHT + ZONE_HEADER + ZONE_PADDING)
  })

  it('da a la zona vacía su tamaño propio, 240 × 180', () => {
    const model = twoSchemas()

    const zones = schemaZones(model, resolveLayout(model))

    const empty = zones.find((zone) => zone.isEmpty)
    expect(empty?.schema).toBe('reportes')
    expect(empty?.rect.width).toBe(EMPTY_ZONE_WIDTH)
    expect(empty?.rect.height).toBe(EMPTY_ZONE_HEIGHT)
    expect(empty?.tableCount).toBe(0)
  })

  it('coloca la zona vacía donde la dejó el usuario si el archivo la trae', () => {
    const model = twoSchemas({ x: -300, y: 40 })

    const zones = schemaZones(model, resolveLayout(model))

    const empty = zones.find((zone) => zone.isEmpty)
    expect(empty?.rect.x).toBe(-300)
    expect(empty?.rect.y).toBe(40)
  })

  it('devuelve las zonas en el orden del modelo y cuenta sus tablas', () => {
    const model = twoSchemas()

    const zones = schemaZones(model, resolveLayout(model))

    expect(zones.map((zone) => zone.schema)).toEqual(['ventas', 'reportes'])
    expect(zones.map((zone) => zone.tableCount)).toEqual([2, 0])
    expect(zones.map((zone) => zone.isEmpty)).toEqual([false, true])
  })

  it('resuelve el color de cada zona contra la paleta', () => {
    const model = twoSchemas()
    model.schemas[1] = { name: 'reportes', abbreviation: 'REP', color: 'fucsia' }

    const zones = schemaZones(model, resolveLayout(model))

    expect(zones[0]?.color).toBe('blue')
    expect(zones[1]?.color).toBe(DEFAULT_SCHEMA_COLOR)
  })
})

describe('contentBounds', () => {
  it('envuelve todas las zonas', () => {
    const model = twoSchemas({ x: -300, y: 40 })

    const bounds = contentBounds(schemaZones(model, resolveLayout(model)))

    expect(bounds).not.toBeNull()
    expect(bounds?.x).toBe(-300)
    // La zona vacía quedó más arriba que las tablas: el envolvente arranca en
    // ella.
    expect(bounds?.y).toBe(40)
    expect(bounds?.width).toBeGreaterThan(EMPTY_ZONE_WIDTH)
  })

  it('devuelve null sin ninguna zona', () => {
    expect(contentBounds([])).toBeNull()
  })
})
