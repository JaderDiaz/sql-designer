import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { relationsTouching } from '@/lib/model/marks'
import { useAppStore } from '@/store'

/**
 * Confirmación de eliminar un campo (FR-019, FR-020).
 *
 * Un campo se puede llevar más que su columna: la relación que lo usa se va
 * con él, y como un solo paso deshacible, así que el diálogo la nombra antes
 * de tocar nada (RS-08).
 *
 * El último campo de una tabla no se elimina: el archivo exige al menos uno,
 * y en lugar de fallar al confirmar el botón queda deshabilitado con el
 * motivo (FR-020).
 */

/** Lo que se dice cuando el campo es el único de la tabla (FR-020). */
export const LAST_FIELD_MESSAGE = 'Una tabla necesita al menos un campo.'

/** Lo que se dice de la relación que se va con el campo (FR-019). */
export function alsoDeletedMessage(relation: string): string {
  return `Se eliminará también la relación \`${relation}\`.`
}

export function DeleteFieldDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const model = useAppStore((state) => state.model)
  const target = useAppStore((state) => state.deleteFieldTarget)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const deleteField = useAppStore((state) => state.deleteField)

  const open = dialog === 'delete-field'
  const table = (model?.tables ?? []).find((item) => item.name === target?.table)
  if (target === null || table === undefined || model === null) return null

  const relations = relationsTouching(model, { table: target.table, field: target.field })
  const isLast = table.fields.length <= 1

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      title={`¿Eliminar «${target.field}»?`}
      description={
        relations.length === 0
          ? `Este campo se quita de la tabla ${target.table} y del lienzo.`
          : `Este campo lo usa ${
              relations.length === 1 ? 'una relación' : `${relations.length} relaciones`
            }, que se ${relations.length === 1 ? 'eliminará' : 'eliminarán'} con él.`
      }
      icon="trash-2"
      iconClassName="bg-danger-soft"
      iconColorClassName="text-danger-text"
      onSubmit={() => {
        if (isLast) return
        deleteField(target.table, target.field)
      }}
      footer={
        <>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button
            variant="destructive"
            type="submit"
            disabled={isLast}
            title={isLast ? LAST_FIELD_MESSAGE : undefined}
          >
            Eliminar campo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {isLast ? (
          <p role="alert" className="m-0 text-[12px] leading-4 text-label">
            {LAST_FIELD_MESSAGE}
          </p>
        ) : null}

        {relations.map((relation) => (
          <p key={relation.name} className="m-0 text-[12px] leading-4 text-label-secondary">
            {alsoDeletedMessage(relation.name)}
          </p>
        ))}

        <p className="m-0 text-[11px] leading-4 text-label-tertiary">
          Nada se escribe en el archivo hasta que guardes, y ⌘Z lo deshace en un paso.
        </p>
      </div>
    </Sheet>
  )
}
