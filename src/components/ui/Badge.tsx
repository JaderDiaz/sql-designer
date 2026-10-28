import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Tono de la insignia: cada uno con su par de tokens de estado. */
export type BadgeTone = 'green' | 'orange'

/** Props de la insignia de estado. */
export interface BadgeProps {
  tone: BadgeTone
  /** Texto de la insignia. */
  children: string
  /** Icono a la izquierda, cuando el estado tiene uno. */
  icon?: IconName
  /** Punto del color del tono, para un estado sin icono. */
  dot?: boolean
  className?: string
}

/**
 * Insignia de estado del sistema Aura: píldora pequeña con tono verde o
 * naranja, como las de «Indexada» y «Sin índice» del lienzo de diseño
 * (FR-033).
 *
 * El color no es el único portador del estado: la insignia siempre lleva su
 * texto, y por eso se puede leer en escala de grises y con un lector de
 * pantalla (puerta 5).
 */
export function Badge({ tone, children, icon, dot, className }: BadgeProps) {
  return (
    <span className={cn('au-badge', `au-badge-${tone}`, className)}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {dot ? <span className="au-badge-dot" /> : null}
      {children}
    </span>
  )
}
