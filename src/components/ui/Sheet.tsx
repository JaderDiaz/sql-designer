import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Props de la hoja. */
export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Frase que explica para qué sirve la hoja. */
  description?: string
  /** Icono de la cabecera, en su cuadro de color suave. */
  icon?: IconName
  /** Clase del cuadro del icono, para su color de fondo. */
  iconClassName?: string
  /** Clase del icono, para su color; por defecto el azul del sistema. */
  iconColorClassName?: string
  /** Ancho en píxeles, como lo fija el lienzo para cada hoja. */
  width?: number
  /** Qué se ve al pie, normalmente los botones. */
  footer?: ReactNode
  /** Si el contenido se envía como formulario al pulsar Enter. */
  onSubmit?: () => void
  children?: ReactNode
  className?: string
}

/**
 * Hoja: el diálogo de contenido del lienzo, el que usan Nuevo modelo,
 * Renombrar y las confirmaciones.
 *
 * Se distingue de `Dialog`, que dibuja una ventana con su cromo y pestañas:
 * la hoja es una tarjeta centrada con cabecera de icono, cuerpo y pie, y entra
 * con el resorte suave del lienzo.
 *
 * Sobre Radix: la trampa de foco, el cierre con Escape y los enlaces de
 * título y descripción los aporta el primitivo (principio V).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  icon,
  iconClassName,
  iconColorClassName = 'text-blue',
  width = 440,
  footer,
  onSubmit,
  children,
  className,
}: SheetProps) {
  const body = (
    <>
      <div className="flex items-start gap-3">
        {icon ? (
          <span
            className={cn(
              'flex h-9 w-9 flex-none items-center justify-center rounded-md',
              iconClassName ?? 'bg-accent-soft',
            )}
          >
            <Icon name={icon} size={18} className={iconColorClassName} />
          </span>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <RadixDialog.Title className="m-0 text-[17px] font-semibold leading-[22px]">
            {title}
          </RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="m-0 text-[12px] leading-4 text-label-secondary">
              {description}
            </RadixDialog.Description>
          ) : null}
        </div>
      </div>
      {children}
      {footer ? <div className="flex justify-end gap-2 pt-1">{footer}</div> : null}
    </>
  )

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="sm-scrim fixed inset-0 bg-scrim" />
        <RadixDialog.Content
          style={{ width, marginLeft: -width / 2 }}
          className={cn(
            // El margen negativo centra en vez de `-translate-x-1/2`: la
            // animación de entrada termina en `transform: none` y se la comería.
            'sm-sheet fixed left-1/2 top-[34px] box-border flex flex-col gap-5',
            'rounded-xl bg-raised p-5 shadow-window',
            className,
          )}
        >
          {onSubmit ? (
            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault()
                onSubmit()
              }}
            >
              {body}
            </form>
          ) : (
            body
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
