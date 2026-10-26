import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { fileNameOf } from '@/lib/model/summary'
import { useAppStore } from '@/store'

/**
 * Aviso de que el archivo cambió en el disco desde la última lectura
 * (FR-025).
 *
 * Sin respuesta no se escribe nada: sobrescribir repite el guardado con
 * `force`, y cancelar deja el modelo «Editado» para poder revisar el archivo.
 */
export function StaleFileDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const path = useAppStore((state) => state.path)
  const saveModel = useAppStore((state) => state.saveModel)

  const fileName = fileNameOf(path ?? '')

  return (
    <Sheet
      open={dialog === 'stale'}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      icon="triangle-alert"
      iconClassName="bg-warning-soft"
      iconColorClassName="text-orange"
      title={`«${fileName}» cambió en el disco`}
      description="Otro programa escribió el archivo después de que lo abrieras. Si sobrescribes, se perderá lo que haya cambiado fuera de SQL Designer."
      width={400}
      footer={
        <>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="destructive" onClick={() => void saveModel({ force: true })}>
            Sobrescribir
          </Button>
        </>
      }
    />
  )
}
