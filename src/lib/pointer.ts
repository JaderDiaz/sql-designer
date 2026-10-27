/**
 * Ayuda común de los gestos de puntero.
 */

/**
 * Captura el puntero si el navegador deja, y si no, sigue sin capturarlo.
 *
 * Un `pointerId` que el navegador no reconoce —un evento sintético, o un
 * puntero que ya se soltó— hace que `setPointerCapture` lance, y el gesto se
 * quedaría sin empezar por algo que solo es una mejora: con captura, los
 * eventos siguen llegando aunque el puntero salga del elemento.
 *
 * @param node Elemento que quiere la captura.
 * @param pointerId Puntero del evento.
 */
export function capturePointer(node: Element, pointerId: number): void {
  try {
    node.setPointerCapture(pointerId)
  } catch {
    // Sin captura el gesto funciona igual mientras el puntero no se salga.
  }
}
