import { cn } from '@/lib/cn'
import { windowControls } from '@/lib/tauri/commands'
import type { WindowControlAction } from '@/lib/tauri/types'

/** Props de los controles de ventana. */
export interface TitlebarProps {
  /**
   * Qué hace el círculo rojo. Sin esto cierra la ventana; el Editor le pasa
   * su propio cierre, que vuelve a la Bienvenida (FR-027).
   */
  onClose?: () => void
  /** Texto accesible del círculo rojo. */
  closeLabel?: string
  /** Punto de cambios sin guardar dentro del círculo rojo (RS-07). */
  isDirty?: boolean
  /**
   * Muestra el círculo verde de ampliar. Solo lo lleva el Editor, que es la
   * zona de trabajo y sí se puede agrandar; la Bienvenida es un diálogo de
   * tamaño fijo.
   */
  canZoom?: boolean
  className?: string
}

/**
 * Controles propios de la ventana (FR-012).
 *
 * La ventana va sin decoración del sistema, así que cerrar, minimizar y
 * ampliar se dibujan aquí: círculos de 12 px con su símbolo, que aparece al
 * pasar el cursor por el grupo o al enfocar con el teclado. Van arriba a la
 * izquierda en los dos sistemas, en el sitio que marca el lienzo. El tercer
 * círculo solo sale donde ampliar tiene sentido.
 */
export function Titlebar({
  onClose,
  closeLabel,
  isDirty = false,
  canZoom = false,
  className,
}: TitlebarProps) {
  return (
    <div className={cn('group absolute left-5 top-5 z-50 flex select-none gap-2', className)}>
      <WindowButton
        action="close"
        label={closeLabel ?? 'Cerrar'}
        tone="close"
        onClick={onClose}
        isDirty={isDirty}
      />
      <WindowButton
        action="minimize"
        label="Minimizar"
        tone="minimize"
        onClick={undefined}
        isDirty={false}
      />
      {canZoom ? (
        <WindowButton
          action="toggle_maximize"
          label="Ampliar"
          tone="zoom"
          onClick={undefined}
          isDirty={false}
        />
      ) : null}
    </div>
  )
}

/** Color y símbolo de cada control. */
type ControlTone = 'close' | 'minimize' | 'zoom'

interface WindowButtonProps {
  action: WindowControlAction
  label: string
  tone: ControlTone
  /** Acción propia; sin ella se manda la del sistema a Rust. */
  onClick: (() => void) | undefined
  isDirty: boolean
}

const TONE_COLOR: Record<ControlTone, string> = {
  close: 'var(--traffic-close)',
  minimize: 'var(--traffic-minimize)',
  zoom: 'var(--traffic-zoom)',
}

/** Trazo del símbolo, sobre una caja de 12 × 12. */
const TONE_PATH: Record<ControlTone, string> = {
  close: 'M4.2 4.2 7.8 7.8M7.8 4.2 4.2 7.8',
  minimize: 'M3.8 6h4.4',
  zoom: 'M4.4 7.6V4.4h3.2M7.6 4.4 4.4 7.6',
}

/** Control de ventana; delega la acción en el comando de Rust. */
function WindowButton({ action, label, tone, onClick, isDirty }: WindowButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick ?? (() => void windowControls(action))}
      style={{ background: TONE_COLOR[tone] }}
      className={cn(
        'flex h-3 w-3 items-center justify-center rounded-full',
        'shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.14)]',
        'transition-[filter] duration-fast ease-standard active:brightness-90',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-[var(--focus-ring)]',
        isDirty ? 'sm-traffic is-dirty' : null,
      )}
    >
      <svg
        viewBox="0 0 12 12"
        className="h-3 w-3 opacity-0 transition-opacity duration-fast ease-standard group-hover:opacity-100 group-focus-within:opacity-100"
        aria-hidden="true"
      >
        <path
          d={TONE_PATH[tone]}
          fill="none"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
