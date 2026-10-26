import {
  Bell,
  CaseSensitive,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleArrowDown,
  CircleMinus,
  Clock,
  Cloud,
  Copy,
  Database,
  File,
  FileCode,
  FilePlus2,
  FileText,
  FileWarning,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Minus,
  Layers,
  Monitor,
  Moon,
  MousePointerClick,
  Pencil,
  Redo2,
  Plus,
  Save,
  Search,
  SearchX,
  Settings,
  Square,
  Sun,
  Table2,
  Tags,
  Trash2,
  Undo2,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/cn'

/** Iconos Lucide que usan las pantallas y los diálogos de archivo. */
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
  | 'check'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevrons-up-down'
  | 'circle-arrow-down'
  | 'circle-minus'
  | 'clock'
  | 'cloud'
  | 'copy'
  | 'file'
  | 'file-code'
  | 'file-plus-2'
  | 'file-text'
  | 'file-warning'
  | 'folder'
  | 'folder-plus'
  | 'hard-drive'
  | 'layers'
  | 'mouse-pointer-click'
  | 'pencil'
  | 'redo-2'
  | 'undo-2'
  | 'save'
  | 'search'
  | 'search-x'
  | 'table-2'
  | 'tags'
  | 'trash-2'
  | 'triangle-alert'

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
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevrons-up-down': ChevronsUpDown,
  'circle-arrow-down': CircleArrowDown,
  'circle-minus': CircleMinus,
  clock: Clock,
  cloud: Cloud,
  copy: Copy,
  file: File,
  'file-code': FileCode,
  'file-plus-2': FilePlus2,
  'file-text': FileText,
  'file-warning': FileWarning,
  folder: Folder,
  'folder-plus': FolderPlus,
  'hard-drive': HardDrive,
  layers: Layers,
  'mouse-pointer-click': MousePointerClick,
  pencil: Pencil,
  'redo-2': Redo2,
  'undo-2': Undo2,
  save: Save,
  search: Search,
  'search-x': SearchX,
  'table-2': Table2,
  tags: Tags,
  'trash-2': Trash2,
  'triangle-alert': TriangleAlert,
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
