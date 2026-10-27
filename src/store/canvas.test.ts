import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas/constants'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import type { Model } from '@/lib/model/types'
import { useAppStore } from '@/store'
import { DEFAULT_PREFERENCES } from '@/store/preferences'
import { resetStore } from '@/test/helpers'

vi.mock('@/lib/tauri/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/commands')>()
  return { ...actual, preferencesUpdate: vi.fn() }
})

const { preferencesUpdate } = await import('@/lib/tauri/commands')

/**
 * Pruebas de la parte del lienzo (FR-006, FR-014, FR-032).
 *
 * Lo que se protege: que la vista arranque ajustada al modelo, que esconder
 * una zona se recuerde en las preferencias y que el foco no sobreviva al
 * modelo que lo tenía.
 */

/** Modelo de ejemplo con tablas en tres esquemas y un cuarto vacío. */
function threeSchemas(): Model {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  return result.model
}

describe('vista del lienzo', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(preferencesUpdate).mockResolvedValue(DEFAULT_PREFERENCES)
  })

  it('«Ajustar» deja el modelo entero a la vista (FR-010, FR-014)', () => {
    useAppStore.setState({ model: threeSchemas() })

    useAppStore.getState().fitToModel()

    const { pan, zoom, viewport } = useAppStore.getState()
    expect(zoom).toBeGreaterThanOrEqual(ZOOM_MIN)
    expect(zoom).toBeLessThanOrEqual(ZOOM_MAX)
    expect(pan.x).toBeGreaterThan(0)
    expect(viewport.width).toBeGreaterThan(0)
  })

  it('sin modelo, «Ajustar» deja el 100 % sin desplazar', () => {
    useAppStore.getState().fitToModel()

    expect(useAppStore.getState()).toMatchObject({ zoom: 1, pan: { x: 0, y: 0 } })
  })

  it('recorta el zoom a los topes al fijar la vista', () => {
    useAppStore.getState().setView({ pan: { x: 10, y: 20 }, zoom: 9 })

    expect(useAppStore.getState().zoom).toBe(ZOOM_MAX)
  })

  it('acercar y alejar no se salen de los topes (FR-008)', () => {
    const { zoomBy } = useAppStore.getState()

    for (let step = 0; step < 40; step += 1) zoomBy(0.1)
    expect(useAppStore.getState().zoom).toBe(ZOOM_MAX)

    for (let step = 0; step < 40; step += 1) zoomBy(-0.1)
    expect(useAppStore.getState().zoom).toBe(ZOOM_MIN)
  })
})

describe('foco y selección', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(preferencesUpdate).mockResolvedValue(DEFAULT_PREFERENCES)
  })

  it('enfocar un esquema lo deja seleccionado y centra el lienzo (FR-029)', () => {
    useAppStore.setState({ model: threeSchemas() })

    useAppStore.getState().focusSchema('inventario')

    expect(useAppStore.getState().focusedSchema).toBe('inventario')
    expect(useAppStore.getState().selectedSchema).toBe('inventario')
  })

  it('enfocar un esquema que no existe no deja foco', () => {
    useAppStore.setState({ model: threeSchemas() })

    useAppStore.getState().focusSchema('contabilidad')

    expect(useAppStore.getState().focusedSchema).toBeNull()
  })

  it('cerrar el modelo quita el foco y la selección (FR-032)', () => {
    useAppStore.setState({ model: threeSchemas() })
    useAppStore.getState().focusSchema('ventas')

    useAppStore.getState().closeModel()

    expect(useAppStore.getState().focusedSchema).toBeNull()
    expect(useAppStore.getState().selectedSchema).toBeNull()
    expect(useAppStore.getState().zoom).toBe(1)
  })
})

describe('disposición de las zonas (FR-006)', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(preferencesUpdate).mockResolvedValue(DEFAULT_PREFERENCES)
  })

  it('esconder la barra lateral escribe la preferencia', async () => {
    await useAppStore.getState().toggleSidebar()

    expect(useAppStore.getState().isSidebarHidden).toBe(true)
    expect(preferencesUpdate).toHaveBeenCalledWith({ sidebarHidden: true })
  })

  it('esconder el inspector escribe la preferencia', async () => {
    await useAppStore.getState().toggleInspector()

    expect(useAppStore.getState().isInspectorHidden).toBe(true)
    expect(preferencesUpdate).toHaveBeenCalledWith({ inspectorHidden: true })
  })

  it('si la escritura falla, la zona vuelve a donde estaba y se dice por qué', async () => {
    vi.mocked(preferencesUpdate).mockRejectedValue(new Error('disco lleno'))

    await useAppStore.getState().toggleSidebar()

    expect(useAppStore.getState().isSidebarHidden).toBe(false)
    expect(useAppStore.getState().writeError).toContain('No se pudo guardar la disposición')
  })

  it('la disposición guardada se aplica al arrancar', () => {
    useAppStore.getState().applyLayoutPreferences({ sidebar: true, inspector: true })

    expect(useAppStore.getState().isSidebarHidden).toBe(true)
    expect(useAppStore.getState().isInspectorHidden).toBe(true)
  })
})
