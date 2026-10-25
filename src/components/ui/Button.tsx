import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Variantes del botón, las del sistema Aura. */
export type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'destructive'

/** Tamaños del botón: 24, 28 y 36 px de alto. */
export type ButtonSize = 'sm' | 'md' | 'lg'

/** Props del botón; todo lo demás son atributos nativos. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Icono a la izquierda del texto. */
  icon?: IconName
  /** Contenido a la derecha, normalmente el atajo de teclado. */
  trailing?: ReactNode
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 15, lg: 16 }

/**
 * Botón del sistema de diseño sobre las clases `au-btn` de Aura: puro, solo
 * props y tokens (principio VII), sin conocer el almacén.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    trailing,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const iconOnly = icon !== undefined && children === undefined

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'au-btn',
        `au-btn-${variant}`,
        size !== 'md' && `au-btn-${size}`,
        iconOnly && 'au-btn-icon',
        className,
      )}
      {...rest}
    >
      <span className="au-btn-label">
        {icon ? <Icon name={icon} size={ICON_SIZE[size]} /> : null}
        {children}
      </span>
      {trailing}
    </button>
  )
})
