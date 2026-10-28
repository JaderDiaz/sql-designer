import { useRef } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import {
  FIELDS_PANEL_MAX_HEIGHT,
  FIELDS_PANEL_MIN_HEIGHT,
  FIELDS_PANEL_STEP,
} from '@/store/fieldsPanel'
import { useAppStore } from '@/store'

/**
 * Marco del panel inferior del Editor (FR-022, FR-023).
 *
 * El panel cede su alto al lienzo: va debajo de él y encima de la barra de
 * estado, así que al abrirlo el lienzo se encoge y al cerrarlo lo recupera,
 * sin que la barra lateral ni el inspector se muevan.
 *
 * El tirador es un `role="separator"` enfocable: con el puntero sigue el
 * gesto y con el teclado cambia el alto en pasos de 24 px. La preferencia se
 * escribe al soltar, no en cada `pointermove` (contracts/tables.md §2.3).
 */

/** Props del panel. */
export interface BottomPanelProps {
  /** Contenido del panel: la cabecera y la rejilla de campos. */
  children: ReactNode
}

export function BottomPanel({ children }: BottomPanelProps) {
  const height = useAppStore((state) => state.fieldsPanelHeight)
  const setHeight = useAppStore((state) => state.setFieldsPanelHeight)
  const closeFieldsPanel = useAppStore((state) => state.closeFieldsPanel)

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
    <section
      aria-label="Editor de campos"
      className="sm-fields-panel relative"
      style={{ height }}
    >
      <div
        role="separator"
        aria-label="Cambiar el alto del editor de campos"
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

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      <Button
        icon="x"
        size="sm"
        aria-label="Cerrar el editor de campos"
        className="absolute right-2 top-2"
        onClick={closeFieldsPanel}
      />
    </section>
  )
}
