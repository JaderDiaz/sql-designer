import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import type { RecentEntryRecord } from '@/lib/tauri/types'
import { useAppStore } from '@/store'
import { resolveState, toEntry } from '@/store/recents'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    recentsList: vi.fn(),
    recentsTouch: vi.fn(),
    recentsRemove: vi.fn(),
    modelRead: vi.fn(),
    modelWrite: vi.fn(),
  }
})

const { CommandError } = await import('@/lib/tauri/commands')
const { modelRead, modelWrite, recentsList, recentsRemove, recentsTouch } =
  await import('@/lib/tauri/commands')

/**
 * Entrada de ejemplo tal como la devuelve `recents_list`.
 *
 * @param path Ruta del archivo.
 * @param overrides Campos que el escenario quiere cambiar.
 */
function record(path: string, overrides: Partial<RecentEntryRecord> = {}): RecentEntryRecord {
  const stamp = { modifiedMs: 1_000, sizeBytes: 400 }
  return {
    path,
    name: 'Livy · Reservas',
    engine: 'postgres',
    tables: 6,
    stamp,
    invalid: false,
    usedAtMs: 1_700_000_000_000,
    exists: true,
    diskStamp: stamp,
    ...overrides,
  }
}

const PATH = '/Users/ada/Proyectos/livy/modelo.yaml'

describe('estado de una entrada (data-model.md §2)', () => {
  it('un archivo intacto está «ok»', () => {
    expect(resolveState(record(PATH))).toBe('ok')
  })

  it('un archivo que ya no está es «missing», pase lo que pase con el sello', () => {
    expect(resolveState(record(PATH, { exists: false, diskStamp: null }))).toBe('missing')
  })

  it('un archivo marcado como inválido en el caché es «invalid»', () => {
    expect(resolveState(record(PATH, { invalid: true }))).toBe('invalid')
  })

  it('un sello que no coincide con el disco es «stale»', () => {
    expect(resolveState(record(PATH, { diskStamp: { modifiedMs: 2_000, sizeBytes: 460 } }))).toBe(
      'stale',
    )
  })

  it('la fila lleva el archivo y la carpeta separados', () => {
    const entry = toEntry(record(PATH))
    expect(entry.fileName).toBe('modelo.yaml')
    expect(entry.folder).toBe('/Users/ada/Proyectos/livy')
  })
})

describe('lista de recientes (FR-031, FR-035)', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(recentsList).mockResolvedValue([])
    vi.mocked(recentsTouch).mockResolvedValue([])
    vi.mocked(recentsRemove).mockResolvedValue([])
  })

  it('respeta el orden, el tope y la deduplicación que manda Rust', async () => {
    const paths = Array.from({ length: 10 }, (_, index) => `/Users/ada/m${index}.yaml`)
    vi.mocked(recentsList).mockResolvedValue(
      paths.map((path, index) => record(path, { usedAtMs: 2_000 - index })),
    )

    await useAppStore.getState().refreshRecents()

    const recents = useAppStore.getState().recents
    expect(recents).toHaveLength(10)
    expect(recents.map((entry) => entry.path)).toEqual(paths)
    expect(new Set(recents.map((entry) => entry.path)).size).toBe(10)
  })

  it('la lista nace con el modelo más reciente marcado', async () => {
    vi.mocked(recentsList).mockResolvedValue([
      record(PATH, { usedAtMs: 2_000 }),
      record('/Users/ada/otro.yaml', { usedAtMs: 1_000 }),
    ])

    await useAppStore.getState().refreshRecents()

    // El lienzo nunca deja la lista sin selección: «Abrir» está activo desde
    // el primer momento.
    expect(useAppStore.getState().recentSelection).toBe(PATH)
  })

  it('refrescar conserva la fila marcada si sigue en la lista', async () => {
    vi.mocked(recentsList).mockResolvedValue([
      record(PATH, { usedAtMs: 2_000 }),
      record('/Users/ada/otro.yaml', { usedAtMs: 1_000 }),
    ])
    await useAppStore.getState().refreshRecents()
    useAppStore.getState().selectRecent('/Users/ada/otro.yaml')

    await useAppStore.getState().refreshRecents()

    expect(useAppStore.getState().recentSelection).toBe('/Users/ada/otro.yaml')
  })

  it('una lista que no se puede leer deja la Bienvenida con la lista vacía', async () => {
    vi.mocked(recentsList).mockRejectedValue(new Error('sin permiso'))

    await useAppStore.getState().refreshRecents()

    expect(useAppStore.getState().recents).toEqual([])
    expect(useAppStore.getState().isRecentsLoading).toBe(false)
  })

  it('quitar la única entrada no toca el archivo y deja la lista sin selección', async () => {
    vi.mocked(recentsList).mockResolvedValue([record(PATH)])
    await useAppStore.getState().refreshRecents()
    useAppStore.getState().selectRecent(PATH)

    await useAppStore.getState().removeRecent(PATH)

    expect(recentsRemove).toHaveBeenCalledWith(PATH)
    expect(useAppStore.getState().recents).toEqual([])
    expect(useAppStore.getState().recentSelection).toBeNull()
  })

  it('abrir un reciente que ya no está avisa en vez de leerlo', async () => {
    vi.mocked(recentsList).mockResolvedValue([record(PATH, { exists: false, diskStamp: null })])
    await useAppStore.getState().refreshRecents()

    await useAppStore.getState().openRecent(PATH)

    expect(useAppStore.getState().missingTarget?.path).toBe(PATH)
    expect(modelRead).not.toHaveBeenCalled()
  })
})

describe('revalidación perezosa (FR-042)', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(recentsTouch).mockResolvedValue([])
  })

  it('solo relee las filas cuyo sello no coincide, y refresca el caché', async () => {
    const fresh = { modifiedMs: 9_000, sizeBytes: 520 }
    vi.mocked(recentsList).mockResolvedValue([
      record(PATH, { diskStamp: fresh }),
      record('/Users/ada/otro.yaml'),
    ])
    await useAppStore.getState().refreshRecents()
    vi.mocked(modelRead).mockResolvedValue({
      text: readFixture('modelo-postgres'),
      stamp: fresh,
    })

    await useAppStore.getState().revalidateStale()

    expect(modelRead).toHaveBeenCalledTimes(1)
    expect(modelRead).toHaveBeenCalledWith(PATH)
    expect(recentsTouch).toHaveBeenCalledWith(
      expect.objectContaining({ path: PATH, stamp: fresh, invalid: false }),
    )
    expect(useAppStore.getState().recents[0]?.state).toBe('ok')
  })

  it('un archivo que ya no se puede leer o parsear queda marcado como inválido', async () => {
    vi.mocked(recentsList).mockResolvedValue([
      record(PATH, { diskStamp: { modifiedMs: 9_000, sizeBytes: 520 } }),
    ])
    await useAppStore.getState().refreshRecents()
    vi.mocked(modelRead).mockRejectedValue(new Error('no se pudo leer'))

    await useAppStore.getState().revalidateStale()

    expect(useAppStore.getState().recents[0]?.state).toBe('invalid')
  })
})

describe('renombrar un reciente sin abrirlo (FR-036)', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(recentsList).mockResolvedValue([record(PATH)])
    vi.mocked(recentsTouch).mockResolvedValue([])
    vi.mocked(modelRead).mockResolvedValue({
      text: readFixture('modelo-postgres'),
      stamp: { modifiedMs: 1_000, sizeBytes: 400 },
    })
    vi.mocked(modelWrite).mockResolvedValue({ stamp: { modifiedMs: 2_000, sizeBytes: 410 } })
  })

  it('cambia el nombre del modelo dentro del archivo, no el del archivo', async () => {
    await useAppStore.getState().refreshRecents()
    useAppStore.getState().startRenameRecent(PATH)

    await useAppStore.getState().renameRecent(PATH, 'Livy · Reservas 2027')

    const [writtenPath, text, stamp] = vi.mocked(modelWrite).mock.calls[0] ?? []
    expect(writtenPath).toBe(PATH)
    expect(text).toContain('name: Livy · Reservas 2027')
    expect(stamp).toEqual({ modifiedMs: 1_000, sizeBytes: 400 })

    const entry = useAppStore.getState().recents[0]
    expect(entry?.name).toBe('Livy · Reservas 2027')
    expect(entry?.fileName).toBe('modelo.yaml')
    expect(useAppStore.getState().renameTarget).toBeNull()
  })

  it('refresca el caché de recientes con el nombre nuevo', async () => {
    await useAppStore.getState().refreshRecents()

    await useAppStore.getState().renameRecent(PATH, 'Livy · Reservas 2027')

    expect(recentsTouch).toHaveBeenCalledWith(
      expect.objectContaining({ path: PATH, name: 'Livy · Reservas 2027', invalid: false }),
    )
  })

  it('un nombre vacío no escribe nada', async () => {
    await useAppStore.getState().refreshRecents()

    await useAppStore.getState().renameRecent(PATH, '   ')

    expect(modelRead).not.toHaveBeenCalled()
    expect(modelWrite).not.toHaveBeenCalled()
  })

  it('un archivo tocado por fuera avisa en lugar de pisarlo (FR-025)', async () => {
    await useAppStore.getState().refreshRecents()
    vi.mocked(modelWrite).mockRejectedValue(
      new CommandError({ code: 'model_stale', message: 'El archivo cambió.' }),
    )

    await useAppStore.getState().renameRecent(PATH, 'Livy · Reservas 2027')

    expect(useAppStore.getState().dialog).toBe('stale')
    expect(useAppStore.getState().recents[0]?.name).toBe('Livy · Reservas')
  })
})
