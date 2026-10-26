import { BrowserDialog } from '@/components/features/browser/BrowserDialog'
import { FileBrowser } from '@/components/features/browser/FileBrowser'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { formatModified, formatSize } from '@/lib/format'
import type { ModelPreview } from '@/lib/model/summary'
import { ENGINE_LABELS } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Diálogo Abrir modelo, según `project/AbrirModelo.dc.html` del lienzo
 * (FR-012 a FR-017).
 *
 * El explorador es el mismo que usa Elegir carpeta; aquí se le añade el panel
 * de vista previa y el pie con el formato.
 */

/**
 * Único formato que abre la aplicación.
 *
 * El lienzo lo dibuja como un selector, pero mientras no haya más de un
 * formato se escribe como dato: un desplegable con una sola opción promete
 * una elección que no existe.
 */
const FORMAT_LABEL = 'Modelo SQL Designer (.yaml)'

export function OpenModelDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const preview = useAppStore((state) => state.preview)
  const selection = useAppStore((state) => state.selection)
  const openModel = useAppStore((state) => state.openModel)

  const canOpen = preview !== null && !preview.invalid

  /**
   * Abre un modelo; uno roto no cambia de pantalla y deja el diálogo donde
   * estaba, con el aviso de archivo con errores encima (FR-016).
   *
   * @param path Ruta del modelo; por defecto, el seleccionado.
   */
  function open(path: string | null = selection) {
    if (path === null) return
    void openModel(path)
  }

  return (
    <BrowserDialog
      open={dialog === 'open-model'}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      label="Abrir modelo"
      footer={
        <>
          <span className="text-[12px] leading-4 text-label-secondary">Formato</span>
          <span className="text-[12px] leading-4 text-label">{FORMAT_LABEL}</span>
          <div className="flex-1" />
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="primary" disabled={!canOpen} onClick={() => open()}>
            Abrir
          </Button>
        </>
      }
    >
      <div className="flex min-h-0 flex-1">
        <FileBrowser
          onActivateFile={(path) => open(path)}
          className="flex min-w-0 flex-1 flex-col"
        />
        {preview === null ? <EmptyPreview /> : <PreviewPanel preview={preview} onOpen={() => open()} />}
      </div>
    </BrowserDialog>
  )
}

/**
 * Panel derecho mientras no hay nada seleccionado.
 *
 * Ocupa el mismo ancho que la vista previa a propósito: en el lienzo el panel
 * está siempre, y sin él la lista daría un salto de 220 px al seleccionar el
 * primer archivo.
 */
function EmptyPreview() {
  return (
    <aside
      aria-label="Vista previa"
      className="flex w-[220px] flex-none flex-col items-center justify-center gap-2 border-l-[0.5px] border-separator px-5 py-6 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-fill-hover">
        <Icon name="file-code" size={26} className="text-label-tertiary" />
      </span>
      <span className="text-[12px] leading-4 text-label-secondary">
        Selecciona un modelo para ver sus datos.
      </span>
    </aside>
  )
}

/** Props del panel de vista previa. */
interface PreviewPanelProps {
  preview: ModelPreview
  onOpen: () => void
}

/**
 * Panel derecho con los cinco datos del archivo seleccionado (FR-013).
 *
 * Un archivo con errores lo dice aquí mismo, antes de intentar abrirlo, y los
 * datos que no se pudieron leer salen como raya.
 */
function PreviewPanel({ preview, onOpen }: PreviewPanelProps) {
  const rows: Array<[string, string]> = [
    ['Motor', preview.engine === null ? '—' : ENGINE_LABELS[preview.engine]],
    ['Tablas', preview.invalid ? '—' : String(preview.tables)],
    ['Relaciones', preview.invalid ? '—' : String(preview.relations)],
    ['Tamaño', formatSize(preview.sizeBytes)],
    ['Modificado', formatModified(preview.modifiedMs)],
  ]

  return (
    <aside
      aria-label="Vista previa"
      className="flex w-[220px] flex-none flex-col items-center gap-4 border-l-[0.5px] border-separator px-5 py-6"
      onDoubleClick={onOpen}
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-lg ${
          preview.invalid ? 'bg-warning-soft' : 'bg-info-soft'
        }`}
      >
        <Icon
          name={preview.invalid ? 'file-warning' : 'database'}
          size={26}
          className={preview.invalid ? 'text-orange' : 'text-blue'}
        />
      </span>

      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-[15px] font-semibold leading-5">{preview.name}</span>
        <span className="font-mono text-[11px] leading-[14px] text-label-secondary">
          {preview.fileName}
        </span>
      </div>

      {preview.invalid ? (
        <div
          role="alert"
          className="flex w-full gap-2 rounded-md bg-warning-soft p-2.5 text-[12px] leading-4"
        >
          <Icon name="triangle-alert" className="flex-none text-orange" />
          <span>Este archivo tiene errores y no se puede abrir.</span>
        </div>
      ) : null}

      <dl className="m-0 grid w-full grid-cols-2 gap-2 text-[12px] leading-4 [font-variant-numeric:tabular-nums]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-label-secondary">{label}</dt>
            <dd className="m-0 text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
