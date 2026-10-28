import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readFixture } from '@/lib/model/__fixtures__'
import { emptyModel } from '@/lib/model/defaults'
import { CommandError } from '@/lib/tauri/commands'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { RENAME_LABEL, pushHistory } from '@/store/model'
import type { HistoryStep } from '@/store/model'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    modelRead: vi.fn(),
    modelWrite: vi.fn(),
    recentsTouch: vi.fn(),
    preferencesUpdate: vi.fn(),
    measureModelSaved: vi.fn(),
    fsUserPlaces: vi.fn(),
    fsListDirectory: vi.fn(),
  }
})

const { measureModelSaved, modelRead, modelWrite, recentsTouch } = await import(
  '@/lib/tauri/commands'
)

const PATH = '/Users/ada/Proyectos/livy/modelo.yaml'
const STAMP = { modifiedMs: 1_761_000_000_000, sizeBytes: 900 }

/** Deja un modelo abierto y guardado, como después de abrirlo. */
function openSaved(model: Model = emptyModel('Livy · Reservas', 'postgres')) {
  resetStore()
  useAppStore.setState({
    model,
    savedModel: model,
    path: PATH,
    stamp: STAMP,
    isDirty: false,
    savedAtMs: STAMP.modifiedMs,
    past: [],
    future: [],
    saveError: null,
    screen: 'editor',
  })
  return model
}

describe('guardar y estado de cambios (FR-018 a FR-025)', () => {
  beforeEach(() => {
    vi.mocked(modelWrite).mockResolvedValue({ stamp: { modifiedMs: 2, sizeBytes: 950 } })
    vi.mocked(recentsTouch).mockResolvedValue([])
    vi.mocked(measureModelSaved).mockResolvedValue(null)
  })

  it('renombrar marca «Editado» sin tocar el archivo', () => {
    openSaved()

    useAppStore.getState().renameModel('Livy · Reservas 2026')

    expect(useAppStore.getState().model?.name).toBe('Livy · Reservas 2026')
    expect(useAppStore.getState().isDirty).toBe(true)
    expect(useAppStore.getState().path).toBe(PATH)
    expect(modelWrite).not.toHaveBeenCalled()
  })

  it('renombrar con el mismo nombre o con uno vacío no cambia nada', () => {
    const model = openSaved()

    useAppStore.getState().renameModel(model.name)
    useAppStore.getState().renameModel('   ')

    expect(useAppStore.getState().isDirty).toBe(false)
    expect(useAppStore.getState().past).toEqual([])
  })

  it('guardar con éxito limpia «Editado», fija la hora y avisa', async () => {
    openSaved()
    useAppStore.getState().renameModel('Otro nombre')

    const antes = Date.now()
    const ok = await useAppStore.getState().saveModel()

    expect(ok).toBe(true)
    const state = useAppStore.getState()
    expect(state.isDirty).toBe(false)
    expect(state.stamp).toEqual({ modifiedMs: 2, sizeBytes: 950 })
    expect(state.savedAtMs).toBeGreaterThanOrEqual(antes)
    expect(state.notice).toBe('Guardado')
    expect(recentsTouch).toHaveBeenCalled()
  })

  it('guardar sin cambios no reescribe el archivo (FR-021)', async () => {
    openSaved()

    const ok = await useAppStore.getState().saveModel()

    expect(ok).toBe(true)
    expect(modelWrite).not.toHaveBeenCalled()
  })

  it('un archivo cambiado por fuera pregunta antes de escribir (FR-025)', async () => {
    openSaved()
    useAppStore.getState().renameModel('Otro nombre')
    vi.mocked(modelWrite).mockRejectedValueOnce(
      new CommandError({ code: 'model_stale', message: 'El archivo cambió en el disco.' }),
    )

    const ok = await useAppStore.getState().saveModel()

    expect(ok).toBe(false)
    expect(useAppStore.getState().dialog).toBe('stale')
    expect(useAppStore.getState().isDirty).toBe(true)
  })

  it('sobrescribir repite la escritura ya confirmada y cierra el aviso', async () => {
    openSaved()
    useAppStore.getState().renameModel('Otro nombre')
    useAppStore.setState({ dialog: 'stale' })

    await useAppStore.getState().saveModel({ force: true })

    expect(vi.mocked(modelWrite).mock.calls[0]?.[3]).toBe(true)
    expect(useAppStore.getState().dialog).toBeNull()
    expect(useAppStore.getState().isDirty).toBe(false)
  })

  it('un fallo de escritura deja «Editado» y dice la causa (FR-024)', async () => {
    openSaved()
    useAppStore.getState().renameModel('Otro nombre')
    vi.mocked(modelWrite).mockRejectedValueOnce(
      new CommandError({ code: 'path_denied', message: 'El sistema no da acceso a esa ruta.' }),
    )

    const ok = await useAppStore.getState().saveModel()

    expect(ok).toBe(false)
    expect(useAppStore.getState().isDirty).toBe(true)
    expect(useAppStore.getState().model?.name).toBe('Otro nombre')
    expect(useAppStore.getState().saveError).toBe('El sistema no da acceso a esa ruta.')
    expect(useAppStore.getState().notice).toContain('No se pudo guardar')
  })

  it('si la carpeta del modelo ya no está, ofrece elegir otra (FR-045)', async () => {
    openSaved()
    useAppStore.getState().renameModel('Otro nombre')
    vi.mocked(modelWrite).mockRejectedValueOnce(
      new CommandError({ code: 'path_not_found', message: 'La ruta ya no existe.' }),
    )

    await useAppStore.getState().saveModel()

    expect(useAppStore.getState().dialog).toBe('choose-folder')
    expect(useAppStore.getState().choosePurpose).toBe('relocate-save')
    expect(useAppStore.getState().isDirty).toBe(true)
  })
})

describe('deshacer y rehacer (FR-044, RS-06)', () => {
  beforeEach(() => {
    vi.mocked(modelWrite).mockResolvedValue({ stamp: { modifiedMs: 2, sizeBytes: 950 } })
    vi.mocked(recentsTouch).mockResolvedValue([])
  })

  it('deshacer devuelve el nombre anterior y vuelve a «Guardado»', () => {
    const model = openSaved()
    useAppStore.getState().renameModel('Otro nombre')

    useAppStore.getState().undo()

    const state = useAppStore.getState()
    expect(state.model?.name).toBe(model.name)
    expect(state.isDirty).toBe(false)
    expect(state.notice).toBe(`Deshecho: ${RENAME_LABEL}`)
  })

  it('rehacer repone el nombre nuevo y vuelve a «Editado»', () => {
    openSaved()
    useAppStore.getState().renameModel('Otro nombre')
    useAppStore.getState().undo()

    useAppStore.getState().redo()

    const state = useAppStore.getState()
    expect(state.model?.name).toBe('Otro nombre')
    expect(state.isDirty).toBe(true)
    expect(state.notice).toBe(`Rehecho: ${RENAME_LABEL}`)
  })

  it('en los extremos no hace nada', () => {
    openSaved()

    useAppStore.getState().undo()
    useAppStore.getState().redo()

    expect(useAppStore.getState().isDirty).toBe(false)
    expect(useAppStore.getState().past).toEqual([])
    expect(useAppStore.getState().future).toEqual([])
  })

  it('el historial se vacía al abrir y al cerrar un modelo', async () => {
    openSaved()
    useAppStore.getState().renameModel('Otro nombre')
    expect(useAppStore.getState().past).toHaveLength(1)

    vi.mocked(modelRead).mockResolvedValue({ text: readFixture('modelo-postgres'), stamp: STAMP })
    await useAppStore.getState().openModel(PATH)
    expect(useAppStore.getState().past).toEqual([])

    useAppStore.getState().renameModel('Otro más')
    useAppStore.getState().closeModel()
    expect(useAppStore.getState().past).toEqual([])
    expect(useAppStore.getState().future).toEqual([])
  })

  it('un renombrado nuevo descarta lo que se podía rehacer', () => {
    openSaved()
    useAppStore.getState().renameModel('Uno')
    useAppStore.getState().undo()

    useAppStore.getState().renameModel('Dos')

    expect(useAppStore.getState().future).toEqual([])
    expect(useAppStore.getState().model?.name).toBe('Dos')
  })
})

describe('pushHistory: un paso por gesto (FR-024a)', () => {
  /** Modelo de partida y dos cambios seguidos sobre su nombre. */
  const base = emptyModel('Uno', 'postgres')
  const uno: Model = { ...base, name: 'Do' }
  const dos: Model = { ...base, name: 'Dos' }
  const tres: Model = { ...base, name: 'Doscientos' }

  it('tres cambios con la misma clave dejan un solo paso', () => {
    let past: HistoryStep[] = []
    let model: Model = base

    for (const next of [uno, dos, tres]) {
      const patch = pushHistory({ model, savedModel: base, past }, next, 'editar el campo', 'celda')
      past = patch.past
      model = patch.model
    }

    expect(past).toHaveLength(1)
    // Deshacer devuelve el valor de antes de empezar a escribir, no el de la
    // pulsación anterior.
    expect(past[0]?.model.name).toBe('Uno')
    expect(past[0]?.coalesceKey).toBe('celda')
    expect(model.name).toBe('Doscientos')
  })

  it('una clave distinta cierra el paso anterior', () => {
    const first = pushHistory({ model: base, savedModel: base, past: [] }, uno, 'editar', 'a')
    const second = pushHistory(
      { model: first.model, savedModel: base, past: first.past },
      dos,
      'editar',
      'b',
    )

    expect(second.past).toHaveLength(2)
    expect(second.past.map((step) => step.coalesceKey)).toEqual(['a', 'b'])
  })

  it('un paso sin clave nunca se fusiona', () => {
    const first = pushHistory({ model: base, savedModel: base, past: [] }, uno, 'renombrar')
    const second = pushHistory(
      { model: first.model, savedModel: base, past: first.past },
      dos,
      'renombrar',
    )

    expect(second.past).toHaveLength(2)
    expect(second.past[0]?.coalesceKey).toBeUndefined()
  })

  it('siempre limpia el futuro y mide «Editado» contra el guardado', () => {
    const patch = pushHistory(
      { model: base, savedModel: base, past: [] },
      uno,
      'editar',
      'celda',
    )

    expect(patch.future).toEqual([])
    expect(patch.isDirty).toBe(true)
    expect(pushHistory({ model: uno, savedModel: base, past: [] }, base, 'editar').isDirty).toBe(
      false,
    )
  })
})
