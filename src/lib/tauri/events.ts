import { listen } from '@tauri-apps/api/event'

/** Evento que emite el elemento Ajustes del menú nativo (FR-020). */
export const PREFERENCES_OPEN_EVENT = 'preferences://open'

/** Evento con el que la ventana pide permiso para cerrarse (FR-028). */
export const CLOSE_REQUESTED_EVENT = 'window://close-requested'

/**
 * Escucha el evento del menú nativo y llama al manejador recibido.
 *
 * Las tres vías de FR-020 —atajo, menú y control visible— acaban en la misma
 * acción del almacén; esta función solo conecta la del menú.
 *
 * @param handler Qué hacer cuando el menú pide abrir Ajustes.
 * @returns Función para dejar de escuchar.
 */
export function onPreferencesOpen(handler: () => void): () => void {
  let stop: (() => void) | undefined
  let cancelled = false

  void listen(PREFERENCES_OPEN_EVENT, () => handler()).then((unlisten) => {
    if (cancelled) {
      unlisten()
      return
    }
    stop = unlisten
  })

  return () => {
    cancelled = true
    stop?.()
  }
}

/**
 * Escucha el intento de cerrar la ventana (FR-028).
 *
 * Rust para el cierre y emite este evento solo cuando la interfaz ha dicho
 * que hay cambios sin guardar; el manejador pregunta y, con la respuesta,
 * vuelve a pedir el cierre con `windowControls('close')`.
 *
 * @param handler Qué hacer cuando la ventana quiere cerrarse.
 * @returns Función para dejar de escuchar.
 */
export function onCloseRequested(handler: () => void): () => void {
  let stop: (() => void) | undefined
  let cancelled = false

  void listen(CLOSE_REQUESTED_EVENT, () => handler()).then((unlisten) => {
    if (cancelled) {
      unlisten()
      return
    }
    stop = unlisten
  })

  return () => {
    cancelled = true
    stop?.()
  }
}
