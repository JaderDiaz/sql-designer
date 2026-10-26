import { useRef, type KeyboardEvent } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Una ubicación de la barra lateral. */
export interface SidebarItem {
  id: string
  label: string
  icon: IconName
}

/** Un grupo de ubicaciones con su título. */
export interface SidebarSection {
  title: string
  items: SidebarItem[]
}

/** Props de la barra lateral. */
export interface SidebarProps {
  sections: SidebarSection[]
  value: string
  onValueChange: (id: string) => void
  /** Texto accesible del grupo entero. */
  label: string
  className?: string
}

/**
 * Barra lateral de ubicaciones de los diálogos de archivo, como la dibuja el
 * lienzo: secciones con título, icono, selección única y flechas para moverse
 * entre ubicaciones sin salir de la lista (RS-09).
 */
export function Sidebar({ sections, value, onValueChange, label, className }: SidebarProps) {
  const container = useRef<HTMLDivElement>(null)
  const flat = sections.flatMap((section) => section.items)

  /**
   * Mueve la selección con las flechas y la lleva a los extremos con Inicio y
   * Fin, dejando el foco en la ubicación elegida.
   */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = flat.findIndex((item) => item.id === value)
    let next = index
    if (event.key === 'ArrowDown') next = Math.min(flat.length - 1, index + 1)
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = flat.length - 1
    else return

    event.preventDefault()
    const target = flat[next]
    if (!target || target.id === value) return
    onValueChange(target.id)
    container.current?.querySelector<HTMLButtonElement>(`[data-id="${target.id}"]`)?.focus()
  }

  return (
    <div
      ref={container}
      className={cn('au-side', className)}
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {sections.map((section) => (
        <div className="au-side-section" key={section.title}>
          <span className="au-side-title">{section.title}</span>
          {section.items.map((item) => {
            const current = item.id === value
            return (
              <button
                key={item.id}
                type="button"
                data-id={item.id}
                className="au-side-item"
                aria-current={current}
                tabIndex={current ? 0 : -1}
                onClick={() => onValueChange(item.id)}
              >
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
