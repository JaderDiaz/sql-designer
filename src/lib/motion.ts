import type { Variants } from 'framer-motion'

/**
 * Variantes de entrada compartidas por las pantallas.
 *
 * El movimiento es corto y hacia su sitio: nada entra desde fuera de la
 * ventana. `MotionConfig reducedMotion="user"` las anula cuando el sistema
 * pide menos movimiento (FR-010).
 */

/** Curva de salida de Aura (`--easing-out`). */
const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Contenedor que escalona la entrada de sus hijos. */
export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
}

/** Hijo que sube unos píxeles al aparecer. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE_OUT } },
}

/** Panel que entra desde su borde izquierdo. */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.38, ease: EASE_OUT } },
}
