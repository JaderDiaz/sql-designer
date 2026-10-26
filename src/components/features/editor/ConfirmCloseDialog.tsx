import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useAppStore } from '@/store'

/**
 * Pregunta por los cambios sin guardar antes de cerrar el modelo, abrir otro
 * o cerrar la ventana (FR-028, FR-030).
 *
 * Esc equivale a «Cancelar», que es lo que hace Radix al cerrar la hoja: la
 * respuesta destructiva nunca es la de salirse sin decidir.
 *
 * El orden y los tonos son los del lienzo: «No guardar» a la izquierda y en
 * tono normal —no destructivo—, «Cancelar» en medio y «Guardar» como acción
 * principal, que es además la que recibe el foco.
 */
export function ConfirmCloseDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const model = useAppStore((state) => state.model)
  const resolvePending = useAppStore((state) => state.resolvePending)

  return (
    <Sheet
      open={dialog === 'confirm-close'}
      onOpenChange={(next) => {
        if (!next) void resolvePending('cancel')
      }}
      icon="save"
      title={`¿Guardar los cambios de «${model?.name ?? ''}»?`}
      description="Si no guardas, se perderán los cambios hechos desde la última vez que guardaste."
      width={380}
      footer={
        <>
          <Button onClick={() => void resolvePending('discard')}>No guardar</Button>
          <Button onClick={() => void resolvePending('cancel')}>Cancelar</Button>
          <Button variant="primary" onClick={() => void resolvePending('save')}>
            Guardar
          </Button>
        </>
      }
    />
  )
}
