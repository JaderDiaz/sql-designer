import { useEffect } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Props del aviso. */
export interface ToastProps {
  /** Texto del aviso; es una sola línea, como la escribe el lienzo. */
  title: string
  /** Icono de la píldora; sin él se elige por lo que dice el aviso. */
  icon?: IconName
  /** Se llama cuando el aviso se va, por el reloj o por un clic. */
  onDismiss: () => void
  /** Cuánto se ve, en milisegundos. */
  durationMs?: number
  className?: string
}

/** Cuánto se queda el aviso en pantalla, como en el lienzo. */
export const NOTICE_MS = 2000

/**
 * Icono que le toca a un aviso, por lo que dice.
 *
 * El lienzo usa el reloj del historial para deshacer y rehacer, el aviso
 * neutro para lo que no se pudo hacer, y el visto para lo que sí.
 *
 * @param title Texto del aviso.
 */
export function noticeIcon(title: string): IconName {
  if (/^(Deshecho|Rehecho)/.test(title)) return 'history'
  if (/^(No se|No hay|Selecciona)/.test(title)) return 'info'
  return 'circle-check'
}

/**
 * Aviso flotante: una píldora de cristal abajo al centro de la ventana.
 *
 * Es transitoria a propósito —se va sola a los {@link NOTICE_MS}
 * milisegundos—, porque en el lienzo el aviso nunca tapa la pantalla: ni la
 * cabecera de Recientes ni la barra del Editor. Un clic la cierra antes.
 */
export function Toast({ title, icon, onDismiss, durationMs = NOTICE_MS, className }: ToastProps) {
  // El reloj se reinicia con cada aviso nuevo: dos avisos seguidos no se
  // cuentan el mismo tiempo.
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(timer)
  }, [durationMs, onDismiss, title])

  return (
    <div role="status" aria-live="polite" className={cn('au-pill', className)} onClick={onDismiss}>
      <Icon name={icon ?? noticeIcon(title)} size={14} className="text-label-secondary" />
      {title}
    </div>
  )
}
