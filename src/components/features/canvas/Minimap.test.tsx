import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { Minimap } from '@/components/features/canvas/Minimap'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas del minimapa (FR-012).
 *
 * Lo que se protege: que esté todo el modelo —una marca por tabla y el
 * contorno de cada zona—, que el recuadro del área visible siga a la vista, y
 * que pulsar dentro lleve la vista a ese punto sin cambiar la escala.
 */

/** Caja del minimapa en la ventana, que jsdom no mide por su cuenta. */
const BOX = { left: 600, top: 500, width: 168, height: 108 }

/** Deja el modelo abierto, dibuja el minimapa y le da su caja. */
function renderMinimap() {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  act(() => {
    useAppStore.setState({
      screen: 'editor',
      model: result.model,
      savedModel: result.model,
      viewport: { x: 0, y: 0, width: 800, height: 600 },
    })
  })
  const view = render(<Minimap />)
  const node = screen.getByRole('button', { name: 'Minimapa del modelo' })
  node.getBoundingClientRect = () =>
    ({
      ...BOX,
      right: BOX.left + BOX.width,
      bottom: BOX.top + BOX.height,
      x: BOX.left,
      y: BOX.top,
      toJSON: () => undefined,
    }) as DOMRect
  return view
}

/** El minimapa, por su nombre accesible. */
function minimap(): HTMLElement {
  return screen.getByRole('button', { name: 'Minimapa del modelo' })
}

describe('Minimap', () => {
  beforeEach(() => renderMinimap())

  it('dibuja una marca por tabla y el contorno de cada zona (FR-012)', () => {
    const node = minimap()
    expect(node.querySelectorAll('.sm-minimap-mark')).toHaveLength(4)
    expect(node.querySelectorAll('.sm-minimap-zone')).toHaveLength(4)
  })

  it('cada marca lleva el color del esquema de su tabla (FR-040)', () => {
    const facturas = minimap().querySelector<HTMLElement>('[data-table="facturas"]')
    const productos = minimap().querySelector<HTMLElement>('[data-table="productos"]')

    expect(facturas?.style.getPropertyValue('--zone')).toBe('var(--blue)')
    expect(productos?.style.getPropertyValue('--zone')).toBe('var(--green)')
  })

  it('el recuadro del área visible se estrecha al acercarse (FR-012)', () => {
    const view = () => minimap().querySelector<HTMLElement>('[data-view]')
    const wide = view()?.style.width

    act(() => {
      useAppStore.getState().setView({ pan: { x: 0, y: 0 }, zoom: 2 })
    })

    expect(view()?.style.width).not.toBe(wide)
    expect(Number.parseFloat(view()?.style.width ?? '0')).toBeLessThan(
      Number.parseFloat(wide ?? '0'),
    )
  })

  it('pulsar dentro lleva la vista a ese punto sin cambiar la escala (FR-012)', async () => {
    const before = useAppStore.getState().zoom

    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: minimap(),
      coords: { clientX: BOX.left + 20, clientY: BOX.top + 20 },
    })

    expect(useAppStore.getState().zoom).toBe(before)
    expect(useAppStore.getState().pan).not.toEqual({ x: 0, y: 0 })
  })

  it('arrastrar dentro sigue moviendo la vista', async () => {
    await userEvent.pointer([
      {
        keys: '[MouseLeft>]',
        target: minimap(),
        coords: { clientX: BOX.left + 20, clientY: BOX.top + 20 },
      },
      { target: minimap(), coords: { clientX: BOX.left + 140, clientY: BOX.top + 80 } },
      {
        keys: '[/MouseLeft]',
        target: minimap(),
        coords: { clientX: BOX.left + 140, clientY: BOX.top + 80 },
      },
    ])

    const first = useAppStore.getState().pan
    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: minimap(),
      coords: { clientX: BOX.left + 20, clientY: BOX.top + 20 },
    })

    expect(useAppStore.getState().pan).not.toEqual(first)
  })
})

describe('Minimap sin modelo', () => {
  it('no dibuja ninguna marca', () => {
    resetStore()
    render(<Minimap />)

    expect(minimap().querySelectorAll('.sm-minimap-mark')).toHaveLength(0)
  })
})
