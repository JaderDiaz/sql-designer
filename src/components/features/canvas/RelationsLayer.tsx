import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { CSSProperties, MutableRefObject } from 'react'

import { glyphOf, pathOf, relationAnchors, touchedRelations } from '@/lib/canvas/relations'
import type { DragTarget, RelationLine, RelationRoute } from '@/lib/canvas/relations'
import { cardinalityOf } from '@/lib/model/marks'
import type { CardinalityEnd } from '@/lib/model/marks'
import type { Model, Position } from '@/lib/model/types'

/**
 * Capa de las relaciones del lienzo (FR-013 a FR-015, FR-018).
 *
 * Es un `<svg>` suelto dentro del escenario, en coordenadas del modelo y
 * **antes** de las tarjetas, así que las líneas quedan por debajo de ellas sin
 * necesidad de `z-index`. No captura el puntero ni aporta nada al árbol de
 * accesibilidad: lleva `aria-hidden`, porque lo que dibuja ya se lee en la
 * ficha «Claves foráneas» y en el inspector (contracts/relations.md §5).
 *
 * Mientras se arrastra una tabla no se vuelve a renderizar: quien arrastra
 * llama a {@link RelationsLayerHandle.paintRelations} por cuadro y la capa
 * escribe el atributo `d` de las relaciones que ese gesto mueve, con el carril
 * que ya tenían. Los carriles se recalculan al soltar, cuando el modelo
 * cambia (research R2, R6, SC-003).
 */

/**
 * Cómo se escribe cada extremo junto a la línea resaltada (FR-024).
 *
 * Son las mismas cuatro cardinalidades que dice el inspector, en la notación
 * corta del lienzo de diseño: el extremo referenciado siempre es `1`.
 */
export const END_TEXT: Record<CardinalityEnd, string> = {
  one: '1',
  'zero-or-one': '0..1',
  many: 'N',
  'zero-or-many': '0..N',
}

/** Mando que la capa deja a quien arrastra (research R6). */
export interface RelationsLayerHandle {
  /**
   * Repinta las relaciones que mueve un gesto.
   *
   * @param delta Desplazamiento del gesto, en coordenadas del modelo.
   * @param target Tabla o esquema que se arrastra.
   */
  paintRelations: (delta: Position, target: DragTarget) => void
}

/** Props de la capa. */
export interface RelationsLayerProps {
  /** Modelo completo, para recalcular las anclas durante el arrastre. */
  model: Model
  /** Posición de cada tabla, ya resuelta. */
  layout: Map<string, Position>
  /** Líneas ya compuestas, memorizadas por quien dibuja el lienzo. */
  lines: RelationLine[]
  /** Trazado elegido en Ajustes (FR-017). */
  route: RelationRoute
  /** Relaciones resaltadas, que llevan el flujo y la cardinalidad (FR-024). */
  hot?: ReadonlySet<string>
  /** Si hay algo resaltado: entonces las demás líneas se atenúan (FR-021). */
  isDimming?: boolean
  /** Dónde dejar el mando del arrastre. */
  handle?: MutableRefObject<RelationsLayerHandle | null>
}

/** Lo que un gesto de arrastre mueve, guardado mientras el gesto dura. */
interface PaintingGesture {
  /** Qué se arrastra, para saber si el gesto siguiente es otro. */
  key: string
  /** Tablas que el gesto desplaza. */
  moved: string[]
  /** Relaciones que hay que volver a trazar. */
  touched: string[]
  /** Layout prestado que se reescribe cuadro a cuadro. */
  shifted: Map<string, Position>
}

/** Los tres nodos de una relación, para escribirles su `d` por cuadro. */
interface LineNodes {
  line: SVGPathElement | null
  glyphA: SVGPathElement | null
  glyphB: SVGPathElement | null
}

export function RelationsLayer({
  model,
  layout,
  lines,
  route,
  hot,
  isDimming = false,
  handle,
}: RelationsLayerProps) {
  /** Nodos de cada relación, por nombre. */
  const nodes = useRef(new Map<string, LineNodes>())

  /** Lo que el gesto en curso mueve, resuelto una vez y no por cuadro. */
  const painting = useRef<PaintingGesture | null>(null)

  /** La relación y la cardinalidad de cada línea, por nombre. */
  const details = useMemo(() => {
    const relations = model.relations ?? []
    return new Map(
      relations.map(
        (relation) => [relation.name, { relation, ends: cardinalityOf(model, relation) }] as const,
      ),
    )
  }, [model])

  /** Las anclas de cada relación, para colocar sus etiquetas (FR-024). */
  const anchorsOf = useMemo(() => {
    const result = new Map<string, ReturnType<typeof relationAnchors>>()
    for (const relation of model.relations ?? []) {
      result.set(relation.name, relationAnchors(model, layout, relation))
    }
    return result
  }, [layout, model])

  /** El carril de cada línea, congelado hasta que el modelo cambie (R2). */
  const lanes = useMemo(
    () => new Map(lines.map((line) => [line.name, line.lane] as const)),
    [lines],
  )

  /** Qué tablas mueve el gesto: la arrastrada, o todas las de su esquema. */
  const tablesOfTarget = useCallback(
    (target: DragTarget): Set<string> => {
      if (target.kind === 'table') return new Set([target.name])
      return new Set(
        (model.tables ?? [])
          .filter((table) => table.schema === target.name)
          .map((table) => table.name),
      )
    },
    [model],
  )

  const paintRelations = useCallback(
    (delta: Position, target: DragTarget) => {
      const key = `${target.kind}:${target.name}`
      // Lo que el gesto mueve y lo que toca no cambia de un cuadro al otro:
      // se resuelve al primero y se reaprovecha hasta que el gesto cambie de
      // objetivo. El layout prestado también se reusa, para no asignar un mapa
      // nuevo por cuadro (SC-003).
      let gesture = painting.current
      if (gesture === null || gesture.key !== key) {
        gesture = {
          key,
          moved: [...tablesOfTarget(target)],
          touched: touchedRelations(model, target),
          shifted: new Map(layout),
        }
        painting.current = gesture
      }

      // El layout prestado lleva lo que se arrastra ya desplazado: el almacén
      // no se toca hasta que se suelte (FR-027).
      for (const name of gesture.moved) {
        const position = layout.get(name)
        if (position === undefined) continue
        gesture.shifted.set(name, { x: position.x + delta.x, y: position.y + delta.y })
      }
      const shifted = gesture.shifted

      for (const name of gesture.touched) {
        const detail = details.get(name)
        const group = nodes.current.get(name)
        if (detail === undefined || group === undefined) continue
        const anchors = relationAnchors(model, shifted, detail.relation)
        if (anchors === null) continue
        const lane = lanes.get(name)
        if (lane === undefined) continue
        group.line?.setAttribute('d', pathOf(anchors, lane, route))
        group.glyphA?.setAttribute(
          'd',
          glyphOf(detail.ends.to, { x: anchors.ax, y: anchors.ay }, anchors.oa),
        )
        group.glyphB?.setAttribute(
          'd',
          glyphOf(detail.ends.from, { x: anchors.bx, y: anchors.by }, anchors.ob),
        )
      }
    },
    [details, lanes, layout, model, route, tablesOfTarget],
  )

  // Un modelo o un layout nuevos invalidan lo que el gesto tenía resuelto: al
  // soltar, el almacén cambia y el gesto siguiente parte de cero.
  useEffect(() => {
    painting.current = null
  }, [layout, model])

  // El mando se deja por efecto y se recoge al desmontar: quien arrastra lo
  // llama por cuadro y no debe quedarse con un mando de una capa que ya no
  // está.
  useEffect(() => {
    if (handle === undefined) return undefined
    handle.current = { paintRelations }
    return () => {
      handle.current = null
    }
  }, [handle, paintRelations])

  return (
    <svg aria-hidden="true" className="sm-rel-layer" width="0" height="0">
      {lines.map((line) => {
        const isHot = hot?.has(line.name) === true
        const ends = details.get(line.name)?.ends
        const anchors = anchorsOf.get(line.name) ?? null
        return (
          <g
            key={line.name}
            className="sm-rel"
            data-relation={line.name}
            data-state={isHot ? 'hot' : isDimming ? 'dim' : undefined}
            style={{ '--rel': `var(--${line.color})` } as CSSProperties}
          >
            <path
              ref={(node) => {
                registerNode(nodes.current, line.name, 'line', node)
              }}
              className="sm-rel-line"
              d={line.d}
            />
            <path
              ref={(node) => {
                registerNode(nodes.current, line.name, 'glyphA', node)
              }}
              className="sm-rel-glyph"
              d={line.glyphA}
            />
            <path
              ref={(node) => {
                registerNode(nodes.current, line.name, 'glyphB', node)
              }}
              className="sm-rel-glyph"
              d={line.glyphB}
            />

            {/* El flujo es un segundo trazo discontinuo sobre el mismo `d`: su
              animación la lleva la hoja, con los tres niveles de Ajustes y
              apagada con «Reducir movimiento» (FR-024, FR-025). */}
            {isHot ? <path className="sm-rel-flow" d={line.d} /> : null}

            {isHot && ends !== undefined && anchors !== null ? (
              <g className="sm-rel-label">
                <text x={anchors.ax + anchors.oa * 18} y={anchors.ay - 7}>
                  {END_TEXT[ends.to]}
                </text>
                <text x={anchors.bx + anchors.ob * 18} y={anchors.by - 7}>
                  {END_TEXT[ends.from]}
                </text>
              </g>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Guarda —o suelta— uno de los tres nodos de una relación.
 *
 * @param map Mapa de nodos de la capa.
 * @param name Nombre técnico de la relación.
 * @param key Cuál de los tres nodos es.
 * @param node Nodo montado, o `null` al desmontarse.
 */
function registerNode(
  map: Map<string, LineNodes>,
  name: string,
  key: keyof LineNodes,
  node: SVGPathElement | null,
): void {
  const current = map.get(name) ?? { line: null, glyphA: null, glyphB: null }
  current[key] = node
  if (current.line === null && current.glyphA === null && current.glyphB === null) {
    map.delete(name)
    return
  }
  map.set(name, current)
}
