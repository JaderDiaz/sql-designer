import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useAppStore } from '@/store'

/**
 * Pregunta por los cambios sin guardar antes de cerrar el modelo, abrir otro
 * o cerrar la ventana (FR-028, FR-030).
 *
 * Esc equivale a «Cancelar», que es lo que hace Radix al cerrar la hoja: la
 * respuesta destructiva nunca es la de salirse sin decidir.
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
      icon="triangle-alert"
      iconClassName="bg-warning-soft"
      iconColorClassName="text-orange"
      title="¿Guardar los cambios?"
      description={`«${model?.name ?? ''}» tiene cambios sin guardar. Si no los guardas, se perderán.`}
      width={400}
      footer={
        <>
          <Button onClick={() => void resolvePending('cancel')}>Cancelar</Button>
          <Button variant="destructive" onClick={() => void resolvePending('discard')}>
            No guardar
          </Button>
          <Button variant="primary" onClick={() => void resolvePending('save')}>
            Guardar
          </Button>
        </>
      }
    />
  )
}
