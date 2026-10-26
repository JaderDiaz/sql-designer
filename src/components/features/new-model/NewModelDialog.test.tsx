import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NewModelDialog } from '@/components/features/new-model/NewModelDialog'
import type { Engine } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, pathBuildModel: vi.fn(), fsUserPlaces: vi.fn() }
})

const { fsUserPlaces, pathBuildModel } = await import('@/lib/tauri/commands')

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

describe('Nuevo modelo (FR-002 a FR-006)', () => {

  it('la ruta final se actualiza al escribir el nombre', async () => {
    const user = userEvent.setup()
    renderOpen()

    expect(screen.getByText(`Se creará ${FOLDER}/….yaml`)).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Livy · Reservas')

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

    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), '··· ---')

    expect(screen.getByRole('alert')).toHaveTextContent('Usa al menos una letra o un número.')
    expect(screen.getByRole('button', { name: 'Crear modelo' })).toBeDisabled()
  })

  it('con un archivo que ya existe en la carpeta pide otro nombre y no deja crear', async () => {
    const user = userEvent.setup()
    renderOpen({ taken: ['livy-reservas.yaml'] })

    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Livy · Reservas')

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

    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Livy · Reservas')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Crear modelo' })).toBeEnabled()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
