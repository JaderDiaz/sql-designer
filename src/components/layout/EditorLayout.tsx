import type { ReactNode } from 'react'

/** Ancho de la barra lateral, del tablero `Editor` del lienzo. */
export const SIDEBAR_WIDTH = 248

/** Ancho del inspector. */
export const INSPECTOR_WIDTH = 300

/** Props del marco del Editor. */
export interface EditorLayoutProps {
  /** Barra superior: modelo, acciones y las dos zonas escondibles. */
  chrome: ReactNode
  /** Barra lateral con esquemas y tablas (FR-002). */
  sidebar: ReactNode
  /** El lienzo, que ocupa todo lo que las demás zonas dejan libre. */
  canvas: ReactNode
  /** Inspector de lo seleccionado (FR-003). */
  inspector: ReactNode
  /** Barra de estado (FR-004). */
  statusBar: ReactNode
  /** Si la barra lateral está escondida (FR-006). */
  isSidebarHidden: boolean
  /** Si el inspector está escondido (FR-006). */
  isInspectorHidden: boolean
}

/**
 * Las cinco zonas del Editor (FR-001, tablero `Editor` del lienzo).
 *
 * La barra lateral va a la izquierda de todo y de arriba abajo, como una
 * tarjeta con su propio aire: es el navegador del modelo y no cuelga de la
 * barra superior, que empieza a su derecha. El inspector llega también hasta
 * abajo, y la barra de estado habla solo del lienzo, así que va debajo de él y
 * no cruza por debajo del inspector.
 *
 * La barra lateral y el inspector se pueden esconder, y entonces salen del
 * árbol en lugar de quedarse con ancho cero: así el lienzo recibe de verdad
 * ese espacio y nada invisible sigue recibiendo el foco del tabulador
 * (FR-006).
 */
export function EditorLayout({
  chrome,
  sidebar,
  canvas,
  inspector,
  statusBar,
  isSidebarHidden,
  isInspectorHidden,
}: EditorLayoutProps) {
  return (
    <div className="flex h-full min-h-0 w-full bg-window">
      {isSidebarHidden ? null : (
        <nav
          aria-label="Esquemas y tablas del modelo"
          style={{ width: SIDEBAR_WIDTH }}
          className="m-2 flex min-h-0 flex-none flex-col overflow-hidden rounded-[10px] bg-sidebar shadow-[0_0_0_0.5px_var(--separator)]"
        >
          {sidebar}
        </nav>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {chrome}

        <div className="flex min-h-0 flex-1">
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            {canvas}
            {statusBar}
          </div>

          {isInspectorHidden ? null : (
            <aside
              aria-label="Inspector"
              style={{ width: INSPECTOR_WIDTH }}
              className="flex min-h-0 flex-none flex-col border-l-[0.5px] border-separator bg-window"
            >
              {inspector}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
