import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import type { DirectoryEntry, Place } from '@/lib/tauri/types'
import { useAppStore } from '@/store'
import { filterEntries, isSelectable } from '@/store/browser'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    fsUserPlaces: vi.fn(),
    fsListDirectory: vi.fn(),
    fsCreateDirectory: vi.fn(),
    modelRead: vi.fn(),
  }
})

const { fsCreateDirectory, fsListDirectory, fsUserPlaces, modelRead } = await import(
  '@/lib/tauri/commands'
)

/** Ubicaciones del escenario, con la virtual «Recientes» sin ruta. */
const PLACES: Place[] = [
  { id: 'recents', label: 'Recientes', icon: 'clock', path: null, canCreateFolder: false },
  {
    id: 'documents',
    label: 'Documentos',
    icon: 'file-text',
    path: '/Users/ada/Documents',
    canCreateFolder: true,
  },
  {
    id: 'desktop',
    label: 'Escritorio',
    icon: 'monitor',
    path: '/Users/ada/Desktop',
    canCreateFolder: true,
  },
]

/**
 * Entrada de ejemplo.
 *
 * @param name Nombre del archivo o de la carpeta.
 * @param kind `folder`, `model` u `other`.
 */
function entry(name: string, kind: 'folder' | 'model' | 'other'): DirectoryEntry {
  return {
    name,
    path: `/Users/ada/Documents/${name}`,
    isDirectory: kind === 'folder',
    sizeBytes: 10,
    modifiedMs: 1_761_000_000_000,
    isModel: kind === 'model',
  }
}

const ENTRIES: DirectoryEntry[] = [
  entry('livy', 'folder'),
  entry('Proyectos', 'folder'),
  entry('modelo.yaml', 'model'),
  entry('notas.txt', 'other'),
]

describe('explorador de archivos (FR-007 a FR-013)', () => {
  beforeEach(() => {
    resetStore()
    useAppStore.setState({ places: [] })
    vi.mocked(fsUserPlaces).mockResolvedValue(PLACES)
    vi.mocked(fsListDirectory).mockResolvedValue(ENTRIES)
  })

  it('arranca en la última carpeta y carga su contenido', async () => {
    resetStore({ preferences: { lastFolder: '/Users/ada/Documents' } })
    useAppStore.setState({ places: [] })

    await useAppStore.getState().startBrowsing('models')

    const state = useAppStore.getState()
    expect(state.browsePath).toBe('/Users/ada/Documents')
    expect(state.placeId).toBe('documents')
    expect(state.entries).toHaveLength(4)
    expect(fsListDirectory).toHaveBeenCalledWith('/Users/ada/Documents', 'models')
  })

  it('sin carpeta recordada arranca en Documentos', async () => {
    await useAppStore.getState().startBrowsing('folders')

    expect(useAppStore.getState().browsePath).toBe('/Users/ada/Documents')
  })

  it('Atrás y Adelante recorren el historial y se agotan en los extremos', async () => {
    await useAppStore.getState().startBrowsing('models')

    await useAppStore.getState().goToFolder('/Users/ada/Documents/livy')
    expect(useAppStore.getState().browseHistory).toEqual(['/Users/ada/Documents'])
    expect(useAppStore.getState().browseFuture).toEqual([])

    await useAppStore.getState().goBack()
    expect(useAppStore.getState().browsePath).toBe('/Users/ada/Documents')
    expect(useAppStore.getState().browseHistory).toEqual([])
    expect(useAppStore.getState().browseFuture).toEqual(['/Users/ada/Documents/livy'])

    // En el extremo no hace nada: el botón se dibuja deshabilitado con esto.
    await useAppStore.getState().goBack()
    expect(useAppStore.getState().browsePath).toBe('/Users/ada/Documents')

    await useAppStore.getState().goForward()
    expect(useAppStore.getState().browsePath).toBe('/Users/ada/Documents/livy')
    expect(useAppStore.getState().browseFuture).toEqual([])

    await useAppStore.getState().goForward()
    expect(useAppStore.getState().browsePath).toBe('/Users/ada/Documents/livy')
  })

  it('ir a una ubicación de la barra lateral la marca, y la virtual no navega', async () => {
    await useAppStore.getState().startBrowsing('models')

    await useAppStore.getState().goToPlace('desktop')
    expect(useAppStore.getState().browsePath).toBe('/Users/ada/Desktop')
    expect(useAppStore.getState().placeId).toBe('desktop')

    await useAppStore.getState().goToPlace('recents')
    expect(useAppStore.getState().browsePath).toBe('/Users/ada/Desktop')
  })

  it('la búsqueda filtra en memoria, sin volver al disco', async () => {
    await useAppStore.getState().startBrowsing('models')
    const llamadas = vi.mocked(fsListDirectory).mock.calls.length

    useAppStore.getState().setQuery('MODELO')

    expect(filterEntries(useAppStore.getState().entries, 'MODELO')).toHaveLength(1)
    expect(vi.mocked(fsListDirectory).mock.calls).toHaveLength(llamadas)
  })

  it('la búsqueda que no encuentra nada deja la lista visible vacía', async () => {
    await useAppStore.getState().startBrowsing('models')

    useAppStore.getState().setQuery('no existe')

    expect(filterEntries(useAppStore.getState().entries, 'no existe')).toEqual([])
  })

  it('solo se puede seleccionar lo que el filtro permite', () => {
    const carpeta = entry('livy', 'folder')
    const modelo = entry('modelo.yaml', 'model')
    const otro = entry('notas.txt', 'other')

    expect(isSelectable(carpeta, 'folders')).toBe(true)
    expect(isSelectable(modelo, 'folders')).toBe(false)
    expect(isSelectable(carpeta, 'models')).toBe(false)
    expect(isSelectable(modelo, 'models')).toBe(true)
    expect(isSelectable(otro, 'models')).toBe(false)
    expect(isSelectable(otro, 'all')).toBe(false)
  })

  it('seleccionar un modelo trae su vista previa', async () => {
    vi.mocked(modelRead).mockResolvedValue({
      text: readFixture('modelo-postgres'),
      stamp: { modifiedMs: 1_761_000_000_000, sizeBytes: 900 },
    })
    await useAppStore.getState().startBrowsing('models')

    await useAppStore.getState().select('/Users/ada/Documents/modelo.yaml')

    const { preview, selection } = useAppStore.getState()
    expect(selection).toBe('/Users/ada/Documents/modelo.yaml')
    expect(preview).toMatchObject({ engine: 'postgres', tables: 6, relations: 6, invalid: false })
  })

  it('seleccionar un archivo roto marca la vista previa con su línea', async () => {
    vi.mocked(modelRead).mockResolvedValue({
      text: readFixture('modelo-roto'),
      stamp: { modifiedMs: 1_761_000_000_000, sizeBytes: 120 },
    })
    await useAppStore.getState().startBrowsing('models')

    await useAppStore.getState().select('/Users/ada/Documents/modelo.yaml')

    expect(useAppStore.getState().preview).toMatchObject({ invalid: true })
    expect(useAppStore.getState().preview?.error?.line).toBe(8)
  })

  it('un archivo que no es modelo no se selecciona y no se lee', async () => {
    await useAppStore.getState().startBrowsing('models')

    await useAppStore.getState().select('/Users/ada/Documents/notas.txt')

    expect(useAppStore.getState().selection).toBeNull()
    expect(modelRead).not.toHaveBeenCalled()
  })

  it('crear una carpeta usa el nombre que devuelve Rust y la deja seleccionada', async () => {
    vi.mocked(fsCreateDirectory).mockResolvedValue({
      name: 'carpeta sin título 2',
      path: '/Users/ada/Documents/carpeta sin título 2',
    })
    vi.mocked(fsListDirectory).mockResolvedValue([
      ...ENTRIES,
      entry('carpeta sin título 2', 'folder'),
    ])
    await useAppStore.getState().startBrowsing('folders')

    const path = await useAppStore.getState().createFolder('carpeta sin título')

    expect(path).toBe('/Users/ada/Documents/carpeta sin título 2')
    expect(useAppStore.getState().selection).toBe('/Users/ada/Documents/carpeta sin título 2')
  })

  it('un listado que falla deja la lista vacía y la causa a la vista', async () => {
    vi.mocked(fsListDirectory).mockRejectedValue(new Error('El sistema no da acceso a esa ruta.'))

    await useAppStore.getState().startBrowsing('models')

    expect(useAppStore.getState().entries).toEqual([])
    expect(useAppStore.getState().browseError).toBe('El sistema no da acceso a esa ruta.')
  })
})
