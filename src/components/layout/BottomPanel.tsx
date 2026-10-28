import { useRef } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import type { TabItem } from '@/components/ui/Tabs'
import {
  FIELDS_PANEL_MAX_HEIGHT,
  FIELDS_PANEL_MIN_HEIGHT,
  FIELDS_PANEL_STEP,
} from '@/store/fieldsPanel'
import type { PanelTab } from '@/store/fieldsPanel'
import { useAppStore } from '@/store'
import type { Table } from '@/lib/model/types'

/**
 * Marco del panel inferior del Editor, con sus dos fichas (FR-003, FR-022,
 * FR-023).
 *
 * El panel cede su alto al lienzo: va debajo de él y encima de la barra de
 * estado, así que al abrirlo el lienzo se encoge y al cerrarlo lo recupera,
 * sin que la barra lateral ni el inspector se muevan.
 *
 * Desde el Incremento 4 es el «Editor de tabla» y no solo el de campos: la
 * lista de fichas vive aquí, y el contenido de la que esté activa lo decide
 * quien usa el panel. El tirador es un `role="separator"` enfocable: con el
 * puntero sigue el gesto y con el teclado cambia el alto en pasos de 24 px, y
 * la preferencia se escribe al soltar, no en cada `pointermove`
 * (contracts/tables.md §2.3).
 */

/** Props del panel. */
export interface BottomPanelProps {
  /** Tabla abierta; de ella salen los dos contadores de las fichas. */
  table: Table
  /** Contenido de la ficha activa. */
  children: ReactNode
}

export function BottomPanel({ table, children }: BottomPanelProps) {
  const height = useAppStore((state) => state.fieldsPanelHeight)
  const setHeight = useAppStore((state) => state.setFieldsPanelHeight)
  const closeFieldsPanel = useAppStore((state) => state.closeFieldsPanel)
  const panelTab = useAppStore((state) => state.panelTab)
  const setPanelTab = useAppStore((state) => state.setPanelTab)
  const relations = useAppStore((state) => state.model?.relations)

  /** Las dos fichas con su contador (FR-034). */
  const items: Array<TabItem<PanelTab>> = [
    { value: 'fields', label: 'Campos', count: table.fields.length },
    {
      value: 'foreignKeys',
      label: 'Claves foráneas',
      count: (relations ?? []).filter((relation) => relation.fromTable === table.name).length,
    },
  ]

  /**
   * Gesto del tirador: dónde empezó, con qué alto y el último que calculó.
   *
   * El último hace falta al soltar: el `height` de este render es el de antes
   * del movimiento, y escribir ese en la preferencia devolvía el panel a su
   * alto anterior en cuanto se soltaba el tirador.
   */
  const drag = useRef<{ y: number; height: number; last: number } | null>(null)

  /** Empieza a arrastrar el tirador. */
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    drag.current = { y: event.clientY, height, last: height }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  /** Sigue el gesto: el panel crece hacia arriba. */
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (start === null) return
    const next = start.height + (start.y - event.clientY)
    start.last = next
    setHeight(next)
  }

  /** Suelta el tirador y escribe la preferencia. */
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (start === null) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setHeight(start.last, true)
  }

  /** Cambia el alto con el teclado, en pasos de 24 px (FR-022, FR-046). */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const next =
      event.key === 'ArrowUp'
        ? height + FIELDS_PANEL_STEP
        : event.key === 'ArrowDown'
          ? height - FIELDS_PANEL_STEP
          : event.key === 'Home'
            ? FIELDS_PANEL_MAX_HEIGHT
            : event.key === 'End'
              ? FIELDS_PANEL_MIN_HEIGHT
              : null
    if (next === null) return
    event.preventDefault()
    setHeight(next, true)
  }

  return (
    <section aria-label="Editor de tabla" className="sm-fields-panel relative" style={{ height }}>
      <div
        role="separator"
        aria-label="Cambiar el alto del editor de tabla"
        aria-orientation="horizontal"
        aria-valuenow={height}
        aria-valuemin={FIELDS_PANEL_MIN_HEIGHT}
        aria-valuemax={FIELDS_PANEL_MAX_HEIGHT}
        tabIndex={0}
        className="sm-panel-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      />

      <div className="sm-panel-tabs">
        <Tabs
          value={panelTab}
          onValueChange={setPanelTab}
          items={items}
          label="Secciones de la tabla"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      <Button
        icon="x"
        size="sm"
        aria-label="Cerrar el editor de tabla"
        className="absolute right-2 top-2"
        onClick={closeFieldsPanel}
      />
    </section>
  )
}
