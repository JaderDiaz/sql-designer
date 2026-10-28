import { useEffect } from 'react'

import { usePlatform } from '@/hooks/usePlatform'
import { isMacOS } from '@/lib/platform'
import { useAppStore } from '@/store'

/** Atajo declarado como tecla más modificadores. */
export interface Shortcut {
  /** Tecla, comparada sin distinguir mayúsculas (`n`, `o`, `,`). */
  key: string
  /** Si exige ⌘ en macOS o Ctrl en Windows. */
  meta?: boolean
  /** Si exige ⇧; `false` exige que **no** esté pulsada. */
  shift?: boolean
  /** Si exige ⌥ en macOS o Alt en Windows. Sin declarar, exige que no esté. */
  alt?: boolean
}

/**
 * Escucha un atajo mientras el componente está montado.
 *
 * @param shortcut Tecla y modificadores del atajo.
 * @param handler Qué hacer al activarlo.
 * @param enabled Si el atajo está activo; los del Editor solo lo están allí.
 */
export function useShortcut(shortcut: Shortcut, handler: () => void, enabled = true): void {
  const platform = usePlatform()

  useEffect(() => {
    if (!enabled) return undefined
    const mac = isMacOS(platform)

    const onKeyDown = (event: KeyboardEvent) => {
      if (!matches(event, shortcut.key)) return
      // Un atajo sin modificador no puede robarle la tecla a quien escribe:
      // `T` crea una tabla en el lienzo, pero dentro de una celda del editor
      // de campos escribe una «t» (FR-001, research R16).
      if (!shortcut.meta && isTypingTarget(event.target)) return
      if (shortcut.meta) {
        const pressed = mac ? event.metaKey : event.ctrlKey
        if (!pressed) return
      }
      if (shortcut.shift !== undefined && event.shiftKey !== shortcut.shift) return
      // ⌥ sin declarar es ⌥ sin pulsar: si no, ⌥⌘S guardaría el modelo además
      // de esconder la barra lateral.
      if (event.altKey !== (shortcut.alt ?? false)) return
      event.preventDefault()
      handler()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, handler, platform, shortcut.alt, shortcut.key, shortcut.meta, shortcut.shift])
}

/**
 * ¿El foco está en algo donde se escribe?
 *
 * @param target Destino de la pulsación.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * ¿Esta pulsación es la tecla del atajo?
 *
 * Se mira `event.key` y también `event.code`: con ⌥ pulsado macOS cambia el
 * carácter que produce la tecla —⌥S escribe «ß»—, así que un atajo con ⌥ solo
 * se reconoce por la posición física de la tecla.
 *
 * @param event Pulsación del teclado.
 * @param key Tecla declarada en el atajo.
 */
function matches(event: KeyboardEvent, key: string): boolean {
  if (event.key.toLowerCase() === key.toLowerCase()) return true
  const code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : null
  return code !== null && event.code === code
}

/**
 * Registra los atajos de la aplicación.
 *
 * `⌘N`/`Ctrl+N` abre Nuevo modelo (FR-002), `⌘O`/`Ctrl+O` abre Abrir modelo
 * (FR-012) y `⌘,`/`Ctrl+,` abre Ajustes, que es la tercera vía de FR-020. Los
 * dos primeros pasan por la pregunta de los cambios sin guardar cuando hay un
 * modelo editado (FR-030).
 *
 * `⌘S`, `⌘W`, `⌘Z` y `⇧⌘Z` (`Ctrl+S`, `Ctrl+W`, `Ctrl+Z` y `Ctrl+Y`) solo
 * escuchan con el Editor delante, para que en la Bienvenida no hagan nada
 * (FR-021, FR-027, FR-044, RS-12).
 *
 * ⌥⌘S y ⌥⌘I (Alt+Ctrl+S y Alt+Ctrl+I) esconden y muestran la barra lateral y
 * el inspector, también solo en el Editor (FR-006).
 */
export function useAppShortcuts(): void {
  const openPreferences = useAppStore((state) => state.openPreferences)
  const requestIntent = useAppStore((state) => state.requestIntent)
  const requestClose = useAppStore((state) => state.requestClose)
  const saveModel = useAppStore((state) => state.saveModel)
  const undo = useAppStore((state) => state.undo)
  const redo = useAppStore((state) => state.redo)
  const screen = useAppStore((state) => state.screen)
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)
  const toggleInspector = useAppStore((state) => state.toggleInspector)
  const openTableDialog = useAppStore((state) => state.openTableDialog)
  const duplicateTable = useAppStore((state) => state.duplicateTable)
  const openDeleteTableDialog = useAppStore((state) => state.openDeleteTableDialog)
  const openFieldsPanel = useAppStore((state) => state.openFieldsPanel)
  const closeFieldsPanel = useAppStore((state) => state.closeFieldsPanel)

  const inEditor = screen === 'editor'

  useShortcut({ key: 'n', meta: true }, () => requestIntent('new-model'))
  useShortcut({ key: 'o', meta: true }, () => requestIntent('open-model'))
  useShortcut({ key: ',', meta: true }, openPreferences)

  useShortcut({ key: 's', meta: true }, () => void saveModel(), inEditor)
  useShortcut({ key: 'w', meta: true }, requestClose, inEditor)
  useShortcut({ key: 'z', meta: true, shift: false }, undo, inEditor)
  useShortcut({ key: 'z', meta: true, shift: true }, redo, inEditor)
  // Windows usa Ctrl+Y para rehacer, además de Ctrl+⇧+Z (RS-12).
  useShortcut({ key: 'y', meta: true }, redo, inEditor)

  useShortcut({ key: 's', meta: true, alt: true }, () => void toggleSidebar(), inEditor)
  useShortcut({ key: 'i', meta: true, alt: true }, () => void toggleInspector(), inEditor)

  // Atajos del Incremento 3 (research R16): `T` crea una tabla, ⌘D duplica la
  // seleccionada, ⌫ pide confirmación para eliminarla y ⌥⌘E abre su editor de
  // campos. Los tres últimos solo hacen algo con una tabla seleccionada.
  useShortcut({ key: 't' }, () => openTableDialog(), inEditor)
  useShortcut(
    { key: 'd', meta: true },
    () => {
      const name = useAppStore.getState().selectedTable
      if (name !== null) duplicateTable(name)
    },
    inEditor,
  )
  useShortcut(
    { key: 'Backspace' },
    () => {
      const name = useAppStore.getState().selectedTable
      if (name !== null) openDeleteTableDialog(name)
    },
    inEditor,
  )
  useShortcut(
    { key: 'Delete' },
    () => {
      const name = useAppStore.getState().selectedTable
      if (name !== null) openDeleteTableDialog(name)
    },
    inEditor,
  )
  useShortcut(
    { key: 'e', meta: true, alt: true },
    () => {
      const { selectedTable, isFieldsPanelOpen } = useAppStore.getState()
      if (isFieldsPanelOpen) closeFieldsPanel()
      else if (selectedTable !== null) openFieldsPanel(selectedTable)
    },
    inEditor,
  )
}
