import * as RadixTabs from '@radix-ui/react-tabs'

import { cn } from '@/lib/cn'

/** Una ficha de la lista. */
export interface TabItem<T extends string> {
  value: T
  label: string
  /** Cuántos elementos tiene la ficha; se muestra al lado del nombre. */
  count?: number
}

/** Props de la lista de fichas. */
export interface TabsProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  items: ReadonlyArray<TabItem<T>>
  /** Nombre de la lista para el lector de pantalla. */
  label: string
  className?: string
}

/**
 * Lista de fichas del sistema Aura, sobre `@radix-ui/react-tabs`.
 *
 * Radix pone el rol `tablist`, el recorrido con las flechas y el
 * `aria-controls` de cada ficha; el principio V prohíbe reimplementar eso a
 * mano (research R9). El componente es **puro**: recibe las fichas, la activa
 * y el `onChange`, y no importa el almacén.
 *
 * El contenido de cada ficha no vive aquí: lo pinta quien la usa, porque las
 * dos rejillas del panel son grandes y tienen su propio estado. La lista solo
 * dice cuál está activa.
 */
export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  label,
  className,
}: TabsProps<T>) {
  return (
    <RadixTabs.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      className={cn('au-tabs', className)}
    >
      <RadixTabs.List aria-label={label} className="au-tabs-list">
        {items.map((item) => (
          <RadixTabs.Trigger key={item.value} value={item.value} className="au-tab">
            {item.label}
            {item.count === undefined ? null : <span className="au-tab-count">{item.count}</span>}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
    </RadixTabs.Root>
  )
}
