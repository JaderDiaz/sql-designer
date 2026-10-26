import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** Props de la región que desplaza. */
export interface ScrollRegionProps {
  children: ReactNode
  className?: string
  /** Etiqueta accesible cuando la región es la que desplaza el contenido. */
  label?: string
  /** Marca el fondo de la región como zona para arrastrar la ventana. */
  dragRegion?: boolean
}

/**
 * Región que desplaza su propio contenido para que la ventana nunca desplace
 * (RS-01, FR-011).
 *
 * El desplazamiento va en estilos en línea a propósito: es comportamiento, no
 * apariencia, y así se puede verificar en las pruebas sin resolver Tailwind.
 */
export function ScrollRegion({ children, className, label, dragRegion }: ScrollRegionProps) {
  return (
    <div
      data-scroll-region=""
      data-tauri-drag-region={dragRegion ? '' : undefined}
      tabIndex={-1}
      aria-label={label}
      className={cn('min-h-0 flex-1', className)}
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
        // Al llegar con el tabulador, el navegador pega el elemento al borde
        // de la región y le corta el anillo de foco: este margen se lo deja.
        scrollPadding: 10,
      }}
    >
      {children}
    </div>
  )
}
