import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FileErrorDialog } from '@/components/features/open-model/FileErrorDialog'
import { OpenModelDialog } from '@/components/features/open-model/OpenModelDialog'
import { readFixture } from '@/lib/model/__fixtures__'
import type { DirectoryEntry, Place } from '@/lib/tauri/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    fsUserPlaces: vi.fn(),
    fsListDirectory: vi.fn(),
    modelRead: vi.fn(),
    recentsTouch: vi.fn(),
    preferencesUpdate: vi.fn(),
    revealInFileManager: vi.fn(),
  }
})

const { fsListDirectory, fsUserPlaces, modelRead, preferencesUpdate, recentsTouch } =
  await import('@/lib/tauri/commands')

const FOLDER = '/Users/ada/Proyectos/livy'

const PLACES: Place[] = [
  {
    id: 'documents',
    label: 'Documentos',
    icon: 'file-text',
    path: '/Users/ada/Documents',
    canCreateFolder: true,
  },
]

/**
 * Entrada de ejemplo dentro de la carpeta del escenario.
 *
 * @param name Nombre del archivo o de la carpeta.
 * @param kind Tipo de la entrada.
 */
function entry(name: string, kind: 'folder' | 'model' | 'other'): DirectoryEntry {
  return {
    name,
    path: `${FOLDER}/${name}`,
    isDirectory: kind === 'folder',
    sizeBytes: 28 * 1024,
    modifiedMs: Date.now(),
    isModel: kind === 'model',
  }
}

const ENTRIES: DirectoryEntry[] = [
  entry('migraciones', 'folder'),
  entry('modelo.yaml', 'model'),
  entry('facturacion.yaml', 'model'),
  entry('schema.sql', 'other'),
]

/**
 * Abre el diálogo ya explorando la carpeta del escenario.
 *
 * @param entries Contenido de la carpeta; por defecto, el del escenario.
 */
async function renderOpen(entries: DirectoryEntry[] = ENTRIES) {
  resetStore({ preferences: { lastFolder: FOLDER } })
  useAppStore.setState({ places: [] })
  vi.mocked(fsUserPlaces).mockResolvedValue(PLACES)
  vi.mocked(fsListDirectory).mockResolvedValue(entries)
  const view = render(
    <>
      <OpenModelDialog />
      <FileErrorDialog />
    </>,
  )
  await act(async () => {
    useAppStore.getState().openOpenModel()
  })
  return view
}

describe('Abrir modelo (FR-012 a FR-017)', () => {
  beforeEach(() => {
    vi.mocked(modelRead).mockResolvedValue({
      text: readFixture('modelo-postgres'),
      stamp: { modifiedMs: Date.now(), sizeBytes: 28 * 1024 },
    })
    vi.mocked(recentsTouch).mockResolvedValue([])
    vi.mocked(preferencesUpdate).mockResolvedValue({
      formatVersion: 1,
      theme: 'system',
      showWelcomeOnStart: true,
      window: null,
      lastModelPath: null,
      engine: 'postgres',
      lastFolder: null,
    })
  })

  it('sin selección «Abrir» está deshabilitado y la vista previa está vacía', async () => {
    await renderOpen()

    expect(screen.getByRole('button', { name: 'Abrir' })).toBeDisabled()
    // El panel se reserva desde el principio para que la ventana no salte de
    // ancho al seleccionar el primer archivo.
    const preview = screen.getByRole('complementary', { name: 'Vista previa' })
    expect(preview).toHaveTextContent('Selecciona un modelo para ver sus datos.')
  })

  it('la vista previa muestra los cinco datos del modelo seleccionado', async () => {
    const user = userEvent.setup()
    await renderOpen()

    await user.click(screen.getByRole('option', { name: /modelo\.yaml/ }))

    const preview = await screen.findByRole('complementary', { name: 'Vista previa' })
    expect(within(preview).getByText('PostgreSQL')).toBeInTheDocument()
    expect(within(preview).getByText('28 KB')).toBeInTheDocument()
    expect(within(preview).getByText(/^Hoy,/)).toBeInTheDocument()
    const relaciones = within(preview).getByText('Relaciones').nextElementSibling
    expect(relaciones).toHaveTextContent('6')
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeEnabled()
  })

  it('doble clic sobre un modelo lo abre en el Editor', async () => {
    const user = userEvent.setup()
    await renderOpen()

    await user.dblClick(screen.getByRole('option', { name: /modelo\.yaml/ }))

    await waitFor(() => {
      expect(useAppStore.getState().screen).toBe('editor')
    })
    expect(useAppStore.getState().model?.engine).toBe('postgres')
  })

  it('un archivo con errores marca la vista previa y abre el diálogo con la línea', async () => {
    const user = userEvent.setup()
    await renderOpen()
    vi.mocked(modelRead).mockResolvedValue({
      text: readFixture('modelo-roto'),
      stamp: { modifiedMs: Date.now(), sizeBytes: 120 },
    })

    await user.click(screen.getByRole('option', { name: /facturacion\.yaml/ }))

    const preview = await screen.findByRole('complementary', { name: 'Vista previa' })
    expect(within(preview).getByRole('alert')).toHaveTextContent(
      'Este archivo tiene errores y no se puede abrir.',
    )
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeDisabled()

    await act(async () => {
      await useAppStore.getState().openModel(`${FOLDER}/facturacion.yaml`)
    })

    expect(await screen.findByText('No se pudo abrir «facturacion.yaml»')).toBeInTheDocument()
    expect(screen.getByText(/Línea 8:/)).toBeInTheDocument()
    expect(useAppStore.getState().screen).toBe('welcome')
  })

  it('los archivos que no son .yaml salen deshabilitados y no se seleccionan', async () => {
    const user = userEvent.setup()
    await renderOpen()

    const otro = screen.getByRole('option', { name: /schema\.sql/ })
    expect(otro).toBeDisabled()

    await user.click(otro)
    expect(useAppStore.getState().selection).toBeNull()
  })

  it('doble clic en una carpeta entra en ella', async () => {
    const user = userEvent.setup()
    await renderOpen()

    await user.dblClick(screen.getByRole('option', { name: /migraciones/ }))

    await waitFor(() => {
      expect(useAppStore.getState().browsePath).toBe(`${FOLDER}/migraciones`)
    })
  })

  it('la búsqueda sin coincidencias dice «Sin resultados» con el texto buscado', async () => {
    const user = userEvent.setup()
    await renderOpen()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar archivos' }), 'zzz')

    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    expect(screen.getByText('Ningún archivo coincide con «zzz».')).toBeInTheDocument()
  })

  it('una carpeta sin modelos lo dice con su explicación', async () => {
    await renderOpen([])

    expect(screen.getByText('No hay modelos aquí')).toBeInTheDocument()
    expect(screen.getByText('Los modelos de SQL Designer son archivos .yaml.')).toBeInTheDocument()
  })
})
