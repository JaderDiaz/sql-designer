import { preferencesUpdate } from '@/lib/tauri/commands'
import type { AppSlice } from '@/store/types'

/**
 * Parte del panel inferior de campos: si está abierto, su alto y la celda
 * enfocada (FR-010, FR-022, FR-023).
 *
 * El alto es preferencia de la aplicación, no del archivo: el modelo no
 * recuerda cómo estaba la pantalla. Durante el arrastre del tirador solo
 * cambia el alto de la sesión; la preferencia se escribe al soltar, con
 * `commit`, para no pedirle un guardado al disco en cada `pointermove`
 * (contracts/tables.md §2.3).
 */

/** Columnas de la rejilla, en el orden en que se muestran (FR-011). */
export type FieldColumn =
  | 'key'
  | 'name'
  | 'type'
  | 'length'
  | 'scale'
  | 'nullable'
  | 'default'
  | 'comment'
  | 'order'

/** Columnas de la rejilla de claves foráneas, en orden (FR-006). */
export type ForeignKeyColumn =
  | 'column'
  | 'reference'
  | 'onDelete'
  | 'onUpdate'
  | 'index'
  | 'remove'

/** Fichas del panel inferior (FR-003, research R9). */
export type PanelTab = 'fields' | 'foreignKeys'

/**
 * Celda enfocada de una de las dos rejillas del panel.
 *
 * En la ficha «Campos», `field` es el nombre del campo; en la de claves
 * foráneas es el nombre de la relación, que es lo que identifica a su fila.
 * Las dos rejillas comparten esta celda porque solo una está a la vista
 * (data-model.md §3).
 */
export interface FieldCell {
  field: string
  column: FieldColumn | ForeignKeyColumn
}

/** Alto mínimo del panel (FR-022). */
export const FIELDS_PANEL_MIN_HEIGHT = 200

/** Alto máximo del panel (FR-022). */
export const FIELDS_PANEL_MAX_HEIGHT = 560

/** Alto del panel cuando no hay preferencia guardada. */
export const FIELDS_PANEL_DEFAULT_HEIGHT = 320

/** Paso del tirador con el teclado (FR-022). */
export const FIELDS_PANEL_STEP = 24

/**
 * Recorta un alto a los topes del panel.
 *
 * @param height Alto pedido, en píxeles.
 */
export function clampPanelHeight(height: number): number {
  if (!Number.isFinite(height)) return FIELDS_PANEL_DEFAULT_HEIGHT
  return Math.min(FIELDS_PANEL_MAX_HEIGHT, Math.max(FIELDS_PANEL_MIN_HEIGHT, Math.round(height)))
}

/** Estado y acciones del panel de campos. */
export interface FieldsPanelSlice {
  /** Si el panel está abierto (FR-023). */
  isFieldsPanelOpen: boolean
  /** Tabla cuyos campos muestra el panel, o `null`. */
  fieldsPanelTable: string | null
  /** Alto actual, espejo de la preferencia, recortado a `[200, 560]`. */
  fieldsPanelHeight: number
  /** Celda enfocada de la rejilla, o `null` (FR-044). */
  focusedCell: FieldCell | null
  /** Ficha a la vista del panel (FR-003). */
  panelTab: PanelTab
  openFieldsPanel: (table?: string, cell?: FieldCell, tab?: PanelTab) => void
  closeFieldsPanel: () => void
  setFieldsPanelHeight: (height: number, commit?: boolean) => void
  focusCell: (cell: FieldCell | null) => void
  setPanelTab: (tab: PanelTab) => void
}

/**
 * Crea la parte del panel de campos.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createFieldsPanelSlice: AppSlice<FieldsPanelSlice> = (set, get) => ({
  isFieldsPanelOpen: false,
  fieldsPanelTable: null,
  fieldsPanelHeight: FIELDS_PANEL_DEFAULT_HEIGHT,
  focusedCell: null,
  panelTab: 'fields',

  /**
   * Abre el panel sobre una tabla y, si se dice, enfoca una celda (FR-007,
   * FR-023, FR-044).
   *
   * @param table Tabla que mostrar; sin ella, la seleccionada.
   * @param cell Celda que enfocar al abrir.
   * @param tab Ficha en la que abrirse; sin ella, «Campos» (FR-003).
   */
  openFieldsPanel(table, cell, tab) {
    const name = table ?? get().selectedTable
    if (name === null) return
    set({
      isFieldsPanelOpen: true,
      fieldsPanelTable: name,
      focusedCell: cell ?? null,
      panelTab: tab ?? 'fields',
      selectedTable: name,
      selectedSchema: null,
    })
  },

  /** Cierra el panel y conserva la selección (FR-023). */
  closeFieldsPanel() {
    set({ isFieldsPanelOpen: false, focusedCell: null })
  },

  /**
   * Cambia el alto del panel, recortado a sus topes (FR-022).
   *
   * @param height Alto pedido, en píxeles.
   * @param commit Si además se escribe la preferencia; al soltar el tirador.
   */
  setFieldsPanelHeight(height, commit = false) {
    const next = clampPanelHeight(height)
    set({ fieldsPanelHeight: next })
    if (!commit) return
    void preferencesUpdate({ fieldsPanelHeight: next }).catch(() => undefined)
  },

  /**
   * Enfoca una celda de la rejilla, o suelta el foco.
   *
   * @param cell Celda, o `null`.
   */
  focusCell(cell) {
    set({ focusedCell: cell })
  },

  /**
   * Cambia de ficha y suelta el foco (FR-003).
   *
   * El foco se suelta porque la celda enfocada es de la rejilla que se va: la
   * ficha nueva enfoca la suya cuando el usuario entra en ella.
   *
   * @param tab Ficha que mostrar.
   */
  setPanelTab(tab) {
    if (get().panelTab === tab) return
    set({ panelTab: tab, focusedCell: null })
  },
})
