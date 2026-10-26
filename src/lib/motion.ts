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

/** Curva de entrada de Aura (`--easing-in`), para lo que se va. */
const EASE_IN = [0.4, 0, 1, 1] as const

/**
 * Cuánto tarda una pantalla en irse, en milisegundos.
 *
 * Es también lo que espera la ventana antes de encoger al volver a la
 * Bienvenida: primero se va el Editor y después se recoge la ventana, nunca
 * las dos cosas a la vez (`src/App.tsx`).
 */
export const SCREEN_EXIT_MS = 160

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

/**
 * Pantalla entera: entra desde un poco más atrás, como si se acercara, y se
 * va igual de deprisa para no cruzarse con la que llega.
 *
 * Acompaña al cambio de tamaño de la ventana, que ocurre a la vez: la ventana
 * crece y el contenido se asienta en lugar de aparecer ya colocado.
 */
export const screenIn: Variants = {
  hidden: { opacity: 0, scale: 0.99 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.42, ease: EASE_OUT, staggerChildren: 0.055, delayChildren: 0.06 },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    transition: { duration: SCREEN_EXIT_MS / 1000, ease: EASE_IN },
  },
}

/** Panel que entra desde su borde izquierdo. */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.38, ease: EASE_OUT } },
}
