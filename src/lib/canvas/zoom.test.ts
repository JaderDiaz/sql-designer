import { describe, expect, it } from 'vitest'

import { FIT_MARGIN, ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas/constants'
import type { Rect, View } from '@/lib/canvas/constants'
import { clampZoom, fitToContent, toModelPoint, zoomAt } from '@/lib/canvas/zoom'

/**
 * Pruebas del zoom y del encuadre (FR-008 a FR-011, SC-004).
 *
 * La garantía que más se nota al usar el lienzo es la de `zoomAt`: el punto
 * del modelo que hay bajo el puntero no se mueve de sitio.
 */

/** Caja del lienzo de las pruebas. */
const VIEWPORT: Rect = { x: 0, y: 0, width: 1000, height: 600 }

/** Vista sin desplazar y al 100 %. */
const IDENTITY: View = { pan: { x: 0, y: 0 }, zoom: 1 }

describe('clampZoom', () => {
  it('recorta a los topes de 40 % y 200 %', () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN)
    expect(clampZoom(9)).toBe(ZOOM_MAX)
    expect(clampZoom(1.25)).toBe(1.25)
  })

  it('devuelve el 100 % con un número que no lo es', () => {
    expect(clampZoom(Number.NaN)).toBe(1)
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_MAX)
  })
})

describe('zoomAt', () => {
  it('deja quieto el punto del modelo que hay bajo el puntero', () => {
    const pointer = { x: 300, y: 220 }
    const before = toModelPoint(IDENTITY, pointer)

    const next = zoomAt(IDENTITY, 1.8, pointer)

    const after = toModelPoint(next, pointer)
    expect(next.zoom).toBe(1.8)
    expect(after.x).toBeCloseTo(before.x, 10)
    expect(after.y).toBeCloseTo(before.y, 10)
  })

  it('recorta el zoom y sigue dejando el punto quieto', () => {
    const pointer = { x: 120, y: 90 }
    const view: View = { pan: { x: -50, y: 30 }, zoom: 1.5 }
    const before = toModelPoint(view, pointer)

    const next = zoomAt(view, 12, pointer)

    expect(next.zoom).toBe(ZOOM_MAX)
    expect(toModelPoint(next, pointer).x).toBeCloseTo(before.x, 10)
    expect(toModelPoint(next, pointer).y).toBeCloseTo(before.y, 10)
  })
})

describe('fitToContent', () => {
  it('deja el contenido dentro de la caja con su margen', () => {
    const bounds: Rect = { x: 0, y: 0, width: 2000, height: 1000 }

    const view = fitToContent(bounds, VIEWPORT)

    const right = bounds.x + bounds.width
    const bottom = bounds.y + bounds.height
    expect(view.pan.x).toBeGreaterThanOrEqual(FIT_MARGIN - 1)
    expect(view.pan.y).toBeGreaterThanOrEqual(FIT_MARGIN - 1)
    expect(right * view.zoom + view.pan.x).toBeLessThanOrEqual(VIEWPORT.width - FIT_MARGIN + 1)
    expect(bottom * view.zoom + view.pan.y).toBeLessThanOrEqual(VIEWPORT.height - FIT_MARGIN + 1)
  })

  it('trae a la vista las posiciones negativas y las enormes (SC-004)', () => {
    const bounds: Rect = { x: -4800, y: -3600, width: 23000, height: 16000 }

    const view = fitToContent(bounds, VIEWPORT)

    const left = bounds.x * view.zoom + view.pan.x
    const top = bounds.y * view.zoom + view.pan.y
    expect(view.zoom).toBe(ZOOM_MIN)
    // Con el tope del 40 % un modelo tan grande no cabe entero, pero su
    // esquina superior izquierda sí entra en la caja y desde ahí se recorre.
    expect(left).toBeLessThan(VIEWPORT.width)
    expect(top).toBeLessThan(VIEWPORT.height)
    expect(Number.isFinite(left)).toBe(true)
  })

  it('no pasa de los topes del zoom con un modelo diminuto', () => {
    const view = fitToContent({ x: 0, y: 0, width: 10, height: 10 }, VIEWPORT)

    expect(view.zoom).toBe(ZOOM_MAX)
  })

  it('devuelve el 100 % centrado con el modelo vacío', () => {
    expect(fitToContent(null, VIEWPORT)).toEqual({ pan: { x: 0, y: 0 }, zoom: 1 })
    expect(fitToContent({ x: 0, y: 0, width: 0, height: 0 }, VIEWPORT)).toEqual({
      pan: { x: 0, y: 0 },
      zoom: 1,
    })
  })

  it('centra el contenido en la caja', () => {
    const bounds: Rect = { x: 100, y: 100, width: 200, height: 100 }

    const view = fitToContent(bounds, VIEWPORT)

    const centerX = (bounds.x + bounds.width / 2) * view.zoom + view.pan.x
    const centerY = (bounds.y + bounds.height / 2) * view.zoom + view.pan.y
    expect(centerX).toBeCloseTo(VIEWPORT.width / 2, 6)
    expect(centerY).toBeCloseTo(VIEWPORT.height / 2, 6)
  })
})
