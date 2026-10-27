import { useMemo, useRef } from 'react'

import { TABLE_HEIGHT, TABLE_WIDTH, type Rect } from '@/lib/canvas/constants'
import { contentBounds, schemaZones } from '@/lib/canvas/geometry'
import { resolveLayout } from '@/lib/canvas/layout'
import { resolveSchemaColor } from '@/lib/model/colors'
import { useAppStore } from '@/store'

/**
 * Minimapa del modelo, abajo a la derecha (FR-012).
 *
 * Es el mapa de todo lo que hay, a la escala que haga falta para que entre
 * entero: el contorno de cada zona con su color, una marca por tabla y el
 * recuadro de lo que se está viendo. Pulsar o arrastrar dentro lleva la vista a
 * ese punto sin cambiar el zoom, que es lo que lo hace útil cuando el modelo no
 * cabe en la pantalla.
 *
 * Toda la geometría sale de las mismas funciones puras que el lienzo, así que
 * el minimapa no puede discrepar de lo que se dibuja (research R11).
 */

/** Ancho del minimapa. */
const WIDTH = 168

/** Alto del minimapa. */
const HEIGHT = 108

/** Aire interior, para que una zona en el borde no se pegue al marco. */
const PADDING = 6

/** Lo que hace falta para pasar de coordenadas del modelo al minimapa. */
interface Projection {
  scale: number
  offsetX: number
  offsetY: number
}

/** Proyección que deja el envolvente centrado dentro del minimapa. */
function project(bounds: Rect | null): Projection {
  if (bounds === null || bounds.width <= 0 || bounds.height <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }
  const scale = Math.min(
    (WIDTH - PADDING * 2) / bounds.width,
    (HEIGHT - PADDING * 2) / bounds.height,
  )
  return {
    offsetX: (WIDTH - bounds.width * scale) / 2 - bounds.x * scale,
    offsetY: (HEIGHT - bounds.height * scale) / 2 - bounds.y * scale,
    scale,
  }
}

/** Un rectángulo del modelo, en píxeles del minimapa. */
function placed(rect: Rect, projection: Projection) {
  return {
    left: rect.x * projection.scale + projection.offsetX,
    top: rect.y * projection.scale + projection.offsetY,
    width: Math.max(rect.width * projection.scale, 1),
    height: Math.max(rect.height * projection.scale, 1),
  }
}

export function Minimap() {
  const model = useAppStore((state) => state.model)
  const pan = useAppStore((state) => state.pan)
  const zoom = useAppStore((state) => state.zoom)
  const viewport = useAppStore((state) => state.viewport)
  const centerOn = useAppStore((state) => state.centerOn)
  const frame = useRef<HTMLButtonElement>(null)
  const pointer = useRef<number | null>(null)

  const { zones, tables, projection } = useMemo(() => {
    if (model === null) {
      return { zones: [], tables: [], projection: project(null) }
    }
    const layout = resolveLayout(model)
    const list = schemaZones(model, layout)
    const colors = new Map(
      model.schemas.map((schema) => [schema.name, resolveSchemaColor(schema.color)]),
    )
    return {
      zones: list,
      tables: (model.tables ?? []).flatMap((table) => {
        const position = layout.get(table.name)
        if (position === undefined) return []
        return [
          {
            name: table.name,
            color: colors.get(table.schema) ?? 'gray',
            rect: { ...position, width: TABLE_WIDTH, height: TABLE_HEIGHT },
          },
        ]
      }),
      projection: project(contentBounds(list)),
    }
  }, [model])

  // Lo que se está viendo, en coordenadas del modelo: la vista es la inversa
  // del `transform` del lienzo.
  const visible: Rect = {
    x: -pan.x / zoom,
    y: -pan.y / zoom,
    width: viewport.width / zoom,
    height: viewport.height / zoom,
  }

  /** Lleva la vista al punto del modelo que señala el puntero (FR-012). */
  function goTo(event: React.PointerEvent<HTMLButtonElement>) {
    const node = frame.current
    if (node === null) return
    const box = node.getBoundingClientRect()
    centerOn({
      x: (event.clientX - box.left - projection.offsetX) / projection.scale,
      y: (event.clientY - box.top - projection.offsetY) / projection.scale,
    })
  }

  return (
    <button
      ref={frame}
      type="button"
      aria-label="Minimapa del modelo"
      className="sm-minimap"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        pointer.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        goTo(event)
      }}
      onPointerMove={(event) => {
        if (pointer.current !== event.pointerId) return
        goTo(event)
      }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return
        pointer.current = null
      }}
      onPointerCancel={() => {
        pointer.current = null
      }}
    >
      {zones.map((zone) => (
        <span
          key={zone.schema}
          aria-hidden="true"
          data-zone={zone.schema}
          className="sm-minimap-zone"
          style={{ ...placed(zone.rect, projection), '--zone': `var(--${zone.color})` } as React.CSSProperties}
        />
      ))}

      {tables.map((table) => (
        <span
          key={table.name}
          aria-hidden="true"
          data-table={table.name}
          className="sm-minimap-mark"
          style={{ ...placed(table.rect, projection), '--zone': `var(--${table.color})` } as React.CSSProperties}
        />
      ))}

      <span aria-hidden="true" data-view="" className="sm-minimap-view" style={placed(visible, projection)} />
    </button>
  )
}
