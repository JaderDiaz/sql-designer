import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas/constants'
import { contentBounds, schemaZones } from '@/lib/canvas/geometry'
import { resolveLayout } from '@/lib/canvas/layout'
import { serializeModel } from '@/lib/model/serialize'
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

  it('enfocar centra la vista en la zona del esquema, no en el modelo (FR-029)', () => {
    useAppStore.setState({
      model: threeSchemas(),
      viewport: { x: 0, y: 0, width: 800, height: 600 },
    })

    useAppStore.getState().focusSchema('personas')

    const model = useAppStore.getState().model
    if (model === null) throw new Error('el modelo debería estar abierto')
    const zone = schemaZones(model, resolveLayout(model)).find(
      (candidate) => candidate.schema === 'personas',
    )
    if (zone === undefined) throw new Error('la zona debería existir')

    const { pan, zoom } = useAppStore.getState()
    const center = { x: zone.rect.x + zone.rect.width / 2, y: zone.rect.y + zone.rect.height / 2 }
    expect(center.x * zoom + pan.x).toBeCloseTo(400, 6)
    expect(center.y * zoom + pan.y).toBeCloseTo(300, 6)
  })

  it('quitar el foco deja la vista donde está (FR-031)', () => {
    useAppStore.setState({ model: threeSchemas() })
    useAppStore.getState().focusSchema('ventas')
    const view = { pan: useAppStore.getState().pan, zoom: useAppStore.getState().zoom }

    useAppStore.getState().focusSchema(null)

    expect(useAppStore.getState().focusedSchema).toBeNull()
    expect(useAppStore.getState().pan).toEqual(view.pan)
    expect(useAppStore.getState().zoom).toBe(view.zoom)
  })

  it('eliminar el esquema enfocado quita el foco solo (FR-032)', () => {
    const model = threeSchemas()
    useAppStore.setState({ model, savedModel: model })
    useAppStore.getState().focusSchema('ventas')

    useAppStore.getState().deleteSchema('ventas', { withTables: true, target: null })

    expect(useAppStore.getState().focusedSchema).toBeNull()
    expect(useAppStore.getState().selectedSchema).toBeNull()
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

describe('zoom en el puntero y encuadre (FR-008 a FR-011, FR-014)', () => {
  beforeEach(() => {
    resetStore()
    useAppStore.setState({
      model: threeSchemas(),
      viewport: { x: 0, y: 0, width: 800, height: 600 },
    })
  })

  it('acercar conserva el punto del modelo que hay bajo el puntero (FR-009)', () => {
    const pointer = { x: 300, y: 200 }
    const before = {
      x: (pointer.x - useAppStore.getState().pan.x) / useAppStore.getState().zoom,
      y: (pointer.y - useAppStore.getState().pan.y) / useAppStore.getState().zoom,
    }

    useAppStore.getState().zoomBy(0.5, pointer)

    const { pan, zoom } = useAppStore.getState()
    expect(before.x * zoom + pan.x).toBeCloseTo(pointer.x, 6)
    expect(before.y * zoom + pan.y).toBeCloseTo(pointer.y, 6)
  })

  it('sin puntero, el zoom se hace sobre el centro del lienzo', () => {
    useAppStore.getState().zoomBy(0.5)

    const { pan, zoom } = useAppStore.getState()
    const center = { x: 400, y: 300 }
    expect((center.x - pan.x) / zoom).toBeCloseTo(center.x, 6)
    expect((center.y - pan.y) / zoom).toBeCloseTo(center.y, 6)
  })

  it('`zoomTo` recorta a los topes y no se pasa (FR-008)', () => {
    useAppStore.getState().zoomTo(9)
    expect(useAppStore.getState().zoom).toBe(ZOOM_MAX)

    useAppStore.getState().zoomTo(0.01)
    expect(useAppStore.getState().zoom).toBe(ZOOM_MIN)
  })

  it('`zoomTo(1)` devuelve el 100 %, que es lo que hace ⌘0 (FR-039)', () => {
    useAppStore.getState().zoomTo(1.8)
    useAppStore.getState().zoomTo(1)

    expect(useAppStore.getState().zoom).toBe(1)
  })

  it('«Ajustar» parte del envolvente del modelo entero, no de una zona (FR-010)', () => {
    useAppStore.getState().fitToModel()

    const model = useAppStore.getState().model
    if (model === null) throw new Error('el modelo debería estar abierto')
    const bounds = contentBounds(schemaZones(model, resolveLayout(model)))
    if (bounds === null) throw new Error('el modelo debería tener zonas')

    const { pan, zoom, viewport } = useAppStore.getState()
    // Las cuatro esquinas del envolvente caen dentro del lienzo.
    expect(bounds.x * zoom + pan.x).toBeGreaterThanOrEqual(0)
    expect(bounds.y * zoom + pan.y).toBeGreaterThanOrEqual(0)
    expect((bounds.x + bounds.width) * zoom + pan.x).toBeLessThanOrEqual(viewport.width)
    expect((bounds.y + bounds.height) * zoom + pan.y).toBeLessThanOrEqual(viewport.height)
  })

  it('mover la vista no cambia la escala (FR-007)', () => {
    useAppStore.getState().zoomTo(1.5)
    const before = useAppStore.getState().pan

    useAppStore.getState().panBy({ x: -120, y: 45 })

    expect(useAppStore.getState().zoom).toBe(1.5)
    expect(useAppStore.getState().pan).toEqual({ x: before.x - 120, y: before.y + 45 })
  })

  it('centrar en un punto lo deja en el medio del lienzo (FR-012)', () => {
    useAppStore.getState().centerOn({ x: 1000, y: 400 })

    const { pan, zoom } = useAppStore.getState()
    expect(1000 * zoom + pan.x).toBeCloseTo(400, 6)
    expect(400 * zoom + pan.y).toBeCloseTo(300, 6)
  })

  it('ni la vista ni el foco llegan al archivo (FR-014, FR-032)', () => {
    useAppStore.getState().zoomTo(1.7)
    useAppStore.getState().panBy({ x: 300, y: -200 })
    useAppStore.getState().focusSchema('ventas')

    const model = useAppStore.getState().model
    if (model === null) throw new Error('el modelo debería estar abierto')
    const text = serializeModel(model)
    expect(text).not.toContain('zoom')
    expect(text).not.toContain('pan')
    expect(text).not.toContain('focus')
  })

  it('abrir un modelo pide el encuadre y «Ajustar» lo consume (FR-014)', () => {
    useAppStore.getState().requestFit()
    expect(useAppStore.getState().needsFit).toBe(true)

    useAppStore.getState().fitToModel()

    expect(useAppStore.getState().needsFit).toBe(false)
  })
})
