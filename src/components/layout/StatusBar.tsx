import { saveStatusText } from '@/components/layout/EditorChrome'
import { ENGINE_LABELS } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Barra de estado del Editor (FR-004).
 *
 * Dice el motor del modelo, el estado del archivo que definió el Incremento 1,
 * qué esquema está enfocado, el porcentaje de zoom y cuántos esquemas y tablas
 * hay. El estado del archivo es lo único que cambia sin que el usuario mire,
 * así que es lo único con `aria-live`.
 */

/** Alto de la barra, del tablero `Editor` del lienzo. */
export const STATUS_BAR_HEIGHT = 28

export function StatusBar() {
  const model = useAppStore((state) => state.model)
  const isDirty = useAppStore((state) => state.isDirty)
  const savedAtMs = useAppStore((state) => state.savedAtMs)
  const zoom = useAppStore((state) => state.zoom)
  const focusedSchema = useAppStore((state) => state.focusedSchema)

  if (model === null) return null

  const schemas = model.schemas.length
  const tables = model.tables?.length ?? 0

  return (
    <footer
      style={{ minHeight: STATUS_BAR_HEIGHT }}
      className="flex flex-none flex-wrap items-center gap-3 border-t-[0.5px] border-separator bg-window px-4 py-1 text-[11px] leading-[14px] text-label-secondary [font-variant-numeric:tabular-nums]"
    >
      <span>{ENGINE_LABELS[model.engine]}</span>
      <span aria-hidden="true" className="h-[12px] w-[0.5px] bg-separator" />
      <span aria-live="polite">{saveStatusText(isDirty, savedAtMs)}</span>

      {focusedSchema === null ? null : (
        <>
          <span aria-hidden="true" className="h-[12px] w-[0.5px] bg-separator" />
          <span>Enfocado: {focusedSchema}</span>
        </>
      )}

      <span className="flex-1" />

      <span>{schemas === 1 ? '1 esquema' : `${schemas} esquemas`}</span>
      <span aria-hidden="true" className="h-[12px] w-[0.5px] bg-separator" />
      <span>{tables === 1 ? '1 tabla' : `${tables} tablas`}</span>
      <span aria-hidden="true" className="h-[12px] w-[0.5px] bg-separator" />
      <span aria-label={`Zoom ${Math.round(zoom * 100)} %`}>{Math.round(zoom * 100)} %</span>
    </footer>
  )
}
