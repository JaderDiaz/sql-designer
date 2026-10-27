import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Sheet } from '@/components/ui/Sheet'
import { Switch } from '@/components/ui/Switch'
import { useAppStore } from '@/store'

/**
 * Confirmación de eliminar un esquema (FR-033 a FR-037).
 *
 * Antes de eliminar se dice qué queda afectado, porque el esquema no se lleva
 * solo su nombre: con el interruptor apagado sus tablas, sus enums y sus
 * vistas pasan al esquema que se elija, y con él encendido se van con él junto
 * a las relaciones que tocaban a esas tablas.
 *
 * El interruptor arranca apagado: mover es reversible de un vistazo y eliminar
 * no lo parece, aunque las dos cosas se deshagan igual en un paso.
 *
 * Cuando el esquema es el único del modelo no hay interruptor que valga: no
 * existe destino al que mover sus tablas, así que se van con él y el diálogo
 * lo dice en lugar de ofrecer una elección que no existe (FR-035).
 */

/** Cómo se lee el número de tablas afectadas. */
export function affectedLabel(count: number): string {
  if (count === 0) return 'sin tablas'
  return count === 1 ? '1 tabla' : `${count} tablas`
}

export function DeleteSchemaDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const model = useAppStore((state) => state.model)
  const schemaTarget = useAppStore((state) => state.schemaTarget)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const deleteSchema = useAppStore((state) => state.deleteSchema)

  const open = dialog === 'delete-schema'
  const schema = model?.schemas.find((candidate) => candidate.name === schemaTarget)
  const others = (model?.schemas ?? []).filter((candidate) => candidate.name !== schema?.name)

  const [withTables, setWithTables] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)

  // Al abrir, el interruptor vuelve a su estado seguro y el destino vuelve a
  // ser el propuesto, no el que se eligiera la vez anterior.
  useEffect(() => {
    if (!open) return
    setWithTables(false)
    setChosen(null)
  }, [open, schemaTarget])

  if (schema === undefined) return null

  // El destino propuesto es el primer esquema del modelo distinto del que se
  // elimina (FR-036); sin elección, es ese.
  const target = chosen ?? others[0]?.name ?? ''
  // Sin ningún otro esquema, eliminar las tablas no es una opción: es la única
  // salida, así que el interruptor no se pinta y vale por encendido.
  const isOnly = others.length === 0
  const deletesTables = isOnly || withTables

  const tables = (model?.tables ?? []).filter((table) => table.schema === schema.name)
  const enums = (model?.enums ?? []).filter((value) => value.schema === schema.name)
  const views = (model?.views ?? []).filter((view) => view.schema === schema.name)

  /** Lo que se mueve o se va con el esquema, dicho en una frase. */
  const alsoMoves = [
    enums.length > 0 ? (enums.length === 1 ? 'su enum' : `sus ${enums.length} enums`) : null,
    views.length > 0 ? (views.length === 1 ? 'su vista' : `sus ${views.length} vistas`) : null,
  ].filter((part): part is string => part !== null)

  /** Elimina el esquema con lo que se haya elegido y cierra (FR-037). */
  const name = schema.name
  const confirm = () => {
    deleteSchema(name, { withTables: deletesTables, target: deletesTables ? null : target })
    closeDialog()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      title={`¿Eliminar «${schema.name}»?`}
      description={
        tables.length === 0
          ? 'Este esquema no tiene tablas, así que no se moverá nada.'
          : `Este esquema tiene ${affectedLabel(tables.length)}. Decide qué pasa con ${
              tables.length === 1 ? 'ella' : 'ellas'
            }.`
      }
      icon="trash-2"
      iconClassName="bg-danger-soft"
      iconColorClassName="text-danger-text"
      onSubmit={confirm}
      footer={
        <>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="destructive" type="submit">
            {deletesTables && tables.length > 0 ? 'Eliminar esquema y tablas' : 'Eliminar esquema'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {isOnly && tables.length > 0 ? (
          <p className="m-0 text-[12px] leading-4 text-label-secondary">
            Es el único esquema del modelo, así que sus{' '}
            {affectedLabel(tables.length)} se eliminan con él, junto a las relaciones que las
            tocaban. El modelo queda en blanco.
          </p>
        ) : null}

        {!isOnly && tables.length > 0 ? (
          <Switch
            checked={withTables}
            onCheckedChange={setWithTables}
            label={`Eliminar también sus ${affectedLabel(tables.length)}`}
            hint={
              withTables
                ? 'Se eliminan con el esquema, junto a las relaciones que las tocaban.'
                : 'Apagado, las tablas pasan al esquema que elijas.'
            }
          />
        ) : null}

        {!deletesTables && others.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-medium leading-4 text-label">
              {others.length === 1 ? 'Destino' : 'Mover a'}
            </span>
            {others.length === 1 ? (
              // Con un solo destino posible no hay nada que elegir: se nombra.
              <p className="m-0 text-[12px] leading-4 text-label-secondary">
                Todo pasa al esquema <strong className="font-semibold">{others[0]?.name}</strong>,
                el único que queda.
              </p>
            ) : (
              <Select
                value={target}
                onValueChange={setChosen}
                options={others.map((candidate) => ({
                  value: candidate.name,
                  label: `${candidate.abbreviation} · ${candidate.name}`,
                }))}
                label="Esquema de destino"
              />
            )}
          </div>
        ) : null}

        {alsoMoves.length > 0 ? (
          <p className="m-0 text-[12px] leading-4 text-label-secondary">
            {deletesTables ? 'También se eliminan ' : 'También se mueven '}
            {alsoMoves.join(' y ')}.
          </p>
        ) : null}

        <p className="m-0 text-[11px] leading-4 text-label-tertiary">
          Nada se escribe en el archivo hasta que guardes, y ⌘Z lo deshace en un paso.
        </p>
      </div>
    </Sheet>
  )
}
