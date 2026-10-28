import {
  GRID_COLUMNS,
  GRID_GAP,
  SCHEMA_GAP,
  TABLE_WIDTH,
  tableHeight,
} from '@/lib/canvas/constants'
import type { Model, Position } from '@/lib/model/types'

/**
 * Dónde se dibuja cada tabla del modelo (FR-013, FR-028).
 *
 * La posición no es del lienzo: la que el archivo trae es la que el usuario
 * guardó y se respeta sin tocar. Las tablas que el archivo no trae con
 * posición se colocan en una rejilla por esquema, y cada esquema ocupa su
 * propia banda a la derecha de la anterior, para que dos zonas de un modelo
 * recién abierto no se solapen (FR-028).
 *
 * La colocación es determinista —el mismo modelo da el mismo mapa— y no muta
 * el modelo: nada de esto se escribe en el archivo hasta que el usuario mueve
 * algo (FR-013).
 */

/**
 * Resuelve la posición de cada tabla del modelo.
 *
 * @param model Modelo en memoria.
 * @returns Un mapa del nombre técnico de cada tabla a su posición en
 * coordenadas del modelo.
 */
export function resolveLayout(model: Model): Map<string, Position> {
  const layout = new Map<string, Position>()
  const tables = model.tables ?? []
  let cursorX = 0

  for (const schema of model.schemas) {
    const own = tables.filter((table) => table.schema === schema.name)
    if (own.length === 0) continue

    const bandStart = cursorX
    let rightEdge = bandStart
    let placed = 0
    // Cada fila baja el alto de su tabla más alta, no una constante: dos
    // tablas de distinto número de campos no se pueden solapar (research R1).
    let rowTop = 0
    let rowHeight = 0

    for (const table of own) {
      if (table.position) {
        layout.set(table.name, { x: table.position.x, y: table.position.y })
        rightEdge = Math.max(rightEdge, table.position.x + TABLE_WIDTH)
        continue
      }
      const column = placed % GRID_COLUMNS
      if (column === 0 && placed > 0) {
        rowTop += rowHeight + GRID_GAP
        rowHeight = 0
      }
      const position = { x: bandStart + column * (TABLE_WIDTH + GRID_GAP), y: rowTop }
      layout.set(table.name, position)
      rowHeight = Math.max(rowHeight, tableHeight(table.fields.length))
      rightEdge = Math.max(rightEdge, position.x + TABLE_WIDTH)
      placed += 1
    }

    cursorX = rightEdge + SCHEMA_GAP
  }

  return layout
}
