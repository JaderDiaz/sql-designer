import { FIT_MARGIN, ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas/constants'
import type { Rect, View } from '@/lib/canvas/constants'
import type { Position } from '@/lib/model/types'

/**
 * Zoom y encuadre del lienzo (FR-008 a FR-011).
 *
 * Todo en coordenadas del lienzo: `pan` son píxeles de pantalla y `zoom` la
 * escala del nodo que contiene el modelo. Un punto del modelo se ve en
 * `punto * zoom + pan`, y de esa única fórmula salen las tres funciones.
 */

/**
 * Recorta un zoom a los topes del incremento, 40 % y 200 % (FR-008).
 *
 * @param zoom Zoom pedido.
 */
export function clampZoom(zoom: number): number {
  // Un `NaN` no se puede recortar y vendría de una división por cero en algún
  // gesto: se cae al 100 %, que es un estado del que el usuario puede salir.
  if (Number.isNaN(zoom)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

/**
 * Cambia el zoom dejando quieto el punto del modelo que hay bajo el puntero
 * (FR-009).
 *
 * Es lo que hace que ⌘ + rueda y el pellizco se sientan naturales: se acerca
 * hacia donde se está mirando, no hacia el centro de la ventana.
 *
 * @param view Vista actual.
 * @param zoom Zoom pedido, antes de recortar.
 * @param pointer Puntero en coordenadas del lienzo.
 * @returns La vista nueva, con el zoom ya recortado.
 */
export function zoomAt(view: View, zoom: number, pointer: Position): View {
  const next = clampZoom(zoom)
  const model = {
    x: (pointer.x - view.pan.x) / view.zoom,
    y: (pointer.y - view.pan.y) / view.zoom,
  }
  return {
    pan: { x: pointer.x - model.x * next, y: pointer.y - model.y * next },
    zoom: next,
  }
}

/**
 * Vista que deja todo el modelo visible y centrado (FR-010, FR-011).
 *
 * Parte del envolvente del contenido, no de un rectángulo fijo, así que trae a
 * la vista cualquier posición que traiga el archivo, también negativa o
 * enorme. El zoom se recorta a los topes: un modelo gigante se queda al 40 % y
 * puede no caber entero, que es la única salida honesta sin romper el tope.
 *
 * @param bounds Envolvente del contenido, o `null` si no hay nada que mostrar.
 * @param viewport Caja del lienzo en pantalla.
 * @returns La vista ajustada; con `bounds` nulo, el 100 % sin desplazar.
 */
export function fitToContent(bounds: Rect | null, viewport: Rect): View {
  if (bounds === null || bounds.width <= 0 || bounds.height <= 0) {
    return { pan: { x: 0, y: 0 }, zoom: 1 }
  }

  const usableWidth = Math.max(viewport.width - FIT_MARGIN * 2, 1)
  const usableHeight = Math.max(viewport.height - FIT_MARGIN * 2, 1)
  const zoom = clampZoom(Math.min(usableWidth / bounds.width, usableHeight / bounds.height))

  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  return {
    pan: {
      x: viewport.x + viewport.width / 2 - centerX * zoom,
      y: viewport.y + viewport.height / 2 - centerY * zoom,
    },
    zoom,
  }
}

/**
 * Vista que centra un rectángulo sin tocar el zoom (FR-014, FR-029).
 *
 * Es lo que se usa al abrir un modelo y al enfocar un esquema: acercar o
 * alejar por cuenta propia desorienta, porque la escala es del usuario. Solo
 * «Ajustar» cambia el porcentaje.
 *
 * @param bounds Rectángulo que se quiere ver centrado, o `null` si no hay nada.
 * @param viewport Caja del lienzo en pantalla.
 * @param zoom Zoom actual, que se conserva.
 * @returns La vista centrada; con `bounds` nulo, el origen sin desplazar.
 */
export function centerOnContent(bounds: Rect | null, viewport: Rect, zoom: number): View {
  if (bounds === null || bounds.width <= 0 || bounds.height <= 0) {
    return { pan: { x: 0, y: 0 }, zoom }
  }

  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  return {
    pan: {
      x: viewport.x + viewport.width / 2 - centerX * zoom,
      y: viewport.y + viewport.height / 2 - centerY * zoom,
    },
    zoom,
  }
}

/**
 * Pasa un punto de la pantalla a coordenadas del modelo.
 *
 * @param view Vista actual.
 * @param point Punto en coordenadas del lienzo.
 */
export function toModelPoint(view: View, point: Position): Position {
  return { x: (point.x - view.pan.x) / view.zoom, y: (point.y - view.pan.y) / view.zoom }
}
