import { cn } from '@/lib/cn'

/** Props del atajo mostrado. */
export interface KbdProps {
  /** Texto del atajo, ya resuelto por `src/lib/platform.ts`. */
  children: string
  className?: string
}

/**
 * Muestra un atajo de teclado como en el lienzo: texto de 11 px, color
 * secundario y algo de espaciado, sin caja. El símbolo del modificador lo
 * decide `src/lib/platform.ts`, no este componente (RS-12).
 */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'font-sans text-[11px] leading-[14px] tracking-[0.04em] text-label-secondary',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
