import { Titlebar } from '@/components/layout/Titlebar'
import { Button } from '@/components/ui/Button'
import { formatTime } from '@/lib/format'
import { ENGINE_LABELS } from '@/lib/model/types'
import type { PlatformInfo } from '@/lib/tauri/types'
import { shortcutLabel } from '@/lib/platform'
import { useAppStore } from '@/store'

/**
 * Cabecera del Editor, según `project/Editor.dc.html` del lienzo (FR-018 a
 * FR-021, RS-07).
 *
 * Trae los controles de ventana, con el círculo rojo cerrando el modelo y su
 * punto de cambios sin guardar; el nombre del modelo con «Guardado · <motor>»
 * o «Editado · <motor>»; la hora del último guardado; deshacer y rehacer;
 * renombrar; y los dos botones que esconden y muestran la barra lateral y el
 * inspector (FR-006, FR-038).
 */

/**
 * Atajo de las dos zonas escondibles, con ⌥ delante de ⌘ (FR-006).
 *
 * @param platform Sistema en ejecución.
 * @param key Tecla del atajo, en mayúscula.
 */
export function layoutShortcut(platform: PlatformInfo, key: string): string {
  const { alt } = platform.modifierSymbols
  return platform.os === 'macos'
    ? `${alt}${shortcutLabel(platform, key)}`
    : `${alt}+${shortcutLabel(platform, key)}`
}

/** Texto del estado de guardado, con la hora del último guardado (FR-018). */
export function saveStatusText(isDirty: boolean, savedAtMs: number | null): string {
  if (isDirty) return 'Cambios sin guardar'
  if (savedAtMs === null) return 'Guardado'
  return `Guardado a las ${formatTime(savedAtMs)}`
}

export function EditorChrome() {
  const model = useAppStore((state) => state.model)
  const isDirty = useAppStore((state) => state.isDirty)
  const savedAtMs = useAppStore((state) => state.savedAtMs)
  const past = useAppStore((state) => state.past)
  const future = useAppStore((state) => state.future)
  const platform = useAppStore((state) => state.platform)
  const undo = useAppStore((state) => state.undo)
  const redo = useAppStore((state) => state.redo)
  const requestClose = useAppStore((state) => state.requestClose)
  const openDialog = useAppStore((state) => state.openDialog)
  const isSidebarHidden = useAppStore((state) => state.isSidebarHidden)
  const isInspectorHidden = useAppStore((state) => state.isInspectorHidden)
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)
  const toggleInspector = useAppStore((state) => state.toggleInspector)

  if (model === null) return null

  const engine = ENGINE_LABELS[model.engine]
  const closeLabel = isDirty ? 'Cerrar (cambios sin guardar)' : 'Cerrar'

  return (
    <header
      data-tauri-drag-region
      className="flex min-h-[52px] flex-none flex-wrap items-center gap-2 border-b-[0.5px] border-separator px-3 py-2"
    >
      <Titlebar
        onClose={requestClose}
        closeLabel={closeLabel}
        isDirty={isDirty}
        canZoom
        className="relative left-0 top-0 mr-2 z-auto"
      />

      <div className="mr-2 flex min-w-0 flex-col">
        <span className="whitespace-nowrap text-[13px] font-semibold leading-4">{model.name}</span>
        <span className="whitespace-nowrap text-[11px] leading-[14px] text-label-secondary">
          {isDirty ? 'Editado' : 'Guardado'} · {engine}
        </span>
      </div>

      <Button
        variant="plain"
        icon="pencil"
        aria-label="Renombrar modelo"
        title="Renombrar modelo"
        onClick={() => openDialog('rename')}
      />

      <span aria-hidden="true" className="mx-1 h-[18px] w-[0.5px] bg-separator" />

      <Button
        variant="plain"
        icon="plus"
        aria-label="Nuevo esquema"
        title="Nuevo esquema"
        onClick={() => openDialog('schema')}
      />

      <div className="flex-1" />

      <Button
        variant="plain"
        icon="panel-left"
        aria-label="Barra lateral"
        aria-pressed={!isSidebarHidden}
        title={`Barra lateral (${layoutShortcut(platform, 'S')})`}
        onClick={() => void toggleSidebar()}
      />
      <Button
        variant="plain"
        icon="panel-right"
        aria-label="Inspector"
        aria-pressed={!isInspectorHidden}
        title={`Inspector (${layoutShortcut(platform, 'I')})`}
        onClick={() => void toggleInspector()}
      />

      <span aria-hidden="true" className="mx-1 h-[18px] w-[0.5px] bg-separator" />

      <span
        aria-live="polite"
        className="flex items-center gap-1.5 text-[11px] leading-[14px] text-label-secondary [font-variant-numeric:tabular-nums]"
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-orange' : 'bg-green'}`}
        />
        {saveStatusText(isDirty, savedAtMs)}
        {isDirty ? ` · ${shortcutLabel(platform, 'S')}` : ''}
      </span>

      <span aria-hidden="true" className="mx-1 h-[18px] w-[0.5px] bg-separator" />

      <Button
        variant="plain"
        icon="undo-2"
        aria-label="Deshacer"
        title={`Deshacer (${shortcutLabel(platform, 'Z')})`}
        disabled={past.length === 0}
        onClick={undo}
      />
      <Button
        variant="plain"
        icon="redo-2"
        aria-label="Rehacer"
        title="Rehacer"
        disabled={future.length === 0}
        onClick={redo}
      />
    </header>
  )
}
