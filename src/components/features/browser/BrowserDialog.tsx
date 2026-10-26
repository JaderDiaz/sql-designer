import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** Props del marco de los diálogos de archivo. */
export interface BrowserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Texto accesible del diálogo; no se dibuja, el marco no tiene título. */
  label: string
  /** Ancho y alto en píxeles, como los fija el lienzo. */
  width?: number
  height?: number
  /** Explorador y panel de vista previa. */
  children: ReactNode
  /** Barra inferior con el formato y los botones. */
  footer?: ReactNode
  /**
   * Escape dentro del diálogo. Llamar a `preventDefault` lo deja abierto, que
   * es lo que hace Elegir carpeta mientras se escribe el nombre de una carpeta
   * nueva: ahí Escape cancela el nombre, no el diálogo.
   */
  onEscapeKeyDown?: (event: KeyboardEvent) => void
  className?: string
}

/**
 * Marco de los diálogos de archivo: una ventana propia de 780 × 456 con su
 * cromo, no una hoja (`Sheet`). La usan Abrir modelo y Elegir carpeta.
 *
 * El título va solo para el lector de pantalla, porque el lienzo no dibuja
 * ninguno: la barra superior ya dice en qué carpeta se está.
 *
 * Sobre Radix: la trampa de foco, el cierre con Escape y el velo los aporta el
 * primitivo (principio V).
 */
export function BrowserDialog({
  open,
  onOpenChange,
  label,
  width = 780,
  height = 456,
  children,
  footer,
  onEscapeKeyDown,
  className,
}: BrowserDialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="sm-scrim fixed inset-0 bg-scrim" />
        <RadixDialog.Content
          aria-label={label}
          onEscapeKeyDown={onEscapeKeyDown}
          style={{ width, height, marginLeft: -width / 2, marginTop: -height / 2 }}
          className={cn(
            // Margen negativo en vez de `translate`: la animación de entrada
            // termina en `transform: none` y se lo comería.
            'sm-sheet fixed left-1/2 top-1/2 box-border flex flex-col overflow-hidden',
            'rounded-xl bg-window shadow-window',
            className,
          )}
        >
          <RadixDialog.Title className="sr-only">{label}</RadixDialog.Title>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          {footer ? (
            <div className="flex h-14 flex-none items-center gap-2 border-t-[0.5px] border-separator px-4">
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
