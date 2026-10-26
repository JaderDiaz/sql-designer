import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChooseFolderDialog } from '@/components/features/choose-folder/ChooseFolderDialog'
import type { DirectoryEntry, Place } from '@/lib/tauri/types'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    fsUserPlaces: vi.fn(),
    fsListDirectory: vi.fn(),
    fsCreateDirectory: vi.fn(),
  }
})

const { fsCreateDirectory, fsListDirectory, fsUserPlaces } = await import('@/lib/tauri/commands')

const PARENT = '/Users/ada/Proyectos'

const PLACES: Place[] = [
  {
    id: 'documents',
    label: 'Documentos',
    icon: 'file-text',
    path: PARENT,
    canCreateFolder: true,
  },
  { id: 'recents', label: 'Recientes', icon: 'clock', path: null, canCreateFolder: false },
]

/**
 * Entrada de ejemplo dentro de la carpeta padre.
 *
 * @param name Nombre del archivo o de la carpeta.
 * @param isDirectory Si es carpeta.
 */
function entry(name: string, isDirectory: boolean): DirectoryEntry {
  return {
    name,
    path: `${PARENT}/${name}`,
    isDirectory,
    sizeBytes: 10,
    modifiedMs: Date.now(),
    isModel: !isDirectory && name.endsWith('.yaml'),
  }
}

const ENTRIES: DirectoryEntry[] = [
  entry('livy', true),
  entry('clientes', true),
  entry('notas.md', false),
]

/**
 * Abre Elegir carpeta con el borrador de Nuevo modelo ya escrito.
 *
 * @param entries Contenido de la carpeta; por defecto, el del escenario.
 */
async function renderOpen(entries: DirectoryEntry[] = ENTRIES) {
  resetStore({ preferences: { lastFolder: PARENT } })
  useAppStore.setState({
    places: [],
    draftName: 'Livy · Reservas',
    draftEngine: 'mysql',
    draftFolder: PARENT,
  })
  vi.mocked(fsUserPlaces).mockResolvedValue(PLACES)
  vi.mocked(fsListDirectory).mockResolvedValue(entries)
  const view = render(<ChooseFolderDialog />)
  await act(async () => {
    useAppStore.getState().openChooseFolder('new-model')
  })
  return view
}

describe('Elegir carpeta (FR-007 a FR-011)', () => {
  beforeEach(() => {
    vi.mocked(fsCreateDirectory).mockResolvedValue({
      name: 'carpeta sin título',
      path: `${PARENT}/carpeta sin título`,
    })
  })

  it('solo se pueden seleccionar carpetas; los archivos salen deshabilitados', async () => {
    const user = userEvent.setup()
    await renderOpen()

    const archivo = screen.getByRole('option', { name: /notas\.md/ })
    expect(archivo).toBeDisabled()

    await user.click(screen.getByRole('option', { name: /livy/ }))
    expect(useAppStore.getState().selection).toBe(`${PARENT}/livy`)
  })

  it('«Elegir» devuelve la carpeta al borrador y vuelve a Nuevo modelo', async () => {
    const user = userEvent.setup()
    await renderOpen()

    await user.click(screen.getByRole('option', { name: /clientes/ }))
    await user.click(screen.getByRole('button', { name: 'Elegir' }))

    const state = useAppStore.getState()
    expect(state.draftFolder).toBe(`${PARENT}/clientes`)
    expect(state.dialog).toBe('new-model')
    // El borrador sobrevive a elegir la carpeta (FR-011).
    expect(state.draftName).toBe('Livy · Reservas')
    expect(state.draftEngine).toBe('mysql')
  })

  it('«Cancelar» vuelve a Nuevo modelo sin tocar el borrador', async () => {
    const user = userEvent.setup()
    await renderOpen()

    await user.click(screen.getByRole('option', { name: /clientes/ }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    const state = useAppStore.getState()
    expect(state.draftFolder).toBe(PARENT)
    expect(state.dialog).toBe('new-model')
    expect(state.draftName).toBe('Livy · Reservas')
  })

  it('«Nueva carpeta» crea «carpeta sin título» y la deja seleccionada', async () => {
    const user = userEvent.setup()
    await renderOpen()
    vi.mocked(fsListDirectory).mockResolvedValue([...ENTRIES, entry('carpeta sin título', true)])

    await user.click(screen.getByRole('button', { name: 'Nueva carpeta' }))

    expect(fsCreateDirectory).toHaveBeenCalledWith(PARENT, 'carpeta sin título')
    expect(useAppStore.getState().selection).toBe(`${PARENT}/carpeta sin título`)
  })

  it('una carpeta sin subcarpetas lo dice con su explicación', async () => {
    await renderOpen([])

    expect(screen.getByText('Carpeta vacía')).toBeInTheDocument()
    expect(
      screen.getByText('Crea una carpeta nueva o elige otra ubicación.'),
    ).toBeInTheDocument()
  })

  it('la búsqueda sin coincidencias dice «Sin resultados» con el texto buscado', async () => {
    const user = userEvent.setup()
    await renderOpen()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar carpetas' }), 'zzz')

    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    expect(screen.getByText('Ninguna carpeta coincide con «zzz».')).toBeInTheDocument()
  })

  it('«Nueva carpeta» se deshabilita donde no se puede escribir', async () => {
    await renderOpen()

    await act(async () => {
      await useAppStore.getState().goToPlace('recents')
    })
    act(() => {
      useAppStore.setState({ placeId: 'recents' })
    })

    expect(screen.getByRole('button', { name: 'Nueva carpeta' })).toBeDisabled()
  })
})
