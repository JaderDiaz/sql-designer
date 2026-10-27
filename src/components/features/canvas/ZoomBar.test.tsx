import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { ZoomBar } from '@/components/features/canvas/ZoomBar'
import { ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas/constants'
import { readFixture } from '@/lib/model/__fixtures__'
import { parseModel } from '@/lib/model/parse'
import { useAppStore } from '@/store'
import { resetStore } from '@/test/helpers'

/**
 * Pruebas de la barra de zoom (FR-008, FR-010).
 *
 * El porcentaje es la única forma de saber a qué escala se trabaja, y el tope
 * alcanzado se dice deshabilitando el botón en lugar de no hacer nada al
 * pulsarlo.
 */

/** Deja un modelo abierto con el lienzo medido y dibuja la barra. */
function renderBar(zoom = 1) {
  const result = parseModel(readFixture('modelo-tres-esquemas'))
  if (!result.ok) throw new Error('el ejemplo no es un modelo válido')
  resetStore()
  act(() => {
    useAppStore.setState({
      screen: 'editor',
      model: result.model,
      savedModel: result.model,
      viewport: { x: 0, y: 0, width: 800, height: 600 },
      zoom,
    })
  })
  return render(<ZoomBar />)
}

describe('ZoomBar', () => {
  beforeEach(() => renderBar())

  it('muestra el porcentaje y lo anuncia al cambiar (FR-008)', () => {
    const value = screen.getByText('100 %')
    expect(value).toHaveAttribute('aria-live', 'polite')
  })

  it('acercar y alejar cambian el zoom un paso', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Acercar' }))
    expect(useAppStore.getState().zoom).toBeCloseTo(1.1, 6)

    await userEvent.click(screen.getByRole('button', { name: 'Alejar' }))
    expect(useAppStore.getState().zoom).toBeCloseTo(1, 6)
  })

  it('«Ajustar» deja el modelo entero a la vista (FR-010)', async () => {
    act(() => {
      useAppStore.getState().setView({ pan: { x: 4000, y: 4000 }, zoom: 2 })
    })

    await userEvent.click(screen.getByRole('button', { name: /Ajustar/ }))

    expect(useAppStore.getState().zoom).toBeLessThan(2)
    expect(useAppStore.getState().pan).not.toEqual({ x: 4000, y: 4000 })
  })
})

describe('ZoomBar en los topes (FR-008)', () => {
  it('en el 200 % no se puede acercar más', () => {
    renderBar(ZOOM_MAX)

    expect(screen.getByRole('button', { name: 'Acercar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Alejar' })).toBeEnabled()
    expect(screen.getByText('200 %')).toBeInTheDocument()
  })

  it('en el 40 % no se puede alejar más', () => {
    renderBar(ZOOM_MIN)

    expect(screen.getByRole('button', { name: 'Alejar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Acercar' })).toBeEnabled()
    expect(screen.getByText('40 %')).toBeInTheDocument()
  })
})

describe('ZoomBar con el porcentaje escrito (FR-009)', () => {
  /** Abre el campo del porcentaje, que es pulsar lo que dice el zoom. */
  async function abrirCampo() {
    await userEvent.click(screen.getByRole('button', { name: /^Zoom / }))
    return screen.getByRole('textbox', { name: 'Porcentaje de zoom' })
  }

  it('pulsar el porcentaje lo convierte en un campo con el valor dentro', async () => {
    renderBar(1)

    expect(await abrirCampo()).toHaveValue('100')
  })

  it('escribir un porcentaje y pulsar Intro lo aplica', async () => {
    renderBar(1)
    const field = await abrirCampo()

    await userEvent.clear(field)
    await userEvent.type(field, '150{Enter}')

    expect(useAppStore.getState().zoom).toBeCloseTo(1.5)
    expect(screen.getByText('150 %')).toBeInTheDocument()
  })

  it('un porcentaje fuera de los topes se recorta (FR-008)', async () => {
    renderBar(1)
    const field = await abrirCampo()

    await userEvent.clear(field)
    await userEvent.type(field, '900{Enter}')

    expect(useAppStore.getState().zoom).toBe(ZOOM_MAX)
  })

  it('Esc deja el zoom como estaba', async () => {
    renderBar(1)
    const field = await abrirCampo()

    await userEvent.clear(field)
    await userEvent.type(field, '75{Escape}')

    expect(useAppStore.getState().zoom).toBe(1)
    expect(screen.getByText('100 %')).toBeInTheDocument()
  })

  it('lo que no es un número deja el zoom como estaba', async () => {
    renderBar(1)
    const field = await abrirCampo()

    await userEvent.clear(field)
    await userEvent.type(field, 'ocho{Enter}')

    expect(useAppStore.getState().zoom).toBe(1)
  })
})
