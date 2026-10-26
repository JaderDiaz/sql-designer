import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { TextField } from '@/components/ui/TextField'
import { fileNameOf } from '@/lib/model/summary'
import { NAME_MAX_LENGTH } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { EMPTY_NAME_ERROR } from '@/store/model'

/**
 * Diálogo de renombrar el modelo (FR-020, FR-036).
 *
 * Cambia el nombre del modelo, no el del archivo: por eso lo dice en una
 * frase. El cambio marca «Editado» y entra en el historial, así que ⌘Z lo
 * deshace (FR-044).
 *
 * El mismo diálogo sirve desde el Editor y desde una fila de Recientes; la
 * diferencia es quién aplica el nombre.
 */
export function RenameModelDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const model = useAppStore((state) => state.model)
  const path = useAppStore((state) => state.path)
  const renameModel = useAppStore((state) => state.renameModel)
  const renameTarget = useAppStore((state) => state.renameTarget)
  const renameRecent = useAppStore((state) => state.renameRecent)

  const open = dialog === 'rename'
  const current = renameTarget?.name ?? model?.name ?? ''
  const fileName = fileNameOf(renameTarget?.path ?? path ?? '')
  const [name, setName] = useState(current)

  // El campo nace con el nombre actual cada vez que el diálogo se abre.
  useEffect(() => {
    if (open) setName(current)
  }, [current, open])

  const error = name.trim() === '' ? EMPTY_NAME_ERROR : null

  /** Aplica el nombre nuevo al modelo abierto o al reciente elegido. */
  function confirm() {
    if (error !== null) return
    if (renameTarget !== null) void renameRecent(renameTarget.path, name)
    else renameModel(name)
    closeDialog()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      icon="pencil"
      title="Renombrar el modelo"
      description={`El archivo sigue siendo ${fileName}.`}
      onSubmit={confirm}
      footer={
        <>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={error !== null}>
            Renombrar
          </Button>
        </>
      }
    >
      <TextField
        label="Nombre"
        value={name}
        onValueChange={setName}
        error={error}
        maxLength={NAME_MAX_LENGTH}
        autoFocus
      />
    </Sheet>
  )
}
