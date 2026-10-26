import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyModel } from '@/lib/model/defaults'
import { CommandError } from '@/lib/tauri/commands'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return {
    ...actual,
    modelWrite: vi.fn(),
    recentsTouch: vi.fn(),
    measureModelSaved: vi.fn(),
    preferencesUpdate: vi.fn(),
    fsUserPlaces: vi.fn(),
    fsListDirectory: vi.fn(),
    windowControls: vi.fn(),
    windowSetCloseGuard: vi.fn(),
  }
})

const {
  fsUserPlaces,
  measureModelSaved,
  modelWrite,
  recentsTouch,
  windowControls,
  windowSetCloseGuard,
} = await import('@/lib/tauri/commands')

const PATH = '/Users/ada/Proyectos/livy/modelo.yaml'

/**
 * Deja un modelo abierto en el Editor.
 *
 * @param dirty Si tiene cambios sin guardar.
 */
function openEditor(dirty: boolean) {
  resetStore()
  const model = emptyModel('Livy · Reservas', 'postgres')
  useAppStore.setState({
    model,
    savedModel: dirty ? emptyModel('Otro', 'postgres') : model,
    path: PATH,
    stamp: { modifiedMs: 1, sizeBytes: 100 },
    isDirty: dirty,
    screen: 'editor',
  })
}

describe('cerrar el modelo (FR-027, FR-028, FR-030)', () => {
  beforeEach(() => {
    vi.mocked(modelWrite).mockResolvedValue({ stamp: { modifiedMs: 2, sizeBytes: 120 } })
    vi.mocked(recentsTouch).mockResolvedValue([])
    vi.mocked(measureModelSaved).mockResolvedValue(null)
    vi.mocked(windowSetCloseGuard).mockResolvedValue(undefined)
    vi.mocked(windowControls).mockResolvedValue(undefined)
    vi.mocked(fsUserPlaces).mockResolvedValue([])
  })

  it('cerrar sin cambios vuelve a la Bienvenida sin preguntar', () => {
    openEditor(false)

    useAppStore.getState().requestClose()

    const state = useAppStore.getState()
    expect(state.screen).toBe('welcome')
    expect(state.model).toBeNull()
    expect(state.dialog).toBeNull()
  })

  it('cerrar con cambios pregunta y apunta la intención', () => {
    openEditor(true)

    useAppStore.getState().requestClose()

    expect(useAppStore.getState().dialog).toBe('confirm-close')
    expect(useAppStore.getState().pendingIntent).toBe('close')
    expect(useAppStore.getState().screen).toBe('editor')
  })

  it('«Guardar» guarda y continúa con la intención', async () => {
    openEditor(true)
    useAppStore.getState().requestClose()

    await useAppStore.getState().resolvePending('save')

    expect(modelWrite).toHaveBeenCalled()
    expect(useAppStore.getState().screen).toBe('welcome')
    expect(useAppStore.getState().pendingIntent).toBeNull()
  })

  it('si el guardado falla, la intención no se ejecuta y no se pierde nada', async () => {
    openEditor(true)
    useAppStore.getState().requestClose()
    vi.mocked(modelWrite).mockRejectedValueOnce(
      new CommandError({ code: 'path_denied', message: 'Sin permiso.' }),
    )

    await useAppStore.getState().resolvePending('save')

    expect(useAppStore.getState().screen).toBe('editor')
    expect(useAppStore.getState().isDirty).toBe(true)
  })

  it('«No guardar» continúa sin escribir', async () => {
    openEditor(true)
    useAppStore.getState().requestClose()

    await useAppStore.getState().resolvePending('discard')

    expect(modelWrite).not.toHaveBeenCalled()
    expect(useAppStore.getState().screen).toBe('welcome')
  })

  it('«Cancelar» deja el Editor y sus cambios', async () => {
    openEditor(true)
    useAppStore.getState().requestClose()

    await useAppStore.getState().resolvePending('cancel')

    const state = useAppStore.getState()
    expect(state.screen).toBe('editor')
    expect(state.isDirty).toBe(true)
    expect(state.dialog).toBeNull()
    expect(state.pendingIntent).toBeNull()
    expect(modelWrite).not.toHaveBeenCalled()
  })

  it('abrir otro modelo con cambios pasa por la misma pregunta (FR-030)', () => {
    openEditor(true)

    useAppStore.getState().requestIntent('open-model')

    expect(useAppStore.getState().dialog).toBe('confirm-close')
    expect(useAppStore.getState().pendingIntent).toBe('open-model')
  })

  it('crear un modelo sin cambios abre su diálogo directamente', () => {
    openEditor(false)

    useAppStore.getState().requestIntent('new-model')

    expect(useAppStore.getState().dialog).toBe('new-model')
    expect(useAppStore.getState().pendingIntent).toBeNull()
  })

  it('cerrar la ventana sin cambios la cierra de verdad', () => {
    openEditor(false)

    useAppStore.getState().requestQuit()

    expect(windowSetCloseGuard).toHaveBeenCalledWith(false)
  })

  it('cerrar la ventana con cambios pregunta antes de salir', () => {
    openEditor(true)

    useAppStore.getState().requestQuit()

    expect(useAppStore.getState().dialog).toBe('confirm-close')
    expect(useAppStore.getState().pendingIntent).toBe('quit')
    expect(windowControls).not.toHaveBeenCalled()
  })
})
