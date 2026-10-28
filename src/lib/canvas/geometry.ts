import {
  EMPTY_ZONE_HEIGHT,
  EMPTY_ZONE_WIDTH,
  GRID_GAP,
  GRID_SNAP,
  SCHEMA_GAP,
  TABLE_WIDTH,
  ZONE_HEADER,
  ZONE_PADDING,
  tableHeight,
} from '@/lib/canvas/constants'
import type { Rect } from '@/lib/canvas/constants'
import { resolveSchemaColor } from '@/lib/model/colors'
import type { Model, Position, Table } from '@/lib/model/types'

/**
 * Zonas de esquema y envolvente del modelo (FR-023 a FR-026a).
 *
 * Una zona no se guarda en ninguna parte: se deriva de las tablas de su
 * esquema cada vez que hace falta, así que mover una tabla ajusta su zona sin
 * que haya un segundo sitio donde la geometría pueda discrepar del modelo
 * (principio IV, research R4).
 */

/** Zona de un esquema en el lienzo. */
export interface SchemaZone {
  /** Nombre técnico del esquema. */
  schema: string
  /** Rectángulo de la zona, en coordenadas del modelo. */
  rect: Rect
  /** Si el esquema no tiene ninguna tabla (FR-025). */
  isEmpty: boolean
  /** Identificador de color ya resuelto contra la paleta (FR-021). */
  color: string
  /** Cuántas tablas tiene, para el rótulo (FR-024). */
  tableCount: number
}

/** Alto mínimo de una zona: el rótulo nunca se queda sin sitio. */
const MIN_ZONE_HEIGHT = ZONE_HEADER + ZONE_PADDING

/**
 * Envolvente de las tablas de un esquema, o `null` si no tiene ninguna.
 *
 * Recibe las tablas y no solo sus nombres porque el alto de cada tarjeta
 * depende de cuántos campos tiene: la zona crece con la tabla más alta, no con
 * una constante (research R1, FR-030).
 */
function tablesBounds(tables: Table[], layout: Map<string, Position>): Rect | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let found = false

  for (const table of tables) {
    const position = layout.get(table.name)
    if (position === undefined) continue
    found = true
    minX = Math.min(minX, position.x)
    minY = Math.min(minY, position.y)
    maxX = Math.max(maxX, position.x + TABLE_WIDTH)
    maxY = Math.max(maxY, position.y + tableHeight(table.fields.length))
  }

  if (!found) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Calcula la zona de cada esquema, en el orden del modelo.
 *
 * Con tablas, la zona es su envolvente más {@link ZONE_PADDING} a los lados y
 * abajo y {@link ZONE_HEADER} arriba, donde va el rótulo. Sin tablas, la zona
 * mide {@link EMPTY_ZONE_WIDTH} × {@link EMPTY_ZONE_HEIGHT} y se coloca donde
 * el esquema guardó su posición o, si no guardó ninguna, a la derecha de todo
 * lo demás por su orden entre los esquemas vacíos (FR-025, FR-026a).
 *
 * @param model Modelo en memoria.
 * @param layout Mapa de posiciones de `resolveLayout`.
 * @returns Una zona por esquema del modelo, en el orden del modelo.
 */
export function schemaZones(model: Model, layout: Map<string, Position>): SchemaZone[] {
  const tables = model.tables ?? []
  const occupied: Array<{ schema: Model['schemas'][number]; rect: Rect; count: number }> = []
  const empty: Array<Model['schemas'][number]> = []

  for (const schema of model.schemas) {
    const own = tables.filter((table) => table.schema === schema.name)
    const bounds = tablesBounds(own, layout)
    if (bounds === null) {
      empty.push(schema)
      continue
    }
    occupied.push({
      schema,
      rect: {
        x: bounds.x - ZONE_PADDING,
        y: bounds.y - ZONE_HEADER,
        width: bounds.width + ZONE_PADDING * 2,
        height: Math.max(bounds.height + ZONE_HEADER + ZONE_PADDING, MIN_ZONE_HEIGHT),
      },
      count: own.length,
    })
  }

  // Las zonas vacías sin posición guardada se alinean a la derecha de todo lo
  // que ya ocupa sitio, en el orden del modelo, para que no pisen a nadie.
  const rightEdge = occupied.reduce((edge, entry) => Math.max(edge, entry.rect.x + entry.rect.width), 0)
  const positions = new Map<string, Rect>()
  let index = 0
  for (const schema of empty) {
    const saved = schema.position
    const rect: Rect = {
      x: saved ? saved.x : rightEdge + SCHEMA_GAP + index * (EMPTY_ZONE_WIDTH + GRID_GAP),
      y: saved ? saved.y : 0,
      width: EMPTY_ZONE_WIDTH,
      height: EMPTY_ZONE_HEIGHT,
    }
    positions.set(schema.name, rect)
    if (!saved) index += 1
  }

  return model.schemas.map((schema) => {
    const entry = occupied.find((candidate) => candidate.schema.name === schema.name)
    const rect = entry?.rect ?? positions.get(schema.name)
    return {
      schema: schema.name,
      rect: rect ?? { x: 0, y: 0, width: EMPTY_ZONE_WIDTH, height: EMPTY_ZONE_HEIGHT },
      isEmpty: entry === undefined,
      color: resolveSchemaColor(schema.color),
      tableCount: entry?.count ?? 0,
    }
  })
}

/**
 * Zona que está debajo de un punto del modelo (FR-031).
 *
 * Cuando dos zonas se solapan gana la última del orden del modelo, que es la
 * que el lienzo dibuja encima: lo que el usuario ve soltar es lo que recibe la
 * tabla. Fuera de todas las zonas devuelve `null`, y entonces la tabla se
 * queda en su esquema.
 *
 * @param zones Zonas del modelo, en el orden del modelo.
 * @param point Punto en coordenadas del modelo.
 */
export function zoneAt(zones: SchemaZone[], point: Position): SchemaZone | null {
  for (let index = zones.length - 1; index >= 0; index -= 1) {
    const zone = zones[index]
    if (zone === undefined) continue
    const { x, y, width, height } = zone.rect
    if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
      return zone
    }
  }
  return null
}

/**
 * Alinea una posición a la cuadrícula del lienzo (FR-032).
 *
 * Con la preferencia apagada devuelve la posición tal cual, para que la
 * llamada no tenga que preguntar dos veces.
 *
 * @param position Posición en coordenadas del modelo.
 * @param enabled Si la preferencia «Ajustar a la cuadrícula» está activa.
 */
export function snapToGrid(position: Position, enabled: boolean): Position {
  if (!enabled) return position
  return {
    x: Math.round(position.x / GRID_SNAP) * GRID_SNAP,
    y: Math.round(position.y / GRID_SNAP) * GRID_SNAP,
  }
}

/** Si dos rectángulos se tocan. */
function overlaps(one: Rect, other: Rect): boolean {
  return (
    one.x < other.x + other.width &&
    other.x < one.x + one.width &&
    one.y < other.y + other.height &&
    other.y < one.y + one.height
  )
}

/**
 * Hueco libre más cercano al sitio pedido (FR-038).
 *
 * Lo usan duplicar una tabla y crear una donde el centro visible ya está
 * ocupado. Busca en espiral por anillos de {@link GRID_GAP} y siempre acaba
 * devolviendo un punto: en el peor caso, uno a la derecha de todo lo ocupado.
 *
 * @param occupied Rectángulos que ya ocupan sitio.
 * @param desired Dónde se querría dejar la tabla.
 * @param size Tamaño de la tabla que se va a colocar.
 */
export function findFreeSpot(occupied: Rect[], desired: Position, size: Rect): Position {
  const step = TABLE_WIDTH + GRID_GAP
  const fits = (point: Position): boolean =>
    !occupied.some((rect) => overlaps({ ...point, width: size.width, height: size.height }, rect))

  if (fits(desired)) return desired

  for (let ring = 1; ring <= 8; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue
        const candidate = { x: desired.x + dx * step, y: desired.y + dy * (size.height + GRID_GAP) }
        if (candidate.x < 0 || candidate.y < 0) continue
        if (fits(candidate)) return candidate
      }
    }
  }

  const rightEdge = occupied.reduce((edge, rect) => Math.max(edge, rect.x + rect.width), 0)
  return { x: rightEdge + GRID_GAP, y: desired.y }
}

/**
 * Envolvente de todas las zonas, que es lo que «Ajustar» tiene que dejar
 * visible (FR-010, FR-011).
 *
 * @param zones Zonas del modelo.
 * @returns El rectángulo que las contiene, o `null` si no hay ninguna.
 */
export function contentBounds(zones: SchemaZone[]): Rect | null {
  if (zones.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const zone of zones) {
    minX = Math.min(minX, zone.rect.x)
    minY = Math.min(minY, zone.rect.y)
    maxX = Math.max(maxX, zone.rect.x + zone.rect.width)
    maxY = Math.max(maxY, zone.rect.y + zone.rect.height)
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
