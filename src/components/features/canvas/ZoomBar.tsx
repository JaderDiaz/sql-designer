import { useEffect, useRef, useState } from 'react'

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
 *
 * El porcentaje también se escribe: pulsarlo lo convierte en un campo con el
 * valor dentro, Intro lo aplica recortado a los topes y Esc deja las cosas
 * como estaban (FR-009).
 */

/** Cómo se lee el zoom: entero, sin decimales que nadie necesita. */
export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)} %`
}

export function ZoomBar() {
  const zoom = useAppStore((state) => state.zoom)
  const zoomBy = useAppStore((state) => state.zoomBy)
  const zoomTo = useAppStore((state) => state.zoomTo)
  const fitToModel = useAppStore((state) => state.fitToModel)

  /** Lo escrito mientras el porcentaje es un campo, o `null` si no lo es. */
  const [draft, setDraft] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)

  // Al abrirse, el campo recibe el foco con su contenido elegido: escribir una
  // cifra basta para reemplazarlo. Depende de si el campo está, no de lo que
  // lleva dentro: si no, cada tecla volvería a elegirlo todo y la siguiente lo
  // borraría.
  const isEditing = draft !== null
  useEffect(() => {
    if (!isEditing) return
    field.current?.focus()
    field.current?.select()
  }, [isEditing])

  /** Aplica lo escrito, si es un número; si no, lo deja como estaba. */
  function commitDraft() {
    const typed = Number.parseFloat((draft ?? '').replace(',', '.'))
    setDraft(null)
    if (!Number.isFinite(typed) || typed <= 0) return
    zoomTo(typed / 100)
  }

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

      {draft === null ? (
        <button
          type="button"
          className="sm-zoom-value"
          aria-label={`Zoom ${zoomLabel(zoom)}, escribir otro`}
          title="Escribir el porcentaje"
          onClick={() => setDraft(String(Math.round(zoom * 100)))}
        >
          <span aria-live="polite">{zoomLabel(zoom)}</span>
        </button>
      ) : (
        <input
          ref={field}
          className="sm-zoom-value sm-zoom-field"
          aria-label="Porcentaje de zoom"
          inputMode="decimal"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraft()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              setDraft(null)
            }
          }}
        />
      )}

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
