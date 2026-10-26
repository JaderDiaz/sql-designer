import { BrowserDialog } from '@/components/features/browser/BrowserDialog'
import { FileBrowser } from '@/components/features/browser/FileBrowser'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import { NEW_FOLDER_NAME } from '@/store/browser'

/**
 * Diálogo Elegir carpeta, según `project/ElegirCarpeta.dc.html` del lienzo
 * (FR-007 a FR-011).
 *
 * Se abre encima de Nuevo modelo sin cerrarlo: el borrador vive en el almacén,
 * así que al volver el nombre y el motor siguen escritos (FR-011).
 *
 * El mismo diálogo sirve para reubicar un guardado cuyo destino desapareció;
 * `choosePurpose` dice qué se hace al pulsar «Elegir» (FR-045).
 */
export function ChooseFolderDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const places = useAppStore((state) => state.places)
  const placeId = useAppStore((state) => state.placeId)
  const browsePath = useAppStore((state) => state.browsePath)
  const selection = useAppStore((state) => state.selection)
  const choosePurpose = useAppStore((state) => state.choosePurpose)
  const createFolder = useAppStore((state) => state.createFolder)
  const setDraftFolder = useAppStore((state) => state.setDraftFolder)
  const openDialog = useAppStore((state) => state.openDialog)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const saveModelAs = useAppStore((state) => state.saveModelAs)

  // Sin nada seleccionado se elige la carpeta en la que se está, que es lo que
  // dice la ruta del pie.
  const chosen = selection ?? browsePath
  const canCreateFolder =
    places.find((place) => place.id === placeId)?.canCreateFolder ?? browsePath !== null

  /** Vuelve a lo que había debajo: Nuevo modelo, o el Editor al reubicar. */
  function back() {
    if (choosePurpose === 'new-model') openDialog('new-model')
    else closeDialog()
  }

  /** Devuelve la carpeta elegida a quien abrió el diálogo. */
  function choose() {
    if (chosen === null) return
    if (choosePurpose === 'new-model') {
      setDraftFolder(chosen)
      openDialog('new-model')
      return
    }
    void saveModelAs(chosen)
  }

  return (
    <BrowserDialog
      open={dialog === 'choose-folder'}
      onOpenChange={(next) => {
        if (!next) back()
      }}
      label={
        choosePurpose === 'new-model'
          ? 'Elegir carpeta para el nuevo modelo'
          : 'Elegir otra carpeta para guardar el modelo'
      }
      width={700}
      height={440}
      footer={
        <>
          <Button
            icon="folder-plus"
            disabled={!canCreateFolder}
            onClick={() => void createFolder(NEW_FOLDER_NAME)}
          >
            Nueva carpeta
          </Button>
          <span className="min-w-0 flex-1 truncate pl-2 font-mono text-[11px] leading-[14px] text-label-secondary">
            {chosen ?? ''}
          </span>
          <Button onClick={back}>Cancelar</Button>
          <Button variant="primary" disabled={chosen === null} onClick={choose}>
            Elegir
          </Button>
        </>
      }
    >
      <FileBrowser className="flex min-h-0 flex-1 flex-col" />
    </BrowserDialog>
  )
}
