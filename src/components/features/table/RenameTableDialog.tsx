import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { TextField } from '@/components/ui/TextField'
import { toTechnicalName } from '@/lib/model/propose'
import { TECHNICAL_NAME_PATTERN } from '@/lib/model/types'
import { useAppStore } from '@/store'

/**
 * Diálogo de renombrar una tabla (FR-037).
 *
 * Se escribe el nombre legible y el diálogo enseña el técnico que se
 * guardará, que es el que viaja al archivo y el que nombran las relaciones;
 * en cuanto se corrige a mano, deja de seguir al legible.
 *
 * Renombrar arrastra todo lo que nombraba a la tabla —sus relaciones, sus
 * únicos, sus índices y sus vistas— en un solo paso de historial, así que ⌘Z
 * lo deshace entero (FR-037, FR-045).
 */

/** Lo que se dice cuando falta el nombre. */
export const EMPTY_NAME_MESSAGE = 'Escribe un nombre para la tabla.'

/** Lo que se dice cuando el nombre técnico no tiene la forma del formato. */
export const INVALID_NAME_MESSAGE =
  'Usa letras, números y guion bajo; no empieces con un número.'

/** Lo que se dice cuando el nombre ya está en el modelo (RS-03). */
export function takenNameMessage(name: string): string {
  return `Ya existe una tabla llamada \`${name}\`.`
}

export function RenameTableDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const model = useAppStore((state) => state.model)
  const target = useAppStore((state) => state.tableTarget)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const renameTable = useAppStore((state) => state.renameTable)

  const open = dialog === 'rename-table'
  const tables = model?.tables ?? []
  const current = tables.find((table) => table.name === target)

  const [label, setLabel] = useState('')
  const [technical, setTechnical] = useState('')
  const [technicalTouched, setTechnicalTouched] = useState(false)

  // El diálogo nace con el nombre que la tabla tiene ahora.
  useEffect(() => {
    if (!open) return
    setLabel(target ?? '')
    setTechnical(target ?? '')
    setTechnicalTouched(true)
  }, [open, target])

  if (current === undefined) return null
  const name: string = current.name

  const proposed = technicalTouched ? technical : toTechnicalName(label)

  const error =
    proposed === ''
      ? EMPTY_NAME_MESSAGE
      : !TECHNICAL_NAME_PATTERN.test(proposed)
        ? INVALID_NAME_MESSAGE
        : proposed !== name && tables.some((table) => table.name === proposed)
          ? takenNameMessage(proposed)
          : null

  const unchanged = proposed === name

  /** Aplica el nombre nuevo y cierra (FR-037). */
  function confirm() {
    if (error !== null || unchanged) return
    renameTable(name, proposed)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      icon="pencil"
      title="Renombrar tabla"
      description={`Se guardará como \`${proposed === '' ? 'sin nombre' : proposed}\`.`}
      onSubmit={confirm}
      footer={
        <>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={error !== null || unchanged}>
            Renombrar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Nombre"
          value={label}
          onValueChange={(value) => {
            setLabel(value)
            setTechnicalTouched(false)
          }}
          hint="De aquí sale el nombre técnico de la tabla."
          autoFocus
        />
        <TextField
          label="Nombre técnico"
          value={proposed}
          onValueChange={(value) => {
            setTechnicalTouched(true)
            setTechnical(value)
          }}
          error={error}
          inputClassName="font-mono"
        />
        <p className="m-0 text-[11px] leading-4 text-label-tertiary">
          Sus relaciones, únicos, índices y vistas se actualizan con el nombre nuevo, y ⌘Z lo
          deshace en un paso.
        </p>
      </div>
    </Sheet>
  )
}
