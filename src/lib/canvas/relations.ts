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
 * @returns La cadena del atributo `d`.
 */
export function pathOf(anchors: RelationAnchors, lane: number, route: RelationRoute): string {
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

  const lanes = assignLanes(
    pairs.map((pair) => pair.anchors),
    tableBoxes(model, layout),
  )
  const schemaOf = new Map(
    (model.tables ?? []).map((table) => [table.name, table.schema] as const),
  )
  const colorOf = new Map(
    model.schemas.map((schema) => [schema.name, resolveSchemaColor(schema.color)] as const),
  )

  return pairs.map(({ relation, anchors }, index) => {
    const cardinality = cardinalityOf(model, relation)
    return {
      name: relation.name,
      d: pathOf(anchors, lanes[index] as number, route),
      lane: lanes[index] as number,
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
