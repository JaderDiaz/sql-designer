import { Titlebar } from '@/components/layout/Titlebar'
import { Button } from '@/components/ui/Button'
import { formatTime } from '@/lib/format'
import { ENGINE_LABELS } from '@/lib/model/types'
import type { PlatformInfo } from '@/lib/tauri/types'
import { shortcutLabel } from '@/lib/platform'
import { useAppStore } from '@/store'

/**
 * Barra superior del Editor, según `project/Editor.dc.html` del lienzo
 * (FR-001, FR-006, RS-07).
 *
 * Empieza a la derecha de la barra lateral y la recorre de un extremo a otro:
 * a la izquierda el botón que esconde la barra lateral, luego el nombre del
 * modelo con «Guardado · <motor>» o «Editado · <motor>»; en el centro queda el
 * hueco del conmutador de vista; y a la derecha las acciones, terminando en el
 * botón que esconde el inspector. Cada zona escondible se recoge por su propio
 * lado, que es lo que hace que el gesto se entienda sin leer el rótulo.
 *
 * Los controles de la ventana viven en la barra lateral mientras se ve; aquí
 * solo salen cuando está escondida, porque entonces esta es la primera fila de
 * la ventana (FR-012).
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
  const past = useAppStore((state) => state.past)
  const future = useAppStore((state) => state.future)
  const platform = useAppStore((state) => state.platform)
  const undo = useAppStore((state) => state.undo)
  const redo = useAppStore((state) => state.redo)
  const requestClose = useAppStore((state) => state.requestClose)
  const openDialog = useAppStore((state) => state.openDialog)
  const openSchemaDialog = useAppStore((state) => state.openSchemaDialog)
  const openTableDialog = useAppStore((state) => state.openTableDialog)
  const selectedTable = useAppStore((state) => state.selectedTable)
  const isFieldsPanelOpen = useAppStore((state) => state.isFieldsPanelOpen)
  const openFieldsPanel = useAppStore((state) => state.openFieldsPanel)
  const closeFieldsPanel = useAppStore((state) => state.closeFieldsPanel)
  const requestForeignKey = useAppStore((state) => state.requestForeignKey)
  const isSidebarHidden = useAppStore((state) => state.isSidebarHidden)
  const isInspectorHidden = useAppStore((state) => state.isInspectorHidden)
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)
  const toggleInspector = useAppStore((state) => state.toggleInspector)

  if (model === null) return null

  const engine = ENGINE_LABELS[model.engine]
  const sidebarLabel = isSidebarHidden ? 'Mostrar barra lateral' : 'Ocultar barra lateral'
  const inspectorLabel = isInspectorHidden ? 'Mostrar inspector' : 'Ocultar inspector'

  return (
    <header
      data-tauri-drag-region
      style={{ paddingLeft: isSidebarHidden ? 16 : 8 }}
      className="flex min-h-[52px] flex-none items-center gap-2 border-b-[length:var(--hairline)] border-separator py-2 pr-3"
    >
      {isSidebarHidden ? (
        <Titlebar
          onClose={requestClose}
          closeLabel={isDirty ? 'Cerrar (cambios sin guardar)' : 'Cerrar'}
          isDirty={isDirty}
          canZoom
          className="relative left-0 top-0 mr-2 z-auto"
        />
      ) : null}

      <Button
        variant="plain"
        icon={isSidebarHidden ? 'panel-left-open' : 'panel-left-close'}
        aria-label={sidebarLabel}
        aria-pressed={!isSidebarHidden}
        title={`${sidebarLabel} (${layoutShortcut(platform, 'S')})`}
        onClick={() => void toggleSidebar()}
      />

      <div className="mr-2 flex min-w-0 flex-col">
        <span className="whitespace-nowrap text-[13px] font-semibold leading-4">{model.name}</span>
        <span className="whitespace-nowrap text-[11px] leading-[14px] text-label-secondary">
          {isDirty ? 'Editado' : 'Guardado'} · {engine}
        </span>
      </div>

      {/* El hueco del conmutador de vista, que llega con el Incremento 3. */}
      <div className="min-w-[200px] flex-1" />

      <div className="flex items-center gap-1">
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

        <span aria-hidden="true" className="mx-1 h-[18px] w-[var(--hairline)] bg-separator" />

        <Button
          icon="plus"
          aria-label="Nueva tabla"
          title={`Nueva tabla (${shortcutLabel(platform, 'T')})`}
          onClick={() => openTableDialog()}
        >
          Tabla
        </Button>
        <Button
          icon="git-merge"
          aria-label="Relación"
          title={`Nueva relación (${shortcutLabel(platform, 'R')})`}
          onClick={() => requestForeignKey()}
        >
          Relación
        </Button>
        <Button
          variant="plain"
          icon="layers"
          aria-label="Nuevo esquema"
          title="Nuevo esquema"
          onClick={() => openSchemaDialog(null)}
        />
        <Button
          variant="plain"
          icon="table-properties"
          aria-label={isFieldsPanelOpen ? 'Cerrar el editor de tabla' : 'Editar campos'}
          aria-pressed={isFieldsPanelOpen}
          title={`Editar campos (${layoutShortcut(platform, 'E')})`}
          disabled={selectedTable === null && !isFieldsPanelOpen}
          onClick={() => {
            if (isFieldsPanelOpen) closeFieldsPanel()
            else openFieldsPanel()
          }}
        />
        <Button
          variant="plain"
          icon="pencil"
          aria-label="Renombrar modelo"
          title="Renombrar modelo"
          onClick={() => openDialog('rename')}
        />

        <Button
          variant="plain"
          icon={isInspectorHidden ? 'panel-right-open' : 'panel-right-close'}
          aria-label={inspectorLabel}
          aria-pressed={!isInspectorHidden}
          title={`${inspectorLabel} (${layoutShortcut(platform, 'I')})`}
          onClick={() => void toggleInspector()}
        />
      </div>
    </header>
  )
}
