import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** Props del diálogo. */
export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Título centrado en la cabecera. */
  title: string
  /** Descripción breve para el lector de pantalla. */
  description?: string
  /** Pestañas de la cabecera, debajo del título. */
  tabs?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Diálogo con cromo de ventana, como lo dibuja el lienzo: cabecera con el
 * botón de cerrar y el título centrado, cuerpo propio y velo sobre toda la
 * ventana.
 *
 * Sobre Radix: la trampa de foco, el cierre con Escape y el rol los aporta el
 * primitivo. El botón de cerrar va al final del marcado, aunque se dibuje
 * arriba a la izquierda, para que el foco entre primero en el contenido.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  tabs,
  children,
  className,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="sm-scrim fixed inset-0 bg-scrim" />
        <RadixDialog.Content
          className={cn(
            // El margen negativo centra en vez de `-translate-x-1/2`: la
            // animación de entrada termina en `transform: none` y se la comería.
            'sm-dialog fixed left-1/2 top-[40px] ml-[-300px] flex w-[600px]',
            'flex-col overflow-hidden rounded-xl bg-window shadow-window',
            className,
          )}
        >
          <div className="border-b-[length:var(--hairline)] border-separator bg-sidebar">
            <div className="relative flex h-[38px] items-center justify-center">
              <RadixDialog.Title className="text-[13px] font-semibold leading-[18px] text-label">
                {title}
              </RadixDialog.Title>
            </div>
            {tabs ? (
              <div
                role="tablist"
                aria-label="Secciones de ajustes"
                className="flex justify-center gap-1 pb-2"
              >
                {tabs}
              </div>
            ) : null}
          </div>

          {description ? (
            <RadixDialog.Description className="sr-only">{description}</RadixDialog.Description>
          ) : null}

          {children}

          <RadixDialog.Close
            aria-label="Cerrar"
            title="Cerrar"
            className="absolute left-[14px] top-[13px] h-3 w-3 rounded-full shadow-[inset_0_0_0_var(--hairline)_rgba(0,0,0,0.14)] active:brightness-90"
            style={{ background: 'var(--traffic-close)' }}
          />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
