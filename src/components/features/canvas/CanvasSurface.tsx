import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { SchemaZone } from '@/components/features/canvas/SchemaZone'
import { TableCard } from '@/components/features/canvas/TableCard'
import { SchemaContextMenu } from '@/components/features/schema/SchemaContextMenu'
import { schemaZones } from '@/lib/canvas/geometry'
import { resolveLayout } from '@/lib/canvas/layout'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store'

/**
 * Superficie del lienzo: el nodo que recorta y el nodo que se transforma
 * (research R1).
 *
 * Todo el modelo se dibuja una sola vez en coordenadas del modelo y el
 * desplazamiento y el zoom se aplican con un único `transform` en el nodo
 * interior, de modo que mover la vista no vuelve a medir nada: el navegador
 * compone la capa que ya tiene. Ni las zonas ni las tarjetas leen `pan` ni
 * `zoom`: no saben a qué escala se están dibujando.
 *
 * Arrastrar una zona tampoco pasa por el almacén mientras el dedo está abajo:
 * el grupo que se mueve lleva `data-drag` y se desplaza con dos variables CSS
 * que se escriben por referencia, así que el gesto no provoca ni un render. Al
 * soltar se hace una sola llamada a `moveSchema`, que es el único paso de
 * deshacer del gesto (FR-026, FR-027, research R3).
 */

/** Props de la superficie. */
export interface CanvasSurfaceProps {
  /** Lo que va fijo sobre el lienzo: minimapa, barra de zoom, tarjetas. */
  overlay?: ReactNode
  className?: string
}

/** Desde cuántos píxeles de recorrido el gesto cuenta como arrastre. */
const DRAG_THRESHOLD = 3

/** Lo que hace falta recordar del gesto en curso. */
interface DragState {
  schema: string
  pointerId: number
  /** Punto de partida del puntero, en coordenadas de la ventana. */
  originX: number
  originY: number
  /** Desplazamiento acumulado, en coordenadas del modelo. */
  deltaX: number
  deltaY: number
  /** Si ya se pasó el umbral: antes de eso el gesto todavía puede ser un clic. */
  moved: boolean
}

export function CanvasSurface({ overlay, className }: CanvasSurfaceProps) {
  const model = useAppStore((state) => state.model)
  const pan = useAppStore((state) => state.pan)
  const zoom = useAppStore((state) => state.zoom)
  const isGesturing = useAppStore((state) => state.isGesturing)
  const focusedSchema = useAppStore((state) => state.focusedSchema)
  const selectedSchema = useAppStore((state) => state.selectedSchema)
  const selectSchema = useAppStore((state) => state.selectSchema)
  const setViewport = useAppStore((state) => state.setViewport)
  const setGesturing = useAppStore((state) => state.setGesturing)
  const moveSchema = useAppStore((state) => state.moveSchema)

  const surface = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  // Qué esquema se arrastra es lo único del gesto que el árbol necesita saber,
  // y solo cambia dos veces: al empezar y al terminar.
  const [dragging, setDragging] = useState<string | null>(null)

  // La caja del lienzo se mide al montar y en cada cambio de tamaño: esconder
  // la barra lateral o el inspector la cambia sin que la ventana se mueva.
  useEffect(() => {
    const node = surface.current
    if (node === null) return undefined

    const measure = () => {
      const rect = node.getBoundingClientRect()
      setViewport({ x: 0, y: 0, width: rect.width, height: rect.height })
    }
    measure()

    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [setViewport])

  // La geometría se recalcula solo cuando el modelo cambia: mover la vista no
  // la toca, porque no depende de ella.
  const { layout, zones } = useMemo(() => {
    if (model === null) return { layout: new Map<string, { x: number; y: number }>(), zones: [] }
    const resolved = resolveLayout(model)
    return { layout: resolved, zones: schemaZones(model, resolved) }
  }, [model])

  const tables = model?.tables ?? []

  /** Escribe el desplazamiento del gesto en las variables del grupo. */
  function paintDrag(x: number, y: number) {
    stage.current?.style.setProperty('--drag-x', `${x}px`)
    stage.current?.style.setProperty('--drag-y', `${y}px`)
  }

  /** Empieza a arrastrar la zona de un esquema (FR-026). */
  function startDrag(event: React.PointerEvent<HTMLButtonElement>, schema: string) {
    // Solo el botón principal arrastra: el derecho abre el menú contextual y
    // el central mueve la vista (FR-007, FR-038).
    if (event.button !== 0 || drag.current !== null) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      schema,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      deltaX: 0,
      deltaY: 0,
      moved: false,
    }
  }

  /** Mueve el grupo con el puntero, sin tocar el almacén. */
  function continueDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (current === null || event.pointerId !== current.pointerId) return

    const screenX = event.clientX - current.originX
    const screenY = event.clientY - current.originY
    if (!current.moved) {
      if (Math.abs(screenX) < DRAG_THRESHOLD && Math.abs(screenY) < DRAG_THRESHOLD) return
      current.moved = true
      setDragging(current.schema)
      setGesturing(true)
    }

    // El puntero se mide en píxeles de la pantalla y el modelo vive en sus
    // propias coordenadas: el zoom es la conversión entre los dos.
    current.deltaX = screenX / zoom
    current.deltaY = screenY / zoom
    paintDrag(current.deltaX, current.deltaY)
  }

  /** Suelta la zona y guarda el gesto entero en un solo paso (FR-027). */
  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (current === null || event.pointerId !== current.pointerId) return
    drag.current = null
    paintDrag(0, 0)

    if (!current.moved) return
    setDragging(null)
    setGesturing(false)
    const delta = { x: Math.round(current.deltaX), y: Math.round(current.deltaY) }
    if (delta.x !== 0 || delta.y !== 0) moveSchema(current.schema, delta)
  }

  return (
    <div
      ref={surface}
      role="application"
      aria-label="Lienzo del modelo"
      // El lienzo recibe el foco para que las flechas muevan la vista y Esc
      // quite el foco del esquema (FR-031, FR-039).
      tabIndex={0}
      className={cn('sm-canvas relative min-h-0 flex-1 overflow-hidden', className)}
      data-gesturing={isGesturing ? '' : undefined}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--label) 12%, transparent) 1px, transparent 0)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      <div
        ref={stage}
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          willChange: 'transform',
        }}
      >
        {zones.map((zone) => {
          const schema = model?.schemas.find((candidate) => candidate.name === zone.schema)
          if (schema === undefined) return null
          return (
            <SchemaContextMenu key={zone.schema} schema={schema} tableCount={zone.tableCount}>
              <SchemaZone
                zone={zone}
                schema={schema}
                isSelected={selectedSchema === zone.schema}
                isDim={focusedSchema !== null && focusedSchema !== zone.schema}
                isDragging={dragging === zone.schema}
                onPointerDown={(event) => startDrag(event, zone.schema)}
                onPointerMove={continueDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClick={() => selectSchema(zone.schema)}
              />
            </SchemaContextMenu>
          )
        })}

        {tables.map((table) => {
          const position = layout.get(table.name)
          if (position === undefined) return null
          const schema = model?.schemas.find((candidate) => candidate.name === table.schema)
          return (
            <TableCard
              key={table.name}
              table={table}
              position={position}
              schema={table.schema}
              abbreviation={schema?.abbreviation ?? ''}
              isDim={focusedSchema !== null && focusedSchema !== table.schema}
              isDragging={dragging === table.schema}
            />
          )
        })}
      </div>

      {overlay}
    </div>
  )
}
