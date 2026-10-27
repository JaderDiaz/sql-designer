import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { CanvasSurface } from '@/components/features/canvas/CanvasSurface'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas del lienzo: lo que dibuja, lo que selecciona y lo que mueve
 * (FR-023, FR-026, FR-033).
 *
 * El arrastre se escribe en el almacén una sola vez, al soltar, así que lo que
 * se comprueba del gesto es el modelo que queda y el único paso de deshacer,
 * no los píxeles intermedios.
 */

/** Deja el modelo de tres esquemas abierto y dibuja el lienzo. */
function renderCanvas() {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  act(() => {
    useAppStore.setState({
      screen: 'editor',
      model: result.model,
      savedModel: result.model,
      isDirty: false,
    })
  })
  return render(<CanvasSurface />)
}

/** Arrastra la zona de un esquema de un punto a otro. */
async function dragZone(name: string, from: [number, number], to: [number, number]) {
  const zone = screen.getByRole('button', { name: new RegExp(`^Esquema \\w+ · ${name},`) })
  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: zone, coords: { clientX: from[0], clientY: from[1] } },
    { target: zone, coords: { clientX: to[0], clientY: to[1] } },
    { keys: '[/MouseLeft]', target: zone, coords: { clientX: to[0], clientY: to[1] } },
  ])
}

describe('CanvasSurface', () => {
  beforeEach(() => renderCanvas())

  it('dibuja una zona por esquema y una tarjeta por tabla (FR-023)', () => {
    expect(screen.getByRole('button', { name: /^Esquema VEN · ventas, 2 tablas$/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Esquema REP · reportes, sin tablas$/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Tabla facturas, esquema VEN · ventas, 3 campos' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Tabla / })).toHaveLength(4)
  })

  it('pulsar una zona selecciona su esquema, que es lo que mira el inspector (FR-033)', async () => {
    await userEvent.click(screen.getByRole('button', { name: /^Esquema INV · inventario,/ }))

    expect(useAppStore.getState().selectedSchema).toBe('inventario')
  })

  it('arrastrar una zona mueve sus tablas y deja un solo paso de deshacer (FR-026, FR-027)', async () => {
    await dragZone('ventas', [100, 100], [160, 140])

    const tables = useAppStore.getState().model?.tables ?? []
    expect(tables.find((table) => table.name === 'facturas')?.position).toEqual({ x: 60, y: 40 })
    expect(tables.find((table) => table.name === 'pagos')?.position).toEqual({ x: 300, y: 40 })
    expect(tables.find((table) => table.name === 'productos')?.position).toBeUndefined()
    expect(useAppStore.getState().past).toHaveLength(1)
    expect(useAppStore.getState().isDirty).toBe(true)
  })

  it('arrastrar la zona de un esquema sin tablas escribe su posición (FR-026a)', async () => {
    await dragZone('reportes', [100, 100], [50, 125])

    const schema = useAppStore
      .getState()
      .model?.schemas.find((candidate) => candidate.name === 'reportes')
    expect(schema?.position).toEqual({ x: 1050, y: 25 })
  })

  it('el desplazamiento se mide en coordenadas del modelo, no de la pantalla (FR-026)', async () => {
    act(() => {
      useAppStore.getState().setView({ pan: { x: 0, y: 0 }, zoom: 2 })
    })

    await dragZone('ventas', [100, 100], [200, 100])

    expect(useAppStore.getState().model?.tables?.[0]?.position).toEqual({ x: 50, y: 0 })
  })

  it('un clic sin recorrido no mueve nada', async () => {
    await dragZone('ventas', [100, 100], [101, 100])

    expect(useAppStore.getState().past).toHaveLength(0)
    expect(useAppStore.getState().isDirty).toBe(false)
  })

  it('al terminar el gesto el lienzo vuelve a pintar normal (SC-003)', async () => {
    await dragZone('ventas', [100, 100], [160, 140])

    expect(useAppStore.getState().isGesturing).toBe(false)
  })
})

describe('CanvasSurface: mover la vista y hacer zoom (FR-007 a FR-011, FR-039)', () => {
  beforeEach(() => renderCanvas())

  /** El lienzo, por su nombre accesible. */
  function canvas(): HTMLElement {
    return screen.getByRole('application', { name: 'Lienzo del modelo' })
  }

  it('arrastrar desde un espacio vacío mueve la vista (FR-007)', async () => {
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: canvas(), coords: { clientX: 400, clientY: 300 } },
      { target: canvas(), coords: { clientX: 460, clientY: 340 } },
      { keys: '[/MouseLeft]', target: canvas(), coords: { clientX: 460, clientY: 340 } },
    ])

    await waitFor(() => {
      expect(useAppStore.getState().pan).toEqual({ x: 60, y: 40 })
    })
    expect(useAppStore.getState().zoom).toBe(1)
  })

  it('arrastrar con la rueda pulsada mueve la vista también encima de una zona (FR-007)', async () => {
    const zone = screen.getByRole('button', { name: /^Esquema VEN · ventas,/ })

    await userEvent.pointer([
      { keys: '[MouseMiddle>]', target: zone, coords: { clientX: 400, clientY: 300 } },
      { target: zone, coords: { clientX: 380, clientY: 280 } },
      { keys: '[/MouseMiddle]', target: zone, coords: { clientX: 380, clientY: 280 } },
    ])

    await waitFor(() => {
      expect(useAppStore.getState().pan).toEqual({ x: -20, y: -20 })
    })
    // La zona no se movió: el gesto era de la vista.
    expect(useAppStore.getState().model?.tables?.[0]?.position).toBeUndefined()
  })

  it('con la barra espaciadora mantenida, arrastrar una zona mueve la vista (FR-007)', async () => {
    const zone = screen.getByRole('button', { name: /^Esquema VEN · ventas,/ })
    fireEvent.keyDown(canvas(), { key: ' ', code: 'Space' })

    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: zone, coords: { clientX: 400, clientY: 300 } },
      { target: zone, coords: { clientX: 450, clientY: 300 } },
      { keys: '[/MouseLeft]', target: zone, coords: { clientX: 450, clientY: 300 } },
    ])

    await waitFor(() => {
      expect(useAppStore.getState().pan).toEqual({ x: 50, y: 0 })
    })
    expect(useAppStore.getState().model?.tables?.[0]?.position).toBeUndefined()

    fireEvent.keyUp(canvas(), { key: ' ', code: 'Space' })
  })

  it('soltar la barra espaciadora devuelve el arrastre a la zona', async () => {
    fireEvent.keyDown(canvas(), { key: ' ', code: 'Space' })
    fireEvent.keyUp(canvas(), { key: ' ', code: 'Space' })

    await dragZone('ventas', [100, 100], [160, 140])

    expect(useAppStore.getState().model?.tables?.[0]?.position).toEqual({ x: 60, y: 40 })
  })

  it('la rueda sola mueve la vista (FR-007)', async () => {
    fireEvent.wheel(canvas(), { deltaX: 30, deltaY: 50 })

    await waitFor(() => {
      expect(useAppStore.getState().pan).toEqual({ x: -30, y: -50 })
    })
    expect(useAppStore.getState().zoom).toBe(1)
  })

  it('⌘ y la rueda acercan sin mover la escala al centro (FR-009)', async () => {
    fireEvent.wheel(canvas(), { deltaY: -200, metaKey: true })

    await waitFor(() => {
      expect(useAppStore.getState().zoom).toBeGreaterThan(1)
    })
  })

  it('el pellizco del panel táctil aleja igual que ⌘ y la rueda (FR-009)', async () => {
    fireEvent.wheel(canvas(), { deltaY: 200, ctrlKey: true })

    await waitFor(() => {
      expect(useAppStore.getState().zoom).toBeLessThan(1)
    })
  })

  it('el zoom de la rueda no se sale de los topes (FR-008)', async () => {
    for (let index = 0; index < 20; index += 1) {
      fireEvent.wheel(canvas(), { deltaY: -400, metaKey: true })
    }

    await waitFor(() => {
      expect(useAppStore.getState().zoom).toBe(2)
    })
  })

  it('las flechas mueven la vista (FR-039)', async () => {
    fireEvent.keyDown(canvas(), { key: 'ArrowRight' })

    await waitFor(() => {
      expect(useAppStore.getState().pan.x).toBeLessThan(0)
    })
  })

  it('⌘0 devuelve el 100 % y ⇧1 ajusta (FR-039)', () => {
    act(() => {
      useAppStore.getState().setView({ pan: { x: 0, y: 0 }, zoom: 1.8 })
    })

    fireEvent.keyDown(canvas(), { key: '0', metaKey: true })
    expect(useAppStore.getState().zoom).toBe(1)

    fireEvent.keyDown(canvas(), { key: '1', code: 'Digit1', shiftKey: true })
    expect(useAppStore.getState().zoom).not.toBe(1)
  })

  it('⌘+ y ⌘− cambian el zoom un paso (FR-039)', () => {
    fireEvent.keyDown(canvas(), { key: '=', metaKey: true })
    expect(useAppStore.getState().zoom).toBeCloseTo(1.1, 6)

    fireEvent.keyDown(canvas(), { key: '-', metaKey: true })
    expect(useAppStore.getState().zoom).toBeCloseTo(1, 6)
  })
})

describe('CanvasSurface: foco de un esquema (FR-030, FR-031)', () => {
  beforeEach(() => renderCanvas())

  it('con un esquema enfocado, las demás zonas y sus tablas se atenúan (FR-030)', () => {
    act(() => {
      useAppStore.getState().focusSchema('ventas')
    })

    const ventas = screen.getByRole('button', { name: /^Esquema VEN · ventas,/ })
    const inventario = screen.getByRole('button', { name: /^Esquema INV · inventario,/ })
    const facturas = screen.getByRole('button', { name: /^Tabla facturas,/ })
    const productos = screen.getByRole('button', { name: /^Tabla productos,/ })

    expect(ventas.className).not.toContain('is-dim')
    expect(facturas.className).not.toContain('is-dim')
    expect(inventario.className).toContain('is-dim')
    expect(productos.className).toContain('is-dim')
  })

  it('Esc en el lienzo suelta el foco y deja la vista donde está (FR-031)', () => {
    act(() => {
      useAppStore.getState().focusSchema('ventas')
    })
    const view = { pan: useAppStore.getState().pan, zoom: useAppStore.getState().zoom }

    fireEvent.keyDown(screen.getByRole('application', { name: 'Lienzo del modelo' }), {
      key: 'Escape',
    })

    expect(useAppStore.getState().focusedSchema).toBeNull()
    expect(useAppStore.getState().pan).toEqual(view.pan)
    expect(useAppStore.getState().zoom).toBe(view.zoom)
  })
})
