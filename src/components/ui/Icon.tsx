import {
  Bell,
  CaseSensitive,
  Database,
  FolderOpen,
  Minus,
  Monitor,
  Moon,
  Plus,
  Settings,
  Square,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/cn'

/** Iconos Lucide que usan la Bienvenida, Ajustes y la barra de título. */
export type IconName =
  | 'bell'
  | 'plus'
  | 'folder-open'
  | 'settings'
  | 'case-sensitive'
  | 'database'
  | 'monitor'
  | 'sun'
  | 'moon'
  | 'minus'
  | 'square'
  | 'x'

/** Props del icono. */
export interface IconProps {
  name: IconName
  /** Lado en píxeles; el sistema de diseño usa 16 por defecto. */
  size?: number
  className?: string
  /** Texto accesible; sin él, el icono queda oculto para el lector. */
  label?: string
}

const ICONS: Record<IconName, LucideIcon> = {
  bell: Bell,
  plus: Plus,
  'folder-open': FolderOpen,
  settings: Settings,
  'case-sensitive': CaseSensitive,
  database: Database,
  monitor: Monitor,
  sun: Sun,
  moon: Moon,
  minus: Minus,
  square: Square,
  x: X,
}

/**
 * Icono del sistema de diseño: Lucide empaquetado (nunca de la red), trazo
 * 1,75 sobre una cuadrícula de 24 y color heredado del contexto.
 */
export function Icon({ name, size = 16, className, label }: IconProps) {
  const Glyph = ICONS[name]

  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={1.75}
      className={cn('au-icon', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
