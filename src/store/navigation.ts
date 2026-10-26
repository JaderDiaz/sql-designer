import type { AppSlice } from '@/store/types'

/**
 * Parte de navegación del almacén: qué pantalla se ve, qué diálogo está
 * abierto encima y qué intención quedó esperando una confirmación.
 *
 * No hay enrutador ni URLs en una aplicación de escritorio de una sola
 * ventana, así que la pantalla es estado de aplicación (research.md R12): los
 * atajos y los diálogos la cambian sin pasar propiedades por tres niveles.
 */

/** Pantallas de la aplicación. */
export type Screen = 'welcome' | 'editor'

/**
 * Diálogos que se pueden abrir encima de la pantalla.
 *
 * `choose-folder` se abre encima de `new-model` sin cerrarlo, de modo que el
 * borrador del modelo nuevo sobrevive a elegir la carpeta.
 */
export type Dialog =
  | 'new-model'
  | 'choose-folder'
  | 'open-model'
  | 'rename'
  | 'confirm-close'
  | 'file-error'
  | 'not-found'
  | 'trash'
  | 'stale'

/**
 * Qué se quería hacer cuando se preguntó por los cambios sin guardar, para
 * retomarlo si el usuario responde «Guardar» o «No guardar» (FR-030).
 */
export type PendingIntent = 'new-model' | 'open-model' | 'close'

/** Estado y acciones de la parte de navegación. */
export interface NavigationSlice {
  screen: Screen
  dialog: Dialog | null
  pendingIntent: PendingIntent | null
  goToScreen: (screen: Screen) => void
  openDialog: (dialog: Dialog) => void
  closeDialog: () => void
  setPendingIntent: (intent: PendingIntent | null) => void
}

/**
 * Crea la parte de navegación del almacén.
 *
 * @param set Escritura del almacén compuesto.
 */
export const createNavigationSlice: AppSlice<NavigationSlice> = (set) => ({
  screen: 'welcome',
  dialog: null,
  pendingIntent: null,

  /**
   * Cambia de pantalla y cierra cualquier diálogo abierto, para que un
   * diálogo de la pantalla anterior no quede encima de la nueva.
   *
   * @param screen Pantalla que se quiere mostrar.
   */
  goToScreen(screen) {
    set({ screen, dialog: null })
  },

  /**
   * Abre un diálogo encima de la pantalla actual.
   *
   * @param dialog Diálogo que se quiere mostrar.
   */
  openDialog(dialog) {
    set({ dialog })
  },

  /** Cierra el diálogo abierto, si hay alguno. */
  closeDialog() {
    set({ dialog: null })
  },

  /**
   * Guarda o limpia la intención que espera una confirmación.
   *
   * @param intent Qué hacer al resolver la pregunta, o `null` para olvidarla.
   */
  setPendingIntent(intent) {
    set({ pendingIntent: intent })
  },
})
