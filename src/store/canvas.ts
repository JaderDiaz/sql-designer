import type { Rect } from '@/lib/canvas/constants'
import { contentBounds, schemaZones } from '@/lib/canvas/geometry'
import { resolveLayout } from '@/lib/canvas/layout'
import { clampZoom, fitToContent, zoomAt } from '@/lib/canvas/zoom'
import type { Position } from '@/lib/model/types'
import { CommandError, preferencesUpdate } from '@/lib/tauri/commands'
import type { AppSlice } from '@/store/types'

/**
 * Parte del lienzo: la vista, el foco, la selección y qué zonas de la ventana
 * están escondidas.
 *
 * Nada de esto es del modelo y nada se escribe en su archivo (FR-014, FR-032):
 * la vista es de la sesión y la disposición de la instalación. Las zonas no se
 * guardan aquí tampoco: se derivan del modelo con las funciones puras de
 * `src/lib/canvas/` cada vez que hacen falta (research R4).
 */

/** Caja del lienzo cuando todavía no se ha medido ninguna. */
export const DEFAULT_VIEWPORT: Rect = { x: 0, y: 0, width: 1200, height: 700 }

/** Cuánto cambia el zoom cada pulsación de los botones − y + (FR-008). */
export const ZOOM_STEP = 0.1

/** Estado y acciones de la parte del lienzo. */
export interface CanvasSlice {
  /** Desplazamiento de la vista, en píxeles de pantalla. */
  pan: Position
  /** Escala del lienzo, ya recortada a los topes de `clampZoom`. */
  zoom: number
  /**
   * Caja del lienzo tal como la mide el componente.
   *
   * Es una medida, no una preferencia: el lienzo la reporta al montarse y
   * cuando la ventana cambia de tamaño, y de ella salen «Ajustar», el centrado
   * del foco y la escala del minimapa.
   */
  viewport: Rect
  /** Nombre técnico del esquema enfocado, o `null` (FR-029 a FR-032). */
  focusedSchema: string | null
  /** Nombre técnico del esquema seleccionado: lo que mira el inspector. */
  selectedSchema: string | null
  /** Si hay un gesto en curso; el lienzo pinta sin sombras (research R19). */
  isGesturing: boolean
  /**
   * Si la vista está esperando su encuadre inicial (FR-014).
   *
   * Abrir un modelo no puede encuadrarlo todavía: la caja del lienzo no está
   * medida hasta que el componente monta. Así que el modelo lo pide y el
   * lienzo lo cumple con la primera medida.
   */
  needsFit: boolean
  /** La barra lateral está escondida (FR-006). */
  isSidebarHidden: boolean
  /** El inspector está escondido (FR-006). */
  isInspectorHidden: boolean
  setViewport: (viewport: Rect) => void
  requestFit: () => void
  setView: (view: { pan: Position; zoom: number }) => void
  panBy: (delta: Position) => void
  centerOn: (point: Position) => void
  zoomBy: (delta: number, pointer?: Position) => void
  zoomTo: (zoom: number, pointer?: Position) => void
  fitToModel: () => void
  focusSchema: (name: string | null) => void
  selectSchema: (name: string | null) => void
  setGesturing: (gesturing: boolean) => void
  applyLayoutPreferences: (layout: { sidebar: boolean; inspector: boolean }) => void
  toggleSidebar: () => Promise<void>
  toggleInspector: () => Promise<void>
}

/** Centro de una caja, que es el punto de zoom cuando no hay puntero. */
function centerOf(viewport: Rect): Position {
  return { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 }
}

/**
 * Crea la parte del lienzo.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createCanvasSlice: AppSlice<CanvasSlice> = (set, get) => ({
  pan: { x: 0, y: 0 },
  zoom: 1,
  viewport: DEFAULT_VIEWPORT,
  focusedSchema: null,
  selectedSchema: null,
  isGesturing: false,
  needsFit: false,
  isSidebarHidden: false,
  isInspectorHidden: false,

  /**
   * Registra la caja del lienzo medida por el componente.
   *
   * @param viewport Caja en píxeles de pantalla.
   */
  setViewport(viewport) {
    set({ viewport })
  },

  /** Pide que la vista se encuadre con la primera medida del lienzo (FR-014). */
  requestFit() {
    set({ needsFit: true })
  },

  /**
   * Fija la vista completa, recortando el zoom a los topes.
   *
   * @param view Desplazamiento y escala pedidos.
   */
  setView(view) {
    set({ pan: view.pan, zoom: clampZoom(view.zoom) })
  },

  /**
   * Mueve la vista sin cambiar el zoom (FR-007).
   *
   * @param delta Desplazamiento en píxeles de pantalla.
   */
  panBy(delta) {
    const { pan } = get()
    set({ pan: { x: pan.x + delta.x, y: pan.y + delta.y } })
  },

  /**
   * Deja un punto del modelo en el centro del lienzo (FR-012).
   *
   * Es lo que hace el minimapa al pulsarlo: la vista salta a donde se señala
   * sin cambiar la escala.
   *
   * @param point Punto en coordenadas del modelo.
   */
  centerOn(point) {
    const { zoom, viewport } = get()
    const center = centerOf(viewport)
    set({ pan: { x: center.x - point.x * zoom, y: center.y - point.y * zoom } })
  },

  /**
   * Suma al zoom actual conservando el punto que hay bajo el puntero (FR-008,
   * FR-009).
   *
   * @param delta Cuánto se suma al zoom; negativo aleja.
   * @param pointer Puntero en coordenadas del lienzo; sin él, su centro.
   */
  zoomBy(delta, pointer) {
    const { pan, zoom, viewport } = get()
    const next = zoomAt({ pan, zoom }, zoom + delta, pointer ?? centerOf(viewport))
    set({ pan: next.pan, zoom: next.zoom })
  },

  /**
   * Fija un zoom absoluto conservando el punto que hay bajo el puntero.
   *
   * @param zoom Zoom pedido, antes de recortar.
   * @param pointer Puntero en coordenadas del lienzo; sin él, su centro.
   */
  zoomTo(zoom, pointer) {
    const { pan, zoom: current, viewport } = get()
    const next = zoomAt({ pan, zoom: current }, zoom, pointer ?? centerOf(viewport))
    set({ pan: next.pan, zoom: next.zoom })
  },

  /** Deja todo el modelo a la vista, con su margen (FR-010, FR-011). */
  fitToModel() {
    const { model, viewport } = get()
    const bounds =
      model === null ? null : contentBounds(schemaZones(model, resolveLayout(model)))
    const next = fitToContent(bounds, viewport)
    set({ pan: next.pan, zoom: next.zoom, needsFit: false })
  },

  /**
   * Enfoca un esquema y centra el lienzo en su zona (FR-029, FR-031).
   *
   * El foco no filtra el modelo: filtra lo que se muestra. Quitarlo con `null`
   * deja la vista donde está, porque mover el lienzo sin que nadie lo pida
   * desorienta.
   *
   * @param name Nombre técnico del esquema, o `null` para quitar el foco.
   */
  focusSchema(name) {
    if (name === null) {
      set({ focusedSchema: null })
      return
    }

    const { model, viewport } = get()
    const zone =
      model === null
        ? undefined
        : schemaZones(model, resolveLayout(model)).find((candidate) => candidate.schema === name)
    if (zone === undefined) {
      set({ focusedSchema: null })
      return
    }

    const next = fitToContent(zone.rect, viewport)
    set({ focusedSchema: name, selectedSchema: name, pan: next.pan, zoom: next.zoom })
  },

  /**
   * Cambia lo que mira el inspector (FR-003).
   *
   * @param name Nombre técnico del esquema, o `null` para soltar la selección.
   */
  selectSchema(name) {
    set({ selectedSchema: name })
  },

  /**
   * Marca que hay un gesto en curso, para pintar sin sombras ni transiciones
   * mientras dura (SC-003, research R19).
   *
   * @param gesturing Si el gesto está en curso.
   */
  setGesturing(gesturing) {
    set({ isGesturing: gesturing })
  },

  /**
   * Aplica la disposición que traen las preferencias al arrancar (FR-006).
   *
   * @param layout Si cada zona quedó escondida la última vez.
   */
  applyLayoutPreferences(layout) {
    set({ isSidebarHidden: layout.sidebar, isInspectorHidden: layout.inspector })
  },

  /** Esconde o muestra la barra lateral y lo recuerda (FR-006). */
  async toggleSidebar() {
    const hidden = !get().isSidebarHidden
    // El cambio se ve antes de persistirse, porque esconder una zona tiene que
    // sentirse inmediato; si el disco no lo acepta, vuelve a donde estaba y la
    // causa queda a la vista, como en el tema.
    set({ isSidebarHidden: hidden })
    try {
      set({ preferences: await preferencesUpdate({ sidebarHidden: hidden }) })
    } catch (error) {
      set({ isSidebarHidden: !hidden, writeError: layoutError(error) })
    }
  },

  /** Esconde o muestra el inspector y lo recuerda (FR-006). */
  async toggleInspector() {
    const hidden = !get().isInspectorHidden
    set({ isInspectorHidden: hidden })
    try {
      set({ preferences: await preferencesUpdate({ inspectorHidden: hidden }) })
    } catch (error) {
      set({ isInspectorHidden: !hidden, writeError: layoutError(error) })
    }
  },
})

/**
 * Lo que se dice cuando la disposición no se pudo guardar.
 *
 * @param error Fallo que devolvió `preferences_update`.
 */
function layoutError(error: unknown): string {
  return error instanceof CommandError
    ? `No se pudo guardar la disposición: ${error.message}`
    : 'No se pudo guardar la disposición.'
}
