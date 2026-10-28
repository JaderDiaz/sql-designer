import { describe, expect, it } from 'vitest'

import {
  EMPTY_ZONE_HEIGHT,
  EMPTY_ZONE_WIDTH,
  FIELD_ROW_HEIGHT,
  TABLE_WIDTH,
  tableHeight,
  ZONE_HEADER,
  ZONE_PADDING,
} from '@/lib/canvas/constants'
import { contentBounds, findFreeSpot, schemaZones, snapToGrid, zoneAt } from '@/lib/canvas/geometry'
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
      height: 500 + tableHeight(1) - 200 + ZONE_HEADER + ZONE_PADDING,
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
    expect(zone?.rect.height).toBe(tableHeight(1) + ZONE_HEADER + ZONE_PADDING)
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

describe('tableHeight', () => {
  it('crece con los campos y nunca baja del alto de un campo', () => {
    expect(tableHeight(0)).toBe(66)
    expect(tableHeight(1)).toBe(66)
    expect(tableHeight(4)).toBe(138)
    expect(tableHeight(40)).toBe(1002)
  })

  it('cada campo añade exactamente una fila', () => {
    expect(tableHeight(5) - tableHeight(4)).toBe(FIELD_ROW_HEIGHT)
  })
})

describe('zoneAt', () => {
  /** Dos zonas que se solapan, en el orden del modelo. */
  const zones = [
    {
      schema: 'ventas',
      rect: { x: 0, y: 0, width: 300, height: 200 },
      isEmpty: false,
      color: 'blue',
      tableCount: 1,
    },
    {
      schema: 'inventario',
      rect: { x: 200, y: 100, width: 300, height: 200 },
      isEmpty: false,
      color: 'green',
      tableCount: 1,
    },
  ]

  it('da la zona que contiene el punto', () => {
    expect(zoneAt(zones, { x: 50, y: 50 })?.schema).toBe('ventas')
    expect(zoneAt(zones, { x: 400, y: 250 })?.schema).toBe('inventario')
  })

  it('con solapes gana la última del orden del modelo', () => {
    // Es la que el lienzo dibuja encima: lo que el usuario ve soltar.
    expect(zoneAt(zones, { x: 250, y: 150 })?.schema).toBe('inventario')
  })

  it('cuenta el borde como dentro', () => {
    expect(zoneAt(zones, { x: 0, y: 0 })?.schema).toBe('ventas')
  })

  it('fuera de todas las zonas devuelve null', () => {
    expect(zoneAt(zones, { x: 900, y: 900 })).toBeNull()
    expect(zoneAt([], { x: 0, y: 0 })).toBeNull()
  })
})

describe('snapToGrid', () => {
  it('redondea al punto más cercano de la cuadrícula', () => {
    expect(snapToGrid({ x: 37, y: 11 }, true)).toEqual({ x: 48, y: 0 })
    expect(snapToGrid({ x: 24, y: 48 }, true)).toEqual({ x: 24, y: 48 })
  })

  it('apagada devuelve la posición tal cual', () => {
    expect(snapToGrid({ x: 37, y: 11 }, false)).toEqual({ x: 37, y: 11 })
  })
})

describe('findFreeSpot', () => {
  const size = { x: 0, y: 0, width: TABLE_WIDTH, height: tableHeight(3) }

  it('devuelve el punto pedido cuando está libre', () => {
    expect(findFreeSpot([], { x: 120, y: 160 }, size)).toEqual({ x: 120, y: 160 })
  })

  it('aparta la tabla cuando el punto pedido está ocupado', () => {
    const occupied = [{ x: 120, y: 160, width: TABLE_WIDTH, height: tableHeight(3) }]

    const spot = findFreeSpot(occupied, { x: 120, y: 160 }, size)

    expect(spot).not.toEqual({ x: 120, y: 160 })
    const overlap =
      spot.x < 120 + TABLE_WIDTH &&
      120 < spot.x + TABLE_WIDTH &&
      spot.y < 160 + tableHeight(3) &&
      160 < spot.y + tableHeight(3)
    expect(overlap).toBe(false)
  })

  it('siempre devuelve un punto, aunque todo el entorno esté ocupado', () => {
    const occupied = Array.from({ length: 400 }, (_, index) => ({
      x: (index % 20) * TABLE_WIDTH,
      y: Math.floor(index / 20) * tableHeight(3),
      width: TABLE_WIDTH,
      height: tableHeight(3),
    }))

    const spot = findFreeSpot(occupied, { x: 400, y: 200 }, size)

    expect(Number.isFinite(spot.x)).toBe(true)
    expect(Number.isFinite(spot.y)).toBe(true)
  })

  it('nunca devuelve coordenadas negativas', () => {
    const occupied = [{ x: 0, y: 0, width: TABLE_WIDTH, height: tableHeight(3) }]

    const spot = findFreeSpot(occupied, { x: 0, y: 0 }, size)

    expect(spot.x).toBeGreaterThanOrEqual(0)
    expect(spot.y).toBeGreaterThanOrEqual(0)
  })
})
