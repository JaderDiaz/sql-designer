import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NewModelDialog } from '@/components/features/new-model/NewModelDialog'
import type { Engine } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { DEFAULT_PREFERENCES } from '@/store/preferences'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    pathBuildModel: vi.fn(),
    fsUserPlaces: vi.fn(),
    modelWrite: vi.fn(),
    recentsTouch: vi.fn(),
    preferencesUpdate: vi.fn(),
  }
})

const { fsUserPlaces, modelWrite, pathBuildModel, preferencesUpdate, recentsTouch } =
  await import('@/lib/tauri/commands')

/** Carpeta del escenario, la misma que el lienzo. */
const FOLDER = '/Users/ada/Proyectos/livy'

/** Opciones del escenario. */
interface Scenario {
  /** Nombres de archivo que ya existen en la carpeta. */
  taken?: string[]
  /** Motor de Ajustes, que es el que debe preseleccionarse (RS-10). */
  engine?: Engine
}

/**
 * Abre el diálogo por la misma vía que la Bienvenida: la acción del almacén,
 * que prepara el borrador con el motor de Ajustes y la última carpeta.
 *
 * @param scenario Archivos ya existentes y motor de Ajustes.
 */
function renderOpen({ taken = [], engine = 'postgres' }: Scenario = {}) {
  resetStore({ preferences: { engine, lastFolder: FOLDER } })
  vi.mocked(fsUserPlaces).mockResolvedValue([])
  vi.mocked(modelWrite).mockResolvedValue({ stamp: { modifiedMs: 1, sizeBytes: 10 } })
  vi.mocked(recentsTouch).mockResolvedValue([])
  vi.mocked(preferencesUpdate).mockResolvedValue(DEFAULT_PREFERENCES)
  vi.mocked(pathBuildModel).mockImplementation((folder: string, stem: string) =>
    Promise.resolve({
      path: `${folder}/${stem}.yaml`,
      fileName: `${stem}.yaml`,
      exists: taken.includes(`${stem}.yaml`),
    }),
  )
  act(() => {
    useAppStore.getState().openNewModel()
  })
  return render(<NewModelDialog />)
}

/** El campo del nombre del modelo. */
function nameField() {
  return screen.getByRole('textbox', { name: 'Nombre del modelo' })
}

/** El campo del nombre del archivo. */
function fileField() {
  return screen.getByRole('textbox', { name: 'Nombre del archivo' })
}

describe('Nuevo modelo (FR-002 a FR-006)', () => {
  it('la ruta final se actualiza al escribir el nombre', async () => {
    const user = userEvent.setup()
    renderOpen()

    expect(screen.getByText(`Se creará ${FOLDER}/….yaml`)).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Nombre del modelo' }), 'Livy · Reservas')

    expect(screen.getByText(`Se creará ${FOLDER}/livy-reservas.yaml`)).toBeInTheDocument()
  })

  it('con el nombre vacío dice el motivo y no deja crear', () => {
    renderOpen()

    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un nombre para el modelo.')
    expect(screen.getByRole('button', { name: 'Crear modelo' })).toBeDisabled()
  })

  it('con un nombre sin letras ni números pide al menos una y no deja crear', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.type(screen.getByRole('textbox', { name: 'Nombre del modelo' }), '··· ---')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Usa al menos una letra o un número en el nombre.',
    )
    expect(screen.getByRole('button', { name: 'Crear modelo' })).toBeDisabled()
  })

  it('con un archivo que ya existe en la carpeta pide otro nombre y no deja crear', async () => {
    const user = userEvent.setup()
    renderOpen({ taken: ['livy-reservas.yaml'] })

    await user.type(screen.getByRole('textbox', { name: 'Nombre del modelo' }), 'Livy · Reservas')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Ya existe livy-reservas.yaml en esta carpeta. Elige otro nombre.',
      )
    })
    expect(screen.getByRole('button', { name: 'Crear modelo' })).toBeDisabled()
  })

  it('con un nombre válido y la carpeta elegida deja crear', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.type(screen.getByRole('textbox', { name: 'Nombre del modelo' }), 'Livy · Reservas')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Crear modelo' })).toBeEnabled()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('el nombre del archivo se propone a partir del nombre del modelo', async () => {
    const user = userEvent.setup()
    renderOpen()

    expect(fileField()).toHaveValue('')
    expect(
      screen.getByText('Se propone a partir del nombre del modelo; puedes cambiarlo.'),
    ).toBeInTheDocument()

    await user.type(nameField(), 'Livy · Reservas')

    expect(fileField()).toHaveValue('livy-reservas')
  })

  it('el nombre del archivo escrito a mano manda sobre la propuesta', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.type(nameField(), 'Livy · Reservas')
    await user.clear(fileField())
    await user.type(fileField(), 'reservas_v2')

    expect(screen.getByText(`Se creará ${FOLDER}/reservas_v2.yaml`)).toBeInTheDocument()
    expect(screen.getByText('Nombre personalizado.')).toBeInTheDocument()

    // El nombre del modelo sigue siendo el suyo y no lo arrastra el archivo.
    await user.type(nameField(), ' 2026')
    expect(fileField()).toHaveValue('reservas_v2')
  })

  it('«Usar el nombre del modelo» devuelve el archivo a la propuesta', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.type(nameField(), 'Livy · Reservas')
    await user.clear(fileField())
    await user.type(fileField(), 'otro-nombre')

    await user.click(screen.getByRole('button', { name: 'Usar el nombre del modelo' }))

    expect(fileField()).toHaveValue('livy-reservas')
    expect(
      screen.queryByRole('button', { name: 'Usar el nombre del modelo' }),
    ).not.toBeInTheDocument()
  })

  it('la extensión escrita a mano no se repite en la ruta', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.type(nameField(), 'Livy · Reservas')
    await user.clear(fileField())
    await user.type(fileField(), 'reservas.yaml')

    expect(screen.getByText(`Se creará ${FOLDER}/reservas.yaml`)).toBeInTheDocument()
  })

  it('un nombre de archivo con espacios dice qué se admite y no deja crear', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.type(nameField(), 'Livy · Reservas')
    await user.clear(fileField())
    await user.type(fileField(), 'livy reservas')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Usa letras, números, guion o guion bajo, sin espacios.',
    )
    expect(screen.getByRole('button', { name: 'Crear modelo' })).toBeDisabled()
  })

  it('con el archivo vaciado a mano pide un nombre para él y no deja crear', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.type(nameField(), 'Livy · Reservas')
    await user.clear(fileField())

    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un nombre para el archivo.')
    expect(screen.getByRole('button', { name: 'Crear modelo' })).toBeDisabled()
  })

  it('el archivo que se crea es el del campo, no el del nombre del modelo', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.type(nameField(), 'Livy · Reservas')
    await user.clear(fileField())
    await user.type(fileField(), 'reservas_v2')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Crear modelo' })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: 'Crear modelo' }))

    await waitFor(() => {
      expect(modelWrite).toHaveBeenCalledWith(`${FOLDER}/reservas_v2.yaml`, expect.any(String))
    })
    expect(useAppStore.getState().model?.name).toBe('Livy · Reservas')
  })

  it('cada motor trae su frase y el inicial es el de Ajustes', async () => {
    const user = userEvent.setup()
    renderOpen({ engine: 'mysql' })

    expect(screen.getByRole('radio', { name: 'MySQL' })).toBeChecked()
    expect(screen.getByText('InnoDB, enums por columna y AUTO_INCREMENT.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'SQLite' }))
    expect(
      screen.getByText('Un solo archivo, tipos flexibles. Ideal para apps locales.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'PostgreSQL' }))
    expect(screen.getByText('Esquemas, enums nativos, JSONB y secuencias.')).toBeInTheDocument()
  })
})
