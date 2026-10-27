import { Icon } from '@/components/ui/Icon'
import { ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas/constants'
import { useAppStore } from '@/store'
import { ZOOM_STEP } from '@/store/canvas'

/**
 * Barra de zoom del lienzo, abajo a la izquierda (FR-008, FR-010).
 *
 * El porcentaje no es decorativo: es la única forma de saber a qué escala se
 * está trabajando, así que se anuncia con `aria-live="polite"` para que
 * cambiarlo con el teclado o con la rueda también se oiga. El botón del tope
 * alcanzado se deshabilita en lugar de no hacer nada al pulsarlo.
 */

/** Cómo se lee el zoom: entero, sin decimales que nadie necesita. */
export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)} %`
}

export function ZoomBar() {
  const zoom = useAppStore((state) => state.zoom)
  const zoomBy = useAppStore((state) => state.zoomBy)
  const fitToModel = useAppStore((state) => state.fitToModel)

  // Los topes se comparan con holgura: el zoom es un número de coma flotante y
  // dos décimas sumadas diez veces no caen exactamente en 2.
  const atMin = zoom <= ZOOM_MIN + 0.001
  const atMax = zoom >= ZOOM_MAX - 0.001

  return (
    <div className="sm-zoombar" role="group" aria-label="Zoom del lienzo">
      <button
        type="button"
        className="sm-zoom-button"
        aria-label="Alejar"
        disabled={atMin}
        onClick={() => zoomBy(-ZOOM_STEP)}
      >
        <Icon name="minus" size={14} />
      </button>

      <span className="sm-zoom-value" aria-live="polite">
        {zoomLabel(zoom)}
      </span>

      <button
        type="button"
        className="sm-zoom-button"
        aria-label="Acercar"
        disabled={atMax}
        onClick={() => zoomBy(ZOOM_STEP)}
      >
        <Icon name="plus" size={14} />
      </button>

      <span aria-hidden="true" className="sm-zoom-rule" />

      <button type="button" className="sm-zoom-button w-auto px-2" onClick={fitToModel}>
        <Icon name="maximize" size={13} />
        <span className="text-[11px] leading-[14px]">Ajustar</span>
      </button>
    </div>
  )
}
