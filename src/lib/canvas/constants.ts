/**
 * Medidas del lienzo y topes del zoom.
 *
 * Son las del tablero `Editor` del lienzo de diseño, en píxeles del modelo: la
 * geometría trabaja siempre en coordenadas del modelo y el zoom se aplica
 * después, de una sola vez, al nodo que las contiene (research R1).
 */

/** Ancho de la tarjeta de una tabla. */
export const TABLE_WIDTH = 200

/** Alto de la tarjeta compacta de una tabla. */
export const TABLE_HEIGHT = 64

/** Aire entre el borde de la zona y sus tablas, a los lados y abajo. */
export const ZONE_PADDING = 20

/** Alto del rótulo de la zona, que va dentro del borde superior. */
export const ZONE_HEADER = 40

/** Ancho de la zona de un esquema sin tablas. */
export const EMPTY_ZONE_WIDTH = 240

/** Alto de la zona de un esquema sin tablas. */
export const EMPTY_ZONE_HEIGHT = 180

/** Zoom mínimo: 40 % (FR-008). */
export const ZOOM_MIN = 0.4

/** Zoom máximo: 200 % (FR-008). */
export const ZOOM_MAX = 2

/** Aire que «Ajustar» deja alrededor del modelo (FR-010). */
export const FIT_MARGIN = 48

/** Separación entre dos tablas de la misma rejilla. */
export const GRID_GAP = 40

/** Columnas de la rejilla con la que se coloca un esquema sin posiciones. */
export const GRID_COLUMNS = 3

/** Aire entre la banda de un esquema y la del siguiente. */
export const SCHEMA_GAP = 80

/** Rectángulo en coordenadas del modelo. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Vista del lienzo: cuánto se ha desplazado y a qué escala se dibuja. */
export interface View {
  /** Desplazamiento en píxeles de pantalla. */
  pan: { x: number; y: number }
  /** Escala, entre {@link ZOOM_MIN} y {@link ZOOM_MAX}. */
  zoom: number
}
