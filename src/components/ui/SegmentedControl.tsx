import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Una opción del selector. */
export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: IconName
}

/** Props del selector de una opción entre varias. */
export interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: ReadonlyArray<SegmentedOption<T>>
  /** Nombre del grupo para el lector de pantalla. */
  label: string
  className?: string
}

/** Posición y ancho del resalte que marca la opción activa. */
interface Thumb {
  x: number
  w: number
}

/**
 * Selector segmentado del sistema Aura: el resalte se desliza con resorte
 * hasta la opción activa, que se recorre con las flechas y se activa con el
 * teclado, con foco visible (FR-014, SC-004).
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: SegmentedControlProps<T>) {
  const root = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<Thumb | null>(null)

  const measure = useCallback(() => {
    const active = root.current?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (active) setThumb({ x: active.offsetLeft, w: active.offsetWidth })
  }, [])

  useLayoutEffect(measure, [measure, value, options.length])

  // Vuelve a medir cuando cargan las fuentes o cambia el tamaño de la ventana.
  useEffect(() => {
    void document.fonts?.ready.then(measure)
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  /** Flechas: mueven la selección y el foco a la vez, con vuelta al principio. */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return

    event.preventDefault()
    const current = options.findIndex((option) => option.value === value)
    const step = event.key === 'ArrowRight' ? 1 : options.length - 1
    const next = options[(current + step) % options.length]
    if (!next) return

    onValueChange(next.value)
    const items = root.current?.querySelectorAll<HTMLElement>('.au-seg-item')
    items?.[options.indexOf(next)]?.focus()
  }

  return (
    <div
      ref={root}
      role="radiogroup"
      aria-label={label}
      className={cn('au-seg', className)}
      onKeyDown={onKeyDown}
    >
      {thumb ? (
        <span
          className="au-seg-thumb"
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
        />
      ) : null}
      {options.map((option) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="au-seg-item"
            onClick={() => onValueChange(option.value)}
          >
            {option.icon ? <Icon name={option.icon} size={14} /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
