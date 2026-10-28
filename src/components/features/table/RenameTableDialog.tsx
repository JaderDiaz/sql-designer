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
 * El nombre se escribe una sola vez, en monoespaciada, como en el tablero
 * `Editor` del lienzo de diseño: lo que se escribe es el nombre técnico, y la
 * pista enseña cómo quedará si lleva mayúsculas, acentos o espacios.
 *
 * Renombrar arrastra todo lo que nombraba a la tabla —sus relaciones, sus
 * únicos, sus índices y sus vistas— en un solo paso de historial, así que ⌘Z
 * lo deshace entero (FR-037, FR-045).
 */

/** Lo que se dice cuando falta el nombre. */
export const EMPTY_NAME_MESSAGE = 'Escribe un nombre para la tabla.'

/** Lo que se dice cuando el nombre técnico no tiene la forma del formato. */
export const INVALID_NAME_MESSAGE = 'Usa letras, números y guion bajo; no empieces con un número.'

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

  const [written, setWritten] = useState('')

  // El diálogo nace con el nombre que la tabla tiene ahora.
  useEffect(() => {
    if (!open) return
    setWritten(target ?? '')
  }, [open, target])

  if (current === undefined) return null
  const name: string = current.name

  const proposed = toTechnicalName(written)

  const error =
    proposed === ''
      ? EMPTY_NAME_MESSAGE
      : // Lo que se escribe es el nombre técnico: empezar por número se dice.
        /^[0-9]/.test(written.trim()) || !TECHNICAL_NAME_PATTERN.test(proposed)
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
      description="Sus relaciones, únicos, índices y vistas se actualizan con el nombre nuevo."
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
          value={written}
          onValueChange={setWritten}
          hint={
            proposed === '' || proposed === written
              ? 'Minúsculas y guion bajo, en singular: pago, residente…'
              : `Se guardará como \`${proposed}\`.`
          }
          error={error}
          inputClassName="font-mono"
          autoFocus
        />
        <p className="m-0 text-[11px] leading-4 text-label-tertiary">⌘Z lo deshace en un paso.</p>
      </div>
    </Sheet>
  )
}
