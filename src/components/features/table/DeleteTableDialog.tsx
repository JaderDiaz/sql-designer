import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { relationsTouching } from '@/lib/model/marks'
import { useAppStore } from '@/store'

/**
 * Confirmación de eliminar una tabla (FR-039).
 *
 * Una tabla no se lleva solo sus campos: las relaciones que la tocaban se van
 * con ella, y la confirmación dice cuántas son antes de tocar nada (RS-08).
 * Todo es un solo paso de historial, y el diálogo lo dice para que eliminar no
 * parezca definitivo cuando no lo es.
 */

/** Cómo se lee el número de relaciones que se van con la tabla. */
export function relationsLabel(count: number): string {
  if (count === 0) return 'sin relaciones'
  return count === 1 ? '1 relación' : `${count} relaciones`
}

export function DeleteTableDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const model = useAppStore((state) => state.model)
  const target = useAppStore((state) => state.deleteTableTarget)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const deleteTable = useAppStore((state) => state.deleteTable)

  const open = dialog === 'delete-table'
  const table = (model?.tables ?? []).find((item) => item.name === target)
  if (model === null || target === null || table === undefined) return null

  const relations = relationsTouching(model, { table: target })
  const fields = table.fields.length

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      title={`¿Eliminar «${target}»?`}
      description={
        relations.length === 0
          ? `Esta tabla tiene ${fields === 1 ? '1 campo' : `${fields} campos`} y ninguna relación.`
          : `Se eliminarán también sus ${relationsLabel(relations.length)}.`
      }
      icon="trash-2"
      iconClassName="bg-danger-soft"
      iconColorClassName="text-danger-text"
      onSubmit={() => deleteTable(target)}
      footer={
        <>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="destructive" type="submit">
            {relations.length === 0 ? 'Eliminar tabla' : 'Eliminar tabla y relaciones'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {relations.map((relation) => (
          <p key={relation.name} className="m-0 text-[12px] leading-4 text-label-secondary">
            <code className="font-mono">{relation.name}</code>, entre{' '}
            {relation.fromTable} y {relation.toTable}.
          </p>
        ))}
        <p className="m-0 text-[11px] leading-4 text-label-tertiary">
          Nada se escribe en el archivo hasta que guardes, y ⌘Z lo deshace en un paso.
        </p>
      </div>
    </Sheet>
  )
}
