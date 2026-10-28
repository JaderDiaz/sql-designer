import * as RadixContextMenu from '@radix-ui/react-context-menu'
import type { KeyboardEvent, ReactNode } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Una acción del menú contextual. */
export interface ContextMenuAction {
  id: string
  label: string
  icon?: IconName
  /** Atajo que se muestra a la derecha, ya con los símbolos del sistema. */
  shortcut?: ReactNode
  /** Color de un punto a la izquierda, como el de un esquema. */
  swatch?: string
  /** Acciones de un submenú; entonces la entrada no se pulsa, se abre. */
  items?: ContextMenuAction[]
  /** Variante destructiva: la acción se pinta en rojo (RS-08). */
  destructive?: boolean
  disabled?: boolean
  /** Separador encima de esta acción. */
  separatorBefore?: boolean
  onSelect: () => void
}

/** Props del menú contextual. */
export interface ContextMenuProps {
  /** Lo que se puede pulsar con el botón derecho. */
  children: ReactNode
  actions: ContextMenuAction[]
  /** Título opcional encima de las acciones; admite dos líneas. */
  title?: ReactNode
  /** Se avisa al abrir, para que la lista marque la fila del menú. */
  onOpen?: () => void
  /**
   * Si el menú se abre también con un clic normal.
   *
   * Lo usa el botón de puntos suspensivos del inspector: ahí el menú es la
   * acción del botón, no un atajo del botón derecho (FR-036).
   */
  openOnClick?: boolean
  className?: string
}

/**
 * Emite el `contextmenu` que Radix escucha, anclado al elemento.
 *
 * @param target Elemento sobre el que se abre el menú.
 */
function openMenuAt(target: HTMLElement): void {
  const { left, bottom } = target.getBoundingClientRect()
  target.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: left + 8,
      clientY: bottom - 4,
    }),
  )
}

/**
 * Abre el menú desde el teclado con ⇧F10 o con la tecla de menú (RS-09).
 *
 * Radix escucha el evento `contextmenu`, que en Windows y Linux lo emite el
 * propio navegador con esas teclas, pero en macOS no hay tecla de menú y el
 * navegador no lo emite. Así que se emite aquí, anclado al borde inferior del
 * elemento, y el menú sale donde saldría con el botón derecho.
 */
function openFromKeyboard(event: KeyboardEvent<HTMLElement>): void {
  const isMenuKey = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')
  if (!isMenuKey) return

  event.preventDefault()
  openMenuAt(event.currentTarget)
}

/** Lo que se ve dentro de una fila del menú: punto, icono, texto y atajo. */
function MenuRowContent({ action }: { action: ContextMenuAction }) {
  return (
    <>
      {action.swatch === undefined ? null : (
        <span
          aria-hidden="true"
          className="h-2 w-2 flex-none rounded-full"
          style={{ background: `var(--${action.swatch})` }}
        />
      )}
      {action.icon ? <Icon name={action.icon} size={15} /> : null}
      <span>{action.label}</span>
      {action.shortcut ? <span className="au-menu-shortcut">{action.shortcut}</span> : null}
    </>
  )
}

/**
 * Menú contextual del sistema Aura sobre Radix.
 *
 * Radix lo abre con el botón derecho y recorre las acciones con las flechas;
 * la apertura con ⇧F10 y con la tecla de menú la añade
 * {@link openFromKeyboard}, de modo que toda acción del menú es alcanzable sin
 * ratón (RS-09, principio V).
 */
export function ContextMenu({
  children,
  actions,
  title,
  onOpen,
  openOnClick = false,
  className,
}: ContextMenuProps) {
  return (
    <RadixContextMenu.Root
      onOpenChange={(open) => {
        if (open) onOpen?.()
      }}
    >
      <RadixContextMenu.Trigger
        className={cn('au-ctx-area', className)}
        onKeyDown={openFromKeyboard}
        {...(openOnClick
          ? {
              onClick: (event: React.MouseEvent<HTMLElement>) => {
                openMenuAt(event.currentTarget)
              },
            }
          : {})}
        asChild
      >
        {children}
      </RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content className="au-menu au-ctx-menu">
          {title ? <div className="au-menu-title">{title}</div> : null}
          {actions.map((action) => (
            <div key={action.id}>
              {action.separatorBefore ? <RadixContextMenu.Separator className="au-menu-sep" /> : null}
              {action.items === undefined ? (
                <RadixContextMenu.Item
                  className={cn('au-menu-item', action.destructive ? 'is-danger' : null)}
                  disabled={action.disabled ?? false}
                  onSelect={action.onSelect}
                >
                  <MenuRowContent action={action} />
                </RadixContextMenu.Item>
              ) : (
                <RadixContextMenu.Sub>
                  <RadixContextMenu.SubTrigger
                    className="au-menu-item"
                    disabled={action.disabled ?? false}
                  >
                    <MenuRowContent action={action} />
                    <Icon name="chevron-right" size={14} className="ml-auto" />
                  </RadixContextMenu.SubTrigger>
                  <RadixContextMenu.Portal>
                    <RadixContextMenu.SubContent className="au-menu au-ctx-menu" sideOffset={2}>
                      {action.items.map((item) => (
                        <RadixContextMenu.Item
                          key={item.id}
                          className={cn('au-menu-item', item.destructive ? 'is-danger' : null)}
                          disabled={item.disabled ?? false}
                          onSelect={item.onSelect}
                        >
                          <MenuRowContent action={item} />
                        </RadixContextMenu.Item>
                      ))}
                    </RadixContextMenu.SubContent>
                  </RadixContextMenu.Portal>
                </RadixContextMenu.Sub>
              )}
            </div>
          ))}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  )
}
