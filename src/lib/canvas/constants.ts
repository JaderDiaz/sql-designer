/**
 * Medidas del lienzo y topes del zoom.
 *
 * Son las del tablero `Editor` del lienzo de diseño, en píxeles del modelo: la
 * geometría trabaja siempre en coordenadas del modelo y el zoom se aplica
 * después, de una sola vez, al nodo que las contiene (research R1).
 */

/** Ancho de la tarjeta de una tabla. */
export const TABLE_WIDTH = 200

/** Alto de la cabecera de la tarjeta: el nombre de la tabla y su chip. */
export const TABLE_HEADER = 42

/** Alto de una fila de campo dentro de la tarjeta. */
export const FIELD_ROW_HEIGHT = 24

/**
 * Paso de la cuadrícula a la que se alinean las tablas al soltarlas.
 *
 * Es el paso de los puntos que el lienzo ya dibuja; el tablero de diseño dice
 * 20 px y aquí son 24 a propósito, para que la tabla caiga sobre un punto
 * visible (research R5, FR-032).
 */
export const GRID_SNAP = 24

/**
 * Alto de la tarjeta de una tabla, que crece con sus campos (research R1).
 *
 * La tarjeta lista sus campos, así que su alto no es una constante: es la
 * cabecera más una fila por campo. Una tabla sin campos —que el archivo no
 * admite, pero que un borrador en pantalla puede tener un instante— mide lo
 * mismo que una de un campo, para que la zona no salte.
 *
 * @param fieldCount Cuántos campos tiene la tabla.
 */
export function tableHeight(fieldCount: number): number {
  return TABLE_HEADER + FIELD_ROW_HEIGHT * Math.max(1, fieldCount)
}

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
