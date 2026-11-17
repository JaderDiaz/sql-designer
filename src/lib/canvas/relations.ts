import {
  FIELD_ROW_HEIGHT,
  GRID_SNAP,
  TABLE_HEADER,
  TABLE_WIDTH,
  tableHeight,
} from '@/lib/canvas/constants'
import { resolveSchemaColor } from '@/lib/model/colors'
import { cardinalityOf } from '@/lib/model/marks'
import type { CardinalityEnd } from '@/lib/model/marks'
import type { Model, Position, Relation } from '@/lib/model/types'

/**
 * Geometría de las líneas de relación, en coordenadas del modelo.
 *
 * Todo lo de aquí es una función pura del modelo y del layout ya resuelto: no
 * mide el DOM. Es la misma decisión que el Incremento 3 tomó para el alto de
 * la tarjeta, y es la que permite probar el trazado con Vitest —`jsdom` no
 * implementa el layout de SVG—, dibujar relaciones de tablas que están fuera
 * de la pantalla y repintar a mano durante un arrastre (research R1, R6).
 */

/** Cómo va la línea de una relación. */
export type RelationKind =
  /** Las dos tarjetas tienen hueco entre ellas: la línea cruza el hueco. */
  | 'h'
  /** Las tarjetas se solapan en horizontal: la línea sale y rodea. */
  | 'loop'
  /** La relación va de una tabla hacia sí misma (FR-013a). */
  | 'self'

/** Trazado elegido en Ajustes (FR-017). */
export type RelationRoute = 'orthogonal' | 'curved' | 'straight'

/** Trazados válidos, en el orden en que se ofrecen. */
export const RELATION_ROUTES: RelationRoute[] = ['orthogonal', 'curved', 'straight']

/** Separación entre dos líneas que comparten canal; es la del tablero. */
export const LANE = 14

/** Ancho del canal con el que se agrupan las líneas que bajan por el mismo hueco. */
const CHANNEL = 60

/** Aire mínimo entre el carril de un `'loop'` o un `'self'` y la tarjeta. */
const LOOP_CLEARANCE = 18

/** Aire que el carril deja a cada lado de una tarjeta que esquiva (FR-016). */
const CLEARANCE = 10

/** Hueco que el rodeo deja junto a la tarjeta para que quepa el glifo del extremo. */
const GLYPH_ROOM = 22

/** Paso con el que se prueban pasillos vecinos para que dos rodeos no se pisen. */
const DETOUR_STEP = LANE / 2

/** Cuántos pasillos verticales se prueban, como mucho, a cada lado de un rodeo. */
const DETOUR_CANDIDATES = 12

/**
 * Cuántos pasillos horizontales libres se prueban por cada par de verticales,
 * empezando por los más cercanos a la tarjeta de la que sale la línea. Acota
 * el coste del rodeo en un lienzo grande, donde los pasillos libres son
 * cientos y los lejanos nunca ganan.
 */
const DETOUR_CORRIDORS = 8

/** Los dos extremos de una relación y por dónde salen. */
export interface RelationAnchors {
  /** Extremo de la tabla que lleva la clave foránea. */
  ax: number
  ay: number
  /** Extremo de la tabla referenciada. */
  bx: number
  by: number
  /** Hacia dónde sale la línea del extremo A: `1` derecha, `-1` izquierda. */
  oa: 1 | -1
  /** Hacia dónde entra en el extremo B. */
  ob: 1 | -1
  /** Qué forma tiene el recorrido. */
  kind: RelationKind
  /** Canal por el que querría bajar, antes de repartir carriles. */
  base: number
}

/**
 * Tarjeta que el carril de una línea no puede atravesar (FR-016).
 *
 * Son las cajas de las tablas en coordenadas del modelo, las mismas que el
 * lienzo coloca con `left` y `top`.
 */
export interface LaneObstacle {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Rodeo de una línea ortogonal cuyo tramo horizontal toparía con una tarjeta
 * (FR-016, SC-005).
 *
 * Con él el trazado pasa de tres tramos a cinco: sale de la tarjeta, baja por
 * un pasillo junto a ella, cruza por un pasillo entre filas y entra por el
 * carril.
 */
export interface RelationDetour {
  /**
   * Pasillo vertical por el que la línea deja la tarjeta de la clave foránea,
   * como distancia con signo desde su extremo: así acompaña a la tarjeta
   * mientras se arrastra.
   */
  exit: number
  /** Altura del pasillo horizontal por el que cruza, en coordenadas del modelo. */
  corridor: number
}

/** El carril de una línea y, si le hace falta, su rodeo. */
export interface LineRouting {
  /** Carril por el que la línea llega a la tarjeta referenciada. */
  lane: number
  /** Rodeo, o `null` cuando los tres tramos de siempre pasan limpios. */
  detour: RelationDetour | null
}

/** Una relación lista para pintar. */
export interface RelationLine {
  /** Nombre técnico de la relación; es la clave del mapa de refs. */
  name: string
  /** Atributo `d` del trazo. */
  d: string
  /**
   * Carril por el que baja el trazo, ya repartido.
   *
   * Lo guarda la línea para que el arrastre pueda repintar su `d` sin volver
   * a repartir carriles: mientras el dedo está abajo los carriles se quedan
   * como estaban y solo se recalculan al soltar (research R2, R6).
   */
  lane: number
  /**
   * Rodeo del trazado ortogonal, o `null` si no le hace falta. Se guarda por
   * lo mismo que el carril: el arrastre repinta sin volver a enrutar.
   */
  detour: RelationDetour | null
  /** Atributo `d` del glifo del extremo de la clave foránea. */
  glyphA: string
  /** Atributo `d` del glifo del extremo referenciado. */
  glyphB: string
  /** Identificador de color del esquema de la tabla referenciada (FR-015). */
  color: string
  /** Tabla que lleva la clave foránea. */
  from: string
  /** Tabla referenciada. */
  to: string
}

/** Qué se arrastra, para saber qué líneas hay que repintar. */
export interface DragTarget {
  kind: 'table' | 'schema'
  name: string
}

/** Posición de la fila de un campo dentro de la tarjeta. */
function rowCenter(position: Position, index: number): number {
  return position.y + TABLE_HEADER + FIELD_ROW_HEIGHT * index + FIELD_ROW_HEIGHT / 2
}

/**
 * Los dos extremos de una relación y por dónde sale cada uno (FR-013).
 *
 * El extremo cae en el centro de la fila del campo, que se deduce de su índice
 * en la lista de campos. El lado lo decide el hueco horizontal: con al menos
 * {@link TABLE_WIDTH} + {@link GRID_SNAP} de separación la línea cruza el
 * hueco; si las tarjetas se solapan, las dos puntas salen por la derecha y la
 * línea rodea; y una relación de una tabla hacia sí misma sale y vuelve por el
 * mismo lado (research R1, R4).
 *
 * @param model Modelo completo.
 * @param layout Posición de cada tabla, ya resuelta.
 * @param relation Relación que se dibuja.
 * @returns Los extremos, o `null` si la relación nombra algo que no está.
 */
export function relationAnchors(
  model: Model,
  layout: Map<string, Position>,
  relation: Relation,
): RelationAnchors | null {
  const tables = model.tables ?? []
  const from = tables.find((table) => table.name === relation.fromTable)
  const to = tables.find((table) => table.name === relation.toTable)
  if (from === undefined || to === undefined) return null

  const pa = layout.get(from.name)
  const pb = layout.get(to.name)
  if (pa === undefined || pb === undefined) return null

  // De una relación de varias columnas se ancla la primera (FR-020).
  const indexA = from.fields.findIndex((field) => field.name === relation.fromFields[0])
  const indexB = to.fields.findIndex((field) => field.name === relation.toFields[0])
  if (indexA < 0 || indexB < 0) return null

  const ay = rowCenter(pa, indexA)
  const by = rowCenter(pb, indexB)
  const gap = TABLE_WIDTH + GRID_SNAP

  let anchors: Omit<RelationAnchors, 'base'>
  if (relation.fromTable === relation.toTable) {
    anchors = { ax: pa.x + TABLE_WIDTH, ay, bx: pb.x + TABLE_WIDTH, by, oa: 1, ob: 1, kind: 'self' }
  } else if (pb.x >= pa.x + gap) {
    anchors = { ax: pa.x + TABLE_WIDTH, ay, bx: pb.x, by, oa: 1, ob: -1, kind: 'h' }
  } else if (pa.x >= pb.x + gap) {
    anchors = { ax: pa.x, ay, bx: pb.x + TABLE_WIDTH, by, oa: -1, ob: 1, kind: 'h' }
  } else {
    anchors = { ax: pa.x + TABLE_WIDTH, ay, bx: pb.x + TABLE_WIDTH, by, oa: 1, ob: 1, kind: 'loop' }
  }

  // El canal: cerca del destino cuando el salto es largo, para que la línea
  // no corte por la mitad del lienzo; a mitad de camino cuando es corto.
  const base =
    anchors.kind === 'h'
      ? Math.abs(anchors.bx - anchors.ax) > 120
        ? anchors.bx + anchors.ob * 30
        : Math.round((anchors.ax + anchors.bx) / 2)
      : Math.max(anchors.ax, anchors.bx) + 26

  return { ...anchors, base }
}

/** Reparte un grupo de líneas alrededor del centro de su canal. */
function placeLanes(
  anchors: ReadonlyArray<RelationAnchors>,
  order: number[],
  middle: number,
): Map<number, number> {
  const placed = new Map<number, number>()
  const count = order.length

  order.forEach((index, position) => {
    const anchor = anchors[index] as RelationAnchors
    let lane = Math.round(middle + (position - (count - 1) / 2) * LANE)
    if (anchor.kind === 'h') {
      // El carril de una línea que cruza el hueco no puede salirse de él, o
      // pasaría por dentro de una de las dos tarjetas (R2).
      const low = Math.min(anchor.ax, anchor.bx) + 12
      const high = Math.max(anchor.ax, anchor.bx) - 12
      lane =
        high > low
          ? Math.max(low, Math.min(high, lane))
          : Math.round((anchor.ax + anchor.bx) / 2)
    } else {
      lane = Math.max(Math.max(anchor.ax, anchor.bx) + LOOP_CLEARANCE, lane)
    }
    placed.set(index, lane)
  })

  return placed
}

/** Cuenta los cruces entre el tramo vertical de una línea y los horizontales de otra. */
function countCrossings(
  anchors: ReadonlyArray<RelationAnchors>,
  group: number[],
  lanes: Map<number, number>,
): number {
  let crossings = 0

  for (const i of group) {
    for (const j of group) {
      if (i === j) continue
      const a = anchors[i] as RelationAnchors
      const b = anchors[j] as RelationAnchors
      const vertical = lanes.get(j) as number
      const top = Math.min(b.ay, b.by)
      const bottom = Math.max(b.ay, b.by)
      const lane = lanes.get(i) as number
      const segments: Array<[number, number, number]> = [
        [a.ax, lane, a.ay],
        [lane, a.bx, a.by],
      ]
      for (const [x0, x1, y] of segments) {
        const left = Math.min(x0, x1)
        const right = Math.max(x0, x1)
        if (vertical > left && vertical < right && y > top && y < bottom) crossings += 1
      }
    }
  }

  return crossings
}

/** Prueba todas las permutaciones de un grupo pequeño y se queda con la mejor. */
function bestOrder(
  anchors: ReadonlyArray<RelationAnchors>,
  group: number[],
  middle: number,
  start: Map<number, number>,
): Map<number, number> {
  let best = start
  let fewest = countCrossings(anchors, group, start)

  const walk = (left: number[], prefix: number[]): void => {
    if (left.length === 0) {
      const lanes = placeLanes(anchors, prefix, middle)
      const crossings = countCrossings(anchors, group, lanes)
      if (crossings < fewest) {
        fewest = crossings
        best = lanes
      }
      return
    }
    left.forEach((value, index) => {
      walk([...left.slice(0, index), ...left.slice(index + 1)], [...prefix, value])
    })
  }

  walk(group, [])
  return best
}

/**
 * Aparta un carril de las tarjetas que atravesaría (FR-016).
 *
 * El tramo vertical de una línea ortogonal baja por el carril de un extremo al
 * otro, así que cualquier tarjeta que caiga en ese pasillo y a esa altura
 * quedaría cruzada. Esto busca el pasillo libre más cercano: mientras alguna
 * tarjeta estorbe, el carril salta a su lado más próximo con
 * {@link CLEARANCE} de aire, y la búsqueda se para a las diez vueltas, que son
 * más de las que hacen falta en un lienzo de cincuenta tablas.
 *
 * @param anchor Extremos de la línea, de donde sale la altura del tramo.
 * @param lane Carril que le tocó al repartir.
 * @param obstacles Cajas de las tablas del lienzo.
 * @returns El carril libre más cercano, o el que llegó si no estorbaba nada.
 */
function avoidTables(
  anchor: RelationAnchors,
  lane: number,
  obstacles: ReadonlyArray<LaneObstacle>,
): number {
  if (obstacles.length === 0) return lane
  const top = Math.min(anchor.ay, anchor.by)
  const bottom = Math.max(anchor.ay, anchor.by)
  // Solo estorban las tarjetas que el tramo vertical cruzaría de verdad: las
  // que están a otra altura quedan fuera del recorrido.
  const inWay = obstacles.filter(
    (box) => box.bottom > top - CLEARANCE && box.top < bottom + CLEARANCE,
  )

  let current = lane
  for (let round = 0; round < 10; round += 1) {
    const blocking = inWay.find(
      (box) => current > box.left - CLEARANCE && current < box.right + CLEARANCE,
    )
    if (blocking === undefined) return current
    const left = blocking.left - CLEARANCE
    const right = blocking.right + CLEARANCE
    current = Math.abs(current - left) <= Math.abs(current - right) ? left : right
  }
  return current
}

/**
 * El carril por el que baja cada línea (FR-016).
 *
 * Las líneas que usan el mismo hueco vertical comparten canal, así que se
 * reparten cada {@link LANE} píxeles alrededor del centro del grupo. Cuando el
 * grupo tiene entre 2 y 5 líneas y queda algún cruce, se prueban las
 * permutaciones y gana la que menos cruces deja; con más de cinco se ordena
 * por el extremo superior y no se permuta, porque permutar seis ya son 720
 * pruebas (research R2).
 *
 * El reparto se calcula cuando cambia el modelo y **no** en cada cuadro de un
 * arrastre: durante el gesto los carriles se quedan como estaban.
 *
 * Con las cajas de las tablas, el carril repartido se aparta además de
 * cualquier tarjeta que fuera a atravesar: el reparto evita que dos líneas se
 * pisen y la evasión que una línea pise una tabla (FR-016).
 *
 * @param anchors Las anclas de todas las relaciones, en el orden del modelo.
 * @param obstacles Cajas de las tablas del lienzo; sin ellas no se esquiva
 *   nada, que es lo que quieren las pruebas de geometría pura.
 * @returns Un carril por relación, en el mismo orden.
 */
export function assignLanes(
  anchors: ReadonlyArray<RelationAnchors>,
  obstacles: ReadonlyArray<LaneObstacle> = [],
): number[] {
  const groups = new Map<number, number[]>()
  anchors.forEach((anchor, index) => {
    const key = Math.round(anchor.base / CHANNEL)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [index])
    else group.push(index)
  })

  const lanes = new Array<number>(anchors.length).fill(0)

  for (const group of groups.values()) {
    const ordered = [...group].sort((i, j) => {
      const a = anchors[i] as RelationAnchors
      const b = anchors[j] as RelationAnchors
      const top = Math.min(a.ay, a.by) - Math.min(b.ay, b.by)
      if (top !== 0) return top
      // A igual altura, primero la línea más larga: deja las cortas por dentro.
      return Math.abs(b.by - b.ay) - Math.abs(a.by - a.ay)
    })
    const middle =
      group.reduce((sum, index) => sum + (anchors[index] as RelationAnchors).base, 0) / group.length

    let placed = placeLanes(anchors, ordered, middle)
    if (ordered.length > 1 && ordered.length <= 5 && countCrossings(anchors, group, placed) > 0) {
      placed = bestOrder(anchors, group, middle, placed)
    }
    for (const [index, lane] of placed) {
      lanes[index] = avoidTables(anchors[index] as RelationAnchors, lane, obstacles)
    }
  }

  return lanes
}

/** Tramo recto, horizontal o vertical, de una línea ya colocada. */
interface Segment {
  /** `true` si el tramo es vertical. */
  vertical: boolean
  /** La `x` de un tramo vertical o la `y` de uno horizontal. */
  at: number
  from: number
  to: number
}

/** Construye un tramo con sus extremos ordenados. */
function segment(vertical: boolean, at: number, a: number, b: number): Segment {
  return { vertical, at, from: Math.min(a, b), to: Math.max(a, b) }
}

/** Dice si un tramo pasa por dentro de alguna tarjeta, con `pad` de aire. */
function isBlocked(
  part: Segment,
  obstacles: ReadonlyArray<LaneObstacle>,
  pad: number,
): boolean {
  return obstacles.some((box) =>
    part.vertical
      ? part.at > box.left - pad &&
        part.at < box.right + pad &&
        part.from < box.bottom + pad &&
        part.to > box.top - pad
      : part.at > box.top - pad &&
        part.at < box.bottom + pad &&
        part.from < box.right + pad &&
        part.to > box.left - pad,
  )
}

/** Los tramos de una línea ortogonal, con su rodeo si lo lleva. */
function segmentsOf(anchor: RelationAnchors, routing: LineRouting): Segment[] {
  const { ax, ay, bx, by } = anchor
  const { lane, detour } = routing
  if (detour === null) {
    return [segment(false, ay, ax, lane), segment(true, lane, ay, by), segment(false, by, lane, bx)]
  }
  const exit = ax + detour.exit
  return [
    segment(false, ay, ax, exit),
    segment(true, exit, ay, detour.corridor),
    segment(false, detour.corridor, exit, lane),
    segment(true, lane, detour.corridor, by),
    segment(false, by, lane, bx),
  ]
}

/**
 * Los tramos ya colocados, ordenados para preguntar rápido cuáles pisaría uno
 * nuevo: se guardan por orientación y por franja de {@link DETOUR_STEP}.
 */
class PlacedSegments {
  private readonly buckets = new Map<number, Segment[]>()

  private static key(vertical: boolean, slot: number): number {
    return slot * 2 + (vertical ? 1 : 0)
  }

  /** Apunta los tramos de una línea que ya tiene recorrido. */
  add(parts: ReadonlyArray<Segment>): void {
    for (const part of parts) {
      const key = PlacedSegments.key(part.vertical, Math.round(part.at / DETOUR_STEP))
      const bucket = this.buckets.get(key)
      if (bucket === undefined) this.buckets.set(key, [part])
      else bucket.push(part)
    }
  }

  /** Cuántos tramos ya colocados quedarían debajo de estos. */
  overlaps(parts: ReadonlyArray<Segment>): number {
    let overlaps = 0
    for (const part of parts) {
      const slot = Math.round(part.at / DETOUR_STEP)
      for (let near = slot - 1; near <= slot + 1; near += 1) {
        for (const other of this.buckets.get(PlacedSegments.key(part.vertical, near)) ?? []) {
          if (
            Math.abs(part.at - other.at) < DETOUR_STEP - 1 &&
            part.from < other.to - 1 &&
            part.to > other.from + 1
          ) {
            overlaps += 1
          }
        }
      }
    }
    return overlaps
  }
}

/**
 * Pasillos verticales a los que un extremo llega sin cruzar ninguna tarjeta.
 *
 * @param x Borde de la tarjeta del que sale el extremo.
 * @param y Altura del extremo.
 * @param side Hacia dónde sale: `1` derecha, `-1` izquierda.
 * @param lane Carril repartido, que se prefiere si sirve.
 * @param obstacles Cajas de las tablas del lienzo.
 * @param air Aire que se deja a cada tarjeta.
 * @returns Las `x` candidatas, de la más cercana al extremo a la más lejana.
 */
function reachableAisles(
  x: number,
  y: number,
  side: 1 | -1,
  lane: number,
  obstacles: ReadonlyArray<LaneObstacle>,
  air: number,
): number[] {
  // Hasta dónde llega el tramo que sale del extremo: la primera tarjeta que
  // tiene delante a su misma altura.
  let reach = Infinity
  for (const box of obstacles) {
    if (y <= box.top || y >= box.bottom) continue
    const distance = side === 1 ? box.left - x : x - box.right
    if (distance >= 0 && distance < reach) reach = distance
  }
  const nearest = air
  const farthest = reach - air
  if (farthest < nearest) return []

  const bases = [GLYPH_ROOM, (lane - x) * side, nearest]
  if (Number.isFinite(farthest)) bases.push(farthest)
  const distances = new Set<number>()
  for (const base of bases) {
    for (let step = -2; step <= 2; step += 1) distances.add(base + step * DETOUR_STEP)
  }
  // Los bordes de las demás tarjetas abren pasillos cuando el lienzo no es una
  // rejilla y el de al lado de la tarjeta está tapado.
  for (const box of obstacles) {
    distances.add((box.left - air - x) * side)
    distances.add((box.right + air - x) * side)
  }

  return [...distances]
    .filter((distance) => distance >= nearest && distance <= farthest)
    .sort((a, b) => a - b)
    .slice(0, DETOUR_CANDIDATES)
    .map((distance) => x + side * distance)
}

/**
 * Entre qué alturas puede moverse un tramo vertical sin tocar una tarjeta.
 *
 * @param x Pasillo por el que baja el tramo.
 * @param y Altura de la que parte.
 * @param obstacles Cajas de las tablas del lienzo.
 * @param pad Aire que se deja a cada tarjeta.
 * @returns El intervalo libre alrededor de `y`, o `null` si ya nace tapado.
 */
function freeSpan(
  x: number,
  y: number,
  obstacles: ReadonlyArray<LaneObstacle>,
  pad: number,
): [number, number] | null {
  let low = -Infinity
  let high = Infinity
  for (const box of obstacles) {
    if (x <= box.left - pad || x >= box.right + pad) continue
    const top = box.top - pad
    const bottom = box.bottom + pad
    if (y > top && y < bottom) return null
    if (bottom <= y) low = Math.max(low, bottom)
    else high = Math.min(high, top)
  }
  return [low, high]
}

/** El mejor recorrido libre de una línea tapada con `air` de aire, o `null`. */
function findRouting(
  anchor: RelationAnchors,
  lane: number,
  obstacles: ReadonlyArray<LaneObstacle>,
  used: PlacedSegments,
  air: number,
): LineRouting | null {
  const { ax, ay, bx, by, oa, ob } = anchor
  const pad = air - 1
  const exits = reachableAisles(ax, ay, oa, lane, obstacles, air)
  const entries = reachableAisles(bx, by, ob, lane, obstacles, air)
  if (exits.length === 0 || entries.length === 0) return null

  const heights = new Set<number>()
  for (const box of obstacles) {
    for (let step = 0; step <= 2; step += 1) {
      heights.add(box.top - air - step * DETOUR_STEP)
      heights.add(box.bottom + air + step * DETOUR_STEP)
    }
  }
  // De cada pasillo horizontal solo importan las tarjetas que tiene a su
  // altura; se apartan una vez y no por cada par de pasillos verticales.
  const corridors = [...heights]
    .sort((a, b) => Math.abs(a - ay) - Math.abs(b - ay))
    .map((y) => ({
    y,
      inWay: obstacles.filter((box) => y > box.top - pad && y < box.bottom + pad),
    }))
  const exitSpans = new Map(exits.map((x) => [x, freeSpan(x, ay, obstacles, pad)] as const))
  const entrySpans = new Map(entries.map((x) => [x, freeSpan(x, by, obstacles, pad)] as const))

  const found: { routing: LineRouting | null; cost: number } = { routing: null, cost: Infinity }
  const consider = (routing: LineRouting, length: number, exit: number): void => {
    // Se prefiere conservar el carril que ya estaba repartido y, a igualdad,
    // dejar sitio al glifo y cruzar cerca de la tarjeta de la que se sale.
    const floor =
      length +
      (routing.lane === lane || exit === lane ? 0 : 20) +
      Math.abs(Math.abs(exit - ax) - GLYPH_ROOM) * 0.01 +
      Math.abs((routing.detour?.corridor ?? ay) - ay) * 0.0001
    // Pisar a otra línea solo suma: si sin contarlo ya no gana, no se cuenta.
    if (floor >= found.cost) return
    const cost = floor + used.overlaps(segmentsOf(anchor, routing)) * 10000
    if (cost < found.cost) {
      found.cost = cost
      found.routing = routing
    }
  }

  for (const exit of exits) {
    const exitSpan = exitSpans.get(exit)
    if (exitSpan === null || exitSpan === undefined) continue

    // Antes del rodeo, otro carril: si el pasillo de salida llega también al
    // otro extremo, bastan los tres tramos de siempre.
    if (
      entrySpans.has(exit) &&
      Math.min(ay, by) >= exitSpan[0] &&
      Math.max(ay, by) <= exitSpan[1]
    ) {
      consider({ lane: exit, detour: null }, Math.abs(exit - ax) + Math.abs(by - ay) + Math.abs(bx - exit), exit)
    }

    for (const entry of entries) {
      const entrySpan = entrySpans.get(entry)
      if (entrySpan === null || entrySpan === undefined || entry === exit) continue
      const low = Math.max(exitSpan[0], entrySpan[0])
      const high = Math.min(exitSpan[1], entrySpan[1])
      let tried = 0
      for (const { y: corridor, inWay } of corridors) {
        if (tried >= DETOUR_CORRIDORS) break
        if (corridor < low || corridor > high) continue
        if (isBlocked(segment(false, corridor, exit, entry), inWay, pad)) continue
        tried += 1
        consider(
          { lane: entry, detour: { exit: exit - ax, corridor } },
          Math.abs(exit - ax) +
            Math.abs(corridor - ay) +
            Math.abs(entry - exit) +
            Math.abs(by - corridor) +
            Math.abs(bx - entry),
          exit,
        )
      }
    }
  }

  return found.routing
}

/**
 * El recorrido de cada línea ortogonal, con rodeo donde hace falta (FR-016,
 * SC-005).
 *
 * El trazado de tres tramos solo puede elegir su carril, y la altura de cada
 * extremo la fija la fila del campo: cuando las dos tablas están a varias
 * columnas, el tramo horizontal atraviesa las tarjetas de en medio. A esas
 * líneas —y solo a esas— se les busca otro recorrido: primero otro carril y,
 * si no lo hay, un rodeo de cinco tramos que sale por un pasillo junto a la
 * tarjeta, cruza por un pasillo entre filas y entra por otro junto al destino.
 * Entre los recorridos libres gana el que menos pisa a las líneas ya
 * colocadas y, a igualdad, el más corto.
 *
 * Es un cálculo de cuando cambia el modelo, como el de los carriles: durante
 * un arrastre el rodeo se queda como estaba (research R2, R3).
 *
 * @param anchors Las anclas de todas las relaciones, en el orden del modelo.
 * @param lanes El carril de cada una, de {@link assignLanes}.
 * @param obstacles Cajas de las tablas del lienzo.
 * @returns El carril y el rodeo de cada relación, en el mismo orden. Una línea
 *   tapada que no tiene recorrido libre conserva sus tres tramos.
 */
export function assignDetours(
  anchors: ReadonlyArray<RelationAnchors>,
  lanes: ReadonlyArray<number>,
  obstacles: ReadonlyArray<LaneObstacle>,
): LineRouting[] {
  const routings: LineRouting[] = anchors.map((_, index) => ({
    lane: lanes[index] as number,
    detour: null,
  }))
  if (obstacles.length === 0) return routings

  const used = new PlacedSegments()
  const blocked: number[] = []
  anchors.forEach((anchor, index) => {
    const parts = segmentsOf(anchor, routings[index] as LineRouting)
    if (parts.some((part) => isBlocked(part, obstacles, 0))) blocked.push(index)
    else used.add(parts)
  })

  for (const index of blocked) {
    const anchor = anchors[index] as RelationAnchors
    const lane = lanes[index] as number
    // Con el aire de siempre y, si las tarjetas están tan juntas que no cabe,
    // con el mínimo para no tocarlas.
    const found =
      findRouting(anchor, lane, obstacles, used, CLEARANCE) ??
      findRouting(anchor, lane, obstacles, used, 2)
    if (found !== null) routings[index] = found
    used.add(segmentsOf(anchor, routings[index] as LineRouting))
  }

  return routings
}

/**
 * El atributo `d` del trazo, en el trazado elegido (FR-017).
 *
 * Los tres trazados usan los mismos cuatro números de {@link relationAnchors}
 * y ninguno atraviesa una tarjeta: el ortogonal baja por su carril, el curvo
 * saca los tiradores en horizontal y el recto deja 16 px de salida recta en
 * cada extremo para que la línea no nazca torcida (research R3, R4).
 *
 * @param anchors Extremos de la relación.
 * @param lane Carril que le tocó.
 * @param route Trazado elegido en Ajustes.
 * @param detour Rodeo del trazado ortogonal, de {@link assignDetours}; los
 *   otros dos trazados no lo usan.
 * @returns La cadena del atributo `d`.
 */
export function pathOf(
  anchors: RelationAnchors,
  lane: number,
  route: RelationRoute,
  detour: RelationDetour | null = null,
): string {
  const { ax, ay, bx, by, oa, ob, kind } = anchors

  if (route === 'curved') {
    const handle =
      kind === 'h'
        ? Math.max(36, Math.abs(bx - ax) / 2)
        : lane - Math.max(ax, bx) + 40
    return `M${ax} ${ay} C${ax + oa * handle} ${ay}, ${bx + ob * handle} ${by}, ${bx} ${by}`
  }

  if (route === 'straight') {
    return `M${ax} ${ay} L${ax + oa * 16} ${ay} L${bx + ob * 16} ${by} L${bx} ${by}`
  }

  if (detour !== null) {
    return `M${ax} ${ay} H${ax + detour.exit} V${detour.corridor} H${lane} V${by} H${bx}`
  }

  return `M${ax} ${ay} H${lane} V${by} H${bx}`
}

/** Un círculo como trazo, para el «cero» de las dos cardinalidades opcionales. */
function circle(x: number, y: number, radius: number): string {
  return `M${x - radius} ${y} a${radius} ${radius} 0 1 0 ${radius * 2} 0 a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
}

/**
 * El atributo `d` del glifo de un extremo (FR-014).
 *
 * Son los cuatro de la leyenda del lienzo de diseño: dos barras para «uno», la
 * pata de gallo para «muchos», y las dos opcionales con el círculo del cero. El
 * glifo crece en el sentido en que la línea sale de la tarjeta, así que queda
 * en el hueco y nunca encima de los campos (research R5).
 *
 * @param end Cardinalidad de este extremo.
 * @param point Punto donde la línea toca la tarjeta.
 * @param side `1` si la línea sale hacia la derecha, `-1` hacia la izquierda.
 * @returns La cadena del atributo `d`.
 */
export function glyphOf(
  end: CardinalityEnd,
  point: { x: number; y: number },
  side: 1 | -1,
): string {
  const { x, y } = point
  const bar = (at: number): string => `M${x + at * side} ${y - 5} V${y + 5}`
  const crow = [
    `M${x + 12 * side} ${y} L${x} ${y - 6}`,
    `M${x + 12 * side} ${y} L${x} ${y + 6}`,
  ].join(' ')

  if (end === 'one') return `${bar(6)} ${bar(10)}`
  if (end === 'zero-or-one') return `${bar(6)} ${circle(x + 13 * side, y, 3.5)}`
  if (end === 'zero-or-many') return `${crow} ${circle(x + 18 * side, y, 3.5)}`
  return `${crow} ${bar(15)}`
}

/**
 * Todas las relaciones del modelo, listas para pintar (FR-013 a FR-015).
 *
 * Compone las cuatro funciones anteriores: anclas, carriles, trazado y glifos.
 * El color es el token del esquema de la tabla referenciada, que es la que
 * tiene la llave primaria (FR-015, RS-05), y la cardinalidad de cada extremo
 * sale de {@link cardinalityOf}, la misma que lee el inspector (SC-011).
 *
 * @param model Modelo completo.
 * @param layout Posición de cada tabla, ya resuelta.
 * @param route Trazado elegido en Ajustes.
 * @returns Una línea por relación que se puede dibujar, en el orden del modelo.
 */
export function relationLayer(
  model: Model,
  layout: Map<string, Position>,
  route: RelationRoute,
): RelationLine[] {
  const relations = model.relations ?? []
  const pairs: Array<{ relation: Relation; anchors: RelationAnchors }> = []

  for (const relation of relations) {
    const anchors = relationAnchors(model, layout, relation)
    if (anchors !== null) pairs.push({ relation, anchors })
  }

  const all = pairs.map((pair) => pair.anchors)
  const boxes = tableBoxes(model, layout)
  const lanes = assignLanes(all, boxes)
  // El rodeo es cosa del trazado ortogonal: el curvo y el recto no tienen
  // tramos que apartar.
  const routings =
    route === 'orthogonal'
      ? assignDetours(all, lanes, boxes)
      : lanes.map((lane): LineRouting => ({ lane, detour: null }))
  const schemaOf = new Map(
    (model.tables ?? []).map((table) => [table.name, table.schema] as const),
  )
  const colorOf = new Map(
    model.schemas.map((schema) => [schema.name, resolveSchemaColor(schema.color)] as const),
  )

  return pairs.map(({ relation, anchors }, index) => {
    const cardinality = cardinalityOf(model, relation)
    const { lane, detour } = routings[index] as LineRouting
    return {
      name: relation.name,
      d: pathOf(anchors, lane, route, detour),
      lane,
      detour,
      glyphA: glyphOf(cardinality.to, { x: anchors.ax, y: anchors.ay }, anchors.oa),
      glyphB: glyphOf(cardinality.from, { x: anchors.bx, y: anchors.by }, anchors.ob),
      color: colorOf.get(schemaOf.get(relation.toTable) ?? '') ?? resolveSchemaColor(undefined),
      from: relation.fromTable,
      to: relation.toTable,
    }
  })
}

/**
 * Las cajas de las tablas del lienzo, para esquivarlas (FR-016).
 *
 * @param model Modelo completo.
 * @param layout Posición de cada tabla, ya resuelta.
 * @returns Una caja por tabla colocada, en coordenadas del modelo.
 */
export function tableBoxes(
  model: Model,
  layout: Map<string, Position>,
): LaneObstacle[] {
  const boxes: LaneObstacle[] = []
  for (const table of model.tables ?? []) {
    const position = layout.get(table.name)
    if (position === undefined) continue
    boxes.push({
      left: position.x,
      right: position.x + TABLE_WIDTH,
      top: position.y,
      bottom: position.y + tableHeight(table.fields.length),
    })
  }
  return boxes
}

/**
 * Qué relaciones hay que repintar mientras se arrastra algo (research R6).
 *
 * Al mover una tabla se mueve un extremo de cada relación que la toca; al
 * mover la zona de un esquema se mueven las de todas sus tablas. Las demás no
 * cambian de forma, así que no se tocan: de eso vive el presupuesto de los
 * 16 ms (SC-003).
 *
 * @param model Modelo completo.
 * @param target Tabla o esquema que se arrastra.
 * @returns Los nombres de las relaciones afectadas, en el orden del modelo.
 */
export function touchedRelations(model: Model, target: DragTarget): string[] {
  const relations = model.relations ?? []
  if (target.kind === 'table') {
    return relations
      .filter(
        (relation) => relation.fromTable === target.name || relation.toTable === target.name,
      )
      .map((relation) => relation.name)
  }

  const own = new Set(
    (model.tables ?? [])
      .filter((table) => table.schema === target.name)
      .map((table) => table.name),
  )
  return relations
    .filter((relation) => own.has(relation.fromTable) || own.has(relation.toTable))
    .map((relation) => relation.name)
}
