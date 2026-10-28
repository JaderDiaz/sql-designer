import {
  Archive,
  ArrowDown,
  ArrowUp,
  Bell,
  CaseSensitive,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  CircleArrowDown,
  CircleCheck,
  CircleMinus,
  ClipboardCopy,
  Clock,
  Cloud,
  Copy,
  Database,
  Ellipsis,
  File,
  FileCode,
  FilePlus2,
  FileQuestion,
  FileText,
  FileWarning,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  GitMerge,
  HardDrive,
  History,
  Info,
  KeyRound,
  LayoutTemplate,
  Minus,
  Layers,
  Monitor,
  Moon,
  Maximize,
  MousePointerClick,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Redo2,
  Plus,
  RotateCcw,
  Save,
  Search,
  SearchX,
  Settings,
  Square,
  Sun,
  Table2,
  TableProperties,
  Tags,
  TextCursorInput,
  ToggleRight,
  Trash2,
  Undo2,
  TriangleAlert,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/cn'

/** Iconos Lucide que usan las pantallas y los diálogos de archivo. */
export type IconName =
  | 'archive'
  | 'arrow-down'
  | 'arrow-up'
  | 'bell'
  | 'plus'
  | 'folder-open'
  | 'settings'
  | 'case-sensitive'
  | 'database'
  | 'ellipsis'
  | 'monitor'
  | 'sun'
  | 'moon'
  | 'minus'
  | 'square'
  | 'x'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevrons-up-down'
  | 'circle-arrow-down'
  | 'circle-check'
  | 'circle-minus'
  | 'clock'
  | 'cloud'
  | 'clipboard-copy'
  | 'copy'
  | 'file'
  | 'file-code'
  | 'file-plus-2'
  | 'file-question'
  | 'file-text'
  | 'file-warning'
  | 'folder'
  | 'folder-input'
  | 'folder-plus'
  | 'git-merge'
  | 'hard-drive'
  | 'history'
  | 'info'
  | 'key-round'
  | 'layers'
  | 'layout-template'
  | 'maximize'
  | 'mouse-pointer-click'
  | 'panel-left'
  | 'panel-left-close'
  | 'panel-left-open'
  | 'panel-right'
  | 'panel-right-close'
  | 'panel-right-open'
  | 'pencil'
  | 'redo-2'
  | 'rotate-ccw'
  | 'undo-2'
  | 'save'
  | 'search'
  | 'search-x'
  | 'table-2'
  | 'table-properties'
  | 'tags'
  | 'text-cursor-input'
  | 'toggle-right'
  | 'trash-2'
  | 'triangle-alert'
  | 'user-round'

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
  archive: Archive,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  bell: Bell,
  plus: Plus,
  'folder-open': FolderOpen,
  settings: Settings,
  'case-sensitive': CaseSensitive,
  database: Database,
  ellipsis: Ellipsis,
  monitor: Monitor,
  sun: Sun,
  moon: Moon,
  minus: Minus,
  square: Square,
  x: X,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevrons-up-down': ChevronsUpDown,
  'circle-arrow-down': CircleArrowDown,
  'circle-check': CircleCheck,
  'circle-minus': CircleMinus,
  clock: Clock,
  cloud: Cloud,
  'clipboard-copy': ClipboardCopy,
  copy: Copy,
  file: File,
  'file-code': FileCode,
  'file-plus-2': FilePlus2,
  'file-question': FileQuestion,
  'file-text': FileText,
  'file-warning': FileWarning,
  folder: Folder,
  'folder-input': FolderInput,
  'folder-plus': FolderPlus,
  'git-merge': GitMerge,
  'hard-drive': HardDrive,
  history: History,
  info: Info,
  'key-round': KeyRound,
  layers: Layers,
  'layout-template': LayoutTemplate,
  maximize: Maximize,
  'mouse-pointer-click': MousePointerClick,
  'panel-left': PanelLeft,
  'panel-left-close': PanelLeftClose,
  'panel-left-open': PanelLeftOpen,
  'panel-right': PanelRight,
  'panel-right-close': PanelRightClose,
  'panel-right-open': PanelRightOpen,
  pencil: Pencil,
  'redo-2': Redo2,
  'rotate-ccw': RotateCcw,
  'undo-2': Undo2,
  save: Save,
  search: Search,
  'search-x': SearchX,
  'table-2': Table2,
  'table-properties': TableProperties,
  tags: Tags,
  'text-cursor-input': TextCursorInput,
  'toggle-right': ToggleRight,
  'trash-2': Trash2,
  'triangle-alert': TriangleAlert,
  'user-round': UserRound,
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
