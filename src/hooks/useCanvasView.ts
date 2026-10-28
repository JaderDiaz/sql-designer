import { useCallback, useEffect, useRef, type RefObject } from 'react'

import type { View } from '@/lib/canvas/constants'
import { zoomAt } from '@/lib/canvas/zoom'
import { capturePointer } from '@/lib/pointer'
import { useAppStore } from '@/store'
import { ZOOM_STEP } from '@/store/canvas'

/**
 * Mover la vista del lienzo, hacer zoom y soltar el foco, con las tres formas
 * de mover y las cuatro de acercar (FR-007 a FR-011, FR-031, FR-039).
 *
 * El gesto no pasa por el almacén mientras dura: la vista viva se escribe
 * directamente en el `transform` del nodo del modelo y en el fondo de rejilla,
 * y solo se comitea al almacén tras 120 ms sin más ruedas o al soltar el
 * puntero. Así una rueda sostenida no provoca un render por evento y el
 * historial de la sesión no se llena de pasos intermedios (research R3, R9).
 */

/** Cuánto se espera sin ruedas antes de escribir la vista en el almacén. */
const COMMIT_DELAY = 120

/** Cuánto mueve la vista cada pulsación de una flecha (FR-039). */
const ARROW_STEP = 60

/** Cuánto zoom da cada unidad de rueda con ⌘ o con el pellizco. */
const WHEEL_ZOOM = 0.002

/** Hasta cuántos píxeles de recorrido un gesto sobre el fondo sigue siendo un clic. */
const CLICK_SLOP = 3

/** Franja del borde en la que arrastrar algo empieza a mover la vista. */
const EDGE_BAND = 48

/** Cuánto mueve la vista cada evento del puntero dentro de esa franja. */
const EDGE_SPEED = 12

/** Nodos del lienzo que el gesto escribe directamente. */
export interface CanvasNodes {
  /** El nodo que recorta y recibe el foco. */
  surface: RefObject<HTMLDivElement | null>
  /** El nodo que desplaza la vista; es el que vive en una capa. */
  frame: RefObject<HTMLDivElement | null>
  /** El nodo que escala el modelo, dentro del anterior. */
  stage: RefObject<HTMLDivElement | null>
  /** El fondo de rejilla, que acompaña a la vista. */
  grid: RefObject<HTMLDivElement | null>
}

/** Lo que el lienzo necesita del gesto. */
export interface CanvasViewGestures {
  /** Si la barra espaciadora está mantenida: entonces todo arrastre mueve. */
  isPanning: () => boolean
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  /**
   * Mueve la vista cuando un arrastre ajeno llega al borde del lienzo.
   *
   * La llama quien arrastra una tabla o una zona, no el gesto de la vista: así
   * se puede dejar algo fuera de lo que se veía al empezar (US4, escenario 7).
   */
  edgeFollow: (clientX: number, clientY: number) => void
  /**
   * Cierra el seguimiento del borde al soltar lo que se arrastraba.
   *
   * Suelta la caja del lienzo que {@link CanvasViewGestures.edgeFollow} mide
   * una vez por gesto.
   */
  endEdgeFollow: () => void
}

export function useCanvasView({ surface, frame, stage, grid }: CanvasNodes): CanvasViewGestures {
  const setView = useAppStore((state) => state.setView)
  const setGesturing = useAppStore((state) => state.setGesturing)
  const zoomTo = useAppStore((state) => state.zoomTo)
  const fitToModel = useAppStore((state) => state.fitToModel)
  const focusSchema = useAppStore((state) => state.focusSchema)

  /** Vista viva del gesto, o `null` si la del almacén es la verdadera. */
  const live = useRef<View | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Barra espaciadora mantenida (FR-007). */
  const space = useRef(false)
  /**
   * Caja del lienzo, medida una sola vez por gesto ajeno.
   *
   * `getBoundingClientRect` obliga al navegador a recalcular el estilo y la
   * disposición en el momento, y quien arrastra la llamaba por cuadro justo
   * después de escribir las variables del gesto: con 50 tablas y 60 relaciones
   * en el lienzo, ese recálculo forzado costaba más que volver a trazar las
   * líneas y se comía el presupuesto de los 16 ms (SC-003). La caja no cambia
   * mientras el gesto dura, así que se mide al primer cuadro y se suelta al
   * acabar.
   */
  const edgeBox = useRef<DOMRect | null>(null)
  /**
   * Arrastre que mueve la vista, con el puntero que lo lleva.
   *
   * Guarda también desde dónde salió: un toque en el fondo que no llega a
   * moverse no es un arrastre, es el clic que suelta el foco (FR-031).
   */
  const drag = useRef<{
    pointerId: number
    x: number
    y: number
    /** De dónde salió el gesto, para saber si llegó a moverse. */
    startX: number
    startY: number
    onBackground: boolean
  } | null>(null)

  /** La vista que vale ahora mismo: la del gesto si hay uno. */
  const currentView = useCallback((): View => {
    if (live.current !== null) return live.current
    const { pan, zoom } = useAppStore.getState()
    return { pan, zoom }
  }, [])

  /** Pinta la vista en el DOM sin tocar el almacén. */
  const paint = useCallback(
    (view: View) => {
      live.current = view
      const frameNode = frame.current
      if (frameNode !== null) {
        frameNode.style.transform = `translate(${view.pan.x}px, ${view.pan.y}px)`
      }
      const stageNode = stage.current
      if (stageNode !== null) {
        stageNode.style.transform = `scale(${view.zoom})`
      }
      const gridNode = grid.current
      if (gridNode !== null) {
        gridNode.style.backgroundSize = `${24 * view.zoom}px ${24 * view.zoom}px`
        gridNode.style.backgroundPosition = `${view.pan.x}px ${view.pan.y}px`
      }
    },
    [frame, grid, stage],
  )

  /** Escribe la vista viva en el almacén y cierra el gesto. */
  const commit = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const view = live.current
    live.current = null
    setGesturing(false)
    if (view !== null) setView(view)
  }, [setGesturing, setView])

  /** Aplaza el comiteo mientras el gesto siga llegando. */
  const schedule = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(commit, COMMIT_DELAY)
  }, [commit])

  /** El puntero en coordenadas del lienzo, que es donde vive la vista. */
  const pointerOf = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const box = surface.current?.getBoundingClientRect()
      return {
        x: event.clientX - (box?.left ?? 0),
        y: event.clientY - (box?.top ?? 0),
      }
    },
    [surface],
  )

  // La rueda y el teclado se escuchan en el nodo, no en React: la rueda tiene
  // que poder cancelarse (`passive: false`) para que ⌘ + rueda haga zoom en
  // lugar de agrandar la ventana del sistema (research R9).
  useEffect(() => {
    const node = surface.current
    if (node === null) return undefined

    /** ⌘/Ctrl + rueda y el pellizco hacen zoom; la rueda sola mueve. */
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      setGesturing(true)
      const view = currentView()

      if (event.ctrlKey || event.metaKey) {
        // El pellizco del panel táctil llega como una rueda con `ctrlKey`, así
        // que el mismo camino sirve para los dos (FR-009).
        const factor = Math.exp(-event.deltaY * WHEEL_ZOOM)
        paint(zoomAt(view, view.zoom * factor, pointerOf(event)))
      } else {
        paint({
          pan: { x: view.pan.x - event.deltaX, y: view.pan.y - event.deltaY },
          zoom: view.zoom,
        })
      }
      schedule()
    }

    /** El autoscroll de Windows se come el arrastre con la rueda pulsada. */
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault()
    }
    const onAuxClick = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // Esc suelta el foco del esquema y deja la vista donde está (FR-031).
      if (event.key === 'Escape') {
        if (useAppStore.getState().focusedSchema !== null) {
          event.preventDefault()
          focusSchema(null)
        }
        return
      }

      if (event.code === 'Space' && !event.repeat) {
        space.current = true
        node.dataset.space = ''
        event.preventDefault()
        return
      }

      const step = event.shiftKey ? ARROW_STEP * 3 : ARROW_STEP
      const arrows: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: step, y: 0 },
        ArrowRight: { x: -step, y: 0 },
        ArrowUp: { x: 0, y: step },
        ArrowDown: { x: 0, y: -step },
      }
      const arrow = arrows[event.key]
      if (arrow !== undefined && !event.metaKey && !event.ctrlKey) {
        // Con una tabla seleccionada las flechas la mueven, no la vista: el
        // lienzo se encarga de eso en su propio manejador (FR-034).
        if (useAppStore.getState().selectedTable !== null) return
        event.preventDefault()
        const view = currentView()
        paint({ pan: { x: view.pan.x + arrow.x, y: view.pan.y + arrow.y }, zoom: view.zoom })
        schedule()
        return
      }

      if (event.metaKey || event.ctrlKey) {
        // ⌘+ llega como «+» o como «=» según la distribución del teclado.
        if (event.key === '+' || event.key === '=') {
          event.preventDefault()
          commit()
          zoomTo(useAppStore.getState().zoom + ZOOM_STEP)
          return
        }
        if (event.key === '-') {
          event.preventDefault()
          commit()
          zoomTo(useAppStore.getState().zoom - ZOOM_STEP)
          return
        }
        if (event.key === '0') {
          event.preventDefault()
          commit()
          zoomTo(1)
          return
        }
      }

      if (event.shiftKey && event.code === 'Digit1') {
        event.preventDefault()
        commit()
        fitToModel()
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      space.current = false
      delete node.dataset.space
    }

    // Si la ventana pierde el foco con la barra abajo, nunca llega su `keyup`:
    // el lienzo se quedaría convencido de que sigue pulsada.
    const onBlur = () => {
      space.current = false
      delete node.dataset.space
    }

    node.addEventListener('wheel', onWheel, { passive: false })
    node.addEventListener('mousedown', onMouseDown)
    node.addEventListener('auxclick', onAuxClick)
    node.addEventListener('keydown', onKeyDown)
    node.addEventListener('keyup', onKeyUp)
    node.addEventListener('blur', onBlur)
    window.addEventListener('blur', onBlur)

    return () => {
      node.removeEventListener('wheel', onWheel)
      node.removeEventListener('mousedown', onMouseDown)
      node.removeEventListener('auxclick', onAuxClick)
      node.removeEventListener('keydown', onKeyDown)
      node.removeEventListener('keyup', onKeyUp)
      node.removeEventListener('blur', onBlur)
      window.removeEventListener('blur', onBlur)
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [
    commit,
    currentView,
    fitToModel,
    focusSchema,
    paint,
    pointerOf,
    schedule,
    setGesturing,
    surface,
    zoomTo,
  ])

  return {
    isPanning: () => space.current,

    edgeFollow(clientX, clientY) {
      const box = edgeBox.current ?? surface.current?.getBoundingClientRect() ?? null
      if (box === null) return
      edgeBox.current = box
      const push = (distance: number): number => {
        if (distance >= EDGE_BAND) return 0
        // Cuanto más cerca del borde, más corre: a medio camino de la franja
        // va a la mitad de velocidad.
        return (EDGE_SPEED * (EDGE_BAND - Math.max(0, distance))) / EDGE_BAND
      }
      const dx = push(clientX - box.left) - push(box.right - clientX)
      const dy = push(clientY - box.top) - push(box.bottom - clientY)
      if (dx === 0 && dy === 0) return
      const view = currentView()
      paint({ pan: { x: view.pan.x + dx, y: view.pan.y + dy }, zoom: view.zoom })
      schedule()
    },

    endEdgeFollow() {
      edgeBox.current = null
    },

    /**
     * Empieza a mover la vista de las tres formas de FR-007: arrastrando desde
     * un espacio vacío, con la rueda pulsada o con la barra espaciadora
     * mantenida. Las dos últimas valen también encima de una tabla o de una
     * zona; la primera, solo sobre el fondo.
     */
    onPointerDown(event) {
      if (drag.current !== null) return
      const onBackground = event.target === surface.current || event.target === grid.current
      const wheelButton = event.button === 1
      if (!wheelButton && !space.current && !(event.button === 0 && onBackground)) return

      capturePointer(event.currentTarget, event.pointerId)
      drag.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        onBackground: onBackground && event.button === 0,
      }
      setGesturing(true)
    },

    onPointerMove(event) {
      const current = drag.current
      if (current === null || event.pointerId !== current.pointerId) return
      const view = currentView()
      paint({
        pan: {
          x: view.pan.x + (event.clientX - current.x),
          y: view.pan.y + (event.clientY - current.y),
        },
        zoom: view.zoom,
      })
      current.x = event.clientX
      current.y = event.clientY
    },

    onPointerUp(event) {
      const current = drag.current
      if (current === null || event.pointerId !== current.pointerId) return
      drag.current = null
      commit()
      // Pulsar el fondo sin arrastrarlo suelta el foco del esquema y deja el
      // lienzo como estaba al abrir el modelo (FR-031). Un clic real casi
      // siempre mueve el puntero un pelo, así que lo que decide es cuánto.
      const quieto =
        Math.abs(event.clientX - current.startX) <= CLICK_SLOP &&
        Math.abs(event.clientY - current.startY) <= CLICK_SLOP
      if (current.onBackground && quieto) focusSchema(null)
    },
  }
}
