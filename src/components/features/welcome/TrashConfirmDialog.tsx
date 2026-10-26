import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useAppStore } from '@/store'

/**
 * Confirmación antes de mandar un archivo a la papelera (FR-037, RS-08).
 *
 * Eliminar siempre pregunta, y la pregunta dice qué archivo y de qué carpeta
 * sale. No se borra nada: el archivo pasa a la papelera del sistema, desde
 * donde se puede recuperar, y eso también lo dice la descripción.
 */
export function TrashConfirmDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const trashTarget = useAppStore((state) => state.trashTarget)
  const dismissRecentDialogs = useAppStore((state) => state.dismissRecentDialogs)
  const confirmTrashRecent = useAppStore((state) => state.confirmTrashRecent)

  return (
    <Sheet
      open={dialog === 'trash' && trashTarget !== null}
      onOpenChange={(next) => {
        if (!next) dismissRecentDialogs()
      }}
      icon="trash-2"
      iconClassName="bg-danger-soft"
      iconColorClassName="text-danger-text"
      title={`¿Mover «${trashTarget?.fileName ?? ''}» a la papelera?`}
      description={
        trashTarget === null
          ? ''
          : `Se quita de recientes y el archivo de ${trashTarget.folder} pasa a la Papelera, desde donde puedes recuperarlo.`
      }
      width={380}
      footer={
        <>
          <Button onClick={dismissRecentDialogs}>Cancelar</Button>
          <Button variant="destructive" onClick={() => void confirmTrashRecent()}>
            Mover a la papelera
          </Button>
        </>
      }
    />
  )
}
