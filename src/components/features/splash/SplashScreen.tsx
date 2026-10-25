import { motion } from 'framer-motion'

import { AppIcon } from '@/components/ui/AppIcon'

/**
 * Pantalla de carga: se ve desde el primer fotograma y cubre el tiempo que
 * tardan las preferencias, la identidad y la plataforma en llegar de Rust,
 * para que la ventana no muestre media interfaz a medio montar (SC-001).
 *
 * Solo lleva identidad y una barra indeterminada; nada que dependa de datos
 * que todavía no han llegado.
 */
export function SplashScreen() {
  return (
    <motion.div
      key="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full w-full flex-col items-center justify-center gap-5 bg-window"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.38, ease: [0.34, 1.15, 0.5, 1] }}
      >
        <AppIcon size={72} />
      </motion.div>

      <div className="flex flex-col items-center gap-3">
        <p className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-label">
          SQL Designer
        </p>
        <div role="progressbar" aria-label="Abriendo SQL Designer" className="sm-splash-track">
          <span className="sm-splash-bar" />
        </div>
      </div>
    </motion.div>
  )
}
