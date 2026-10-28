import * as RadixMenu from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/**
 * Menú desplegable del sistema Aura sobre Radix.
 *
 * Es el hermano de `ContextMenu` para los menús que cuelgan de un botón: el
 * primitivo aporta el rol, el foco atrapado, las flechas y el cierre con
 * Escape (principio V); aquí solo viajan las clases `au-*`.
 */

/** Una acción del menú. */
export interface MenuAction {
  id: string
  label: string
  /** Segunda línea que explica la acción. */
  hint?: string
  icon?: IconName
  disabled?: boolean
  /** Título nativo, para decir por qué una acción está apagada. */
  title?: string
  /** Separador encima de esta acción. */
  separatorBefore?: boolean
  onSelect: () => void
}

/** Props del menú. */
export interface MenuProps {
  /** Botón que lo abre. */
  children: ReactNode
  actions: MenuAction[]
  /** Título opcional encima de las acciones. */
  title?: ReactNode
  /** Lado por el que sale, por si el panel no deja sitio abajo. */
  side?: 'top' | 'bottom'
  className?: string
}

export function Menu({ children, actions, title, side = 'bottom', className }: MenuProps) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{children}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content className={cn('au-menu', className)} side={side} sideOffset={6} align="end">
          {title ? <div className="au-menu-title">{title}</div> : null}
          {actions.map((action) => (
            <div key={action.id}>
              {action.separatorBefore ? <RadixMenu.Separator className="au-menu-sep" /> : null}
              <RadixMenu.Item
                className="au-menu-item"
                disabled={action.disabled ?? false}
                title={action.title}
                onSelect={action.onSelect}
              >
                {action.icon ? <Icon name={action.icon} size={15} /> : null}
                <span className="flex min-w-0 flex-col">
                  <span>{action.label}</span>
                  {action.hint ? <span className="au-menu-hint">{action.hint}</span> : null}
                </span>
              </RadixMenu.Item>
            </div>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  )
}
