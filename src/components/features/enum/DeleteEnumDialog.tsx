import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import {
  deleteEnumDescription,
  deleteEnumTitle,
  enumUsage,
  replacementTypeOf,
} from '@/lib/model/enums'
import { useAppStore } from '@/store'

/**
 * Confirmación de eliminar un enum (FR-016 a FR-018).
 *
 * Nombra cada campo que lo usa como `tabla.campo` y el tipo al que pasarán,
 * que sale del catálogo del motor: `varchar(40)` en PostgreSQL y MySQL, `text`
 * en SQLite. Lee la misma lista que la hoja y el menú contextual, así que las
 * tres pantallas cuentan los mismos campos (SC-004). Todo es un solo paso de
 * historial, y la hoja lo dice para que eliminar no parezca definitivo.
 */
export function DeleteEnumDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const model = useAppStore((state) => state.model)
  const target = useAppStore((state) => state.enumTarget)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const deleteEnum = useAppStore((state) => state.deleteEnum)

  const open = dialog === 'delete-enum'
  const value = (model?.enums ?? []).find((item) => item.name === target)
  if (model === null || target === null || value === undefined) return null

  const usage = enumUsage(model, value.name)

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      title={deleteEnumTitle(value.name)}
      description={deleteEnumDescription(usage, replacementTypeOf(model.engine))}
      icon="trash-2"
      iconClassName="bg-danger-soft"
      iconColorClassName="text-danger-text"
      width={380}
      onSubmit={() => deleteEnum(value.name)}
      footer={
        <>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="destructive" type="submit">
            Eliminar enum
          </Button>
        </>
      }
    >
      <p className="m-0 text-[11px] leading-4 text-label-tertiary">
        Nada se escribe en el archivo hasta que guardes, y ⌘Z lo deshace en un paso.
      </p>
    </Sheet>
  )
}
