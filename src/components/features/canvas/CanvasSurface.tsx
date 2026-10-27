import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { useAppStore } from '@/store'

/**
 * Superficie del lienzo: el nodo que recorta y el nodo que se transforma
 * (research R1).
 *
 * Todo el modelo se dibuja una sola vez en coordenadas del modelo y el
 * desplazamiento y el zoom se aplican con un único `transform` en el nodo
 * interior, de modo que mover la vista no vuelve a medir nada: el navegador
 * compone la capa que ya tiene. Los gestos llegan en la historia 4; aquí solo
 * están el nodo, la rejilla de fondo y la medida de la caja, que es de lo que
 * viven «Ajustar», el foco y el minimapa.
 */

/** Props de la superficie. */
export interface CanvasSurfaceProps {
  /** Lo que se dibuja en coordenadas del modelo: zonas y tablas. */
  children: ReactNode
  /** Lo que va fijo sobre el lienzo: minimapa, barra de zoom, tarjetas. */
  overlay?: ReactNode
  className?: string
}

export function CanvasSurface({ children, overlay, className }: CanvasSurfaceProps) {
  const pan = useAppStore((state) => state.pan)
  const zoom = useAppStore((state) => state.zoom)
  const isGesturing = useAppStore((state) => state.isGesturing)
  const setViewport = useAppStore((state) => state.setViewport)
  const surface = useRef<HTMLDivElement>(null)

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
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          willChange: 'transform',
        }}
      >
        {children}
      </div>

      {overlay}
    </div>
  )
}
