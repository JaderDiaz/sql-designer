import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { SchemaZone } from '@/components/features/canvas/SchemaZone'
import { TableCard } from '@/components/features/canvas/TableCard'
import { SchemaContextMenu } from '@/components/features/schema/SchemaContextMenu'
import { TableContextMenu } from '@/components/features/table/TableContextMenu'
import { GRID_SNAP, TABLE_WIDTH, tableHeight } from '@/lib/canvas/constants'
import { schemaZones, zoneAt } from '@/lib/canvas/geometry'
import { toModelPoint } from '@/lib/canvas/zoom'
import { resolveSchemaColor } from '@/lib/model/colors'
import { isBlankModel } from '@/lib/model/defaults'
import { resolveLayout } from '@/lib/canvas/layout'
import { cn } from '@/lib/cn'
import { capturePointer } from '@/lib/pointer'
import { useCanvasView } from '@/hooks/useCanvasView'
import { useAppStore } from '@/store'

/**
 * Superficie del lienzo: el nodo que recorta y los dos que se transforman
 * (research R1).
 *
 * Todo el modelo se dibuja una sola vez en coordenadas del modelo y la vista
 * se aplica con dos `transform` encadenados: `.sm-frame` desplaza y
 * `.sm-stage`, dentro, escala. Son dos y no uno porque la capa que el
 * compositor promueve para que arrastrar vaya fluido guarda su contenido
 * rasterizado a una sola escala: con el zoom dentro de ella, el texto se veía
 * pixelado al acercar. Dejando la escala fuera, la capa guarda el modelo ya
 * dibujado a su tamaño y mover la vista no vuelve a medir nada. Ni las zonas
 * ni las tarjetas leen `pan` ni `zoom`: no saben a qué escala se están
 * dibujando.
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

/** Qué se está arrastrando: la zona de un esquema o una tarjeta de tabla. */
interface DragTarget {
  kind: 'schema' | 'table'
  name: string
}

/** Lo que hace falta recordar del gesto en curso. */
interface DragState extends DragTarget {
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
  const selectedTable = useAppStore((state) => state.selectedTable)
  const selectSchema = useAppStore((state) => state.selectSchema)
  const selectTable = useAppStore((state) => state.selectTable)
  const openTableDialog = useAppStore((state) => state.openTableDialog)
  const openFieldsPanel = useAppStore((state) => state.openFieldsPanel)
  const setViewport = useAppStore((state) => state.setViewport)
  const needsCenter = useAppStore((state) => state.needsCenter)
  const centerOnModel = useAppStore((state) => state.centerOnModel)
  const setGesturing = useAppStore((state) => state.setGesturing)
  const moveSchema = useAppStore((state) => state.moveSchema)
  const moveTable = useAppStore((state) => state.moveTable)

  const surface = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  // Qué se arrastra es lo único del gesto que el árbol necesita saber, y solo
  // cambia dos veces: al empezar y al terminar.
  const [dragging, setDragging] = useState<DragTarget | null>(null)

  // Mover la vista y hacer zoom son del gesto, no de este componente: el
  // lienzo solo le presta sus tres nodos.
  const view = useCanvasView({ surface, frame, stage, grid })

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

  // Abrir un modelo lo deja entero a la vista, pero solo se puede encuadrar
  // cuando la caja del lienzo ya está medida (FR-014).
  useEffect(() => {
    if (needsCenter) centerOnModel()
  }, [centerOnModel, needsCenter])

  // La geometría se recalcula solo cuando el modelo cambia: mover la vista no
  // la toca, porque no depende de ella.
  const { layout, zones } = useMemo(() => {
    const vacio = { layout: new Map<string, { x: number; y: number }>(), zones: [] }
    // Un modelo recién creado llega en blanco: ni siquiera se dibuja la zona
    // de su esquema por defecto, porque lo que ocupa el lienzo entonces es la
    // tarjeta que dice por dónde empezar (FR-005a).
    if (model === null || isBlankModel(model)) return vacio
    const resolved = resolveLayout(model)
    return { layout: resolved, zones: schemaZones(model, resolved) }
  }, [model])

  const tables = model?.tables ?? []

  /**
   * Pasa un punto de la ventana a coordenadas del modelo.
   *
   * @param event Gesto del puntero sobre el lienzo.
   */
  function pointOf(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = surface.current?.getBoundingClientRect()
    const x = event.clientX - (rect?.left ?? 0)
    const y = event.clientY - (rect?.top ?? 0)
    return toModelPoint({ pan, zoom }, { x, y })
  }

  /** Doble clic en el lienzo: abre Nueva tabla en ese punto (FR-006). */
  function onDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    // El doble clic sobre una tarjeta abre su editor de campos, no un diálogo
    // (FR-023): aquí solo cuentan el fondo y las zonas.
    if (target.closest('.sm-table') !== null) return
    // Y solo el lienzo cuenta como lienzo. Los mandos que flotan encima —el
    // zoom, el minimapa, la tarjeta del modelo vacío— viven dentro de este
    // nodo, así que sus dobles clics llegaban hasta aquí: pulsar dos veces
    // seguidas en «Acercar» abría Nueva tabla.
    const onCanvas =
      target === event.currentTarget || target.closest('.sm-frame, .sm-stage, .sm-zone') !== null
    if (!onCanvas) return
    const point = pointOf(event)
    openTableDialog({ x: Math.round(point.x), y: Math.round(point.y) })
  }

  /** Escribe el desplazamiento del gesto en las variables del grupo. */
  function paintDrag(x: number, y: number) {
    stage.current?.style.setProperty('--drag-x', `${x}px`)
    stage.current?.style.setProperty('--drag-y', `${y}px`)
  }

  /**
   * Empieza a arrastrar una tarjeta o la zona de un esquema (FR-026, FR-030).
   *
   * La tarjeta manda sobre la zona que tiene debajo: pulsar una tabla mueve la
   * tabla, no su esquema, porque el `pointerdown` de la tarjeta no llega al
   * nodo de la zona.
   *
   * @param event Gesto del puntero.
   * @param target Qué se arrastra.
   */
  function startDrag(event: React.PointerEvent<HTMLButtonElement>, target: DragTarget) {
    // Solo el botón principal arrastra: el derecho abre el menú contextual y
    // el central mueve la vista (FR-007, FR-038). Con la barra espaciadora
    // mantenida, arrastrar encima de una zona mueve la vista, no el esquema.
    if (event.button !== 0 || view.isPanning() || drag.current !== null) return
    capturePointer(event.currentTarget, event.pointerId)
    drag.current = {
      ...target,
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
      setDragging({ kind: current.kind, name: current.name })
      setGesturing(true)
    }

    // El puntero se mide en píxeles de la pantalla y el modelo vive en sus
    // propias coordenadas: el zoom es la conversión entre los dos.
    current.deltaX = screenX / zoom
    current.deltaY = screenY / zoom
    paintDrag(current.deltaX, current.deltaY)
    // Si el gesto llega al borde, la vista sigue a lo que se arrastra, para
    // poder dejarlo fuera de lo que se ve al empezar (US4, escenario 7).
    view.edgeFollow(event.clientX, event.clientY)
  }

  /**
   * Suelta lo que se arrastraba y guarda el gesto entero en un solo paso
   * (FR-027, FR-030 a FR-032).
   *
   * Una tabla soltada dentro de la zona de otro esquema pasa a ese esquema; la
   * zona la decide el punto del puntero, no la caja de la tarjeta, y fuera de
   * toda zona la tabla se queda en el suyo (FR-031). El ajuste a la cuadrícula
   * lo aplica `moveTable` al guardar, no el gesto (FR-032).
   */
  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (current === null || event.pointerId !== current.pointerId) return
    drag.current = null
    paintDrag(0, 0)

    if (!current.moved) return
    setDragging(null)
    setGesturing(false)
    const delta = { x: Math.round(current.deltaX), y: Math.round(current.deltaY) }
    if (current.kind === 'schema') {
      if (delta.x !== 0 || delta.y !== 0) moveSchema(current.name, delta)
      return
    }
    const zone = zoneAt(zones, pointOf(event))
    moveTable(current.name, delta, zone === null ? {} : { schema: zone.schema })
  }

  /** Mueve la tabla seleccionada con las flechas del teclado (FR-034). */
  function moveWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (selectedTable === null) return false
    const step = event.shiftKey ? GRID_SNAP : 1
    const deltas: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }
    const delta = deltas[event.key]
    if (delta === undefined || event.metaKey || event.ctrlKey || event.altKey) return false
    event.preventDefault()
    const table = tables.find((item) => item.name === selectedTable)
    const base = table?.position ?? layout.get(selectedTable)
    // La zona de destino se decide por el centro de la tarjeta, que es lo que
    // se está moviendo: con el teclado no hay puntero al que mirar (FR-031).
    const center =
      base === undefined
        ? null
        : {
            x: base.x + delta.x + TABLE_WIDTH / 2,
            y: base.y + delta.y + tableHeight(table?.fields.length ?? 1) / 2,
          }
    const zone = center === null ? null : zoneAt(zones, center)
    moveTable(selectedTable, delta, zone === null ? {} : { schema: zone.schema })
    return true
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
      onPointerDown={(event) => {
        // Pulsar el fondo suelta la selección: el inspector vuelve a la ficha
        // del modelo (FR-007a).
        if (event.target === event.currentTarget) {
          if (selectedTable !== null) selectTable(null)
          if (selectedSchema !== null) selectSchema(null)
        }
        view.onPointerDown(event)
      }}
      onPointerMove={view.onPointerMove}
      onPointerUp={view.onPointerUp}
      onPointerCancel={view.onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          if (selectedTable === null) return
          event.preventDefault()
          selectTable(null)
          return
        }
        moveWithKeyboard(event)
      }}
    >
      <div
        ref={grid}
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--label) 12%, transparent) 1px, transparent 0)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      <div
        ref={frame}
        className="sm-frame absolute left-0 top-0"
        // Sin la tercera dimensión: `translate3d` deja el nodo en una capa
        // del compositor, y una capa guarda lo suyo rasterizado a una escala
        // y lo estira, que es lo que pixelaba el texto al acercar y al
        // arrastrar.
        style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
      >
        <div
          ref={stage}
          className="sm-stage absolute left-0 top-0 origin-top-left"
          style={{ transform: `scale(${zoom})` }}
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
                  isDragging={dragging?.kind === 'schema' && dragging.name === zone.schema}
                  onPointerDown={(event) => startDrag(event, { kind: 'schema', name: zone.schema })}
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
              <TableContextMenu key={table.name} table={table}>
                <TableCard
                  table={table}
                  position={position}
                  schema={table.schema}
                  abbreviation={schema?.abbreviation ?? ''}
                  color={resolveSchemaColor(schema?.color)}
                  relations={model?.relations ?? []}
                  isSelected={selectedTable === table.name}
                  isDim={focusedSchema !== null && focusedSchema !== table.schema}
                  // La tarjeta acompaña al grupo cuando se arrastra su esquema
                  // y se mueve sola cuando se arrastra ella (FR-026, FR-030).
                  isDragging={
                    dragging !== null &&
                    (dragging.kind === 'schema'
                      ? dragging.name === table.schema
                      : dragging.name === table.name)
                  }
                  onSelect={() => selectTable(table.name)}
                  onOpenFields={() => openFieldsPanel(table.name)}
                  onPointerDown={(event) => startDrag(event, { kind: 'table', name: table.name })}
                  onPointerMove={continueDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              </TableContextMenu>
            )
          })}
        </div>
      </div>

      {overlay}
    </div>
  )
}
