import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { TextField } from '@/components/ui/TextField'
import {
  EMPTY_FILE_MESSAGE,
  EMPTY_STEM_MESSAGE,
  fileStemProblem,
  normalizeTypedStem,
  toFileStem,
} from '@/lib/model/slug'
import { ENGINE_LABELS, type Engine } from '@/lib/model/types'
import { pathSeparator } from '@/lib/platform'
import { CommandError, pathBuildModel } from '@/lib/tauri/commands'
import { useAppStore } from '@/store'
import { EMPTY_NAME_ERROR } from '@/store/model'

/**
 * Diálogo Nuevo modelo, según `project/NuevoModelo.dc.html` del lienzo
 * (FR-002 a FR-006).
 *
 * El borrador vive en el almacén, no aquí: Elegir carpeta se abre encima sin
 * cerrar este diálogo y al volver el nombre, el motor y el nombre del archivo
 * siguen escritos.
 *
 * El nombre del modelo y el del archivo son dos cosas distintas: el primero es
 * el que se ve en la aplicación y el segundo el del `.yaml` en el disco. El
 * segundo se propone a partir del primero y se puede cambiar a mano; una vez
 * tocado deja de seguirlo, y «Usar el nombre del modelo» lo devuelve a la
 * propuesta.
 */

/** Los tres motores, en el orden del lienzo. */
const ENGINE_OPTIONS: ReadonlyArray<SegmentedOption<Engine>> = [
  { value: 'postgres', label: ENGINE_LABELS.postgres },
  { value: 'mysql', label: ENGINE_LABELS.mysql },
  { value: 'sqlite', label: ENGINE_LABELS.sqlite },
]

/** Frase que describe cada motor, tal como la escribe el lienzo (FR-006). */
export const ENGINE_HINTS: Record<Engine, string> = {
  postgres: 'Esquemas, enums nativos, JSONB y secuencias.',
  mysql: 'InnoDB, enums por columna y AUTO_INCREMENT.',
  sqlite: 'Un solo archivo, tipos flexibles. Ideal para apps locales.',
}

/** Lo que se dice del archivo cuando lo propone el nombre del modelo. */
export const FILE_AUTO_HINT = 'Se propone a partir del nombre del modelo; puedes cambiarlo.'

/** Lo que se dice del archivo cuando el nombre lo escribió el usuario. */
export const FILE_CUSTOM_HINT = 'Nombre personalizado.'

/**
 * Mensaje del nombre que ya está ocupado en esa carpeta (FR-003).
 *
 * @param fileName Nombre del archivo que ya existe, con su extensión.
 */
export function takenMessage(fileName: string): string {
  return `Ya existe ${fileName} en esta carpeta. Elige otro nombre.`
}

export function NewModelDialog() {
  const dialog = useAppStore((state) => state.dialog)
  const platform = useAppStore((state) => state.platform)
  const closeDialog = useAppStore((state) => state.closeDialog)
  const openChooseFolder = useAppStore((state) => state.openChooseFolder)
  const draftName = useAppStore((state) => state.draftName)
  const draftEngine = useAppStore((state) => state.draftEngine)
  const draftFolder = useAppStore((state) => state.draftFolder)
  const draftFileStem = useAppStore((state) => state.draftFileStem)
  const draftFileTouched = useAppStore((state) => state.draftFileTouched)
  const setDraftName = useAppStore((state) => state.setDraftName)
  const setDraftEngine = useAppStore((state) => state.setDraftEngine)
  const setDraftFileStem = useAppStore((state) => state.setDraftFileStem)
  const resetDraftFileStem = useAppStore((state) => state.resetDraftFileStem)
  const createModel = useAppStore((state) => state.createModel)
  const showNotice = useAppStore((state) => state.showNotice)

  const open = dialog === 'new-model' || dialog === 'choose-folder'
  const [taken, setTaken] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // El nombre propuesto y el que de verdad se va a usar. Sin tocar el campo,
  // el archivo sigue al nombre del modelo; tocado, manda lo escrito.
  const auto = toFileStem(draftName)
  const stem = draftFileTouched ? normalizeTypedStem(draftFileStem) : auto
  const custom = draftFileTouched && stem !== auto

  // La existencia se pregunta al disco, que es quien sabe: el nombre puede
  // haber aparecido en la carpeta mientras el diálogo estaba abierto (FR-003).
  useEffect(() => {
    if (stem === '' || draftFolder === null) {
      setTaken(null)
      return undefined
    }
    let cancelled = false
    void pathBuildModel(draftFolder, stem)
      .then((built) => {
        if (!cancelled) setTaken(built.exists ? built.fileName : null)
      })
      .catch(() => {
        if (!cancelled) setTaken(null)
      })
    return () => {
      cancelled = true
    }
  }, [draftFolder, stem])

  const nameError = draftName.trim() === '' ? EMPTY_NAME_ERROR : null
  const fileError =
    stem === ''
      ? // Con el nombre del modelo vacío ya se queja su propio campo: no hace
        // falta repetir la queja debajo del archivo.
        draftFileTouched
        ? EMPTY_FILE_MESSAGE
        : nameError === null
          ? EMPTY_STEM_MESSAGE
          : null
      : (fileStemProblem(stem) ?? (taken !== null ? takenMessage(taken) : null))
  const error = nameError ?? fileError

  // Con el campo vacío, el lienzo deja los puntos suspensivos en la ruta.
  const fileName = `${stem === '' ? '…' : stem}.yaml`

  /** Crea el modelo y deja el diálogo abierto si el disco se queja (FR-024). */
  async function create() {
    if (error !== null || draftFolder === null || creating) return
    setCreating(true)
    try {
      await createModel({
        name: draftName,
        engine: draftEngine,
        folder: draftFolder,
        fileStem: stem,
      })
    } catch (failure) {
      showNotice(
        failure instanceof CommandError
          ? `No se pudo crear el modelo: ${failure.message}`
          : 'No se pudo crear el modelo.',
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog()
      }}
      title="Nuevo modelo"
      description="Crea un archivo .yaml vacío para empezar a diseñar tus tablas."
      icon="file-plus-2"
      iconClassName="bg-info-soft"
      onSubmit={() => void create()}
      footer={
        <>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button
            variant="primary"
            type="submit"
            disabled={error !== null || draftFolder === null || creating}
          >
            Crear modelo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Nombre del modelo"
          placeholder="Por ejemplo, Livy · Reservas"
          value={draftName}
          onValueChange={setDraftName}
          hint="Es el nombre que verás en la app. Puedes cambiarlo después."
          error={nameError}
          autoFocus
        />

        <TextField
          label="Nombre del archivo"
          placeholder="livy-reservas"
          value={draftFileTouched ? draftFileStem : auto}
          onValueChange={setDraftFileStem}
          inputClassName="font-mono"
          hint={custom ? FILE_CUSTOM_HINT : FILE_AUTO_HINT}
          error={fileError}
          trailing={
            <span className="shrink-0 font-mono text-[12px] leading-[28px] text-label-secondary">
              .yaml
            </span>
          }
          messageTrailing={
            custom ? (
              <Button
                variant="plain"
                size="sm"
                icon="rotate-ccw"
                className="shrink-0"
                onClick={resetDraftFileStem}
              >
                Usar el nombre del modelo
              </Button>
            ) : null
          }
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold leading-[18px]">Motor SQL</span>
          <SegmentedControl
            value={draftEngine}
            onValueChange={setDraftEngine}
            options={ENGINE_OPTIONS}
            label="Motor SQL"
            className="w-full"
          />
          <span className="text-[12px] leading-4 text-label-secondary">
            {ENGINE_HINTS[draftEngine]}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold leading-[18px]">Ubicación</span>
          <div className="flex items-center gap-2">
            <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-sm bg-inset px-2">
              <Icon name="folder" className="text-blue" />
              <span className="min-w-0 flex-1 truncate">{draftFolder ?? 'Elige una carpeta'}</span>
            </div>
            <Button onClick={() => openChooseFolder('new-model')}>Cambiar…</Button>
          </div>
          <span className="truncate font-mono text-[11px] leading-[14px] text-label-secondary">
            {draftFolder === null
              ? 'Elige la carpeta donde se creará el archivo.'
              : `Se creará ${draftFolder}${pathSeparator(platform)}${fileName}`}
          </span>
        </div>
      </div>
    </Sheet>
  )
}
