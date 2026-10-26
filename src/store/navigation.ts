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

/** Respuesta a la pregunta por los cambios sin guardar (FR-028). */
export type CloseAnswer = 'save' | 'discard' | 'cancel'

/** Estado y acciones de la parte de navegación. */
export interface NavigationSlice {
  screen: Screen
  dialog: Dialog | null
  pendingIntent: PendingIntent | null
  goToScreen: (screen: Screen) => void
  openDialog: (dialog: Dialog) => void
  closeDialog: () => void
  setPendingIntent: (intent: PendingIntent | null) => void
  requestClose: () => void
  requestIntent: (intent: PendingIntent) => void
  resolvePending: (answer: CloseAnswer) => Promise<void>
}

/**
 * Crea la parte de navegación del almacén.
 *
 * @param set Escritura del almacén compuesto.
 * @param get Lectura del almacén compuesto.
 */
export const createNavigationSlice: AppSlice<NavigationSlice> = (set, get) => ({
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

  /**
   * Cierra el modelo, preguntando primero si hay cambios sin guardar
   * (FR-027, FR-028).
   */
  requestClose() {
    get().requestIntent('close')
  },

  /**
   * Pide hacer algo que reemplaza o cierra el modelo abierto.
   *
   * Con cambios sin guardar no se hace nada todavía: se abre la pregunta y la
   * intención queda apuntada hasta que haya respuesta (FR-030). Sin modelo
   * abierto, o sin cambios, la intención se ejecuta en el momento.
   *
   * @param intent Qué se quería hacer.
   */
  requestIntent(intent) {
    const { model, isDirty } = get()
    if (model !== null && isDirty) {
      set({ pendingIntent: intent, dialog: 'confirm-close' })
      return
    }
    runIntent(intent, get)
  },

  /**
   * Responde a la pregunta por los cambios sin guardar (FR-028, FR-030).
   *
   * «Guardar» escribe y solo entonces continúa; si el guardado falla o pide
   * confirmación, la intención se queda esperando y no se pierde nada.
   * «No guardar» continúa sin escribir. «Cancelar» deja el Editor como
   * estaba, con sus cambios.
   *
   * @param answer Respuesta elegida en el diálogo.
   */
  async resolvePending(answer) {
    const intent = get().pendingIntent

    if (answer === 'cancel') {
      set({ dialog: null, pendingIntent: null })
      return
    }

    if (answer === 'save') {
      set({ dialog: null })
      const saved = await get().saveModel()
      if (!saved) return
    } else {
      set({ dialog: null })
    }

    set({ pendingIntent: null })
    if (intent !== null) runIntent(intent, get)
  },
})

/**
 * Ejecuta la intención que esperaba respuesta.
 *
 * @param intent Qué se quería hacer.
 * @param get Lectura del almacén compuesto.
 */
function runIntent(intent: PendingIntent, get: () => AppStateForIntent): void {
  if (intent === 'close') get().closeModel()
  else if (intent === 'new-model') get().openNewModel()
  else get().openOpenModel()
}

/** Lo que `runIntent` necesita del almacén. */
interface AppStateForIntent {
  closeModel: () => void
  openNewModel: () => void
  openOpenModel: () => void
}
