import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/** Props del aviso. */
export interface ToastProps {
  /** Texto principal del aviso. */
  title: string
  /** Segunda línea opcional. */
  body?: string
  /** Icono del recuadro; el sistema usa la campana por defecto. */
  icon?: IconName
  onDismiss: () => void
  /** Ajustes de posición, por ejemplo para esquivar los controles de ventana. */
  className?: string
}

/**
 * Aviso flotante del sistema Aura, arriba a la derecha de la ventana.
 *
 * Se cierra con su botón; no desaparece solo, para que el aviso no se pierda
 * si el usuario está mirando otra parte de la pantalla.
 */
export function Toast({ title, body, icon = 'bell', onDismiss, className }: ToastProps) {
  return (
    <div className={cn('au-toaster', className)} aria-live="polite">
      <div role="status" className="au-toast">
        <button type="button" className="au-toast-close" aria-label="Cerrar" onClick={onDismiss}>
          <Icon name="x" size={10} />
        </button>
        <div className="au-toast-icon">
          <Icon name={icon} size={18} />
        </div>
        <div className="au-toast-text">
          <div className="au-toast-head">
            <span className="au-toast-title">{title}</span>
          </div>
          {body ? <div className="au-toast-body">{body}</div> : null}
        </div>
      </div>
    </div>
  )
}
