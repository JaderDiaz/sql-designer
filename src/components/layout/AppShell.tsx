import type { ReactNode } from 'react'

import { Titlebar } from '@/components/layout/Titlebar'

/** Props del armazón de ventana. */
export interface AppShellProps {
  children: ReactNode
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
export function AppShell({ children }: AppShellProps) {
  return (
    <div
      data-tauri-drag-region
      className="relative flex h-full flex-col overflow-hidden rounded-xl bg-window text-label shadow-[inset_0_0_0_0.5px_var(--border-subtle)]"
    >
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <Titlebar />
    </div>
  )
}
