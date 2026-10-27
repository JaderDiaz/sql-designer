import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { Titlebar } from '@/components/layout/Titlebar'

/** Props del armazón de ventana. */
export interface AppShellProps {
  children: ReactNode
  /**
   * Si el armazón dibuja los controles de ventana. El Editor los trae en su
   * propia cabecera, donde el círculo rojo cierra el modelo (FR-027).
   */
  showTitlebar?: boolean
}

/**
 * Armazón de la ventana: dibuja el marco —esquinas de 16 px y un filo gris
 * de medio píxel— porque la ventana va sin decoración del sistema, y coloca
 * encima los controles de cerrar y minimizar.
 *
 * Las zonas libres arrastran la ventana (`data-tauri-drag-region`), que es la
 * única forma de moverla sin barra de título del sistema.
 *
 * Ocupa exactamente el alto de la ventana y nunca desplaza; quien desplaza es
 * la `ScrollRegion` que envuelva cada pantalla (RS-01). Los avisos flotan
 * sobre la pantalla como toasts; no hay pie fijo.
 */
export function AppShell({ children, showTitlebar = true }: AppShellProps) {
  return (
    <div
      data-tauri-drag-region
      className="relative flex h-full flex-col overflow-hidden rounded-xl bg-window text-label shadow-[inset_0_0_0_var(--hairline)_var(--border-subtle)]"
    >
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      {/* Las luces se desvanecen con la pantalla que las trae: el Editor pinta
          las suyas en su propia cabecera y sin esto desaparecían de golpe. */}
      <AnimatePresence>
        {showTitlebar ? (
          <motion.div
            key="titlebar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.24, delay: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <Titlebar />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
