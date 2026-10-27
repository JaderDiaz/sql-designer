import { ScrollRegion } from '@/components/layout/ScrollRegion'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ENGINE_LABELS } from '@/lib/model/types'
import { isMacOS } from '@/lib/platform'
import { revealInFileManager } from '@/lib/tauri/commands'
import { saveStatusText } from '@/components/layout/EditorChrome'
import { useAppStore } from '@/store'

/**
 * Inspector del Editor: la ficha del modelo (FR-003).
 *
 * El inspector mira la tabla seleccionada, y las tablas llegan con el
 * Incremento 3, así que aquí todavía solo cabe la ficha del modelo: su
 * nombre, si está guardado, dónde vive, su motor y cuánto tiene dentro.
 * Enfocar un esquema no cambia este panel —centra el lienzo y filtra la lista
 * de la barra lateral—, y sus datos se editan en su propio diálogo.
 */

/** Una cifra de la rejilla de resumen del modelo. */
function Kpi({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[15px] font-semibold leading-5 [font-variant-numeric:tabular-nums]">
        {value}
      </span>
      <span className="text-[10px] leading-[13px] text-label-secondary">{label}</span>
    </div>
  )
}

export function Inspector() {
  const model = useAppStore((state) => state.model)
  const path = useAppStore((state) => state.path)
  const isDirty = useAppStore((state) => state.isDirty)
  const savedAtMs = useAppStore((state) => state.savedAtMs)
  const platform = useAppStore((state) => state.platform)

  if (model === null) return null

  const revealLabel = isMacOS(platform) ? 'Mostrar en Finder' : 'Mostrar en el Explorador'

  return (
    <ScrollRegion label="Datos del modelo" className="flex flex-col">
      <section
        aria-label="Modelo"
        className="flex flex-col gap-3.5 border-b-[length:var(--hairline)] border-separator p-4"
      >
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-accent-soft"
          >
            <Icon name="database" size={18} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="m-0 truncate text-[15px] font-semibold leading-5">{model.name}</h2>
            <span
              aria-live="polite"
              className="flex items-center gap-1.5 text-[11px] leading-[14px] text-label-secondary"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-orange' : 'bg-green'}`}
              />
              {saveStatusText(isDirty, savedAtMs)}
            </span>
          </div>
        </div>

        {path === null ? null : (
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-[14px] text-label-secondary">
              {path}
            </span>
            <Button
              variant="plain"
              size="sm"
              icon="folder-open"
              aria-label={revealLabel}
              title={revealLabel}
              onClick={() => {
                void revealInFileManager(path).catch(() => undefined)
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] leading-[18px] text-label-secondary">Motor</span>
          <span className="text-[13px] leading-[18px]">{ENGINE_LABELS[model.engine]}</span>
        </div>

        <div
          role="list"
          aria-label="Resumen"
          className="grid grid-cols-2 rounded-[10px] bg-inset py-2.5"
        >
          <div role="listitem">
            <Kpi value={model.schemas.length} label="esquemas" />
          </div>
          <div role="listitem">
            <Kpi value={(model.tables ?? []).length} label="tablas" />
          </div>
        </div>
      </section>
    </ScrollRegion>
  )
}
