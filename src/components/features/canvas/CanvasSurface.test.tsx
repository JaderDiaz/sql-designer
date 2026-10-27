import { act, render, screen } from '@testing-library/react'
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
