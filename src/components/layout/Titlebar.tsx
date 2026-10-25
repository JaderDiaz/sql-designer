import { cn } from '@/lib/cn'
import { windowControls } from '@/lib/tauri/commands'

/** Props de los controles de ventana. */
export interface TitlebarProps {
  className?: string
}

/**
 * Controles propios de la ventana (FR-012).
 *
 * La ventana va sin decoración del sistema, así que cerrar y minimizar se
 * dibujan aquí: círculos de 12 px con su símbolo, que aparece al pasar el
 * cursor por el grupo o al enfocar con el teclado. Van arriba a la izquierda
 * en los dos sistemas, en el sitio que marca el lienzo. Esta ventana no se
 * maximiza, así que no hay tercer botón.
 */
export function Titlebar({ className }: TitlebarProps) {
  return (
    <div className={cn('group absolute left-5 top-5 z-50 flex select-none gap-2', className)}>
      <WindowButton action="close" label="Cerrar" tone="close" />
      <WindowButton action="minimize" label="Minimizar" tone="minimize" />
    </div>
  )
}

/** Color y símbolo de cada control. */
type ControlTone = 'close' | 'minimize'

interface WindowButtonProps {
  action: 'minimize' | 'close'
  label: string
  tone: ControlTone
}

const TONE_COLOR: Record<ControlTone, string> = {
  close: 'var(--traffic-close)',
  minimize: 'var(--traffic-minimize)',
}

/** Trazo del símbolo, sobre una caja de 12 × 12. */
const TONE_PATH: Record<ControlTone, string> = {
  close: 'M4.2 4.2 7.8 7.8M7.8 4.2 4.2 7.8',
  minimize: 'M3.8 6h4.4',
}

/** Control de ventana; delega la acción en el comando de Rust. */
function WindowButton({ action, label, tone }: WindowButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => void windowControls(action)}
      style={{ background: TONE_COLOR[tone] }}
      className={cn(
        'flex h-3 w-3 items-center justify-center rounded-full',
        'shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.14)]',
        'transition-[filter] duration-fast ease-standard active:brightness-90',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-[var(--focus-ring)]',
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
